import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTsunamiToStations,
  buildEarthquakesPayload,
  buildLiveAgentState,
  buildSeismicEvent,
  computeDynamicIntensityAndStatus,
  createUpstreamReader,
  fallbackVolcanoEruptions,
  FALLBACK_EARTHQUAKES,
  parseBMKGCoords,
  parseBMKGDepth,
  parseBMKGFelt,
  parseBMKGLatest,
  parseBMKGRecent,
  parseIOCStations,
  parseMagmaVolcanoHTML,
  parseUSGSRecent,
  SEEDED_IOC_STATIONS,
  type OceanFeedResponse,
  type WeatherSummary,
} from '../telemetry';
import type { BMKGGempaDetail, RealtimeEarthquakesData, SeismicEvent, TsunamiScenario } from '../types';

const NOW = new Date('2026-11-16T03:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

const OCEAN: OceanFeedResponse = {
  stations: SEEDED_IOC_STATIONS,
  count: SEEDED_IOC_STATIONS.length,
  live_count: 18,
  anomaly_count: 0,
  source: 'IOC_LIVE',
  timestamp: '2026-11-16T02:59:00Z',
};

const WEATHER: WeatherSummary = {
  statusLabel: '24 km/jam • 28.4°C',
  avgWindKmh: 24,
  maxWindKmh: 28,
  avgTempC: 28.4,
  stationName: 'Selat Sunda',
  source: 'OPEN_METEO',
  timestamp: '2026-11-16T02:59:00Z',
};

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR_MS).toISOString();
}

function bmkgLatest(overrides: Partial<BMKGGempaDetail> = {}): BMKGGempaDetail {
  return {
    Tanggal: '16 Nov 2026',
    Jam: '08:00:00 WIB',
    DateTime: hoursAgo(2),
    Coordinates: '-6.92,105.49',
    Lintang: '6.92 LS',
    Bujur: '105.49 BT',
    Magnitude: '3.8',
    Kedalaman: '25 km',
    Wilayah: 'Pusat gempa berada di laut 40 km BaratDaya Sumur',
    Potensi: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    ...overrides,
  };
}

function quake(magnitude: number, depth: number, timestamp: string, faultZone = '80 km BaratDaya Bengkulu'): SeismicEvent {
  return buildSeismicEvent({ magnitude, depth, latitude: -4.5, longitude: 101.8, faultZone, timestamp });
}

/** A payload as the standalone fetcher builds it when every quake feed answered. */
function livePayload(latest: BMKGGempaDetail, recentBMKG: SeismicEvent[], recentUSGS: SeismicEvent[] = []) {
  return buildEarthquakesPayload({ latest, recentBMKG, recentUSGS, fetchedAt: NOW.toISOString() });
}

function assess(earthquakes: RealtimeEarthquakesData, now = NOW) {
  return computeDynamicIntensityAndStatus({ earthquakes, ocean: OCEAN, weather: WEATHER, now });
}

test('parseBMKGDepth and parseBMKGCoords handle valid and invalid inputs', () => {
  assert.equal(parseBMKGDepth('25 km'), 25);
  assert.equal(parseBMKGDepth(''), 10);
  assert.deepEqual(parseBMKGCoords('-6.92, 105.49'), { lat: -6.92, lon: 105.49 });
  assert.equal(parseBMKGCoords('invalid'), null);
});

test('parseMagmaVolcanoHTML extracts live PVMBG eruption cards accurately', () => {
  const sampleHtml = `
    <div class="timeline-item">
      <div class="timeline-time"><small>10:15 WIB</small></div>
      <p class="timeline-title"><a href="#">Gunung Marapi</a></p>
      <p class="timeline-author">Dibuat oleh <a href="#">Petugas PGA Marapi</a></p>
      <p class="timeline-text">Terjadi erupsi G. Marapi dengan kolom abu teramati ± 600 m di atas puncak. Amplitudo maksimum 30.5 mm durasi 52 detik.</p>
      <img src="https://magma.vsi.esdm.go.id/img/crs/sample-marapi.jpg" />
      <a href="https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/12345/show">Detail</a>
    </div>
  `;

  const parsed = parseMagmaVolcanoHTML(sampleHtml);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].volcano_name, 'Marapi');
  assert.equal(parsed[0].time, '10:15 WIB');
  // No day header and no date in the text: the report says so instead of borrowing today's date.
  assert.equal(parsed[0].date, 'Tanggal tidak tersedia');
  assert.equal(parsed[0].timestamp, '');
  assert.equal(parsed[0].amplitude, '30.5 mm');
  assert.equal(parsed[0].duration, '52 detik');
  assert.equal(parsed[0].alert_level, 'LEVEL III (SIAGA)');
  assert.equal(parsed[0].image_url, 'https://magma.vsi.esdm.go.id/img/crs/sample-marapi.jpg');
  assert.equal(parsed[0].detail_url, 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/12345/show');
  assert.equal(parsed[0].source, 'PVMBG_LIVE');
  assert.doesNotMatch(parsed[0].recommendation, /radius|km/i);
});

