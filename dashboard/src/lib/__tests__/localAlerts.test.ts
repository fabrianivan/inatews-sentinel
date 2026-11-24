import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ALERT_SETTINGS,
  EMPTY_LEDGER,
  QUAKE_FRESH_MS,
  VOLCANO_QUIET_MS,
  collectLocalAlerts,
  parseAlertSettings,
  parseLedger,
  takeNewAlerts,
  type LocalAlertInput,
  type LocalAlertSettings,
} from '../localAlerts';
import {
  bearingDegrees,
  compassDirection,
  describeOffset,
  distanceKm,
  formatDistance,
  isGeoPoint,
  parseLatLon,
} from '../proximity';
import { updateTsunamiNotice } from '../tsunamiNotice';
import type { BMKGGempaDetail, SeismicEvent, VolcanoEruption } from '../types';

const NOW = Date.parse('2026-11-16T03:00:00Z'); // 10:00 WIB
const MINUTE = 60_000;

const JAKARTA = { lat: -6.2, lon: 106.82 };
const BANDUNG = { lat: -6.92, lon: 107.61 };
const LUMAJANG = { lat: -8.13, lon: 113.22 }; // about 25 km from G. Semeru

const ON: LocalAlertSettings = { ...DEFAULT_ALERT_SETTINGS, enabled: true };

function quake(overrides: Partial<BMKGGempaDetail> = {}): BMKGGempaDetail {
  return {
    Tanggal: '16 Nov 2026',
    Jam: '09:50:00 WIB',
    DateTime: new Date(NOW - 10 * MINUTE).toISOString(),
    Coordinates: '-7.05,106.60',
    Lintang: '7.05 LS',
    Bujur: '106.60 BT',
    Magnitude: '5.3',
    Kedalaman: '10 km',
    Wilayah: 'Pusat gempa berada di darat 20 km BaratDaya KOTA-SUKABUMI',
    Potensi: 'Tidak berpotensi tsunami',
    ...overrides,
  };
}

function listed(magnitude: number, lat: number, lon: number, ageMs: number, extra: Partial<SeismicEvent> = {}): SeismicEvent {
  return {
    type: 'SEISMIC',
    magnitude,
    depth: 20,
    frequency: 0,
    count: 1,
    latitude: lat,
    longitude: lon,
    mmi: 0,
    pga: 0,
    fault_zone: 'Laut Banda',
    timestamp: new Date(NOW - ageMs).toISOString(),
    ...extra,
  };
}

function eruption(name: string, ageMs: number, id = `erup-${name.toLowerCase()}-${ageMs}`): VolcanoEruption {
  return {
    id,
    volcano_name: name,
    time: '09:40 WIB',
    date: '16 Nov 2026',
    description: `Terjadi erupsi G. ${name} pada hari Senin, 16 November 2026, pukul 09:40 WIB. Visual letusan tidak teramati.`,
    amplitude: '22 mm',
    duration: '110 detik',
    visual_ash: 'Visual letusan tidak teramati',
    author: 'Petugas Pos',
    alert_level: 'LEVEL III (SIAGA)',
    recommendation: '',
    timestamp: new Date(NOW - ageMs).toISOString(),
    source: 'PVMBG_LIVE',
  };
}

function input(overrides: Partial<LocalAlertInput> = {}): LocalAlertInput {
  return {
    location: JAKARTA,
    settings: ON,
    nowMs: NOW,
    latest: null,
    recent: [],
    notice: null,
    volcanoReports: [],
    ...overrides,
  };
}

