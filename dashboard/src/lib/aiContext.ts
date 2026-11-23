/**
 * Text for the decision-support panel: the prompt context handed to a model,
 * and the templates used when no model answers.
 *
 * The dashboard is unofficial, so everything written here summarises facts with
 * their source and points to the agencies that decide. In REAL mode it never
 * issues evacuation orders, distances, wave heights, arrival times or siren
 * instructions, never states an all-clear, and never claims a measurement that
 * no feed provides. Drill text is always marked "[SIMULASI]" and worded as
 * training values. Template output is labelled as such — never as AI.
 */

import type { AIAnalysis, BMKGGempaDetail } from './types';
import type { LiveTelemetrySnapshot } from './telemetry';
import {
  OFFICIAL_LEVEL_LABEL,
  TSUNAMI_LEVEL_ADVICE,
  classifyPotensi,
  isTsunamiPotential,
  tsunamiLevelFromHeight,
  type TsunamiWarningLevel,
} from './severity';
import { formatAge, formatDecimal, toMillis, type TimeInput } from './time';

export type AIProviderId = 'gemini' | 'bedrock';

export const AI_PROVIDER_COOKIE = 'inatews_ai_provider';

/** The "model" reported whenever text was assembled by these templates rather than written by a model. */
export const AUTO_SUMMARY_MODEL_LABEL = 'Ringkasan otomatis (bukan AI)';

/** Opens every block of drill text, so a copied excerpt stays identifiable. */
export const DRILL_PREFIX = '[SIMULASI]';

const NOT_IN_FEEDS = 'tidak tersedia dari umpan publik';

/** Constraints given to a model so its answer stays within what this dashboard may say. */
export const AI_GUARDRAILS = [
  'Aturan wajib:',
  '1. Rangkum hanya fakta yang tercantum di bawah, dengan menyebut sumbernya.',
  '2. Jangan mengeluarkan perintah evakuasi, jarak aman, instruksi sirene, tinggi gelombang, atau waktu tiba; jangan menyatakan situasi aman.',
  '3. Bila suatu data tidak tercantum, tulis "tidak tersedia".',
  '4. Arahkan keputusan kepada BMKG, PVMBG dan BPBD setempat sesuai SOP.',
  '5. Jangan menyebut tingkat keyakinan dalam persen.',
].join('\n');

export interface TelemetryPromptContext {
  mode?: 'REAL' | 'SIMULASI';
  provider?: AIProviderId;
  scenario?: {
    id: string;
    name: string;
    faultZone: string;
    magnitude: number;
    depth: number;
    tsunamiHeight: number;
    affectedZones: string[];
    evacuationWindowMin?: number;
  } | null;
  phase?: {
    phaseNumber: number;
    phaseName?: string;
    shortLabel: string;
    title: string;
    /** Scenario intensity on the MMI scale — a drill value. */
    mmi?: number;
    activityLevel: number;
    tsunamiActive: boolean;
    /** Share of the scenario's maximum height the drill "observes" in this phase. */
    tsunamiFactor?: number;
    /** Drill bulletin in force ("PD-1" … "PD-4"), if any. */
    bulletin?: string | null;
  } | null;
  latestQuake?: BMKGGempaDetail | null;
  /** @deprecated Not read: sea-level text is built from the IOC feed state itself. */
  oceanSummary?: string;
}

type DrillScenarioContext = NonNullable<TelemetryPromptContext['scenario']>;
type DrillPhaseContext = NonNullable<TelemetryPromptContext['phase']>;

export function normalizeAIProvider(value: unknown): AIProviderId {
  if (typeof value === 'string' && value.toLowerCase().trim() === 'bedrock') {
    return 'bedrock';
  }
  return 'gemini';
}

export function getProviderModelLabel(provider: AIProviderId): string {
  return provider === 'bedrock'
    ? 'Anthropic Claude 3.5 Sonnet (AWS Bedrock)'
    : 'Google Gemini 2.5 Flash';
}