test('parseMagmaVolcanoHTML dates each report from its own day header, in the zone MAGMA wrote', () => {
  // The structure of magma.esdm.go.id/v1/gunung-api/informasi-letusan: reports grouped under day headers.
  const item = (time: string, name: string, text: string, uuid: string) => `
    <div class="timeline-item">
      <div class="timeline-time"><small>${time} </small></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">${name}</a></p>
        <p class="timeline-author">Dibuat oleh <a href="#">Petugas Pos</a></p>
        <p class="timeline-text"> ${text} </p>
        <a href="https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/${uuid}/show">Details</a>
      </div>
    </div>`;
  const dayHeader = (label: string) => `
    <div class="timeline-item timeline-day">
      <div class="timeline-time">&nbsp;</div>
      <div class="timeline-body"><p class="timeline-date">${label}</p></div>
    </div>`;
  const html = [
    '<div class="timeline-group mg-t-20 mg-b-20">',
    dayHeader('Hari Ini, Senin, 23 November 2026'),
    item('18:24 WIT', 'Dukono', 'Terjadi erupsi G. Dukono dengan tinggi kolom abu teramati &plusmn; 900 m di atas puncak. Amplitudo maksimum 34 mm dan durasi 55.54 detik.', 'aaa-111'),
    item('00:19 WIB', 'Semeru', 'Terjadi erupsi G. Semeru. Visual letusan tidak teramati.', 'bbb-222'),
    '</div><div class="timeline-group mg-t-20 mg-b-20">',
    dayHeader('Minggu, 22 November 2026, 1 hari yang lalu'),
    item('23:05 WITA', 'Lewotobi Laki-laki', 'Terjadi erupsi G. Lewotobi Laki-laki.', 'ccc-333'),
    dayHeader('tanggal tidak terbaca'),
    item('07:40 WIB', 'Ibu', 'Terjadi erupsi G. Ibu pada hari Jumat, 20 November 2026, pukul 07:40 WIT.', 'ddd-444'),
    item('06:10 WIB', 'Marapi', 'Terjadi erupsi G. Marapi.', 'eee-555'),
    '</div>',
  ].join('');

  const parsed = parseMagmaVolcanoHTML(html);
  assert.deepEqual(parsed.map((report) => report.volcano_name), ['Dukono', 'Semeru', 'Lewotobi Laki-laki', 'Ibu', 'Marapi']);

  // Today's group: 18:24 WIT is 09:24 UTC; 00:19 WIB is still the previous day in UTC.
  assert.equal(parsed[0].date, '23 Nov 2026');
  assert.equal(parsed[0].timestamp, '2026-11-23T09:24:00.000Z');
  assert.equal(parsed[1].date, '23 Nov 2026');
  assert.equal(parsed[1].timestamp, '2026-11-22T17:19:00.000Z');
  // Yesterday's group is dated yesterday, not with the day the page was fetched.
  assert.equal(parsed[2].date, '22 Nov 2026');
  assert.equal(parsed[2].timestamp, '2026-11-22T15:05:00.000Z');
  // An unreadable header: the date in the report's own text is used; without one it stays unknown.
  assert.equal(parsed[3].date, '20 Nov 2026');
  assert.equal(parsed[4].date, 'Tanggal tidak tersedia');
  assert.equal(parsed[4].timestamp, '');

  // MAGMA's own report id, and its text with entities decoded.
  assert.equal(parsed[0].id, 'erup-dukono-aaa-111');
  assert.match(parsed[0].description, /± 900 m/);
  assert.equal(parsed[0].amplitude, '34 mm');
});

