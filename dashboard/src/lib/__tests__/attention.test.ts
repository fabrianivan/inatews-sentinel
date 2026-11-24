import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTENTION_MEANING,
  ATTENTION_SCALE,
  ruleDepthLabel,
  assessAttention,
  attentionToRiskLevel,
  collectQuakeFacts,
  shortRegion,
  summarizeDays,
} from '../attention';
import type { BMKGGempaDetail, SeismicEvent } from '../types';

const NOW = Date.parse('2026-11-16T10:00:00Z'); // 17:00 WIB
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function latest(overrides: Partial<BMKGGempaDetail> = {}): BMKGGempaDetail {
  return {
    Tanggal: '16 Nov 2026',
    Jam: '16:00:00 WIB',
    DateTime: new Date(NOW - HOUR).toISOString(),
    Coordinates: '-5.41,104.60',
    Lintang: '5.41 LS',
    Bujur: '104.60 BT',
    Magnitude: '3.8',
    Kedalaman: '10 km',
    Wilayah: 'Pusat gempa berada di darat 12 km BaratDaya Tanggamus',
    Potensi: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    Dirasakan: 'III Tanggamus',
    ...overrides,
  };
}

function recent(magnitude: number, ageMs: number, depth = 10, extra: Partial<SeismicEvent> = {}): SeismicEvent {
  return {
    type: 'SEISMIC',
    magnitude,
    depth,
    frequency: 0,
    count: 1,
    latitude: -6.5,
    longitude: 130.2,
    mmi: 0,
    pga: 0,
    fault_zone: 'Laut Banda',
    timestamp: new Date(NOW - ageMs).toISOString(),
    ...extra,
  };
}

test('regression: a 19-day-old deep M6.4 no longer raises the level above a routine M3.8', () => {
  const result = assessAttention({
    latest: latest(),
    recent: [recent(6.4, 19 * DAY, 160)],
    feed: 'live',
    now: NOW,
  });
  assert.equal(result.level, 'rutin');
  assert.equal(result.driver, null);
  assert.equal(result.expiresAtMs, null);
  assert.equal(result.counts.last24h, 0);
  assert.equal(result.counts.last7d, 0);
});

test('shallow events inside 24 hours set the level; the window boundary is exact', () => {
  const at = (magnitude: number, ageMs: number, depth = 10) =>
    assessAttention({ latest: latest(), recent: [recent(magnitude, ageMs, depth)], feed: 'live', now: NOW }).level;

  assert.equal(at(5.0, 23 * HOUR), 'meningkat');
  assert.equal(at(5.0, 25 * HOUR), 'rutin');
  assert.equal(at(6.0, 23 * HOUR), 'tinggi');
  assert.equal(at(6.0, 25 * HOUR), 'rutin');
  // The heuristic is capped at TINGGI: tsunami potential only ever comes from BMKG's words.
  assert.equal(at(8.2, HOUR), 'tinggi');
  assert.equal(at(4.9, HOUR), 'rutin');
});

test('deep events raise one step only, and say so', () => {
  const deepStrong = assessAttention({
    latest: latest(),
    recent: [recent(6.4, 2 * HOUR, 160)],
    feed: 'live',
    now: NOW,
  });
  assert.equal(deepStrong.level, 'meningkat');
  assert.match(deepStrong.reasons[0], /160 km \(dalam, >100 km\)/);
  assert.match(deepStrong.reasons[0], /hanya menaikkan satu tingkat/);

  const deepModerate = assessAttention({
    latest: latest(),
    recent: [recent(5.4, 2 * HOUR, 323)],
    feed: 'live',
    now: NOW,
  });
  assert.equal(deepModerate.level, 'rutin');
});

test('a widely felt quake raises the level even below M5', () => {
  const feltFour = assessAttention({
    latest: latest({ Magnitude: '4.6', Dirasakan: 'IV Manokwari, III Ransiki' }),
    recent: [],
    feed: 'live',
    now: NOW,
  });
  assert.equal(feltFour.level, 'meningkat');
  assert.match(feltFour.reasons[0], /dirasakan IV MMI/);

  const feltSix = assessAttention({
    latest: latest({ Magnitude: '5.6', Dirasakan: 'VI Bajawa, V Ende' }),
    recent: [],
    feed: 'live',
    now: NOW,
  });
  assert.equal(feltSix.level, 'tinggi');
});