// ---------------------------------------------------------------------------
// REAL mode — facts with their source
// ---------------------------------------------------------------------------

interface LiveFacts {
  /** BMKG's latest report, or null when the feed gave none (placeholders do not count). */
  latest: BMKGGempaDetail | null;
  /** "BMKG: M5,4 · 10 km · laut 98 km BaratDaya Melonguane · 3 jam lalu" */
  quake: string;
  /** BMKG's "Potensi" text, verbatim; empty when there is none. */
  potensi: string;
  /** BMKG states tsunami potential for the latest quake. */
  tsunamiStated: boolean;
  catalogue: string;
  ocean: string;
  weather: string;
  volcanoes: string;
  index: string;
  hasQuakeData: boolean;
}

function quakeDetail(quake: BMKGGempaDetail, now: TimeInput): string {
  const magnitude = parseFloat(quake.Magnitude);
  const when =
    toMillis(quake.DateTime) === null
      ? [quake.Tanggal, quake.Jam].filter(Boolean).join(' ') || 'waktu tidak diketahui'
      : formatAge(quake.DateTime, now);
  return [
    Number.isFinite(magnitude) ? `M${formatDecimal(magnitude)}` : 'magnitudo tidak diketahui',
    quake.Kedalaman?.trim() || 'kedalaman tidak diketahui',
    quake.Wilayah?.replace(/^pusat gempa berada di\s*/i, '').trim() || 'lokasi tidak diketahui',
    when,
  ].join(' · ');
}

function collectLiveFacts(
  snapshot: LiveTelemetrySnapshot,
  context: TelemetryPromptContext | undefined,
  now: TimeInput
): LiveFacts {
  // A drill context carries a synthesized quake; it must never be reported as BMKG's.
  const supplied = context?.mode === 'SIMULASI' ? null : context?.latestQuake;
  const candidate = supplied ?? snapshot.earthquakes.latest_bmkg;
  const latest = candidate && !candidate.seeded ? candidate : null;

  const bmkg = snapshot.earthquakes.recent_bmkg.filter((event) => !event.seeded);
  const usgs = snapshot.earthquakes.recent_usgs.filter((event) => !event.seeded);
  const listed = [...bmkg, ...usgs];
  const hasQuakeData = latest !== null || listed.length > 0;

  const { ocean, weather } = snapshot;
  const volcanoNames = Array.from(
    new Set(snapshot.volcanoes.filter((v) => v.source !== 'SEEDED').map((v) => v.volcano_name))
  );

  return {
    latest,
    quake: latest ? `BMKG: ${quakeDetail(latest, now)}` : 'BMKG: data gempa terkini tidak tersedia',
    potensi: latest?.Potensi?.trim() ?? '',
    tsunamiStated: latest !== null && isTsunamiPotential(latest.Potensi),
    catalogue:
      listed.length > 0
        ? `Daftar gempa terkini: ${bmkg.length} dari BMKG, ${usgs.length} dari USGS; terbesar M${formatDecimal(Math.max(...listed.map((event) => event.magnitude)))}`
        : 'Daftar gempa BMKG dan USGS: tidak tersedia',
    ocean:
      ocean.source === 'IOC_LIVE' && ocean.live_count > 0
        ? `IOC UNESCO: ${ocean.live_count} stasiun pasut Indonesia dalam daftar; dasbor tidak menghitung anomali muka laut`
        : 'IOC UNESCO: data stasiun pasut tidak tersedia',
    weather:
      weather.source === 'OPEN_METEO'
        ? `Open-Meteo (${weather.stationName}): angin rata-rata ${formatDecimal(weather.avgWindKmh, 0)} km/jam, suhu ${formatDecimal(weather.avgTempC)} °C`
        : 'Open-Meteo: data cuaca tidak tersedia',
    volcanoes:
      volcanoNames.length > 0
        ? `PVMBG (MAGMA): laporan letusan terbaru — ${volcanoNames.slice(0, 3).join(', ')}`
        : 'PVMBG (MAGMA): laporan letusan tidak tersedia',
    index: hasQuakeData
      ? `Indeks aktivitas (heuristik): ${formatDecimal(snapshot.activityIndex.overall_percentage, 0)}/100 — hitungan dasbor, bukan pengukuran`
      : 'Indeks aktivitas (heuristik): tidak tersedia',
    hasQuakeData,
  };
}