test('placeholder volcano records are marked as seeded', () => {
  const seeded = fallbackVolcanoEruptions(NOW);
  assert.ok(seeded.length > 0);
  assert.ok(seeded.every((report) => report.source === 'SEEDED'));
});

test('parseIOCStations filters IDN stations, skips duplicates, and handles invalid levels', () => {
  const raw = [
    { Code: 'pada', Location: 'Padang', country: 'IDN', Lat: -0.99, Lon: 100.37, lastvalue: 1.42, sensor: 'rad', lasttime: '2026-11-16 01:00:00' },
    { Code: 'pada', Location: 'Padang Dup', country: 'IDN', Lat: -0.99, Lon: 100.37, lastvalue: 2.0 },
    { Code: 'jpn1', Location: 'Tokyo', country: 'JPN', Lat: 35.6, Lon: 139.7, lastvalue: 1.0 },
    { Code: 'cila', Location: 'Cilacap', countryname: 'Indonesia', Lat: -7.74, Lon: 109.01, lastvalue: -999 },
  ];

  const stations = parseIOCStations(raw);
  assert.equal(stations.length, 2);
  assert.equal(stations[0].code, 'pada');
  assert.equal(stations[0].level, '1.42m');
  assert.equal(stations[0].source, 'IOC_LIVE');
  assert.equal(stations[0].levelSource, 'IOC_LASTVALUE');
  // IOC publishes UTC without a zone designator.
  assert.equal(stations[0].lastUpdated, '2026-11-16T01:00:00.000Z');
  assert.equal(stations[1].code, 'cila');
  assert.equal(stations[1].level, '1.20m'); // seeded fallback base level
  assert.equal(stations[1].levelSource, 'BUILT_IN');
  assert.equal(stations[1].lastUpdated, undefined);
});

test('applyTsunamiToStations spikes matching coastal tide gauges when tsunami active', () => {
  const tsunami: TsunamiScenario = {
    active: true,
    detection_time: '2026-11-16T02:00:00.000Z',
    sensor_id: 'BUOY-INA-01 (Selat Sunda)',
    wave_anomaly: 12.0,
    affected_zones: ['Pesisir Pandeglang / Ujung Kulon', 'Lampung Selatan / Kalianda'],
    response_actions: ['Evakuasi segera'],
    severity: 'CRITICAL',
    timestamp: '2026-11-16T02:00:00.000Z',
  };

  const result = applyTsunamiToStations(SEEDED_IOC_STATIONS, tsunami);
  const ciwandan = result.find((s) => s.code === 'ciwa');
  const jayapura = result.find((s) => s.code === 'jayp');

  assert.ok(ciwandan?.isAnomaly);
  assert.equal(ciwandan?.trend, 'TSUNAMI SURGE');
  assert.equal(ciwandan?.status, 'ALERT');
  assert.equal(jayapura?.isAnomaly, false);
  assert.equal(jayapura?.status, 'OPERATIONAL');
});

test('applyTsunamiToStations paints no surge for a statement without a height', () => {
  const statement: TsunamiScenario = {
    active: true,
    detection_time: '2026-11-16T02:00:00.000Z',
    sensor_id: 'BMKG — pernyataan potensi tsunami',
    wave_anomaly: 0,
    affected_zones: ['110 km BaratDaya CILACAP-JATENG'],
    response_actions: [],
    severity: 'CRITICAL',
    timestamp: '2026-11-16T02:00:00.000Z',
  };

  assert.deepEqual(applyTsunamiToStations(SEEDED_IOC_STATIONS, statement), SEEDED_IOC_STATIONS);
});