test('distance, bearing and wording between two places', () => {
  const km = distanceKm(JAKARTA, BANDUNG);
  assert.ok(km > 110 && km < 125, `Jakarta–Bandung is about 118 km, got ${km}`);
  assert.equal(distanceKm(JAKARTA, JAKARTA), 0);
  assert.equal(compassDirection(bearingDegrees(JAKARTA, BANDUNG)), 'tenggara');
  assert.equal(compassDirection(0), 'utara');
  assert.equal(compassDirection(359), 'utara');
  assert.equal(compassDirection(225), 'barat daya');
  assert.equal(compassDirection(-90), 'barat');

  assert.equal(formatDistance(4.2), 'kurang dari 10 km');
  assert.equal(formatDistance(57.4), '±55 km');
  assert.equal(formatDistance(118.3), '±120 km');
  assert.equal(formatDistance(Number.NaN), 'jarak tidak diketahui');
  assert.equal(describeOffset(JAKARTA, BANDUNG), '±120 km di tenggara lokasi Anda');
  assert.equal(describeOffset(JAKARTA, { lat: -6.21, lon: 106.83 }), 'kurang dari 10 km dari lokasi Anda');

  assert.deepEqual(parseLatLon('-7.90,108.90'), { lat: -7.9, lon: 108.9 });
  assert.equal(parseLatLon('108.90'), null);
  assert.equal(parseLatLon('abc,def'), null);
  assert.equal(isGeoPoint({ lat: 95, lon: 10 }), false);
  assert.equal(isGeoPoint(null), false);
});

test('a BMKG earthquake inside the radius is an alert that states fact, distance and source', () => {
  const alerts = collectLocalAlerts(input({ latest: quake() }));
  assert.equal(alerts.length, 1);
  const [alert] = alerts;
  assert.equal(alert.kind, 'quake');
  assert.match(alert.title, /^Gempa M5,3 — ±\d+ km dari lokasi Anda$/);
  assert.match(alert.body, /^Di (selatan|barat daya) lokasi Anda · darat 20 km BaratDaya KOTA-SUKABUMI · kedalaman 10 km · 09:50 WIB\./);
  assert.match(alert.body, /BMKG: “Tidak berpotensi tsunami”\./);
  assert.equal(alert.sticky, false);
  // No instruction, no forecast: only what BMKG published and how far it is.
  assert.doesNotMatch(`${alert.title} ${alert.body}`, /\b(evakuasi|segera|aman|waspada|awas)\b|menit lagi/i);
});

test('a distance measured from a chosen city names the city, not the reader', () => {
  const [alert] = collectLocalAlerts(input({ latest: quake(), locationName: 'Jakarta' }));
  assert.match(alert.title, /^Gempa M5,3 — ±\d+ km dari Jakarta$/);
  assert.match(alert.body, /^Di (selatan|barat daya) Jakarta · /);
  assert.doesNotMatch(`${alert.title} ${alert.body}`, /lokasi Anda/);
  assert.equal(describeOffset(JAKARTA, BANDUNG, 'Jakarta'), '±120 km di tenggara Jakarta');
});

test('distance, age, source and the switches decide what is left out', () => {
  // Outside a 100 km radius, inside 300 km.
  const far = quake({ Coordinates: '-7.75,108.50' });
  assert.equal(collectLocalAlerts(input({ latest: far, settings: { ...ON, radiusKm: 100 } })).length, 0);
  assert.equal(collectLocalAlerts(input({ latest: far, settings: { ...ON, radiusKm: 300 } })).length, 1);

  // An hour-old earthquake is news, not an alert; neither is one stamped far in the future.
  const old = quake({ DateTime: new Date(NOW - QUAKE_FRESH_MS - MINUTE).toISOString() });
  assert.equal(collectLocalAlerts(input({ latest: old })).length, 0);
  const future = quake({ DateTime: new Date(NOW + 20 * MINUTE).toISOString() });
  assert.equal(collectLocalAlerts(input({ latest: future })).length, 0);

  // Placeholders, a switched-off kind, switched-off notifications, and no location.
  assert.equal(collectLocalAlerts(input({ latest: quake({ seeded: true }) })).length, 0);
  assert.equal(collectLocalAlerts(input({ latest: quake(), settings: { ...ON, quakes: false } })).length, 0);
  assert.equal(collectLocalAlerts(input({ latest: quake(), settings: { ...ON, enabled: false } })).length, 0);
  assert.equal(collectLocalAlerts(input({ latest: quake(), location: null })).length, 0);

  // A record without a usable position cannot be placed, so it is not notified.
  assert.equal(collectLocalAlerts(input({ latest: quake({ Coordinates: '' }) })).length, 0);
});