function liveAssessment(facts: LiveFacts): string {
  if (!facts.latest) {
    return 'Data gempa BMKG tidak tersedia, sehingga tidak ada penilaian yang dapat diberikan. Periksa kanal resmi BMKG.';
  }
  const quote = `"${facts.potensi}"`;
  switch (classifyPotensi(facts.potensi)) {
    case 'tsunami':
      return `BMKG menyatakan: ${quote}. Ringkasan ini tidak menambahkan perkiraan tinggi gelombang, waktu tiba atau wilayah terdampak — ikuti peringatan dini tsunami resmi BMKG dan arahan BPBD setempat.`;
    case 'ended':
    case 'no-tsunami':
      return `Menurut BMKG: ${quote}. Dasbor ini tidak menilai potensi tsunami sendiri.`;
    case 'unclear':
      return `Keterangan BMKG menyebut tsunami tetapi tidak dapat digolongkan otomatis: ${quote}. Baca buletin BMKG secara langsung.`;
    case 'other':
      return `Keterangan BMKG untuk gempa ini: ${quote}. Keterangan itu tidak memuat pernyataan tsunami, dan dasbor ini tidak menilai potensi tsunami sendiri.`;
    case 'empty':
      return 'BMKG tidak menyertakan keterangan potensi untuk gempa ini pada umpan publik. Dasbor ini tidak menilai potensi tsunami sendiri — periksa buletin BMKG.';
  }
}

function liveStatus(facts: LiveFacts, riskLevel: string): string {
  if (facts.tsunamiStated) return 'CRITICAL';
  // Without BMKG data the picture is unknown, not routine.
  if (!facts.hasQuakeData) return 'UNKNOWN';
  return riskLevel === 'CRITICAL' || riskLevel === 'HIGH' || riskLevel === 'ELEVATED' ? riskLevel : 'NORMAL';
}

// ---------------------------------------------------------------------------
// SIMULASI mode — drill values, always marked as such
// ---------------------------------------------------------------------------

interface ActiveDrill {
  scenario: DrillScenarioContext;
  phase: DrillPhaseContext | null;
}

function activeDrill(context: TelemetryPromptContext | undefined): ActiveDrill | null {
  if (context?.mode !== 'SIMULASI' || !context.scenario) return null;
  return { scenario: context.scenario, phase: context.phase ?? null };
}

/** The per-phase table predates `tsunamiFactor` in the context and covers callers that do not send it. */
function drillTsunamiFactor(phase: DrillPhaseContext): number {
  if (typeof phase.tsunamiFactor === 'number' && Number.isFinite(phase.tsunamiFactor)) {
    return phase.tsunamiFactor;
  }
  return phase.phaseNumber === 4 ? 1.0 : phase.phaseNumber === 3 ? 0.65 : 0.42;
}

function drillAnomaly({ scenario, phase }: ActiveDrill): string | null {
  if (!phase?.tsunamiActive) return null;
  return `+${formatDecimal(scenario.tsunamiHeight * drillTsunamiFactor(phase))} meter`;
}

function drillSeaLevelLine(drill: ActiveDrill): string {
  const { scenario, phase } = drill;
  const maximum = `maksimum skenario ${formatDecimal(scenario.tsunamiHeight)} meter`;
  if (!phase) return `Sensor skenario: fase latihan tidak diketahui (${maximum}, nilai latihan)`;
  const anomaly = drillAnomaly(drill);
  if (anomaly) {
    return `Sensor skenario: anomali muka laut ${anomaly} (nilai latihan, bukan hasil pemodelan; ${maximum})`;
  }
  return phase.bulletin === 'PD-4'
    ? 'Sensor skenario: peringatan latihan dinyatakan berakhir (PD-4)'
    : 'Sensor skenario: belum ada anomali muka laut pada fase latihan ini';
}