test('computeDynamicIntensityAndStatus and buildLiveAgentState reflect severe live earthquakes', () => {
  const earthquakes: RealtimeEarthquakesData = {
    latest_bmkg: {
      Tanggal: '16 Nov 2026',
      Jam: '09:00 WIB',
      DateTime: '2026-11-16T02:00:00Z',
      Coordinates: '-7.90,108.90',
      Lintang: '7.90 LS',
      Bujur: '108.90 BT',
      Magnitude: '7.4',
      Kedalaman: '12 km',
      Wilayah: '110 km BaratDaya CILACAP-JATENG',
      Potensi: 'Peringatan dini berpotensi TSUNAMI untuk wilayah Jawa Selatan',
    },
    recent_bmkg: [],
    recent_usgs: [],
    timestamp: '2026-11-16T02:00:00Z',
  };
  const ocean = OCEAN;
  const weather = WEATHER;
  const now = new Date('2026-11-16T02:10:00Z');

  const { activityIndex, status, tsunami } = computeDynamicIntensityAndStatus({
    earthquakes,
    ocean,
    weather,
    now,
  });

  assert.equal(status.risk_level, 'CRITICAL');
  assert.equal(tsunami?.active, true);
  assert.ok(activityIndex.overall_percentage >= 90);
  // The product does not declare a warning active in its own voice; it names BMKG's statement.
  assert.equal(status.ocean_status, 'BMKG: BERPOTENSI TSUNAMI');

  const agent = buildLiveAgentState({
    snapshot: {
      earthquakes,
      volcanoes: [],
      ocean,
      weather,
      activityIndex,
      status,
      tsunami,
    },
    activeProvider: 'gemini',
    activeModel: 'Google Gemini 2.5 Flash',
    now,
  });

  assert.equal(agent.current_risk, 'CRITICAL');
  assert.equal(agent.status, 'ALERT_DISPATCH');
  assert.match(agent.recent_thoughts[0].message, /M7\.4/);
});

test('an old deep earthquake in the list does not raise today\'s level', () => {
  const { status, activityIndex } = assess(livePayload(bmkgLatest(), [quake(6.4, 160, hoursAgo(19 * 24))]));

  assert.equal(status.risk_level, 'NORMAL');
  assert.ok(status.risk_reasons && status.risk_reasons.length > 0);
  assert.equal(status.active_alerts, 0);
  assert.equal(activityIndex.max_magnitude, 3.8);
  assert.ok(activityIndex.overall_percentage < 40);
  assert.equal(status.seismic_intensity, activityIndex.overall_percentage);
});

test('a shallow M6.0 raises the level for 24 hours and no longer', () => {
  const inside = assess(livePayload(bmkgLatest(), [quake(6.0, 10, hoursAgo(23))]));
  assert.equal(inside.status.risk_level, 'HIGH');
  assert.equal(inside.status.active_alerts, 1);
  assert.ok(inside.activityIndex.overall_percentage >= 70 && inside.activityIndex.overall_percentage < 90);

  const outside = assess(livePayload(bmkgLatest(), [quake(6.0, 10, hoursAgo(25))]));
  assert.equal(outside.status.risk_level, 'NORMAL');
  assert.equal(outside.status.active_alerts, 0);
  assert.ok(outside.activityIndex.overall_percentage < 40);
});

test('the USGS catalogue never drives the level', () => {
  const { status } = assess(livePayload(bmkgLatest(), [], [quake(7.5, 10, hoursAgo(1), '90 km S of Bengkulu')]));
  // The BMKG list did not answer here, so the honest reading is unknown, not a level USGS set.
  assert.equal(status.risk_level, 'UNKNOWN');

  const withList = assess(
    livePayload(bmkgLatest(), [quake(5.1, 150, hoursAgo(30))], [quake(7.5, 10, hoursAgo(1), '90 km S of Bengkulu')])
  );
  assert.equal(withList.status.risk_level, 'NORMAL');
});

test('a seeded payload is unknown, carries seed provenance and no tsunami', () => {
  const seeded = buildEarthquakesPayload({ latest: null, recentBMKG: [], recentUSGS: [], fetchedAt: NOW.toISOString() });

  assert.equal(seeded.latest_bmkg?.seeded, true);
  assert.equal(seeded.latest_bmkg?.Potensi, '');
  assert.ok([...seeded.recent_bmkg, ...seeded.recent_usgs].every((event) => event.seeded === true));
  assert.deepEqual(seeded.provenance, {
    bmkg_latest: { state: 'seed', fetched_at: NOW.toISOString() },
    bmkg_recent: { state: 'seed', fetched_at: NOW.toISOString() },
    usgs: { state: 'seed', fetched_at: NOW.toISOString() },
  });

  const { status, tsunami, activityIndex } = assess(seeded);
  assert.equal(status.risk_level, 'UNKNOWN');
  assert.equal(tsunami, null);
  assert.equal(status.tsunami_scenario, undefined);
  assert.equal(status.active_alerts, 0);
  assert.equal(activityIndex.overall_percentage, 0);
  assert.equal(status.provenance?.bmkg_latest?.state, 'seed');
  assert.equal(status.provenance?.ioc?.state, 'live');
  assert.equal(status.provenance?.open_meteo?.state, 'live');

  // The bare placeholder constant carries no provenance and must not read as routine either.
  assert.equal(assess(FALLBACK_EARTHQUAKES).status.risk_level, 'UNKNOWN');
});

