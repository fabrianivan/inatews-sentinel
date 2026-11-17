import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTsunamiToStations,
  buildLiveAgentState,
  computeDynamicIntensityAndStatus,
  parseBMKGCoords,
  parseBMKGDepth,
  parseIOCStations,
  parseMagmaVolcanoHTML,
  SEEDED_IOC_STATIONS,
  type OceanFeedResponse,
  type WeatherSummary,
} from '../telemetry';
import type { RealtimeEarthquakesData, TsunamiScenario } from '../types';

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

  const parsed = parseMagmaVolcanoHTML(sampleHtml, new Date('2026-11-16T03:00:00Z'));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].volcano_name, 'Marapi');
  assert.equal(parsed[0].time, '10:15 WIB');
  assert.equal(parsed[0].amplitude, '30.5 mm');
  assert.equal(parsed[0].duration, '52 detik');
  assert.equal(parsed[0].alert_level, 'LEVEL III (SIAGA)');
  assert.equal(parsed[0].image_url, 'https://magma.vsi.esdm.go.id/img/crs/sample-marapi.jpg');
  assert.equal(parsed[0].detail_url, 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/12345/show');
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
  assert.equal(stations[1].code, 'cila');
  assert.equal(stations[1].level, '1.20m'); // seeded fallback base level
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
  const ocean: OceanFeedResponse = {
    stations: SEEDED_IOC_STATIONS,
    count: SEEDED_IOC_STATIONS.length,
    live_count: 18,
    anomaly_count: 0,
    source: 'IOC_LIVE',
    timestamp: '2026-11-16T02:00:00Z',
  };
  const weather: WeatherSummary = {
    statusLabel: '24 km/h • 28.4°C (TERPANTAU NOMINAL)',
    avgWindKmh: 24,
    maxWindKmh: 28,
    avgTempC: 28.4,
    stationName: 'Selat Sunda',
    source: 'OPEN_METEO',
    timestamp: '2026-11-16T02:00:00Z',
  };

  const { activityIndex, status, tsunami } = computeDynamicIntensityAndStatus({
    earthquakes,
    ocean,
    weather,
  });

  assert.equal(status.risk_level, 'CRITICAL');
  assert.equal(tsunami?.active, true);
  assert.ok(activityIndex.overall_percentage >= 90);
  assert.equal(status.ocean_status, 'TSUNAMI WARNING ACTIVE');

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
  });

  assert.equal(agent.current_risk, 'CRITICAL');
  assert.equal(agent.status, 'ALERT_DISPATCH');
  assert.match(agent.recent_thoughts[0].message, /M7\.4/);
});