function drillLevel({ scenario, phase }: ActiveDrill): TsunamiWarningLevel | null {
  return phase?.tsunamiActive ? tsunamiLevelFromHeight(scenario.tsunamiHeight) : null;
}

function drillLevelLine(drill: ActiveDrill): string | null {
  const level = drillLevel(drill);
  return level ? `Tingkat peringatan skenario: tingkat ${OFFICIAL_LEVEL_LABEL[level]} (latihan)` : null;
}

function drillZonesLine({ scenario }: ActiveDrill, limit = scenario.affectedZones.length): string {
  return `Zona pesisir skenario: ${scenario.affectedZones.slice(0, limit).join(', ')}`;
}

function drillArrivalLine({ scenario }: ActiveDrill): string | null {
  if (scenario.evacuationWindowMin === undefined) return null;
  return `Estimasi tiba gelombang pertama (nilai latihan): ≈ ${scenario.evacuationWindowMin} menit setelah gempa utama`;
}

function drillIntensityLine({ phase }: ActiveDrill): string | null {
  if (!phase) return null;
  const index = `indeks aktivitas skenario ${formatDecimal(phase.activityLevel, 0)}/100`;
  return phase.mmi === undefined
    ? `Nilai latihan: ${index}`
    : `Nilai latihan: intensitas skenario MMI ${formatDecimal(phase.mmi)} · ${index}`;
}

function drillScenarioLine({ scenario }: ActiveDrill): string {
  return `Skenario tsunami (latihan): ${scenario.name} · M${formatDecimal(scenario.magnitude)} · kedalaman ${scenario.depth} km · ${scenario.faultZone}`;
}

function drillPhaseLine({ phase }: ActiveDrill): string {
  if (!phase) return 'Fase latihan: tidak diketahui';
  const bulletin = phase.bulletin ? ` · buletin latihan ${phase.bulletin}` : '';
  return `Fase latihan: ${phase.shortLabel} — ${phase.title}${bulletin}`;
}

function present(lines: Array<string | null>): string[] {
  return lines.filter((line): line is string => line !== null);
}

function withDrillPrefix(text: string): string {
  const trimmed = text.trimStart();
  return trimmed.startsWith(DRILL_PREFIX) ? trimmed : `${DRILL_PREFIX} ${trimmed}`;
}

// ---------------------------------------------------------------------------
// Prompt context
// ---------------------------------------------------------------------------

export function formatContextBrief(
  context: TelemetryPromptContext | undefined,
  snapshot: LiveTelemetrySnapshot,
  now: TimeInput = new Date()
): string {
  const drill = activeDrill(context);
  if (drill) {
    return [
      `${DRILL_PREFIX} Mode Operasi: SIMULASI — semua nilai di bawah adalah nilai latihan, bukan data BMKG / PVMBG.`,
      ...present([
        drillScenarioLine(drill),
        drillPhaseLine(drill),
        drillSeaLevelLine(drill),
        drillLevelLine(drill),
        drillZonesLine(drill),
        drillArrivalLine(drill),
        drillIntensityLine(drill),
      ]),
    ].join('\n');
  }

  const facts = collectLiveFacts(snapshot, context, now);
  return [
    'Mode Operasi: REAL — umpan publik',
    facts.quake,
    ...(facts.potensi ? [`Keterangan BMKG (kutipan): "${facts.potensi}"`] : []),
    ...(facts.latest?.Dirasakan ? [`BMKG, dirasakan (MMI): "${facts.latest.Dirasakan}"`] : []),
    facts.catalogue,
    facts.ocean,
    facts.weather,
    facts.volcanoes,
    facts.index,
  ].join('\n');
}