test('a BMKG tsunami statement is relayed without invented content', () => {
  const statementQuake = bmkgLatest({
    DateTime: '2026-11-16T02:00:00+00:00',
    Magnitude: '7.4',
    Kedalaman: '12 km',
    Wilayah: '110 km BaratDaya CILACAP-JATENG',
    Potensi: 'Berpotensi tsunami untuk diteruskan pada masyarakat',
  });
  const earthquakes = livePayload(statementQuake, []);

  const first = assess(earthquakes, new Date('2026-11-16T02:10:00Z'));
  const later = assess(earthquakes, new Date('2026-11-16T05:00:00Z'));

  assert.equal(first.status.risk_level, 'CRITICAL');
  assert.ok(first.activityIndex.overall_percentage >= 90);
  assert.match(first.status.risk_reasons?.[0] ?? '', /^Pernyataan BMKG: Berpotensi tsunami/);
  // One event that raises the level, plus the statement.
  assert.equal(first.status.active_alerts, 2);

  assert.deepEqual(first.tsunami, {
    active: true,
    detection_time: '2026-11-16T02:00:00+00:00',
    sensor_id: 'BMKG — pernyataan potensi tsunami',
    wave_anomaly: 0,
    affected_zones: ['110 km BaratDaya CILACAP-JATENG'],
    response_actions: ['Rujuk buletin Peringatan Dini Tsunami BMKG untuk status dan estimasi tiba per wilayah.'],
    severity: 'CRITICAL',
    timestamp: '2026-11-16T02:00:00+00:00',
  });
  assert.deepEqual(later.tsunami, first.tsunami);

  // A statement on a placeholder record is not BMKG's and changes nothing.
  const placeholder = assess({ ...earthquakes, latest_bmkg: { ...statementQuake, seeded: true } });
  assert.equal(placeholder.tsunami, null);
  assert.notEqual(placeholder.status.risk_level, 'CRITICAL');
});

test('the server-side statement survives an aftershock and lapses with the hold period', () => {
  const mainshockListed: SeismicEvent = {
    ...buildSeismicEvent({
      magnitude: 7.4,
      depth: 12,
      latitude: -7.9,
      longitude: 108.9,
      faultZone: '110 km BaratDaya CILACAP-JATENG',
      timestamp: '2026-11-16T02:00:00+00:00',
    }),
    potensi: 'Berpotensi tsunami untuk diteruskan pada masyarakat',
  };
  // Nine minutes later an aftershock is BMKG's latest report; the statement is only on the list.
  const aftershock = bmkgLatest({
    DateTime: '2026-11-16T02:09:00+00:00',
    Coordinates: '-7.95,108.80',
    Magnitude: '5.1',
    Kedalaman: '15 km',
    Wilayah: '112 km BaratDaya CILACAP-JATENG',
    Potensi: 'Tidak berpotensi tsunami',
  });
  const earthquakes = livePayload(aftershock, [mainshockListed]);

  const soon = assess(earthquakes, new Date('2026-11-16T02:12:00Z'));
  assert.equal(soon.status.risk_level, 'CRITICAL');
  assert.equal(soon.status.ocean_status, 'BMKG: BERPOTENSI TSUNAMI');
  assert.equal(soon.tsunami?.detection_time, '2026-11-16T02:00:00+00:00');
  assert.match(soon.status.risk_reasons?.[0] ?? '', /^Pernyataan BMKG: Berpotensi tsunami/);

  const agent = buildLiveAgentState({
    snapshot: { earthquakes, volcanoes: [], ocean: OCEAN, weather: WEATHER, ...soon },
    activeProvider: 'gemini',
    activeModel: 'Ringkasan otomatis (bukan AI)',
    now: new Date('2026-11-16T02:12:00Z'),
  });
  const decide = agent.recent_thoughts.find((thought) => thought.phase === 'DECIDE')?.message ?? '';
  // The statement is attributed to the earthquake it was made for, not to the latest report.
  assert.match(decide, /potensi tsunami untuk gempa M7\.4 \(110 km BaratDaya CILACAP-JATENG\)/);

  // Seven hours on, with the record still on the feed, it is no longer treated as in force.
  const late = assess(earthquakes, new Date('2026-11-16T09:01:00Z'));
  assert.notEqual(late.status.risk_level, 'CRITICAL');
  assert.equal(late.tsunami, null);
  assert.doesNotMatch(late.status.ocean_status, /TSUNAMI/);

  // BMKG's termination text on the latest report closes the statement on the list as well.
  const terminated = assess(
    livePayload(bmkgLatest({ DateTime: '2026-11-16T02:00:00+00:00', Magnitude: '7.4', Potensi: 'Peringatan dini tsunami dinyatakan telah berakhir' }), [mainshockListed]),
    new Date('2026-11-16T04:30:00Z')
  );
  assert.equal(terminated.tsunami, null);
});

