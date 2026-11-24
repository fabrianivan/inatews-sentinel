import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_SUMMARY_MODEL_LABEL,
  buildContextAwareFallbackAnswer,
  buildDrillAIAnalysis,
  buildLiveAIAnalysis,
  formatContextBrief,
  getLiveModelLabel,
  getProviderModelLabel,
  normalizeAIProvider,
  type TelemetryPromptContext,
} from '../aiContext';
import type { LiveTelemetrySnapshot } from '../telemetry';
import type { AIAnalysis, BMKGGempaDetail, SeismicEvent } from '../types';

const NOW = new Date('2026-11-16T05:00:00Z');

function makeQuake(overrides: Partial<BMKGGempaDetail> = {}): BMKGGempaDetail {
  return {
    Tanggal: '16 Nov 2026',
    Jam: '09:00:00 WIB',
    DateTime: '2026-11-16T02:00:00+00:00',
    Coordinates: '4.10,126.00',
    Lintang: '4.10 LU',
    Bujur: '126.00 BT',
    Magnitude: '5.4',
    Kedalaman: '10 km',
    Wilayah: 'Pusat gempa berada di laut 98 km BaratDaya Melonguane',
    Potensi: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    Dirasakan: 'III Melonguane, II-III Tahuna',
    ...overrides,
  };
}

function makeEvent(magnitude: number, seeded = false): SeismicEvent {
  return {
    type: 'SEISMIC',
    magnitude,
    depth: 10,
    frequency: 3.6,
    count: 1,
    latitude: 4.1,
    longitude: 126,
    mmi: 3,
    pga: 0.01,
    fault_zone: 'Laut Maluku',
    timestamp: '2026-11-16T02:00:00Z',
    seeded,
  };
}

function makeSnapshot(latest: BMKGGempaDetail | null = makeQuake()): LiveTelemetrySnapshot {
  const timestamp = NOW.toISOString();
  return {
    earthquakes: {
      latest_bmkg: latest,
      recent_bmkg: [makeEvent(5.4), makeEvent(4.1)],
      recent_usgs: [makeEvent(5.6)],
      timestamp,
    },
    volcanoes: [],
    ocean: {
      stations: [],
      count: 20,
      live_count: 15,
      anomaly_count: 0,
      source: 'IOC_LIVE',
      timestamp,
    },
    weather: {
      statusLabel: '18 km/h • 29.0°C',
      avgWindKmh: 18,
      maxWindKmh: 22,
      avgTempC: 29.0,
      stationName: 'Selat Sunda & Selatan Jawa',
      source: 'OPEN_METEO',
      timestamp,
    },
    activityIndex: {
      overall_percentage: 47,
      seismic_change: 11.5,
      tremor_change: 2.8,
      deformation_trend: 'REALTIME_MONITORED',
      thermal_trend: 'MONITORED',
      trend_direction: 'STABLE',
      earthquake_count: 4,
      avg_magnitude: 5.0,
      max_magnitude: 5.6,
      timestamp,
    },
    status: {
      seismic_intensity: 47,
      ocean_status: 'IOC LIVE (15 STASIUN)',
      weather_status: '18 km/h • 29.0°C',
      infra_status: 'OPERASIONAL',
      active_alerts: 0,
      risk_level: 'ELEVATED',
      trend_direction: 'STABLE',
      last_update: timestamp,
    },
    tsunami: null,
  };
}

function makeDrillContext(
  phase: Partial<NonNullable<TelemetryPromptContext['phase']>> = {}
): TelemetryPromptContext {
  return {
    mode: 'SIMULASI',
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
      shortLabel: 'PD-2',
      title: 'PD-2 — pemutakhiran parameter dan status ancaman',
      activityLevel: 98,
      tsunamiActive: true,
      ...phase,
    },
  };
}

/** Every string a panel block can show. */
function analysisText(analysis: AIAnalysis): string {
  return [
    analysis.status,
    analysis.threat_summary ?? '',
    analysis.assessment,
    ...analysis.observations,
    ...analysis.recommendations,
    ...(analysis.agency_actions ?? []).flatMap((action) => [action.agency, action.priority, action.action]),
    ...Object.values(analysis.hazard_details ?? {}).map(String),
    ...analysis.contributing_factors.flatMap((factor) => [factor.indicator, factor.value, factor.change]),
    analysis.model_used ?? '',
    analysis.disclaimer,
  ].join('\n');
}