export async function callGeminiAPI(prompt: string, timeoutMs = 8000): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 700,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (!res.ok) return null;
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const text = parts
        .map((p: { text?: string }) => p?.text || '')
        .join('')
        .trim();
      if (text) return text;
    }
  } catch {
    // Graceful fallback if Gemini times out or network fails
  }

  return null;
}

// ---------------------------------------------------------------------------
// Template answers (used when no model answers)
// ---------------------------------------------------------------------------

type Topic = 'tsunami' | 'evacuation' | 'infrastructure' | 'coordination' | 'general';

/** First match wins. */
const TOPIC_KEYWORDS: Array<[Topic, string[]]> = [
  ['tsunami', ['tsunami', 'gelombang', 'tinggi']],
  ['evacuation', ['evakuasi', 'warga', 'masyarakat', 'direktif', 'aktif']],
  ['infrastructure', ['likuefaksi', 'jembatan', 'pelabuhan', 'infrastruktur', 'tutup']],
  ['coordination', ['sar', 'basarnas', 'bnpb', 'ooda', 'korelasi', 'instruksi']],
];

function questionTopic(question: string): Topic {
  const text = question.toLowerCase();
  return TOPIC_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] ?? 'general';
}

function liveTopicLines(topic: Topic, facts: LiveFacts): string[] {
  switch (topic) {
    case 'tsunami':
      return [
        `Tinggi gelombang, waktu tiba dan wilayah terdampak: ${NOT_IN_FEEDS}. Hanya BMKG yang menerbitkannya, melalui peringatan dini tsunami.`,
        facts.ocean,
      ];
    case 'evacuation':
      return [
        'Dasbor ini tidak mengeluarkan perintah evakuasi. Keputusan evakuasi ada pada pemerintah daerah / BPBD berdasarkan peringatan resmi BMKG.',
        ...(facts.tsunamiStated
          ? ['BMKG menyatakan potensi tsunami untuk gempa ini — ikuti peringatan resmi BMKG dan arahan BPBD setempat.']
          : []),
      ];
    case 'infrastructure':
      return [
        `Kondisi jembatan, pelabuhan dan risiko likuefaksi: ${NOT_IN_FEEDS}. Rujuk pengelola infrastruktur dan BPBD setempat.`,
        facts.weather,
      ];
    case 'coordination':
      return [
        'Dasbor ini tidak mengeluarkan instruksi operasi; penugasan SAR mengikuti SOP BNPB / BASARNAS.',
        facts.catalogue,
        facts.volcanoes,
      ];
    case 'general':
      return [facts.catalogue, facts.ocean, facts.weather, facts.volcanoes, facts.index];
  }
}

function drillTopicLines(topic: Topic, drill: ActiveDrill): string[] {
  switch (topic) {
    case 'tsunami':
      return present([
        drillSeaLevelLine(drill),
        drillLevelLine(drill),
        drillZonesLine(drill),
        drillArrivalLine(drill),
      ]);
    case 'evacuation': {
      const level = drillLevel(drill);
      return present([
        level
          ? `${drillLevelLine(drill)} — arahan baku BMKG untuk tingkat ini: "${TSUNAMI_LEVEL_ADVICE[level]}"`
          : drillSeaLevelLine(drill),
        drillZonesLine(drill, 3),
        drillArrivalLine(drill),
        'Ini materi latihan; tidak ada perintah evakuasi nyata.',
      ]);
    }
    case 'infrastructure':
      return [
        'Kondisi infrastruktur tidak dimodelkan dalam skenario latihan ini.',
        drillZonesLine(drill),
        drillSeaLevelLine(drill),
      ];
    case 'coordination':
      return present([
        'Latihan koordinasi: BNPB / BPBD dan BASARNAS berlatih sesuai SOP masing-masing untuk zona skenario.',
        drillZonesLine(drill, 3),
        drillIntensityLine(drill),
      ]);
    case 'general':
      return present([
        drillPhaseLine(drill),
        drillSeaLevelLine(drill),
        drillZonesLine(drill),
        drillIntensityLine(drill),
      ]);
  }
}