test('provenance carries the time each feed was really read', () => {
  const payload = buildEarthquakesPayload({
    latest: bmkgLatest(),
    recentBMKG: [quake(5.2, 20, hoursAgo(3))],
    recentUSGS: [],
    fetchedAt: '2026-11-16T03:00:20.000Z',
    fetchedAtByFeed: { bmkg_latest: '2026-11-16T03:00:00.000Z', usgs: '2026-11-16T02:59:40.000Z' },
  });
  assert.equal(payload.timestamp, '2026-11-16T03:00:20.000Z');
  assert.deepEqual(payload.provenance?.bmkg_latest, { state: 'live', fetched_at: '2026-11-16T03:00:00.000Z' });
  // No separate read time given: the assembly time stands in.
  assert.deepEqual(payload.provenance?.bmkg_recent, { state: 'live', fetched_at: '2026-11-16T03:00:20.000Z' });
  assert.deepEqual(payload.provenance?.usgs, { state: 'failed', fetched_at: '2026-11-16T02:59:40.000Z' });
});

test('feed parsers skip entries without a usable time or magnitude instead of inventing them', () => {
  const recent = parseBMKGRecent({
    Infogempa: {
      gempa: [
        { DateTime: '2026-11-16T01:00:00+00:00', Coordinates: '-4.50,101.80', Magnitude: '5.6', Kedalaman: '30 km', Wilayah: '80 km BaratDaya Bengkulu', Potensi: 'Tidak berpotensi tsunami' },
        { DateTime: '', Coordinates: '-4.50,101.80', Magnitude: '5.2', Kedalaman: '10 km', Wilayah: 'tanpa waktu' },
        { DateTime: '2026-11-16T00:00:00+00:00', Coordinates: '-4.50,101.80', Magnitude: 'n/a', Kedalaman: '10 km', Wilayah: 'tanpa magnitudo' },
      ],
    },
  });
  assert.equal(recent.length, 1);
  assert.equal(recent[0].magnitude, 5.6);
  assert.equal(recent[0].timestamp, '2026-11-16T01:00:00+00:00');
  assert.equal(recent[0].potensi, 'Tidak berpotensi tsunami');

  const usgs = parseUSGSRecent({
    features: [
      { properties: { mag: 4.7, place: '90 km S of Bengkulu', time: Date.UTC(2026, 10, 16, 1) }, geometry: { coordinates: [102.1, -4.9, 35] } },
      { properties: { mag: null, place: 'no magnitude', time: Date.UTC(2026, 10, 16, 1) }, geometry: { coordinates: [102.1, -4.9, 35] } },
      { properties: { mag: 5.0, place: 'no time' }, geometry: { coordinates: [102.1, -4.9, 35] } },
    ],
  });
  assert.equal(usgs.length, 1);
  assert.equal(usgs[0].timestamp, '2026-11-16T01:00:00.000Z');

  assert.equal(parseBMKGLatest({ Infogempa: { gempa: { Magnitude: '5.0', DateTime: 'kemarin' } } }), null);
  assert.equal(parseBMKGLatest(null), null);

  // Fields of the wrong type are made text, and a "seeded" flag in upstream JSON is not honoured.
  const untyped = parseBMKGLatest({
    Infogempa: { gempa: { Magnitude: 5.2, Kedalaman: 10, DateTime: '2026-11-16T01:00:00+00:00', Wilayah: null, seeded: true } },
  });
  assert.equal(untyped?.Magnitude, '5.2');
  assert.equal(untyped?.Kedalaman, '10');
  assert.equal(untyped?.Wilayah, '');
  assert.equal(untyped?.Potensi, '');
  assert.equal(untyped?.seeded, undefined);
  // Such a record must pass through the level computation without throwing.
  const level = assess(livePayload(untyped as BMKGGempaDetail, [quake(4.8, 20, hoursAgo(30))])).status.risk_level;
  assert.equal(level, 'ELEVATED');
});