test('the latest report is not notified twice through its own list entry', () => {
  const latest = quake({ DateTime: new Date(NOW - 10 * MINUTE).toISOString(), Coordinates: '-7.05,106.60' });
  const sameInList = listed(5.3, -7.05, 106.6, 10 * MINUTE, { fault_zone: '20 km BaratDaya KOTA-SUKABUMI' });
  const another = listed(5.6, -6.9, 105.9, 25 * MINUTE, { fault_zone: 'Selat Sunda' });
  const alerts = collectLocalAlerts(input({ latest, recent: [sameInList, another] }));
  assert.deepEqual(
    alerts.map((alert) => alert.title.slice(0, 10)),
    ['Gempa M5,3', 'Gempa M5,6']
  );
});

test('a tsunami statement is always an alert, with or without a location', () => {
  const mainshock = quake({
    Magnitude: '7.4',
    Coordinates: '-7.90,108.90',
    Wilayah: '110 km BaratDaya CILACAP-JATENG',
    Potensi: 'Berpotensi tsunami untuk diteruskan pada masyarakat',
  });
  const notice = updateTsunamiNotice(null, mainshock, [], NOW);

  const anywhere = collectLocalAlerts(input({ notice, location: null }));
  assert.equal(anywhere.length, 1);
  assert.equal(anywhere[0].kind, 'tsunami');
  assert.equal(anywhere[0].title, 'BMKG: berpotensi tsunami — gempa M7,4');
  assert.equal(anywhere[0].sticky, true);
  assert.equal(anywhere[0].distanceKm, null);
  assert.match(anywhere[0].body, /Status per wilayah dan waktu tiba hanya ada di BMKG\.$/);

  // With a location the distance is added, and the statement outranks everything else.
  const located = collectLocalAlerts(input({ notice, latest: mainshock, settings: { ...ON, radiusKm: 1000 } }));
  assert.deepEqual(located.map((alert) => alert.kind), ['tsunami', 'quake']);
  assert.match(located[0].body, /Episenter ±\d+ km di tenggara lokasi Anda\./);

  // A statement the operator recorded as ended, or one past its hold period, is not re-sent as in force.
  assert.ok(notice);
  assert.equal(collectLocalAlerts(input({ notice: { ...notice, status: 'acknowledged' }, location: null })).length, 0);
  assert.equal(collectLocalAlerts(input({ notice: { ...notice, status: 'expired' }, location: null })).length, 0);
});

test('eruption reports near the reader are alerts; placeholders and distant volcanoes are not', () => {
  const reports = [eruption('Semeru', 20 * MINUTE), eruption('Ibu', 20 * MINUTE)];
  const alerts = collectLocalAlerts(input({ location: LUMAJANG, volcanoReports: reports }));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].title, /^Erupsi G\. Semeru — ±\d+ km dari lokasi Anda$/);
  assert.match(alerts[0].body, /^Terjadi erupsi G\. Semeru .* pukul 09:40 WIB\. Sumber: MAGMA PVMBG\.$/);
  assert.equal(alerts[0].throttleKey, 'volcano:Semeru');

  const seeded = { ...eruption('Semeru', 20 * MINUTE), source: 'SEEDED' as const };
  assert.equal(collectLocalAlerts(input({ location: LUMAJANG, volcanoReports: [seeded] })).length, 0);
  // A report MAGMA gave no readable date carries no timestamp and is never treated as fresh.
  const undated = { ...eruption('Semeru', 0), timestamp: '' };
  assert.equal(collectLocalAlerts(input({ location: LUMAJANG, volcanoReports: [undated] })).length, 0);
  assert.equal(
    collectLocalAlerts(input({ location: LUMAJANG, volcanoReports: reports, settings: { ...ON, volcanoes: false } })).length,
    0
  );
});