function bulleted(header: string, lines: string[]): string {
  return [header, ...lines.map((line) => `- ${line}`)].join('\n');
}

export function buildContextAwareFallbackAnswer(params: {
  question: string;
  kind: 'copilot' | 'agent';
  provider: AIProviderId;
  context?: TelemetryPromptContext;
  snapshot: LiveTelemetrySnapshot;
  now?: Date;
}): string {
  const topic = questionTopic(params.question);
  const drill = activeDrill(params.context);

  if (drill) {
    return bulleted(
      `${DRILL_PREFIX} Ringkasan otomatis latihan (bukan AI) — skenario tsunami (latihan) "${drill.scenario.name}", fase ${drill.phase?.shortLabel ?? 'tidak diketahui'}.`,
      [...drillTopicLines(topic, drill), 'Seluruh nilai adalah nilai latihan, bukan data BMKG / PVMBG.']
    );
  }

  const facts = collectLiveFacts(params.snapshot, params.context, params.now ?? new Date());
  return bulleted(
    `[${params.kind === 'agent' ? 'RINGKASAN OTOMATIS AGEN' : 'RINGKASAN OTOMATIS'} — bukan jawaban AI]`,
    [
      facts.quake,
      ...(facts.potensi ? [`Keterangan BMKG: "${facts.potensi}"`] : []),
      ...liveTopicLines(topic, facts),
      'Saran sistem: pantau buletin BMKG dan koordinasikan dengan BPBD setempat sesuai SOP. Keputusan pada BMKG / BPBD.',
    ]
  );
}