const QUESTIONS = [
  'Berapa tinggi gelombang tsunami dan jalur evakuasi?',
  'Apa rekomendasi evakuasi segera untuk warga pesisir?',
  'Apakah jembatan dan pelabuhan perlu ditutup sekarang?',
  'Apa instruksi prioritas untuk tim SAR gabungan BASARNAS dan BNPB?',
  'Bagaimana situasi terkini?',
];

function assertWithinRealModeLimits(text: string): void {
  assert.doesNotMatch(text, /sirine|sirene/i);
  assert.doesNotMatch(text, /radius/i);
  assert.doesNotMatch(text, /terkendali/i);
  assert.doesNotMatch(text, /tidak ada indikasi tsunami/i);
  // No percentages at all: neither a confidence nor an "MMI" attached to the 0-100 index.
  assert.doesNotMatch(text, /%/);
  assert.doesNotMatch(text, /MMI[^\n]*\/100|\/100[^\n]*MMI/);
  assert.doesNotMatch(text, /megathrust drill/i);
}

test('normalizeAIProvider and getProviderModelLabel handle defaults safely', () => {
  assert.equal(normalizeAIProvider('bedrock'), 'bedrock');
  assert.equal(normalizeAIProvider('BEDROCK'), 'bedrock');
  assert.equal(normalizeAIProvider('unknown'), 'gemini');
  assert.match(getProviderModelLabel('bedrock'), /Claude 3\.5 Sonnet/);
  assert.match(getProviderModelLabel('gemini'), /Gemini 2\.5 Flash/);
});

test('only a model answer carries the "(Live API)" label', () => {
  assert.match(getLiveModelLabel('gemini'), /Gemini 2\.5 Flash \(Live API\)$/);
  assert.doesNotMatch(AUTO_SUMMARY_MODEL_LABEL, /Live API|Gemini|Claude/);
  assert.equal(AUTO_SUMMARY_MODEL_LABEL, 'Ringkasan otomatis (bukan AI)');
});

test('buildContextAwareFallbackAnswer injects the active SIMULASI scenario', () => {
  const snapshot = makeSnapshot();
  const context = makeDrillContext();

  const reply = buildContextAwareFallbackAnswer({
    question: 'Berapa tinggi gelombang tsunami dan jalur evakuasi?',
    kind: 'copilot',
    provider: 'gemini',
    context,
    snapshot,
  });

  assert.match(reply, /Mentawai-Siberut Megathrust M9\.0/);
  // Changed on purpose: display values use the Indonesian decimal comma (was "25.0 meter").
  assert.match(reply, /25,0 meter/);
  assert.match(reply, /Padang \/ Teluk Bayur/);
  assert.match(reply, /15 menit/);

  const brief = formatContextBrief(context, snapshot);
  assert.match(brief, /Mode Operasi: SIMULASI/);
  assert.match(brief, /Mentawai-Siberut Megathrust M9\.0/);
});

test('buildLiveAIAnalysis reports sourced facts and names itself as a template', () => {
  const analysis = buildLiveAIAnalysis({ snapshot: makeSnapshot(), provider: 'bedrock', now: NOW });

  // Changed on purpose: the summary leads with BMKG's quake and its age instead of a station
  // count, and a template no longer borrows the selected provider's model name.
  assert.equal(
    analysis.threat_summary,
    'BMKG: M5,4 · 10 km · laut 98 km BaratDaya Melonguane · 3 jam lalu'
  );
  assert.equal(analysis.model_used, AUTO_SUMMARY_MODEL_LABEL);
  assert.ok(analysis.observations.length >= 4);
  assert.ok(analysis.observations.some((line) => /IOC UNESCO: 15 stasiun pasut/.test(line)));
  assert.ok(
    analysis.observations.includes(
      'Keterangan BMKG: "Gempa ini dirasakan untuk diteruskan pada masyarakat"'
    )
  );
  assert.ok(analysis.observations.some((line) => /Indeks aktivitas \(heuristik\): 47\/100/.test(line)));
  assert.equal(analysis.status, 'ELEVATED');
});

