import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContextAwareFallbackAnswer,
  buildLiveAIAnalysis,
  formatContextBrief,
  getProviderModelLabel,
  normalizeAIProvider,
} from '../aiContext';
import {
  computeDynamicIntensityAndStatus,
  FALLBACK_EARTHQUAKES,
  SEEDED_IOC_STATIONS,
  type LiveTelemetrySnapshot,
} from '../telemetry';

function makeSnapshot(): LiveTelemetrySnapshot {
  const ocean = {
    stations: SEEDED_IOC_STATIONS,
    count: SEEDED_IOC_STATIONS.length,
    live_count: 15,
    anomaly_count: 0,
    source: 'IOC_LIVE' as const,
    timestamp: '2026-11-16T02:00:00Z',
  };
  const weather = {
    statusLabel: '18 km/h • 29.0°C (TERPANTAU NOMINAL)',
    avgWindKmh: 18,
    maxWindKmh: 22,
    avgTempC: 29.0,
    stationName: 'Selat Sunda & Selatan Jawa',
    source: 'OPEN_METEO' as const,
    timestamp: '2026-11-16T02:00:00Z',
  };
  const { activityIndex, status, tsunami } = computeDynamicIntensityAndStatus({
    earthquakes: FALLBACK_EARTHQUAKES,
    ocean,
    weather,
  });

  return {
    earthquakes: FALLBACK_EARTHQUAKES,
    volcanoes: [],
    ocean,
    weather,
    activityIndex,
    status,
    tsunami,
  };
}

test('normalizeAIProvider and getProviderModelLabel handle defaults safely', () => {
  assert.equal(normalizeAIProvider('bedrock'), 'bedrock');
  assert.equal(normalizeAIProvider('BEDROCK'), 'bedrock');
  assert.equal(normalizeAIProvider('unknown'), 'gemini');
  assert.match(getProviderModelLabel('bedrock'), /Claude 3\.5 Sonnet/);
  assert.match(getProviderModelLabel('gemini'), /Gemini 2\.5 Flash/);
});

test('buildContextAwareFallbackAnswer injects active SIMULASI Megathrust scenario', () => {
  const snapshot = makeSnapshot();
  const context = {
    mode: 'SIMULASI' as const,
    scenario: {
      id: 'mentawai',
      name: 'Mentawai-Siberut Megathrust M9.0',
      faultZone: 'Segmen Mentawai-Siberut Sumatra Trench',
      magnitude: 9.0,
      depth: 12,
      tsunamiHeight: 25.0,
      affectedZones: ['Padang / Teluk Bayur', 'Kepulauan Mentawai & Siberut'],
      evacuationWindowMin: 15,
    },
    phase: {
      phaseNumber: 4,
      shortLabel: '4. Tsunami Wavefront',
      title: 'Penjalaran Gelombang',
      activityLevel: 98,
      tsunamiActive: true,
    },
  };

  const reply = buildContextAwareFallbackAnswer({
    question: 'Berapa tinggi gelombang tsunami dan jalur evakuasi?',
    kind: 'copilot',
    provider: 'gemini',
    context,
    snapshot,
  });

  assert.match(reply, /Mentawai-Siberut Megathrust M9\.0/);
  assert.match(reply, /25\.0 meter/);
  assert.match(reply, /Padang \/ Teluk Bayur/);
  assert.match(reply, /15 menit/);

  const brief = formatContextBrief(context, snapshot);
  assert.match(brief, /Mode Operasi: SIMULASI/);
  assert.match(brief, /Mentawai-Siberut Megathrust M9\.0/);
});

test('buildLiveAIAnalysis incorporates live IOC count and dynamic intensity percentage', () => {
  const snapshot = makeSnapshot();
  const analysis = buildLiveAIAnalysis({ snapshot, provider: 'bedrock' });

  assert.match(analysis.threat_summary || '', /20 Stasiun IOC/);
  assert.equal(analysis.model_used, 'Anthropic Claude 3.5 Sonnet (AWS Bedrock)');
  assert.ok(analysis.observations.length >= 4);
});
