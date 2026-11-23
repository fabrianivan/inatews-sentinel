import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
  assert.match(deepStrong.reasons[0], /160 km \(menengah\)/);
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
  assert.match(result.reasons[0], /^M6,1 · 35 km \(dangkal\) · Laut Banda · 3 jam lalu/);
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