test('the reason names magnitude, place and age, and the level has an expiry', () => {
  const result = assessAttention({
    latest: latest(),
    recent: [recent(6.1, 3 * HOUR, 35), recent(5.2, 20 * HOUR, 12)],
    feed: 'live',
    now: NOW,
  });
  assert.equal(result.level, 'tinggi');
  assert.equal(result.headline, 'M6,1 · Laut Banda · 3 jam lalu');
  assert.match(result.reasons[0], /^M6,1 · 35 km \(dangkal, ≤100 km\) · Laut Banda · 3 jam lalu/);
  assert.equal(result.driver?.magnitude, 6.1);
  assert.equal(result.expiresAtMs, NOW - 3 * HOUR + DAY);
  assert.deepEqual(result.counts, { last24h: 2, last7d: 2, largest7d: 6.1 });
  assert.match(result.reasons[result.reasons.length - 1], /24 jam 2 · 7 hari 2 · terbesar M6,1/);
});

test('without live BMKG data the level is unknown, never routine', () => {
  for (const feed of ['loading', 'stale', 'seed', 'failed'] as const) {
    const result = assessAttention({ latest: latest(), recent: [recent(6.5, HOUR)], feed, now: NOW });
    assert.equal(result.level, 'unknown', feed);
    assert.equal(result.driver, null);
  }
  // The backend path reports no provenance; the data is evaluated as given.
  assert.equal(
    assessAttention({ latest: latest(), recent: [recent(6.5, HOUR)], feed: 'unreported', now: NOW }).level,
    'tinggi'
  );
});

test('placeholder and undated records are ignored', () => {
  const seededLatest = latest({ Magnitude: '6.8', seeded: true });
  const result = assessAttention({
    latest: seededLatest,
    recent: [recent(6.2, HOUR, 10, { seeded: true }), recent(6.3, HOUR, 10, { timestamp: 'not-a-date' })],
    feed: 'live',
    now: NOW,
  });
  assert.equal(result.level, 'rutin');
  assert.equal(collectQuakeFacts(seededLatest, []).length, 0);
});

test('the latest report is not counted twice when it is also in the recent list', () => {
  const origin = NOW - 2 * HOUR;
  const facts = collectQuakeFacts(latest({ Magnitude: '5.4', DateTime: new Date(origin).toISOString() }), [
    recent(5.4, 2 * HOUR + 20_000),
    recent(5.1, 6 * HOUR),
  ]);
  assert.equal(facts.length, 2);
  assert.deepEqual(facts.map((fact) => fact.magnitude), [5.4, 5.1]);
});

test('risk-level vocabulary for the status payload', () => {
  assert.equal(attentionToRiskLevel('rutin'), 'NORMAL');
  assert.equal(attentionToRiskLevel('meningkat'), 'ELEVATED');
  assert.equal(attentionToRiskLevel('tinggi'), 'HIGH');
  assert.equal(attentionToRiskLevel('unknown'), 'UNKNOWN');
});

test('shortRegion drops the BMKG boilerplate and truncates', () => {
  assert.equal(shortRegion('Pusat gempa berada di laut 98 km BaratDaya Melonguane', 60), 'laut 98 km BaratDaya Melonguane');
  assert.equal(shortRegion('265 km Tenggara BURUSELATAN-MALUKU', 18), '265 km Tenggara B…');
  assert.equal(shortRegion(''), 'lokasi tidak tersedia');
});

test('summarizeDays buckets BMKG M≥5 events by WIB calendar day', () => {
  const days = summarizeDays(
    latest(),
    [recent(6.1, 3 * HOUR), recent(5.2, 5 * HOUR), recent(5.6, 2 * DAY + HOUR), recent(4.4, HOUR), recent(6.9, 9 * DAY)],
    NOW
  );
  assert.equal(days.length, 7);
  const today = days[6];
  assert.equal(today.label, '16 Nov');
  assert.equal(today.count, 2);
  assert.equal(today.largest, 6.1);
  assert.equal(today.inWindow, true);
  assert.equal(days[4].count, 1);
  assert.equal(days[4].largest, 5.6);
  assert.equal(days[4].inWindow, false);
  // M4.4 is below the list threshold and the 9-day-old event is outside the strip.
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 3);
});