export async function generateHybridCopilotReply(params: {
  question: string;
  kind: 'copilot' | 'agent';
  provider: AIProviderId;
  context?: TelemetryPromptContext;
  snapshot: LiveTelemetrySnapshot;
}): Promise<{ answer: string; model: string; latencyMs: number }> {
  const startedAt = Date.now();
  const drill = activeDrill(params.context);

  if (params.provider !== 'bedrock' && process.env.GEMINI_API_KEY?.trim()) {
    const prompt = [
      'Anda membantu operator membaca dasbor pendukung keputusan TIDAK RESMI untuk pemantauan gempa dan tsunami Indonesia.',
      'Jawab dalam Bahasa Indonesia, ringkas dan terstruktur (poin bernomor singkat).',
      AI_GUARDRAILS,
      ...(drill
        ? [
            `Ini mode SIMULASI: awali jawaban dengan "${DRILL_PREFIX}". Nilai skenario di bawah boleh dikutip, selalu sebagai "nilai latihan", dan tidak boleh dikaitkan dengan BMKG atau PVMBG.`,
          ]
        : []),
      '',
      formatContextBrief(params.context, params.snapshot),
      '',
      `Pertanyaan operator: "${params.question}"`,
    ].join('\n');

    const llmText = await callGeminiAPI(prompt, 7500);
    if (llmText) {
      return {
        answer: drill ? withDrillPrefix(llmText) : llmText,
        model: `${getProviderModelLabel(params.provider)} (Live API)`,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  return {
    answer: buildContextAwareFallbackAnswer(params),
    model: AUTO_SUMMARY_MODEL_LABEL,
    latencyMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Panel analysis blocks
// ---------------------------------------------------------------------------

export function buildLiveAIAnalysis(params: {
  snapshot: LiveTelemetrySnapshot;
  /** Accepted so existing call sites keep compiling; a template names no model. */
  provider?: AIProviderId;
  now?: Date;
}): AIAnalysis {
  const now = params.now ?? new Date();
  const facts = collectLiveFacts(params.snapshot, undefined, now);
  const { latest } = facts;
  const magnitude = latest ? parseFloat(latest.Magnitude) : NaN;

  return {
    status: liveStatus(facts, params.snapshot.status.risk_level),
    threat_summary: facts.tsunamiStated && latest
      ? `BMKG menyatakan potensi tsunami — ${quakeDetail(latest, now)}. Ikuti peringatan resmi BMKG.`
      : facts.quake,
    observations: [
      `${facts.quake}.`,
      ...(facts.potensi ? [`Keterangan BMKG: "${facts.potensi}"`] : []),
      ...(latest?.Dirasakan ? [`BMKG, dirasakan (MMI): "${latest.Dirasakan}"`] : []),
      `${facts.catalogue}.`,
      `${facts.ocean}.`,
      `${facts.weather}.`,
      `${facts.volcanoes}.`,
      `${facts.index}.`,
    ],
    assessment: liveAssessment(facts),
    recommendations: facts.tsunamiStated
      ? [
          'Ikuti peringatan dini tsunami resmi BMKG sebagai satu-satunya rujukan status.',
          'Koordinasikan dengan BPBD setempat sesuai SOP.',
          'Pantau pemutakhiran buletin BMKG; dasbor ini bukan saluran peringatan resmi.',
        ]
      : [
          'Pantau buletin BMKG untuk pemutakhiran parameter dan gempa susulan.',
          'Koordinasikan dengan BPBD setempat sesuai SOP bila ada laporan dampak.',
          'Rujuk PVMBG (MAGMA Indonesia) untuk status gunung api.',
        ],
    agency_actions: [
      {
        agency: 'BMKG',
        priority: facts.tsunamiStated ? 'IMMEDIATE' : 'STANDBY',
        action: 'Sumber resmi parameter gempa dan peringatan dini tsunami — pantau buletin terbarunya.',
      },
      {
        agency: 'BNPB / BPBD',
        priority: facts.tsunamiStated ? 'IMMEDIATE' : 'STANDBY',
        action: 'Pemegang keputusan tanggap darurat daerah — koordinasikan sesuai SOP setempat.',
      },
      {
        agency: 'BASARNAS',
        priority: facts.tsunamiStated ? 'URGENT' : 'STANDBY',
        action: 'Kesiapsiagaan SAR mengikuti SOP dan permintaan BNPB / BPBD.',
      },
    ],
    // None of the public feeds carries these, so nothing is estimated here.
    hazard_details: {
      fault_mechanism: NOT_IN_FEEDS,
      estimated_coseismic_slip: NOT_IN_FEEDS,
      aftershock_risk: NOT_IN_FEEDS,
      tsunami_runup_estimate: NOT_IN_FEEDS,
      // Required by the type; no feed gives an arrival time and the panel does not render it in REAL.
      evacuation_window_min: 0,
    },
    // Required by the type; a template has no confidence and the panel does not render one.
    confidence: 0,
    model_used: AUTO_SUMMARY_MODEL_LABEL,
    disclaimer:
      'Ringkasan otomatis dari umpan publik BMKG, USGS, IOC UNESCO, PVMBG dan Open-Meteo. Bukan peringatan resmi — keputusan pada BMKG dan BPBD.',
    contributing_factors: [
      {
        indicator: 'Magnitudo gempa terkini',
        value: Number.isFinite(magnitude) ? `M${formatDecimal(magnitude)}` : 'tidak tersedia',
        change: 'BMKG',
        significance: 0,
      },
      {
        indicator: 'Kedalaman',
        value: latest?.Kedalaman?.trim() || 'tidak tersedia',
        change: 'BMKG',
        significance: 0,
      },
      {
        indicator: 'Stasiun pasut dalam daftar',
        value:
          params.snapshot.ocean.source === 'IOC_LIVE'
            ? `${params.snapshot.ocean.live_count} stasiun`
            : 'tidak tersedia',
        change: 'IOC UNESCO',
        significance: 0,
      },
      {
        indicator: 'Indeks aktivitas (heuristik)',
        value: facts.hasQuakeData
          ? `${formatDecimal(params.snapshot.activityIndex.overall_percentage, 0)}/100`
          : 'tidak tersedia',
        change: 'hitungan dasbor',
        significance: 0,
      },
    ],
    timestamp: now.toISOString(),
  };
}

/**
 * The panel block for a drill, or null when the context carries no drill phase.
 * The status follows the drill's unofficial attention level: a tsunami threat
 * in force reads TINGGI, never an official word.
 */
export function buildDrillAIAnalysis(params: {
  context: TelemetryPromptContext | undefined;
  now?: Date;
}): AIAnalysis | null {
  const drill = activeDrill(params.context);
  if (!drill || !drill.phase) return null;
  const { scenario, phase } = drill;
  const anomaly = drillAnomaly(drill);

  return {
    status: phase.tsunamiActive ? 'HIGH' : phase.activityLevel >= 45 ? 'ELEVATED' : 'NORMAL',
    threat_summary: `${DRILL_PREFIX} ${scenario.name} — fase ${phase.shortLabel}: ${phase.title}. ${drillSeaLevelLine(drill)}.`,
    observations: present([
      drillScenarioLine(drill),
      drillPhaseLine(drill),
      drillSeaLevelLine(drill),
      drillLevelLine(drill),
      drillZonesLine(drill),
      drillArrivalLine(drill),
      drillIntensityLine(drill),
    ]).map((line) => `${line}.`),
    assessment: `${DRILL_PREFIX} Ini skenario tsunami (latihan) untuk uji kesiapsiagaan. Seluruh nilai adalah nilai latihan, bukan hasil pemodelan dan bukan data BMKG / PVMBG.`,
    recommendations: [
      'Latih alur penerimaan buletin PD-1 sampai PD-4 dan penerusannya ke BPBD sesuai SOP.',
      'Cocokkan zona pesisir skenario dengan rencana kontinjensi daerah.',
      'Catat waktu tanggap tiap fase untuk evaluasi setelah latihan.',
    ],
    agency_actions: [
      {
        agency: 'BMKG',
        priority: phase.tsunamiActive ? 'IMMEDIATE' : 'STANDBY',
        action: 'Peran dalam latihan: sumber buletin PD-1 sampai PD-4.',
      },
      {
        agency: 'BNPB / BPBD',
        priority: phase.tsunamiActive ? 'IMMEDIATE' : 'STANDBY',
        action: 'Peran dalam latihan: keputusan tanggap darurat daerah sesuai SOP.',
      },
      {
        agency: 'BASARNAS',
        priority: phase.tsunamiActive ? 'URGENT' : 'STANDBY',
        action: 'Peran dalam latihan: kesiapsiagaan SAR sesuai SOP.',
      },
    ],
    hazard_details: {
      fault_mechanism: `${scenario.faultZone} (skenario latihan)`,
      estimated_coseismic_slip: 'tidak dimodelkan dalam latihan',
      aftershock_risk: 'tidak dimodelkan dalam latihan',
      tsunami_runup_estimate: `hingga ${formatDecimal(scenario.tsunamiHeight)} meter (nilai latihan, bukan hasil pemodelan)`,
      evacuation_window_min: scenario.evacuationWindowMin ?? 0,
    },
    confidence: 0,
    model_used: AUTO_SUMMARY_MODEL_LABEL,
    disclaimer: `${DRILL_PREFIX} Mode latihan aktif — seluruh nilai adalah skenario uji kesiapsiagaan, bukan data BMKG / PVMBG.`,
    contributing_factors: [
      {
        indicator: 'Magnitudo skenario',
        value: `M${formatDecimal(scenario.magnitude)}`,
        change: 'nilai latihan',
        significance: 0,
      },
      {
        indicator: 'Anomali muka laut',
        value: anomaly ?? 'tidak ada pada fase ini',
        change: 'sensor skenario',
        significance: 0,
      },
      {
        indicator: 'Indeks aktivitas skenario',
        value: `${formatDecimal(phase.activityLevel, 0)}/100`,
        change: 'nilai latihan',
        significance: 0,
      },
    ],
    timestamp: (params.now ?? new Date()).toISOString(),
  };
}