test('a partly live payload is never topped up with placeholder quakes', () => {
  const recentBMKG = [quake(5.2, 20, hoursAgo(30)), quake(5.6, 30, hoursAgo(4))];
  const payload = buildEarthquakesPayload({ latest: null, recentBMKG, recentUSGS: [], fetchedAt: NOW.toISOString() });

  // The stand-in for the missing latest report is the newest list entry, marked and without a Potensi sentence.
  assert.equal(payload.latest_bmkg?.seeded, true);
  assert.equal(payload.latest_bmkg?.Magnitude, '5.6');
  assert.equal(payload.latest_bmkg?.Potensi, '');
  assert.deepEqual(payload.recent_usgs, []);
  assert.equal(payload.provenance?.bmkg_latest?.state, 'seed');
  assert.equal(payload.provenance?.bmkg_recent?.state, 'live');
  assert.equal(payload.provenance?.usgs?.state, 'failed');
  assert.ok(payload.recent_bmkg.every((event) => !event.seeded));
});

test('the upstream reader memoises, tolerates one failed read, and reports an outage', async () => {
  const T0 = Date.parse('2026-11-16T03:00:00Z');
  let nowMs = T0;
  let calls = 0;
  let upstream: 'ok' | 'down' = 'ok';
  const read = createUpstreamReader(
    async () => {
      calls += 1;
      if (upstream === 'down') throw new Error('timeout');
      return new Response(JSON.stringify({ n: calls }), { status: 200 });
    },
    () => nowMs
  );
  const options = { timeoutMs: 1000, ttlSeconds: 30, parse: 'json' as const };
  const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();

  // Within the TTL the upstream is asked once, however many routes read it.
  assert.deepEqual(await read('https://example.test/feed', options), { body: { n: 1 }, fetchedAt: at(0) });
  nowMs = T0 + 20_000;
  assert.deepEqual(await read('https://example.test/feed', options), { body: { n: 1 }, fetchedAt: at(0) });
  assert.equal(calls, 1);

  // One failed read: the last good body stands in, still stamped with its own fetch time.
  upstream = 'down';
  nowMs = T0 + 40_000;
  assert.deepEqual(await read('https://example.test/feed', options), { body: { n: 1 }, fetchedAt: at(0) });
  assert.equal(calls, 2);
  // The failure is not held for the whole TTL: five seconds on the upstream is asked again.
  nowMs = T0 + 43_000;
  await read('https://example.test/feed', options);
  assert.equal(calls, 2);
  nowMs = T0 + 46_000;
  await read('https://example.test/feed', options);
  assert.equal(calls, 3);

  // Past the tolerance (twice the TTL) the outage is reported: no body, the time of the failed attempt.
  nowMs = T0 + 70_000;
  assert.deepEqual(await read('https://example.test/feed', options), { body: null, fetchedAt: at(70) });

  // Recovery is picked up on the next read.
  upstream = 'ok';
  nowMs = T0 + 76_000;
  const recovered = await read('https://example.test/feed', options);
  assert.deepEqual(recovered, { body: { n: calls }, fetchedAt: at(76) });

  // A feed that has never answered has nothing to stand in.
  upstream = 'down';
  assert.deepEqual(await read('https://example.test/other', options), { body: null, fetchedAt: at(76) });
});