test('REAL status never drops below NORMAL and is UNKNOWN without quake data', () => {
  const quiet = makeSnapshot();
  quiet.status.risk_level = 'ADVISORY';
  assert.equal(buildLiveAIAnalysis({ snapshot: quiet, now: NOW }).status, 'NORMAL');

  const empty = makeSnapshot(null);
  empty.earthquakes.recent_bmkg = [makeEvent(5.2, true)];
  empty.earthquakes.recent_usgs = [];
  const analysis = buildLiveAIAnalysis({ snapshot: empty, now: NOW });
  assert.equal(analysis.status, 'UNKNOWN');
  assert.match(analysis.threat_summary ?? '', /tidak tersedia/);
  assert.match(analysis.assessment, /tidak tersedia/);
});

test('a seeded placeholder quake is never reported as BMKG data', () => {
  const snapshot = makeSnapshot(makeQuake({ seeded: true, Wilayah: 'Selat Sunda — placeholder' }));
  const text = analysisText(buildLiveAIAnalysis({ snapshot, now: NOW }));
  assert.doesNotMatch(text, /placeholder/);
  assert.match(text, /BMKG: data gempa terkini tidak tersedia/);
});

test('REAL template output stays within what an unofficial dashboard may say', () => {
  const snapshot = makeSnapshot();
  const analysis = buildLiveAIAnalysis({ snapshot, now: NOW });
  assertWithinRealModeLimits(analysisText(analysis));
  assertWithinRealModeLimits(formatContextBrief({ mode: 'REAL' }, snapshot, NOW));

  // "MMI" appears only with BMKG's felt report.
  const mmiLines = analysisText(analysis).split('\n').filter((line) => line.includes('MMI'));
  assert.deepEqual(mmiLines, ['BMKG, dirasakan (MMI): "III Melonguane, II-III Tahuna"']);

  // Nothing is estimated where no feed gives a value.
  assert.match(analysis.hazard_details?.tsunami_runup_estimate ?? '', /tidak tersedia dari umpan publik/);
  assert.equal(analysis.hazard_details?.evacuation_window_min, 0);
  assert.equal(analysis.confidence, 0);

  for (const kind of ['copilot', 'agent'] as const) {
    for (const question of QUESTIONS) {
      const reply = buildContextAwareFallbackAnswer({
        question,
        kind,
        provider: 'gemini',
        context: { mode: 'REAL' },
        snapshot,
        now: NOW,
      });
      assertWithinRealModeLimits(reply);
      assert.match(reply, /bukan jawaban AI/);
      assert.doesNotMatch(reply, /\[SIMULASI\]/);
    }
  }
});

test('REAL output quotes a BMKG tsunami statement without adding estimates', () => {
  const potensi = 'Berpotensi tsunami untuk diteruskan pada masyarakat';
  const snapshot = makeSnapshot(makeQuake({ Magnitude: '7.6', Potensi: potensi }));
  const analysis = buildLiveAIAnalysis({ snapshot, now: NOW });
  const text = analysisText(analysis);

  assert.equal(analysis.status, 'CRITICAL');
  assert.ok(analysis.observations.includes(`Keterangan BMKG: "${potensi}"`));
  assert.match(analysis.assessment, new RegExp(`BMKG menyatakan: "${potensi}"`));
  assertWithinRealModeLimits(text);
  assert.doesNotMatch(text, /\d\s*(m|meter)\b/);
  assert.doesNotMatch(text, /\d\s*menit/);
  assert.ok(analysis.recommendations.every((line) => /BMKG|BPBD/.test(line)));
});