test('the expiry is when the level is back at RUTIN, not when it leaves its current step', () => {
  // TINGGI from an M6.1 twenty hours ago; a shallow M5.2 two hours ago keeps MENINGKAT after it.
  const result = assessAttention({
    latest: latest(),
    recent: [recent(6.1, 20 * HOUR, 35), recent(5.2, 2 * HOUR, 12)],
    feed: 'live',
    now: NOW,
  });
  assert.equal(result.level, 'tinggi');
  assert.equal(result.expiresAtMs, NOW - 2 * HOUR + DAY);

  // Four hours on, the M6.1 is out of the window and the level reads MENINGKAT with the same expiry.
  const later = assessAttention({
    latest: latest(),
    recent: [recent(6.1, 20 * HOUR, 35), recent(5.2, 2 * HOUR, 12)],
    feed: 'live',
    now: NOW + 5 * HOUR,
  });
  assert.equal(later.level, 'meningkat');
  assert.equal(later.expiresAtMs, NOW - 2 * HOUR + DAY);
});

test('the weekly figures cover exactly the days the strip draws', () => {
  // NOW is 17:00 WIB. The strip starts at 00:00 WIB six days earlier, i.e. 6 d 17 h ago:
  // an event 6 d 20 h ago is inside a rolling 168 hours but on a day the strip does not draw.
  const events = [recent(6.4, 6 * DAY + 20 * HOUR), recent(5.3, 6 * DAY + 16 * HOUR), recent(5.8, 2 * DAY), recent(5.1, 3 * HOUR)];
  const result = assessAttention({ latest: latest(), recent: events, feed: 'live', now: NOW });
  const days = summarizeDays(latest(), events, NOW);

  assert.equal(days.length, 7);
  assert.equal(result.counts.last7d, 3);
  assert.equal(result.counts.last7d, days.reduce((sum, day) => sum + day.count, 0));
  assert.equal(result.counts.largest7d, 5.8);
  assert.equal(result.counts.largest7d, Math.max(...days.map((day) => day.largest ?? 0)));
  assert.equal(days[0].count, 1);
});

test('the popup lists every event that raises the level, each with the level it gives on its own', () => {
  const result = assessAttention({
    latest: latest(),
    recent: [recent(6.2, 2 * HOUR, 30), recent(5.1, 5 * HOUR, 15), recent(6.4, 8 * HOUR, 300), recent(5.4, 9 * HOUR, 250)],
    feed: 'live',
    now: NOW,
  });
  assert.equal(result.level, 'tinggi');
  // The deep M5.4 raises nothing; the deep M6.4 raises one step only.
  assert.deepEqual(
    result.raising.map(({ fact, level }) => `${fact.magnitude}:${level}`),
    ['6.2:tinggi', '6.4:meningkat', '5.1:meningkat']
  );
  assert.equal(result.driver, result.raising[0].fact);

  // Nothing raises a routine or unknown level.
  assert.deepEqual(assessAttention({ latest: latest(), recent: [], feed: 'live', now: NOW }).raising, []);
  assert.deepEqual(assessAttention({ latest: latest(), recent: [recent(6.2, HOUR)], feed: 'failed', now: NOW }).raising, []);
});

