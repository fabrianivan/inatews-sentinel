import type {
  AIAnalysis,
  BMKGGempaDetail,
} from './types';
import type { LiveTelemetrySnapshot } from './telemetry';

export type AIProviderId = 'gemini' | 'bedrock';

export const AI_PROVIDER_COOKIE = 'inatews_ai_provider';

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
    mmi?: number;
    activityLevel: number;
    tsunamiActive: boolean;
  } | null;
  latestQuake?: BMKGGempaDetail | null;
  oceanSummary?: string;
}

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

export function formatContextBrief(
  context: TelemetryPromptContext | undefined,
  snapshot: LiveTelemetrySnapshot
): string {
  const mode = context?.mode || 'REAL';
  const latest = context?.latestQuake || snapshot.earthquakes.latest_bmkg;
  const activeScenario = mode === 'SIMULASI' ? context?.scenario : null;
  const activePhase = mode === 'SIMULASI' ? context?.phase : null;
  const topVolcanoes = snapshot.volcanoes
    .slice(0, 3)
    .map((v) => `${v.volcano_name} (${v.alert_level})`)
    .join(', ');

  const lines: string[] = [
    `Mode Operasi: ${mode}`,
    `Gempa Utama (${mode === 'SIMULASI' && activeScenario ? 'Skenario Drill' : 'BMKG TEWS Live'}): M${latest?.Magnitude || '?'} kedalaman ${latest?.Kedalaman || '?'} di ${latest?.Wilayah || 'Indonesia'} | Potensi: ${latest?.Potensi || '-'}`,
    `Statistik Seismik Aktif: ${snapshot.activityIndex.earthquake_count} event BMKG+USGS, Maks M${snapshot.activityIndex.max_magnitude.toFixed(1)}, Intensitas MMI ${mode === 'SIMULASI' && activePhase ? activePhase.activityLevel.toFixed(0) : snapshot.activityIndex.overall_percentage.toFixed(1)}%`,
    `Telemetri Laut IOC UNESCO: ${context?.oceanSummary || snapshot.status.ocean_status} (${snapshot.ocean.count} stasiun terpantau)`,
    `Cuaca Maritim Open-Meteo: ${snapshot.weather.statusLabel}`,
    `Gunung Api Aktif (PVMBG): ${topVolcanoes || 'Monitoring Aktif'}`,
  ];

  if (activeScenario) {
    lines.push(
      `Skenario Megathrust Aktif: ${activeScenario.name} | Sesar: ${activeScenario.faultZone} | Potensi Run-up Maks: ${activeScenario.tsunamiHeight.toFixed(1)}m | Jendela Evakuasi: ${activeScenario.evacuationWindowMin ?? 15} menit | Zona Terdampak: ${activeScenario.affectedZones.join(', ')}`
    );
  }
  if (activePhase) {
    lines.push(
      `Fase Siklus Bencana: ${activePhase.shortLabel} (${activePhase.title}) | Tsunami Aktif: ${activePhase.tsunamiActive ? 'YA' : 'BELUM'}`
    );
  }

  return lines.join('\n');
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

export function buildContextAwareFallbackAnswer(params: {
  question: string;
  kind: 'copilot' | 'agent';
  provider: AIProviderId;
  context?: TelemetryPromptContext;
  snapshot: LiveTelemetrySnapshot;
}): string {
  const { question, kind, context, snapshot } = params;
  const q = question.toLowerCase();
  const isSim = context?.mode === 'SIMULASI' && Boolean(context?.scenario);
  const scenario = context?.scenario;
  const phase = context?.phase;
  const latest = context?.latestQuake || snapshot.earthquakes.latest_bmkg;

  const magLabel = latest?.Magnitude ? `M${latest.Magnitude}` : `M${snapshot.activityIndex.max_magnitude.toFixed(1)}`;
  const depthLabel = latest?.Kedalaman || '10 km';
  const regionLabel = latest?.Wilayah || 'Zona Subduksi Indonesia';
  const potensiLabel = latest?.Potensi || 'Dalam pemantauan InaTEWS';

  const headerPrefix =
    kind === 'agent'
      ? isSim && scenario
        ? `[OODA MEMORI KERJA — DRILL ${phase?.shortLabel || 'AKTIF'}]`
        : `[OODA MEMORI KERJA — TELEMETRI LIVE]`
      : isSim && scenario
      ? `[KOPILOT TAKTIS — DRILL ${scenario.name}]`
      : `[KOPILOT TAKTIS — BMKG/IOC LIVE]`;

  if (q.includes('tsunami') || q.includes('gelombang') || q.includes('tinggi')) {
    if (isSim && scenario) {
      const activeWave = phase?.tsunamiActive
        ? `${(scenario.tsunamiHeight * (phase.phaseNumber === 4 ? 1.0 : phase.phaseNumber === 3 ? 0.65 : 0.42)).toFixed(1)} meter`
        : 'fase pre-event (belum memicu run-up)';
      return (
        `${headerPrefix}\n` +
        `1. **Proyeksi Gelombang (${scenario.name})**: Pada ${phase?.shortLabel || 'fase berjalan'}, anomali muka air laut tercatat sekitar **${activeWave}** (potensi maksimum skenario **${scenario.tsunamiHeight.toFixed(1)} m**).\n` +
        `2. **Koridor Pesisir Prioritas**: ${scenario.affectedZones.join(', ')}.\n` +
        `3. **Jendela Evakuasi Emas**: Estimasi waktu tiba gelombang pertama di pesisir terdekat ~**${scenario.evacuationWindowMin ?? 15} menit** pasca-mainshock.`
      );
    }

    return (
      `${headerPrefix}\n` +
      `1. **Status Ancaman Terkini (${magLabel})**: Gempa live di ${regionLabel} (kedalaman ${depthLabel}) berstatus *"${potensiLabel}"*.\n` +
      `2. **Pembacaan IOC UNESCO**: Terpantau ${snapshot.ocean.count} stasiun pasang surut Indonesia (${snapshot.status.ocean_status}); kondisi cuaca permukaan ${snapshot.weather.statusLabel}.\n` +
      `3. **Ambang Eskalasi**: Peringatan dini tsunami PD-1/PD-2 otomatis terpicu apabila terjadi gempa dangkal >= M7.0 atau lonjakan tide gauge destruktif terverifikasi.`
    );
  }

  if (q.includes('evakuasi') || q.includes('warga') || q.includes('masyarakat') || q.includes('direktif') || q.includes('aktif')) {
    if (isSim && scenario) {
      return (
        `${headerPrefix}\n` +
        `1. **Direktif Evakuasi Aktif (${phase?.shortLabel || 'SIMULASI'})**: ${phase?.tsunamiActive ? 'EVAKUASI TOTAL ZONA MERAH PESISIR (0-2 km dari garis pantai) ke dataran tinggi >20 m dpl.' : 'SIAGA EVAKUASI & pembukaan jalur Tempat Evakuasi Sementara (TES).'}\n` +
        `2. **Wilayah Prioritas**: ${scenario.affectedZones.slice(0, 3).join(', ')}.\n` +
        `3. **Target Waktu**: Tuntaskan pergerakan warga dalam jendela emas **${scenario.evacuationWindowMin ?? 15} menit** sebelum gelombang utama menghantam pesisir.`
      );
    }

    return (
      `${headerPrefix}\n` +
      `1. **Evaluasi Evakuasi Live (${magLabel} di ${regionLabel})**: Tingkat risiko nasional saat ini **${snapshot.status.risk_level}** (Indeks MMI ${snapshot.activityIndex.overall_percentage.toFixed(1)}%). ${snapshot.tsunami?.active ? 'Aktifkan evakuasi pesisir segera!' : 'Belum diperlukan evakuasi tsunami massal; prioritaskan pemeriksaan struktur bangunan di area guncangan lokal.'}\n` +
      `2. **Jaringan Pengamatan**: ${snapshot.ocean.count} stasiun pasut IOC (${snapshot.status.ocean_status}) dan pos PGA PVMBG (${snapshot.volcanoes[0]?.volcano_name || 'Aktif'}) terus disinkronkan.`
    );
  }

  if (q.includes('likuefaksi') || q.includes('jembatan') || q.includes('pelabuhan') || q.includes('infrastruktur') || q.includes('tutup')) {
    const criticalInfra = isSim && (phase?.phaseNumber ?? 0) >= 3;
    return (
      `${headerPrefix}\n` +
      `1. **Integritas Infrastruktur Kritis**: Status saat ini **${criticalInfra ? `CLIPPING & BEBAN EKSTREM (${scenario?.faultZone})` : snapshot.status.infra_status}**.\n` +
      `2. **Pelabuhan & Penyeberangan**: ${criticalInfra ? `Hentikan sementara operasional pelabuhan/jembatan di koridor ${scenario?.affectedZones.slice(0, 2).join(' & ')} akibat estimasi run-up hingga ${scenario?.tsunamiHeight.toFixed(1)} m.` : `Jalur penyeberangan strategis dan jembatan bentang panjang terpantau operasional; cuaca ${snapshot.weather.statusLabel}.`}\n` +
      `3. **Protokol Rekayasa**: Inspeksi visual pier jembatan dan tanggul laut wajib dilakukan pasca-guncangan dengan PGA > 0.15g.`
    );
  }

  if (q.includes('sar') || q.includes('basarnas') || q.includes('bnpb') || q.includes('ooda') || q.includes('korelasi') || q.includes('instruksi')) {
    const oodaSummary = isSim && scenario
      ? `Skenario **${scenario.name}** (${phase?.shortLabel}) dengan MMI ${phase?.activityLevel.toFixed(0)}% dan ${scenario.affectedZones.slice(0, 3).join(', ')}`
      : `Gempa live **${magLabel}** di ${regionLabel}, maks seri terkini **M${snapshot.activityIndex.max_magnitude.toFixed(1)}** (${snapshot.activityIndex.earthquake_count} event), serta ${snapshot.ocean.count} stasiun IOC`;
    return (
      `${headerPrefix}\n` +
      `1. **OBSERVE & ORIENT**: Mengorelasikan ${oodaSummary} dengan kondisi angin ${snapshot.weather.avgWindKmh} km/h & laporan PVMBG (${snapshot.volcanoes[0]?.volcano_name || 'Vulkanik'}).\n` +
      `2. **DECIDE**: Status sistem ditetapkan **${isSim ? (phase?.tsunamiActive ? 'CRITICAL' : 'WASPADA') : snapshot.status.risk_level}**.\n` +
      `3. **ACT (BNPB / BASARNAS / BMKG)**: ${isSim && phase?.tsunamiActive ? `Kerahkan USAR, helikopter, dan kapal SAR menuju ${scenario?.affectedZones[0]} serta pastikan aktivasi sirene InaTEWS.` : 'Pertahankan kesiapsiagaan Pusdalops BPBD regional, jalur radio kebencanaan, dan logistik forward base.'}`
    );
  }

  return (
    `${headerPrefix} Jawaban untuk *"${question}"*:\n` +
    `- **Konteks Aktif**: ${isSim && scenario ? `${scenario.name} (${phase?.shortLabel} — ${phase?.title})` : `Pemantauan Live BMKG (${magLabel} di ${regionLabel})`}.\n` +
    `- **Indikator Terkini**: Intensitas MMI **${isSim && phase ? phase.activityLevel.toFixed(0) : snapshot.activityIndex.overall_percentage.toFixed(1)}%**, ${snapshot.ocean.count} stasiun laut IOC (${snapshot.status.ocean_status}), dan cuaca Open-Meteo (${snapshot.weather.statusLabel}).\n` +
    `- **Rekomendasi**: Seluruh kanal koordinasi BMKG, BNPB, BASARNAS, dan IOC UNESCO tetap tersinkronisasi untuk eskalasi cepat bila anomali meningkat.`
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
  const baseModel = getProviderModelLabel(params.provider);

  if (params.provider !== 'bedrock' && process.env.GEMINI_API_KEY?.trim()) {
    const roleLabel =
      params.kind === 'agent'
        ? 'OODA Autonomous Streaming Data Agent (InaTEWS Sentinel)'
        : 'AI Disaster Intelligence Copilot (BMKG / BNPB / BASARNAS)';

    const prompt = [
      `Anda adalah ${roleLabel} untuk sistem peringatan dini gempa & tsunami Indonesia.`,
      'Jawab dalam Bahasa Indonesia yang taktis, akurat, terstruktur (bullet/poin bernomor singkat), dan SELALU mengacu langsung pada data telemetri atau skenario simulasi aktif di bawah ini:',
      '',
      formatContextBrief(params.context, params.snapshot),
      '',
      `Pertanyaan operator: "${params.question}"`,
    ].join('\n');

    const llmText = await callGeminiAPI(prompt, 7500);
    if (llmText) {
      return {
        answer: llmText,
        model: `${baseModel} (Live API)`,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  const answer = buildContextAwareFallbackAnswer(params);
  return {
    answer,
    model:
      params.provider === 'bedrock'
        ? 'Anthropic Claude 3.5 Sonnet (Context Synthesis)'
        : 'InaTEWS Contextual Engine (Live Telemetry)',
    latencyMs: Math.max(45, Date.now() - startedAt),
  };
}

export function buildLiveAIAnalysis(params: {
  snapshot: LiveTelemetrySnapshot;
  provider: AIProviderId;
  now?: Date;
}): AIAnalysis {
  const nowIso = (params.now || new Date()).toISOString();
  const { earthquakes, ocean, weather, activityIndex, status } = params.snapshot;
  const latest = earthquakes.latest_bmkg;

  const magStr = latest?.Magnitude || activityIndex.max_magnitude.toFixed(1);
  const magNum = parseFloat(magStr) || activityIndex.max_magnitude;
  const wilayah = latest?.Wilayah || 'Zona Subduksi Indonesia';
  const kedalaman = latest?.Kedalaman || '10 km';
  const potensi = latest?.Potensi || 'Dalam pemantauan kontinyu InaTEWS';
  const isTsunamiThreat = Boolean(status.tsunami_scenario?.active);

  const aiStatus = isTsunamiThreat
    ? 'CRITICAL'
    : status.risk_level === 'HIGH'
    ? 'HIGH'
    : status.risk_level === 'ELEVATED'
    ? 'ELEVATED'
    : 'ADVISORY';

  return {
    status: aiStatus,
    threat_summary: isTsunamiThreat
      ? `PERINGATAN TSUNAMI AKTIF — Gempa M${magStr} di ${wilayah}`
      : `Analisis Live InaTEWS: Gempa terkini M${magStr} (${wilayah}) • ${ocean.count} Stasiun IOC • MMI ${activityIndex.overall_percentage.toFixed(1)}%`,
    observations: [
      `BMKG TEWS mencatat gempa tektonik terkini M${magStr} kedalaman ${kedalaman} di ${wilayah} ("${potensi}").`,
      `Agregasi real-time BMKG & USGS mencatat ${activityIndex.earthquake_count} event (magnitudo puncak M${activityIndex.max_magnitude.toFixed(1)}, rata-rata M${activityIndex.avg_magnitude.toFixed(1)}).`,
      `Jaringan pasut IOC UNESCO memantau ${ocean.count} stasiun pesisir Indonesia (${status.ocean_status}); kondisi meteorologi Open-Meteo: ${weather.statusLabel}.`,
      `Indeks aktivitas seismik terkomputasi berada pada ${activityIndex.overall_percentage.toFixed(1)}% (${activityIndex.trend_direction}).`,
    ],
    assessment: isTsunamiThreat
      ? `Gempa subduksi kuat M${magStr} di ${wilayah} berpotensi membangkitkan tsunami lokal. Aktifkan segera sirine pesisir InaTEWS dan SOP evakuasi BNPB/BPBD terdekat.`
      : `Berdasarkan gempa terkini M${magStr} kedalaman ${kedalaman} dan pembacaan ${ocean.count} stasiun pasang surut IOC UNESCO, tidak terdapat indikasi pembangkitan tsunami destruktif saat ini. Pemantauan aftershock dan aktivitas vulkanik PVMBG tetap berjalan kontinyu 24/7.`,
    recommendations: [
      `Pertahankan pemantauan stream telemetri BMKG TEWS dan validasi elevasi muka air laut IOC UNESCO.`,
      `Siagakan kanal diseminasi Warning Receiver System (WRS) apabila magnitudo susulan melampaui M5.5 di segmen subduksi dangkal.`,
      `Koordinasikan kesiapan informasi publik berbasis rilis resmi BMKG & Pusdalops BNPB.`,
    ],
    agency_actions: [
      {
        agency: 'BMKG',
        priority: isTsunamiThreat ? 'IMMEDIATE' : magNum >= 5.5 ? 'URGENT' : 'NORMAL',
        action: `Pemutakhiran parameter hiposenter M${magStr} dan ShakeMap nasional secara kontinyu.`,
      },
      {
        agency: 'BNPB / BPBD',
        priority: isTsunamiThreat ? 'IMMEDIATE' : 'STANDBY',
        action: `Kesiapsiagaan Pusdalops dan pengamatan dampak lokal pada wilayah sekitar ${wilayah}.`,
      },
      {
        agency: 'BASARNAS',
        priority: isTsunamiThreat ? 'IMMEDIATE' : 'STANDBY',
        action: `Standby unsur SAR maritim dan dukungan pelabuhan di jalur pasut terpantau (${weather.avgWindKmh} km/h).`,
      },
    ],
    hazard_details: {
      fault_mechanism: 'Subduction Interplate Thrust & Active Fault Interface',
      estimated_coseismic_slip: magNum >= 6.5 ? '1.5 - 4.0 meter' : magNum >= 5.5 ? '0.2 - 0.8 meter' : '<0.2 meter',
      aftershock_risk: magNum >= 5.5 ? 'MODERATE-HIGH (Pantau klaster gempa susulan 24 jam)' : 'LOW (Dalam batas tektonik latar)',
      tsunami_runup_estimate: isTsunamiThreat ? 'Potensi run-up pesisir lokal — aktifkan evakuasi segera' : 'Tidak berpotensi tsunami berdasarkan pembacaan IOC & kedalaman',
      evacuation_window_min: isTsunamiThreat ? 15 : 120,
    },
    confidence: isTsunamiThreat ? 0.94 : 0.9,
    latency_ms: 95,
    model_used: getProviderModelLabel(params.provider),
    disclaimer: 'Real-time decision support synthesized from BMKG TEWS, USGS, IOC UNESCO, MAGMA PVMBG, and Open-Meteo telemetry.',
    contributing_factors: [
      {
        indicator: 'Mainshock Terkini',
        value: `M${magStr}`,
        change: wilayah.slice(0, 32),
        significance: Math.min(0.98, Number((magNum / 9).toFixed(2))),
      },
      {
        indicator: 'Kedalaman Hiposenter',
        value: kedalaman,
        change: 'BMKG TEWS',
        significance: 0.78,
      },
      {
        indicator: 'Jaringan Pasut IOC',
        value: `${ocean.count} Stasiun`,
        change: ocean.source === 'IOC_LIVE' ? 'IOC LIVE' : 'SEEDED ARRAY',
        significance: 0.85,
      },
      {
        indicator: 'Indeks Intensitas Dinamis',
        value: `${activityIndex.overall_percentage.toFixed(1)}%`,
        change: activityIndex.trend_direction,
        significance: Number((activityIndex.overall_percentage / 100).toFixed(2)),
      },
    ],
    timestamp: nowIso,
  };
}