test('an aftershock on the feed does not replace BMKG\'s tsunami statement', () => {
  const potensi = 'Berpotensi tsunami untuk diteruskan pada masyarakat';
  // The mainshock is now only on the M ≥ 5 list; the latest report is an aftershock.
  const mainshock: SeismicEvent = { ...makeEvent(7.6), timestamp: '2026-11-16T04:40:00Z', potensi };
  const aftershock = makeQuake({
    DateTime: '2026-11-16T04:50:00+00:00',
    Magnitude: '5.1',
    Potensi: 'Tidak berpotensi tsunami',
    Dirasakan: undefined,
  });
  const snapshot = makeSnapshot(aftershock);
  snapshot.earthquakes.recent_bmkg = [mainshock];

  const analysis = buildLiveAIAnalysis({ snapshot, now: NOW });
  const text = analysisText(analysis);
  assert.equal(analysis.status, 'CRITICAL');
  assert.match(analysis.threat_summary ?? '', /^BMKG menyatakan potensi tsunami — M7,6 · /);
  assert.match(analysis.assessment, new RegExp(`^BMKG menyatakan untuk gempa M7,6 .*: "${potensi}"`));
  // The aftershock's own remark is quoted, but as applying to that earthquake only.
  assert.match(analysis.assessment, /\("Tidak berpotensi tsunami"\) hanya berlaku untuk gempa itu/);
  assert.doesNotMatch(analysis.assessment, /Menurut BMKG: "Tidak berpotensi tsunami"/);
  assert.ok(analysis.observations.some((line) => line.startsWith('Pernyataan tsunami BMKG untuk gempa sebelumnya (M7,6')));
  assert.equal(analysis.agency_actions?.[0].priority, 'IMMEDIATE');
  assertWithinRealModeLimits(text);

  const brief = formatContextBrief({ mode: 'REAL' }, snapshot, NOW);
  assert.match(brief, /Keterangan BMKG untuk gempa terkini \(kutipan\): "Tidak berpotensi tsunami"/);
  assert.match(brief, new RegExp(`Pernyataan tsunami BMKG untuk gempa sebelumnya \\(M7,6 .*\\): "${potensi}"`));

  const reply = buildContextAwareFallbackAnswer({
    question: 'Apa rekomendasi evakuasi segera untuk warga pesisir?',
    kind: 'copilot',
    provider: 'gemini',
    context: { mode: 'REAL', latestQuake: aftershock },
    snapshot,
    now: NOW,
  });
  assert.match(reply, /Pernyataan tsunami BMKG untuk gempa sebelumnya/);
  assert.match(reply, /BMKG menyatakan potensi tsunami untuk gempa sebelumnya/);

  // Past the hold period, with the record still listed, the summary stops calling it in force.
  const late = new Date('2026-11-16T11:00:00Z');
  const lateAnalysis = buildLiveAIAnalysis({ snapshot, now: late });
  assert.notEqual(lateAnalysis.status, 'CRITICAL');
  assert.doesNotMatch(lateAnalysis.threat_summary ?? '', /potensi tsunami/);
});

test('an unknown attention level stays unknown and prints no index', () => {
  // BMKG failed while USGS answered: there is quake data, but nothing the level may be read from.
  const partial = makeSnapshot(null);
  partial.earthquakes.recent_bmkg = [];
  partial.status.risk_level = 'UNKNOWN';
  partial.activityIndex.overall_percentage = 0;

  const analysis = buildLiveAIAnalysis({ snapshot: partial, now: NOW });
  assert.equal(analysis.status, 'UNKNOWN');
  assert.ok(analysis.observations.includes('Indeks aktivitas (heuristik): tidak tersedia.'));
  assert.doesNotMatch(analysisText(analysis), /0\/100/);
  const index = analysis.contributing_factors.find((factor) => factor.indicator.startsWith('Indeks aktivitas'));
  assert.equal(index?.value, 'tidak tersedia');
});

test('a malformed request context is reshaped instead of throwing', () => {
  const snapshot = makeSnapshot();
  // Fields of the wrong type, as an arbitrary client could send them.
  const context = {
    mode: 'REAL',
    latestQuake: { Wilayah: 5, Magnitude: 5.4, Kedalaman: 10, DateTime: 'x', Potensi: null, Coordinates: 12 },
  } as unknown as TelemetryPromptContext;

  const reply = buildContextAwareFallbackAnswer({
    question: 'Bagaimana situasi terkini?',
    kind: 'copilot',
    provider: 'gemini',
    context,
    snapshot,
    now: NOW,
  });
  assert.match(reply, /^\[RINGKASAN OTOMATIS — bukan jawaban AI\]/);
  assert.match(formatContextBrief(context, snapshot, NOW), /^Mode Operasi: REAL/);

  // A drill context missing its scenario fields is not rendered as "undefined — fase undefined".
  const brokenDrill = { mode: 'SIMULASI', scenario: { affectedZones: [] }, phase: {} } as unknown as TelemetryPromptContext;
  const brief = formatContextBrief(brokenDrill, snapshot, NOW);
  assert.doesNotMatch(brief, /undefined/);
  assert.equal(buildDrillAIAnalysis({ context: brokenDrill, now: NOW }), null);
});

test('REAL output never reports the drill quake carried by a drill context', () => {
  const snapshot = makeSnapshot();
  const context: TelemetryPromptContext = {
    mode: 'SIMULASI',
    scenario: null,
    latestQuake: makeQuake({ Magnitude: '9.0', Wilayah: 'Skenario Mentawai' }),
  };
  const brief = formatContextBrief(context, snapshot, NOW);
  assert.doesNotMatch(brief, /M9,0|Skenario Mentawai/);
  assert.match(brief, /BMKG: M5,4/);
});