test('each alert is delivered once, and an erupting volcano does not notify every half hour', () => {
  const first = collectLocalAlerts(input({ latest: quake() }));
  const round1 = takeNewAlerts(first, EMPTY_LEDGER, NOW);
  assert.equal(round1.fresh.length, 1);
  // The next poll carries the same earthquake: nothing new.
  assert.equal(takeNewAlerts(first, round1.ledger, NOW + 20_000).fresh.length, 0);

  // Semeru files a report every half hour: one notification, then quiet for six hours.
  const reportAt = (reportMs: number, id: string): VolcanoEruption => ({
    ...eruption('Semeru', 0, id),
    timestamp: new Date(reportMs).toISOString(),
  });
  const alertsAt = (nowMs: number, reports: VolcanoEruption[]) =>
    collectLocalAlerts(input({ location: LUMAJANG, nowMs, volcanoReports: reports }));

  const r1 = reportAt(NOW - 5 * MINUTE, 'r1');
  const r2 = reportAt(NOW + 40 * MINUTE, 'r2');
  let ledger = EMPTY_LEDGER;

  const a = takeNewAlerts(alertsAt(NOW, [r1]), ledger, NOW);
  assert.deepEqual(a.fresh.map((alert) => alert.id), ['volcano:r1']);
  ledger = a.ledger;

  const b = takeNewAlerts(alertsAt(NOW + 45 * MINUTE, [r2, r1]), ledger, NOW + 45 * MINUTE);
  assert.equal(b.fresh.length, 0);
  ledger = b.ledger;

  // After the quiet period a new report notifies again; the one skipped meanwhile never does.
  const later = NOW + VOLCANO_QUIET_MS + 10 * MINUTE;
  const r3 = reportAt(later - 5 * MINUTE, 'r3');
  const c = takeNewAlerts(alertsAt(later, [r3]), ledger, later);
  assert.deepEqual(c.fresh.map((alert) => alert.id), ['volcano:r3']);
  assert.ok(c.ledger.seen['volcano:r2'] !== undefined);

  // Two fresh reports of one volcano arriving together are one notification: the newer one.
  const pair = takeNewAlerts(alertsAt(NOW, [reportAt(NOW - 30 * MINUTE, 'p1'), reportAt(NOW - 2 * MINUTE, 'p2')]), EMPTY_LEDGER, NOW);
  assert.deepEqual(pair.fresh.map((alert) => alert.id), ['volcano:p2']);
});

test('switching notifications on does not replay the past hour, except a statement in force', () => {
  const mainshock = quake({ Magnitude: '7.4', Potensi: 'Berpotensi tsunami untuk diteruskan pada masyarakat' });
  const notice = updateTsunamiNotice(null, mainshock, [], NOW);
  const alerts = collectLocalAlerts(
    input({ notice, latest: mainshock, location: LUMAJANG, settings: { ...ON, radiusKm: 1000 }, volcanoReports: [eruption('Semeru', 20 * MINUTE)] })
  );
  assert.deepEqual(alerts.map((alert) => alert.kind), ['tsunami', 'quake', 'volcano']);

  const baseline = takeNewAlerts(alerts, EMPTY_LEDGER, NOW, { baseline: true });
  assert.deepEqual(baseline.fresh.map((alert) => alert.kind), ['tsunami']);
  // Everything else is recorded as known, so the next poll stays silent.
  assert.equal(takeNewAlerts(alerts, baseline.ledger, NOW + 20_000).fresh.length, 0);
});

test('stored settings and ledger are read defensively', () => {
  assert.deepEqual(parseAlertSettings(null), DEFAULT_ALERT_SETTINGS);
  assert.deepEqual(parseAlertSettings('not json'), DEFAULT_ALERT_SETTINGS);
  assert.deepEqual(parseAlertSettings('{"enabled":true,"radiusKm":500,"quakes":false}'), {
    enabled: true,
    radiusKm: 500,
    quakes: false,
    volcanoes: true,
    placeId: null,
  });
  // A radius that is not one of the offered steps falls back to the default.
  assert.equal(parseAlertSettings('{"enabled":true,"radiusKm":123456}').radiusKm, 300);
  // A chosen city is kept only while it is one of the offered places.
  assert.equal(parseAlertSettings('{"enabled":true,"placeId":"padang"}').placeId, 'padang');
  assert.equal(parseAlertSettings('{"enabled":true,"placeId":"atlantis"}').placeId, null);
  assert.equal(parseAlertSettings('{"enabled":true,"placeId":42}').placeId, null);

  assert.deepEqual(parseLedger(''), EMPTY_LEDGER);
  assert.deepEqual(parseLedger('{"seen":{"a":1,"b":"x"},"lastByKey":null}'), { seen: { a: 1 }, lastByKey: {} });

  // Old entries are dropped as the ledger is used.
  const stale = { seen: { old: NOW - 72 * 60 * MINUTE, recent: NOW - MINUTE }, lastByKey: {} };
  assert.deepEqual(Object.keys(takeNewAlerts([], stale, NOW).ledger.seen), ['recent']);
});