test('the scale shown in the popup states the same thresholds the level is computed with', () => {
  assert.deepEqual(ATTENTION_SCALE.map((step) => step.level), ['rutin', 'meningkat', 'tinggi']);
  const criteria = Object.fromEntries(ATTENTION_SCALE.map((step) => [step.level, step.criterion]));
  assert.match(criteria.meningkat, /M≥5 dangkal \(≤100 km\)/);
  assert.match(criteria.meningkat, /MMI IV–V/);
  assert.match(criteria.meningkat, /M≥6 dalam \(>100 km\)/);
  assert.match(criteria.tinggi, /M≥6 dangkal \(≤100 km\)/);
  assert.match(criteria.tinggi, /MMI VI/);
  for (const level of ['unknown', 'rutin', 'meningkat', 'tinggi'] as const) {
    assert.ok(ATTENTION_MEANING[level].length > 0);
    // The dashboard's own scale never borrows BMKG's or PVMBG's official words.
    assert.doesNotMatch(ATTENTION_MEANING[level], /\b(Waspada|Siaga|Awas|Normal)\b/);
  }

  // Each threshold as computed: one example per row.
  const levelFor = (event: SeismicEvent) => assessAttention({ latest: latest(), recent: [event], feed: 'live', now: NOW }).level;
  assert.equal(levelFor(recent(5.0, HOUR, 100)), 'meningkat');
  assert.equal(levelFor(recent(5.9, HOUR, 101)), 'rutin');
  assert.equal(levelFor(recent(6.0, HOUR, 101)), 'meningkat');
  assert.equal(levelFor(recent(6.0, HOUR, 100)), 'tinggi');
});

test('depth is worded against the rule\'s 100 km split, and the deep note only when it holds', () => {
  assert.equal(ruleDepthLabel(80), '80 km (dangkal, ≤100 km)');
  assert.equal(ruleDepthLabel(100), '100 km (dangkal, ≤100 km)');
  assert.equal(ruleDepthLabel(150), '150 km (dalam, >100 km)');

  // A deep M6.2 felt at MMI VI is lifted to TINGGI by the felt rule: it did not "raise one step only".
  const felt = assessAttention({
    latest: latest({ Magnitude: '6.2', Kedalaman: '150 km', DateTime: new Date(NOW - HOUR).toISOString(), Dirasakan: 'VI Malang, V Blitar' }),
    recent: [],
    feed: 'live',
    now: NOW,
  });
  assert.equal(felt.level, 'tinggi');
  assert.doesNotMatch(felt.reasons[0], /hanya menaikkan satu tingkat/);
});

test('a felt quake keeps counting for 24 hours after another quake becomes the latest report', () => {
  const feltMainshock = latest({
    Magnitude: '5.3',
    Kedalaman: '10 km',
    DateTime: new Date(NOW - 5 * HOUR).toISOString(),
    Coordinates: '-6.90,107.60',
    Wilayah: 'Pusat gempa berada di darat 10 km Bandung',
    Dirasakan: 'VI Bandung',
  });
  const feltSmall = latest({
    Magnitude: '4.2',
    Kedalaman: '15 km',
    DateTime: new Date(NOW - 7 * HOUR).toISOString(),
    Coordinates: '-7.80,110.40',
    Wilayah: 'Pusat gempa berada di darat 12 km Bantul',
    Dirasakan: 'IV Bantul, III Yogyakarta',
  });
  // An unrelated deep quake is now BMKG's latest report; the mainshock is on the M≥5 list without its felt value.
  const unrelated = latest({ Magnitude: '5.1', Kedalaman: '150 km', DateTime: new Date(NOW - HOUR).toISOString(), Dirasakan: undefined });
  const listed = recent(5.3, 5 * HOUR, 10, { fault_zone: '10 km Bandung' });

  const without = assessAttention({ latest: unrelated, recent: [listed], feed: 'live', now: NOW });
  assert.equal(without.level, 'meningkat');

  const withFelt = assessAttention({ latest: unrelated, recent: [listed], felt: [feltMainshock, feltSmall], feed: 'live', now: NOW });
  assert.equal(withFelt.level, 'tinggi');
  assert.equal(withFelt.driver?.feltMmi, 6);
  // The felt M4.2 is not on the M≥5 list at all, and still raises the level on its own.
  assert.ok(withFelt.raising.some(({ fact, level }) => fact.magnitude === 4.2 && level === 'meningkat'));
  // One earthquake is still counted once.
  assert.equal(withFelt.counts.last24h, 2);
  assert.equal(withFelt.expiresAtMs, NOW - 5 * HOUR + DAY);
  // The week strip and its figures agree with the felt list included.
  const days = summarizeDays(unrelated, [listed], NOW, [feltMainshock, feltSmall]);
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), withFelt.counts.last7d);
});