test('every block of drill output starts with [SIMULASI]', () => {
  const snapshot = makeSnapshot();
  const context = makeDrillContext();

  assert.ok(formatContextBrief(context, snapshot, NOW).startsWith('[SIMULASI]'));
  for (const kind of ['copilot', 'agent'] as const) {
    for (const question of QUESTIONS) {
      const reply = buildContextAwareFallbackAnswer({ question, kind, provider: 'gemini', context, snapshot });
      assert.ok(reply.startsWith('[SIMULASI]'), reply);
      assert.match(reply, /bukan AI/);
      assert.match(reply, /nilai latihan/i);
    }
  }

  const analysis = buildDrillAIAnalysis({ context, now: NOW });
  assert.ok(analysis);
  assert.ok(analysis.threat_summary?.startsWith('[SIMULASI]'));
  assert.ok(analysis.assessment.startsWith('[SIMULASI]'));
  assert.ok(analysis.disclaimer.startsWith('[SIMULASI]'));
  assert.equal(analysis.model_used, AUTO_SUMMARY_MODEL_LABEL);
  assert.equal(analysis.status, 'HIGH');

  const text = analysisText(analysis);
  assert.match(text, /Skenario tsunami \(latihan\)/);
  assert.match(text, /Sensor skenario/);
  assert.match(text, /tingkat Awas \(latihan\)/);
  assert.doesNotMatch(text, /megathrust drill/i);
  assert.doesNotMatch(text, /mengonfirmasi/i);
  assert.doesNotMatch(text, /sirine|sirene/i);
  assert.doesNotMatch(text, /%/);
});

test('buildDrillAIAnalysis is null outside a drill', () => {
  assert.equal(buildDrillAIAnalysis({ context: undefined }), null);
  assert.equal(buildDrillAIAnalysis({ context: { mode: 'REAL' } }), null);
  assert.equal(buildDrillAIAnalysis({ context: { ...makeDrillContext(), phase: null } }), null);
});

test('the drill sea-level value follows tsunamiFactor from the context', () => {
  const snapshot = makeSnapshot();

  // Phase 5 is 0,42 in the fallback table; the context's own factor wins.
  const withFactor = makeDrillContext({ phaseNumber: 5, shortLabel: 'PD-3', tsunamiFactor: 0.8, bulletin: 'PD-3' });
  const brief = formatContextBrief(withFactor, snapshot, NOW);
  assert.match(brief, /anomali muka laut \+20,0 meter/);
  assert.match(brief, /buletin latihan PD-3/);
  assert.match(
    buildDrillAIAnalysis({ context: withFactor, now: NOW })?.threat_summary ?? '',
    /\+20,0 meter/
  );

  // Without it, the per-phase table still applies.
  assert.match(formatContextBrief(makeDrillContext({ phaseNumber: 4 }), snapshot, NOW), /\+25,0 meter/);
  assert.match(formatContextBrief(makeDrillContext({ phaseNumber: 5 }), snapshot, NOW), /\+10,5 meter/);
});

test('drill wording follows the phase flags', () => {
  const snapshot = makeSnapshot();

  const beforeBulletin = formatContextBrief(
    makeDrillContext({ phaseNumber: 2, shortLabel: 'Gempa utama', tsunamiFactor: 0.2, bulletin: null }),
    snapshot,
    NOW
  );
  assert.match(beforeBulletin, /\+5,0 meter/);
  assert.match(beforeBulletin, /buletin latihan belum terbit/);
  assert.doesNotMatch(beforeBulletin, /tingkat Awas/);

  const ended = makeDrillContext({
    phaseNumber: 6,
    shortLabel: 'PD-4',
    activityLevel: 68,
    tsunamiActive: false,
    tsunamiFactor: 0.1,
    bulletin: 'PD-4',
  });
  const endedBrief = formatContextBrief(ended, snapshot, NOW);
  assert.match(endedBrief, /peringatan latihan dinyatakan berakhir \(PD-4\)/);
  assert.doesNotMatch(endedBrief, /anomali muka laut \+/);
  assert.equal(buildDrillAIAnalysis({ context: ended, now: NOW })?.status, 'ELEVATED');
});