test('a slow feed does not hold its callers: the read finishes in the background', async () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let calls = 0;
  const read = createUpstreamReader(async () => {
    calls += 1;
    await sleep(60);
    return new Response(JSON.stringify({ stations: 172 }), { status: 200 });
  });
  const options = { timeoutMs: 1000, waitMs: 15, ttlSeconds: 30, parse: 'json' as const };

  // The first caller gives up waiting and goes on without a body, told that the read is still running…
  const first = await read('https://example.test/slow', options);
  assert.equal(first.body, null);
  assert.equal(first.pending, true);
  // …a second caller meanwhile shares the same request instead of starting another…
  const second = await read('https://example.test/slow', options);
  assert.equal(second.body, null);
  assert.equal(calls, 1);
  // …and once it lands, callers get the body without a new request.
  await sleep(80);
  const later = await read('https://example.test/slow', options);
  assert.deepEqual(later.body, { stations: 172 });
  assert.equal(calls, 1);
});

test('while a slow feed refreshes, callers get the copy already held, at once', async () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const T0 = Date.parse('2026-11-16T03:00:00Z');
  let nowMs = T0;
  let calls = 0;
  const read = createUpstreamReader(
    async () => {
      calls += 1;
      if (calls > 1) await sleep(60);
      return new Response(JSON.stringify({ version: calls }), { status: 200 });
    },
    () => nowMs
  );
  const options = { timeoutMs: 1000, waitMs: 500, ttlSeconds: 30, parse: 'json' as const };

  assert.deepEqual((await read('https://example.test/list', options)).body, { version: 1 });

  // Past the TTL a refresh starts; it is slow, and the caller is not made to wait for it.
  nowMs = T0 + 40_000;
  const started = performance.now();
  const during = await read('https://example.test/list', options);
  assert.deepEqual(during.body, { version: 1 });
  assert.equal(during.fetchedAt, new Date(T0).toISOString());
  assert.ok(performance.now() - started < 40, 'the held copy is returned without waiting for the refresh');
  assert.equal(calls, 2);

  // Once the refresh lands, its body is what callers get.
  await sleep(90);
  assert.deepEqual((await read('https://example.test/list', options)).body, { version: 2 });
});

test('BMKG\'s felt list is parsed and carried in the payload with its own provenance', () => {
  const felt = parseBMKGFelt({
    Infogempa: {
      gempa: [
        { Tanggal: '22 Nov 2026', Jam: '14:54:39 WIB', DateTime: '2026-11-22T07:54:39+00:00', Coordinates: '3.12,126.57', Magnitude: '5.4', Kedalaman: '10 km', Wilayah: 'Pusat gempa berada di laut 98 km BaratDaya Melonguane', Dirasakan: 'II Tahuna' },
        { DateTime: 'kemarin', Magnitude: '4.0', Dirasakan: 'III Padang' },
        { DateTime: '2026-11-21T23:16:01+00:00', Magnitude: 4.8, Kedalaman: 6, Dirasakan: 'II - III Kota Jayapura', seeded: true },
      ],
    },
  });
  // The undated entry is skipped; numbers are made text; a "seeded" flag in upstream JSON is not honoured.
  assert.equal(felt.length, 2);
  assert.equal(felt[0].Dirasakan, 'II Tahuna');
  assert.equal(felt[1].Magnitude, '4.8');
  assert.equal(felt[1].Kedalaman, '6');
  assert.equal(felt[1].seeded, undefined);
  assert.deepEqual(parseBMKGFelt(null), []);

  const payload = buildEarthquakesPayload({
    latest: bmkgLatest(),
    recentBMKG: [quake(5.2, 20, hoursAgo(3))],
    recentUSGS: [],
    feltBMKG: felt,
    fetchedAt: NOW.toISOString(),
  });
  assert.equal(payload.felt_bmkg?.length, 2);
  assert.equal(payload.provenance?.bmkg_felt?.state, 'live');
  assert.equal(
    buildEarthquakesPayload({ latest: bmkgLatest(), recentBMKG: [], recentUSGS: [], feltBMKG: [], fetchedAt: NOW.toISOString() })
      .provenance?.bmkg_felt?.state,
    'failed'
  );
  // Callers that do not read the felt list leave both out.
  const without = buildEarthquakesPayload({ latest: bmkgLatest(), recentBMKG: [], recentUSGS: [], fetchedAt: NOW.toISOString() });
  assert.equal(without.felt_bmkg, undefined);
  assert.equal(without.provenance?.bmkg_felt, undefined);
});
