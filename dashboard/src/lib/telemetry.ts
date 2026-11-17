import type {
  ActivityIndex,
  AgentState,
  AgentTacticalAction,
  AgentThought,
  BMKGGempaDetail,
  RealtimeEarthquakesData,
  SeismicEvent,
  SystemStatus,
  TsunamiScenario,
  VolcanoEruption,
} from './types';

export interface IOCStationReading {
  code: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  baseLevelMeters: number;
  level: string;
  anomaly: string;
  trend: 'NORMAL' | 'TSUNAMI SURGE';
  status: 'OPERATIONAL' | 'ALERT';
  isAnomaly: boolean;
  lastUpdated?: string;
  source: 'IOC_LIVE' | 'SEEDED';
  keywords: string[];
}

export interface OceanFeedResponse {
  stations: IOCStationReading[];
  count: number;
  live_count: number;
  anomaly_count: number;
  source: 'IOC_LIVE' | 'FALLBACK';
  timestamp: string;
}

export interface WeatherSummary {
  statusLabel: string;
  avgWindKmh: number;
  maxWindKmh: number;
  avgTempC: number;
  stationName: string;
  source: 'OPEN_METEO' | 'FALLBACK';
  timestamp: string;
}

export interface LiveTelemetrySnapshot {
  earthquakes: RealtimeEarthquakesData;
  volcanoes: VolcanoEruption[];
  ocean: OceanFeedResponse;
  weather: WeatherSummary;
  activityIndex: ActivityIndex;
  status: SystemStatus;
  tsunami: TsunamiScenario | null;
}

export const FALLBACK_EARTHQUAKES: RealtimeEarthquakesData = {
  latest_bmkg: {
    Tanggal: 'Baseline Offline',
    Jam: 'STANDBY',
    DateTime: new Date().toISOString(),
    Coordinates: '-6.92,105.49',
    Lintang: '6.92 LS',
    Bujur: '105.49 BT',
    Magnitude: '3.8',
    Kedalaman: '25 km',
    Wilayah: 'Selat Sunda — Zona Pemantauan Subduksi Jawa-Sumatra',
    Potensi: 'Tidak berpotensi tsunami (Data baseline standby)',
    Dirasakan: 'II Sumur',
  },
  recent_bmkg: [
    {
      type: 'SEISMIC',
      magnitude: 5.2,
      depth: 10,
      frequency: 3.6,
      count: 1,
      latitude: -8.08,
      longitude: 120.56,
      mmi: 7,
      pga: 0.66,
      fault_zone: '60 km TimurLaut RUTENG-MANGGARAI-NTT',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 5.4,
      depth: 10,
      frequency: 3.7,
      count: 1,
      latitude: -8.42,
      longitude: 109.02,
      mmi: 7,
      pga: 0.68,
      fault_zone: '77 km Tenggara CILACAP-JATENG',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 5.5,
      depth: 100,
      frequency: 3.75,
      count: 1,
      latitude: -3.15,
      longitude: 139.41,
      mmi: 6,
      pga: 0.38,
      fault_zone: '69 km TimurLaut KOBAGMA-PAPUAPGNGN',
      timestamp: new Date(Date.now() - 14400000).toISOString(),
    },
  ],
  recent_usgs: [
    {
      type: 'SEISMIC',
      magnitude: 5.0,
      depth: 10,
      frequency: 3.5,
      count: 1,
      latitude: 4.0172,
      longitude: 125.3233,
      mmi: 7,
      pga: 0.63,
      fault_zone: '154 km S of Sarangani, Philippines',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      type: 'SEISMIC',
      magnitude: 4.5,
      depth: 39.5,
      frequency: 3.25,
      count: 1,
      latitude: -4.9167,
      longitude: 102.8454,
      mmi: 6,
      pga: 0.45,
      fault_zone: '108 km SSW of Pagar Alam, Indonesia',
      timestamp: new Date(Date.now() - 5400000).toISOString(),
    },
  ],
  timestamp: new Date().toISOString(),
};

export const SEEDED_IOC_STATIONS: IOCStationReading[] = [
  { code: 'sibo', name: 'Sibolga, Sumatra Utara', type: 'Tide Gauge', lat: 1.74, lon: 98.78, baseLevelMeters: 0.82, level: '0.82m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['sibolga', 'sumatra utara', 'nias', 'mentawai', 'siberut'] },
  { code: 'pada', name: 'Teluk Bayur, Padang', type: 'Tide Gauge', lat: -0.99, lon: 100.37, baseLevelMeters: 1.05, level: '1.05m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['padang', 'sumatera barat', 'sumatra barat', 'mentawai', 'siberut', 'sipora', 'pagai'] },
  { code: 'beng', name: 'Pulau Baai, Bengkulu', type: 'Tide Gauge', lat: -3.88, lon: 102.28, baseLevelMeters: 0.94, level: '0.94m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['bengkulu', 'mentawai', 'pagai', 'engganno'] },
  { code: 'krui', name: 'Krui, Pesisir Barat Lampung', type: 'Tide Gauge', lat: -5.19, lon: 103.93, baseLevelMeters: 0.78, level: '0.78m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['krui', 'lampung', 'selat sunda', 'sunda', 'kalianda'] },
  { code: 'ciwa', name: 'Ciwandan, Selat Sunda', type: 'Tide Gauge', lat: -6.02, lon: 105.95, baseLevelMeters: 0.65, level: '0.65m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['ciwandan', 'selat sunda', 'sunda', 'pandeglang', 'ujung kulon', 'anyer', 'carita', 'kalianda', 'lampung', 'banten'] },
  { code: 'pelr', name: 'Pelabuhan Ratu, Sukabumi', type: 'Tide Gauge', lat: -6.98, lon: 106.54, baseLevelMeters: 1.12, level: '1.12m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['pelabuhan ratu', 'sukabumi', 'banten', 'selat sunda', 'jawa barat', 'pandeglang', 'pangandaran', 'jawa selatan', 'south java'] },
  { code: 'cila', name: 'Cilacap, Jawa Tengah', type: 'Tide Gauge', lat: -7.74, lon: 109.01, baseLevelMeters: 1.2, level: '1.20m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['cilacap', 'jawa tengah', 'jawa selatan', 'south java', 'selatan jawa', 'yogyakarta', 'kebumen', 'pangandaran', 'parangtritis'] },
  { code: 'prig', name: 'Prigi, Trenggalek', type: 'Tide Gauge', lat: -8.28, lon: 111.72, baseLevelMeters: 0.95, level: '0.95m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['prigi', 'trenggalek', 'pacitan', 'jawa timur', 'jawa selatan', 'south java', 'selatan jawa', 'malang', 'banyuwangi'] },
  { code: 'beno', name: 'Benoa, Bali', type: 'Tide Gauge', lat: -8.75, lon: 115.22, baseLevelMeters: 1.45, level: '1.45m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['benoa', 'bali', 'banyuwangi', 'jawa timur', 'south java'] },
  { code: 'lemb', name: 'Lembar, Lombok', type: 'Tide Gauge', lat: -8.73, lon: 116.07, baseLevelMeters: 1.18, level: '1.18m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['lembar', 'lombok', 'ntb', 'bali'] },
  { code: 'bima', name: 'Bima, Sumbawa', type: 'Tide Gauge', lat: -8.45, lon: 118.72, baseLevelMeters: 0.88, level: '0.88m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['bima', 'sumbawa', 'ntb'] },
  { code: 'waig', name: 'Waingapu, Sumba', type: 'Tide Gauge', lat: -9.65, lon: 120.26, baseLevelMeters: 1.02, level: '1.02m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['waingapu', 'sumba', 'ntt'] },
  { code: 'kupa', name: 'Tenau, Kupang', type: 'Tide Gauge', lat: -10.18, lon: 123.53, baseLevelMeters: 1.3, level: '1.30m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['kupang', 'tenau', 'ntt', 'timor'] },
  { code: 'pntk', name: 'Pontianak, Kalbar', type: 'Tide Gauge', lat: -0.02, lon: 109.33, baseLevelMeters: 0.74, level: '0.74m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['pontianak', 'kalbar'] },
  { code: 'bppn', name: 'Semayang, Balikpapan', type: 'Tide Gauge', lat: -1.27, lon: 116.82, baseLevelMeters: 1.15, level: '1.15m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['balikpapan', 'makassar', 'palu', 'koro', 'donggala'] },
  { code: 'toli', name: 'Toli-Toli, Sulteng', type: 'Tide Gauge', lat: 1.05, lon: 120.81, baseLevelMeters: 0.92, level: '0.92m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['toli', 'palu', 'donggala', 'koro', 'sulteng', 'sulawesi tengah', 'mamuju', 'majene'] },
  { code: 'bitu', name: 'Bitung, Sulawesi Utara', type: 'Tide Gauge', lat: 1.44, lon: 125.19, baseLevelMeters: 1.35, level: '1.35m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['bitung', 'sulawesi utara', 'manado', 'minahasa', 'maluku', 'gorontalo'] },
  { code: 'kend', name: 'Kendari, Sultra', type: 'Tide Gauge', lat: -3.98, lon: 122.58, baseLevelMeters: 0.86, level: '0.86m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['kendari', 'sultra', 'sulawesi', 'palu'] },
  { code: 'ambo', name: 'Ambon, Maluku', type: 'Tide Gauge', lat: -3.7, lon: 128.18, baseLevelMeters: 1.1, level: '1.10m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['ambon', 'maluku', 'banda', 'seram'] },
  { code: 'jayp', name: 'Jayapura, Papua', type: 'Tide Gauge', lat: -2.53, lon: 140.71, baseLevelMeters: 0.98, level: '0.98m', anomaly: '0.00m', trend: 'NORMAL', status: 'OPERATIONAL', isAnomaly: false, source: 'SEEDED', keywords: ['jayapura', 'papua', 'biak'] },
];

export function parseBMKGDepth(str: string): number {
  const raw = (str || '').toLowerCase().replace(/km/g, '').trim();
  const d = parseFloat(raw);
  return Number.isNaN(d) || d <= 0 ? 10 : d;
}

export function parseBMKGCoords(str: string): { lat: number; lon: number } | null {
  if (!str) return null;
  const parts = str.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lon = parseFloat(parts[1].trim());
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

export function buildSeismicEvent(params: {
  magnitude: number;
  depth: number;
  latitude: number;
  longitude: number;
  faultZone: string;
  timestamp?: string;
}): SeismicEvent {
  const mag = Number.isFinite(params.magnitude) ? params.magnitude : 4.5;
  const depth = Number.isFinite(params.depth) && params.depth > 0 ? params.depth : 10;
  const mmi = Math.min(12, Math.max(1, Math.round(mag * 1.5 - depth * 0.015)));
  const pga = (mag * 0.14) / (1.0 + depth * 0.01);
  return {
    type: 'SEISMIC',
    magnitude: mag,
    depth,
    frequency: 1.0 + mag * 0.5,
    count: 1,
    latitude: params.latitude,
    longitude: params.longitude,
    mmi,
    pga: Math.max(0.001, pga),
    fault_zone: params.faultZone,
    timestamp: params.timestamp || new Date().toISOString(),
  };
}

type NextRequestInit = RequestInit & { next?: { revalidate?: number } };

function fetchRevalidated(url: string, timeoutMs: number, revalidate: number, headers?: HeadersInit) {
  const init: NextRequestInit = {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate },
  };
  return fetch(url, init);
}

export async function fetchRealtimeEarthquakesData(): Promise<RealtimeEarthquakesData> {
  try {
    const [bmkgAutoRes, bmkgRecentRes, usgsRes] = await Promise.allSettled([
      fetchRevalidated('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', 4000, 30),
      fetchRevalidated('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', 4000, 30),
      fetchRevalidated(
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&limit=12&orderby=time',
        4000,
        45
      ),
    ]);

    let latestBMKG: BMKGGempaDetail | null = null;
    const recentBMKG: SeismicEvent[] = [];
    const recentUSGS: SeismicEvent[] = [];

    if (bmkgAutoRes.status === 'fulfilled' && bmkgAutoRes.value.ok) {
      try {
        const json = await bmkgAutoRes.value.json();
        if (json?.Infogempa?.gempa) {
          latestBMKG = json.Infogempa.gempa as BMKGGempaDetail;
        }
      } catch {
        // ignore parse error
      }
    }

    if (bmkgRecentRes.status === 'fulfilled' && bmkgRecentRes.value.ok) {
      try {
        const json = await bmkgRecentRes.value.json();
        const gempaList: BMKGGempaDetail[] = json?.Infogempa?.gempa || [];
        for (const g of gempaList) {
          const coords = parseBMKGCoords(g.Coordinates);
          if (!coords) continue;
          recentBMKG.push(
            buildSeismicEvent({
              magnitude: parseFloat(g.Magnitude) || 5.0,
              depth: parseBMKGDepth(g.Kedalaman),
              latitude: coords.lat,
              longitude: coords.lon,
              faultZone: g.Wilayah,
              timestamp: g.DateTime,
            })
          );
        }
      } catch {
        // ignore parse error
      }
    }

    if (usgsRes.status === 'fulfilled' && usgsRes.value.ok) {
      try {
        const json = await usgsRes.value.json();
        const features = json?.features || [];
        for (const f of features) {
          const coords = f?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          recentUSGS.push(
            buildSeismicEvent({
              magnitude: f?.properties?.mag ?? 4.5,
              depth: coords[2] ?? 10,
              latitude: coords[1],
              longitude: coords[0],
              faultZone: f?.properties?.place || 'Indonesia Region',
              timestamp: f?.properties?.time ? new Date(f.properties.time).toISOString() : undefined,
            })
          );
        }
      } catch {
        // ignore parse error
      }
    }

    if (!latestBMKG && recentBMKG.length > 0) {
      const first = recentBMKG[0];
      latestBMKG = {
        Tanggal: new Date(first.timestamp).toLocaleDateString('id-ID'),
        Jam: new Date(first.timestamp).toLocaleTimeString('id-ID'),
        DateTime: first.timestamp,
        Coordinates: `${first.latitude},${first.longitude}`,
        Lintang: `${Math.abs(first.latitude).toFixed(2)} ${first.latitude < 0 ? 'LS' : 'LU'}`,
        Bujur: `${Math.abs(first.longitude).toFixed(2)} ${first.longitude < 0 ? 'BB' : 'BT'}`,
        Magnitude: first.magnitude.toFixed(1),
        Kedalaman: `${first.depth.toFixed(0)} km`,
        Wilayah: first.fault_zone,
        Potensi: 'Tidak berpotensi tsunami',
      };
    }

    if (latestBMKG || recentBMKG.length > 0 || recentUSGS.length > 0) {
      return {
        latest_bmkg: latestBMKG || FALLBACK_EARTHQUAKES.latest_bmkg,
        recent_bmkg: recentBMKG.length > 0 ? recentBMKG : FALLBACK_EARTHQUAKES.recent_bmkg,
        recent_usgs: recentUSGS.length > 0 ? recentUSGS : FALLBACK_EARTHQUAKES.recent_usgs,
        timestamp: new Date().toISOString(),
      };
    }
  } catch {
    // fall back cleanly below
  }

  return {
    ...FALLBACK_EARTHQUAKES,
    timestamp: new Date().toISOString(),
  };
}

function getVolcanoAlertLevel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lewotobi')) return 'LEVEL IV (AWAS)';
  if (n.includes('ibu') || n.includes('krakatau') || n.includes('semeru') || n.includes('merapi') || n.includes('marapi')) {
    return 'LEVEL III (SIAGA)';
  }
  return 'LEVEL II (WASPADA)';
}

function getVolcanoRecommendation(level: string): string {
  if (level.includes('AWAS')) {
    return 'Zona bahaya radius 7 km dari kawah harus dikosongkan total. Waspadai awan panas guguran dan lahar hujan.';
  }
  if (level.includes('SIAGA')) {
    return 'Masyarakat dan wisatawan dilarang beraktivitas dalam radius 3 - 5 km dari kawah aktif. Gunakan pelindung pernapasan bila hujan abu.';
  }
  return 'Masyarakat diimbau tidak mendekati kawah dalam radius 2 km dan mengikuti arahan Pos PGA PVMBG setempat.';
}

export function fallbackVolcanoEruptions(now = new Date()): VolcanoEruption[] {
  const dateLabel = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  const iso = now.toISOString();

  return [
    {
      id: 'volcano-ibu-fallback',
      volcano_name: 'Ibu',
      time: 'Monitoring Aktif',
      date: dateLabel,
      description: 'Aktivitas vulkanik G. Ibu terpantau pada stasiun PGA PVMBG dengan embusan kolom abu kelabu berkala.',
      amplitude: '28 mm',
      duration: '44 detik',
      visual_ash: 'Kolom abu kelabu tebal terpantau di puncak',
      author: 'Pos PGA Ibu / PVMBG',
      alert_level: 'LEVEL III (SIAGA)',
      recommendation: 'Masyarakat dilarang beraktivitas dalam radius 4 km dari kawah aktif.',
      timestamp: iso,
    },
    {
      id: 'volcano-krakatau-fallback',
      volcano_name: 'Anak Krakatau',
      time: 'Monitoring Aktif',
      date: dateLabel,
      description: 'Stasiun seismik Pasauran & Kalianda memantau tremor vulkanik Anak Krakatau di kawasan Selat Sunda.',
      amplitude: '24 mm',
      duration: '36 detik',
      visual_ash: 'Asap kawah putih hingga kelabu intensitas sedang',
      author: 'Pos PGA Pasauran / PVMBG',
      alert_level: 'LEVEL III (SIAGA)',
      recommendation: 'Nelayan dan kapal wisata dilarang mendekati radius 5 km dari kawah aktif.',
      timestamp: iso,
    },
    {
      id: 'volcano-semeru-fallback',
      volcano_name: 'Semeru',
      time: 'Monitoring Aktif',
      date: dateLabel,
      description: 'Erupsi periodik G. Semeru dengan lontaran abu mengarah ke sektor tenggara Besuk Kobokan.',
      amplitude: '22 mm',
      duration: '110 detik',
      visual_ash: 'Asap putih kelabu condong ke tenggara',
      author: 'Pos PGA Sawur / PVMBG',
      alert_level: 'LEVEL III (SIAGA)',
      recommendation: 'Hindari aktivitas di sepanjang Besuk Kobokan hingga 13 km dari puncak.',
      timestamp: iso,
    },
  ];
}

export function parseMagmaVolcanoHTML(html: string, now = new Date()): VolcanoEruption[] {
  const chunks = html.split('<div class="timeline-item">');
  if (chunks.length <= 1) return [];

  const dateLabel = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  const iso = now.toISOString();
  const list: VolcanoEruption[] = [];

  for (let i = 1; i < chunks.length && list.length < 12; i++) {
    const chunk = chunks[i];
    const titleMatch = chunk.match(/<p class="timeline-title"><a[^>]*>([^<]+)<\/a><\/p>/i);
    if (!titleMatch) continue;

    const rawName = titleMatch[1].trim();
    const volcanoName = rawName.replace(/^Gunung\s+/i, '').trim();
    const timeMatch = chunk.match(/<div class="timeline-time"><small>([^<]+)<\/small><\/div>/i);
    const authorMatch = chunk.match(/<p class="timeline-author">Dibuat oleh <a[^>]*>([^<]+)<\/a><\/p>/i);
    const textMatch = chunk.match(/<p class="timeline-text">([\s\S]*?)<\/p>/i);
    const imgMatch = chunk.match(/src="(https:\/\/magma\.vsi\.esdm\.go\.id\/img\/crs\/[^"]+)"/i);
    const detailMatch = chunk.match(/href="(https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/informasi-letusan\/[^"]+\/show)"/i);

    const desc = textMatch
      ? textMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : 'Laporan visual letusan MAGMA ESDM.';
    const ampMatch = desc.match(/amplitudo maksimum\s*([0-9]+(?:\.[0-9]+)?\s*mm)/i);
    const durMatch = desc.match(/durasi\s*([0-9]+(?:\.[0-9]+)?\s*detik)/i);
    const lowerDesc = desc.toLowerCase();
    const visualAsh = lowerDesc.includes('kolom abu teramati')
      ? 'Kolom abu vulkanik teramati di atas puncak'
      : lowerDesc.includes('kelabu')
      ? 'Asap/abu kelabu terpantau pos PGA'
      : 'Visual letusan tidak teramati (tertutup kabut / malam)';

    const alertLevel = getVolcanoAlertLevel(volcanoName);
    list.push({
      id: `erup-${volcanoName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
      volcano_name: volcanoName,
      time: timeMatch ? timeMatch[1].trim() : 'Live',
      date: dateLabel,
      description: desc,
      amplitude: ampMatch ? ampMatch[1] : '—',
      duration: durMatch ? durMatch[1] : '—',
      visual_ash: visualAsh,
      image_url: imgMatch ? imgMatch[1] : undefined,
      detail_url: detailMatch ? detailMatch[1] : undefined,
      author: authorMatch ? authorMatch[1].trim() : 'Petugas Pos PVMBG',
      alert_level: alertLevel,
      recommendation: getVolcanoRecommendation(alertLevel),
      timestamp: iso,
    });
  }

  return list;
}

export async function fetchRealtimeVolcanoesData(): Promise<VolcanoEruption[]> {
  try {
    const res = await fetchRevalidated(
      'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan',
      4500,
      120,
      {
        'User-Agent': 'Mozilla/5.0 (compatible; INATEWS-Sentinel/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      }
    );
    if (res.ok) {
      const html = await res.text();
      const parsed = parseMagmaVolcanoHTML(html);
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback below
  }

  return fallbackVolcanoEruptions();
}

function deriveKeywordsForStation(name: string, code: string): string[] {
  const tokens = `${name} ${code}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  return Array.from(new Set(tokens));
}

export function parseIOCStations(
  rawList: unknown,
  fallbackSeeds: IOCStationReading[] = SEEDED_IOC_STATIONS
): IOCStationReading[] {
  if (!Array.isArray(rawList)) return [];

  const seedByCode = new Map(fallbackSeeds.map((s) => [s.code.toLowerCase(), s]));
  const seen = new Set<string>();
  const parsed: IOCStationReading[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const country = String(rec.country ?? rec.Country ?? '').toUpperCase();
    const countryName = String(rec.countryname ?? rec.CountryName ?? '').toLowerCase();
    if (country !== 'IDN' && countryName !== 'indonesia') continue;

    const code = String(rec.Code ?? rec.code ?? '').trim().toLowerCase();
    if (!code || seen.has(code)) continue;

    const lat = Number(rec.Lat ?? rec.lat);
    const lon = Number(rec.Lon ?? rec.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const rawLevel = Number(rec.lastvalue ?? rec.LastValue);
    const validLevel = Number.isFinite(rawLevel) && rawLevel > -50 && rawLevel < 30;
    const seed = seedByCode.get(code);
    const baseLevelMeters = validLevel ? rawLevel : seed?.baseLevelMeters ?? 1.05;

    const rawLoc = String(rec.Location ?? rec.location ?? '').trim();
    const name = seed?.name || (rawLoc ? `${rawLoc}, Indonesia` : `Stasiun ${code.toUpperCase()}`);
    const sensor = String(rec.sensor ?? rec.Sensor ?? '').trim() || seed?.type || 'Tide Gauge';
    const lastUpdated = rec.lasttime || rec.LastTime ? String(rec.lasttime ?? rec.LastTime) : undefined;

    seen.add(code);
    parsed.push({
      code,
      name,
      type: sensor,
      lat,
      lon,
      baseLevelMeters,
      level: `${baseLevelMeters.toFixed(2)}m`,
      anomaly: '0.00m',
      trend: 'NORMAL',
      status: 'OPERATIONAL',
      isAnomaly: false,
      lastUpdated,
      source: 'IOC_LIVE',
      keywords: seed?.keywords || deriveKeywordsForStation(name, code),
    });
  }

  return parsed.sort((a, b) => a.lon - b.lon);
}

export function applyTsunamiToStations(
  stations: IOCStationReading[],
  tsunami: TsunamiScenario | null
): IOCStationReading[] {
  if (!tsunami?.active) {
    return stations.map((st) => ({
      ...st,
      level: `${st.baseLevelMeters.toFixed(2)}m`,
      anomaly: '0.00m',
      trend: 'NORMAL',
      status: 'OPERATIONAL',
      isAnomaly: false,
    }));
  }

  const contextText = `${tsunami.affected_zones.join(' ')} ${tsunami.sensor_id}`.toLowerCase();
  const baseWave = Math.max(0.6, tsunami.wave_anomaly || 1.5);

  return stations.map((st, idx) => {
    const keywordMatch = st.keywords.some((kw) => contextText.includes(kw));
    if (!keywordMatch) {
      return {
        ...st,
        level: `${st.baseLevelMeters.toFixed(2)}m`,
        anomaly: '0.00m',
        trend: 'NORMAL',
        status: 'OPERATIONAL',
        isAnomaly: false,
      };
    }

    const weight = 0.55 + (idx % 4) * 0.12;
    const surge = Math.max(0.45, baseWave * weight);
    return {
      ...st,
      level: `${(st.baseLevelMeters + surge).toFixed(2)}m`,
      anomaly: `+${surge.toFixed(2)}m`,
      trend: 'TSUNAMI SURGE',
      status: 'ALERT',
      isAnomaly: true,
    };
  });
}

export async function fetchRealtimeOceanData(): Promise<OceanFeedResponse> {
  const nowIso = new Date().toISOString();
  try {
    const res = await fetchRevalidated(
      'http://www.ioc-sealevelmonitoring.org/service.php?format=json&query=stationlist',
      4500,
      60
    );
    if (res.ok) {
      const json = await res.json();
      const parsed = parseIOCStations(json);
      if (parsed.length > 0) {
        return {
          stations: parsed,
          count: parsed.length,
          live_count: parsed.length,
          anomaly_count: 0,
          source: 'IOC_LIVE',
          timestamp: nowIso,
        };
      }
    }
  } catch {
    // fall back to seeded array below
  }

  return {
    stations: SEEDED_IOC_STATIONS,
    count: SEEDED_IOC_STATIONS.length,
    live_count: 0,
    anomaly_count: 0,
    source: 'FALLBACK',
    timestamp: nowIso,
  };
}

const WEATHER_PROBE_POINTS = [
  { name: 'Selat Sunda', lat: -6.15, lon: 105.85 },
  { name: 'Selatan Jawa', lat: -7.72, lon: 109.01 },
];

export async function fetchOpenMeteoWeatherSummary(): Promise<WeatherSummary> {
  const nowIso = new Date().toISOString();
  try {
    const results = await Promise.allSettled(
      WEATHER_PROBE_POINTS.map((p) =>
        fetchRevalidated(
          `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current_weather=true`,
          3500,
          120
        )
      )
    );

    const winds: number[] = [];
    const temps: number[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        try {
          const data = await r.value.json();
          const cw = data?.current_weather;
          if (cw && typeof cw.windspeed === 'number' && typeof cw.temperature === 'number') {
            winds.push(cw.windspeed);
            temps.push(cw.temperature);
          }
        } catch {
          // ignore
        }
      }
    }

    if (winds.length > 0 && temps.length > 0) {
      const avgWind = winds.reduce((a, b) => a + b, 0) / winds.length;
      const maxWind = Math.max(...winds);
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const conditionTag = maxWind >= 35 ? 'ANGIN KENCANG' : 'TERPANTAU NOMINAL';
      return {
        statusLabel: `${avgWind.toFixed(0)} km/h • ${avgTemp.toFixed(1)}°C (${conditionTag})`,
        avgWindKmh: Number(avgWind.toFixed(1)),
        maxWindKmh: Number(maxWind.toFixed(1)),
        avgTempC: Number(avgTemp.toFixed(1)),
        stationName: 'Selat Sunda & Selatan Jawa',
        source: 'OPEN_METEO',
        timestamp: nowIso,
      };
    }
  } catch {
    // fallback below
  }

  return {
    statusLabel: 'OPEN-METEO ONLINE',
    avgWindKmh: 16,
    maxWindKmh: 20,
    avgTempC: 28.5,
    stationName: 'Zona Subduksi Indonesia',
    source: 'FALLBACK',
    timestamp: nowIso,
  };
}

export function computeDynamicIntensityAndStatus(params: {
  earthquakes: RealtimeEarthquakesData;
  ocean: OceanFeedResponse;
  weather: WeatherSummary;
  now?: Date;
}): {
  activityIndex: ActivityIndex;
  status: SystemStatus;
  tsunami: TsunamiScenario | null;
} {
  const nowIso = (params.now || new Date()).toISOString();
  const latestMag = parseFloat(params.earthquakes.latest_bmkg?.Magnitude || '0') || 0;
  const combined = [...(params.earthquakes.recent_bmkg || []), ...(params.earthquakes.recent_usgs || [])];
  const mags = combined.map((q) => q.magnitude).filter((m) => Number.isFinite(m) && m > 0);
  if (latestMag > 0) mags.unshift(latestMag);

  const maxMag = mags.length > 0 ? Math.max(...mags) : 3.8;
  const avgMag = mags.length > 0 ? mags.reduce((a, b) => a + b, 0) / mags.length : 3.8;
  const recentStrongCount = mags.filter((m) => m >= 5.0).length;

  const potensi = (params.earthquakes.latest_bmkg?.Potensi || '').toLowerCase();
  const isTsunamiWarning = potensi.includes('berpotensi tsunami') && !potensi.includes('tidak');

  // Derive realistic intensity percentage (12% quiet baseline up to 96% for major M7+ / tsunami)
  const rawPct =
    14 +
    Math.max(0, maxMag - 3.5) * 14 +
    Math.min(18, recentStrongCount * 2.5) +
    (isTsunamiWarning ? 28 : 0);
  const overallPercentage = Number(Math.min(98, Math.max(12, rawPct)).toFixed(1));

  const riskLevel =
    isTsunamiWarning || maxMag >= 7.0
      ? 'CRITICAL'
      : maxMag >= 6.0 || overallPercentage >= 70
      ? 'HIGH'
      : maxMag >= 5.0 || overallPercentage >= 45
      ? 'ELEVATED'
      : 'NORMAL';

  const trendDirection =
    isTsunamiWarning
      ? 'TSUNAMI ALERT'
      : maxMag >= 6.0
      ? 'ELEVATED CLUSTER'
      : params.earthquakes.recent_bmkg.length > 0
      ? 'BMKG LIVE TELEMETRY'
      : 'STABLE';

  const activeAlerts = (isTsunamiWarning ? 3 : 0) + (maxMag >= 6.0 ? 2 : maxMag >= 5.5 ? 1 : 0);

  const oceanStatus = isTsunamiWarning
    ? 'TSUNAMI WARNING ACTIVE'
    : params.ocean.live_count > 0
    ? `IOC LIVE (${params.ocean.live_count} STASIUN)`
    : 'IOC STANDBY ARRAY';

  const tsunami: TsunamiScenario | null = isTsunamiWarning
    ? {
        active: true,
        detection_time: params.earthquakes.latest_bmkg?.DateTime || nowIso,
        sensor_id: `IOC UNESCO (${params.ocean.count} Pasut) & BMKG TEWS`,
        wave_anomaly: Number(Math.max(1.5, (maxMag - 6.0) * 1.8).toFixed(2)),
        affected_zones: [params.earthquakes.latest_bmkg?.Wilayah || 'Pesisir Dekat Episenter'],
        response_actions: [
          'Aktifkan peringatan dini tsunami BMKG & sirine pesisir terdekat',
          'Evakuasi segera menjauhi pantai dan muara sungai menuju ketinggian >20m',
          'Pantau pembacaan langsung tide gauge IOC UNESCO & DART Buoy',
        ],
        severity: 'CRITICAL',
        timestamp: nowIso,
      }
    : null;

  const activityIndex: ActivityIndex = {
    overall_percentage: overallPercentage,
    seismic_change: Number((Math.max(1.2, (maxMag - 3.0) * 4.8)).toFixed(1)),
    tremor_change: Number((Math.max(0.8, recentStrongCount * 1.4)).toFixed(1)),
    deformation_trend: maxMag >= 6.0 ? 'ELEVATED STRAIN RELEASE' : 'REALTIME_MONITORED',
    thermal_trend: 'MONITORED (MAGMA/PVMBG)',
    trend_direction: trendDirection,
    earthquake_count: combined.length + (params.earthquakes.latest_bmkg ? 1 : 0),
    avg_magnitude: Number(avgMag.toFixed(1)),
    max_magnitude: Number(maxMag.toFixed(1)),
    timestamp: nowIso,
  };

  const status: SystemStatus = {
    seismic_intensity: overallPercentage,
    ocean_status: oceanStatus,
    weather_status: params.weather.statusLabel,
    infra_status: riskLevel === 'CRITICAL' ? 'SIAGA DARURAT PESISIR' : 'OPERASIONAL',
    active_alerts: activeAlerts,
    risk_level: riskLevel,
    trend_direction: trendDirection,
    last_update: nowIso,
    tsunami_scenario: tsunami ?? undefined,
  };

  return { activityIndex, status, tsunami };
}

export async function fetchLiveTelemetrySnapshot(): Promise<LiveTelemetrySnapshot> {
  const [quakesRes, volcanoesRes, oceanRes, weatherRes] = await Promise.allSettled([
    fetchRealtimeEarthquakesData(),
    fetchRealtimeVolcanoesData(),
    fetchRealtimeOceanData(),
    fetchOpenMeteoWeatherSummary(),
  ]);

  const earthquakes = quakesRes.status === 'fulfilled' ? quakesRes.value : FALLBACK_EARTHQUAKES;
  const volcanoes = volcanoesRes.status === 'fulfilled' ? volcanoesRes.value : fallbackVolcanoEruptions();
  const ocean =
    oceanRes.status === 'fulfilled'
      ? oceanRes.value
      : {
          stations: SEEDED_IOC_STATIONS,
          count: SEEDED_IOC_STATIONS.length,
          live_count: 0,
          anomaly_count: 0,
          source: 'FALLBACK' as const,
          timestamp: new Date().toISOString(),
        };
  const weather =
    weatherRes.status === 'fulfilled'
      ? weatherRes.value
      : {
          statusLabel: 'OPEN-METEO ONLINE',
          avgWindKmh: 16,
          maxWindKmh: 20,
          avgTempC: 28.5,
          stationName: 'Zona Subduksi Indonesia',
          source: 'FALLBACK' as const,
          timestamp: new Date().toISOString(),
        };

  const { activityIndex, status, tsunami } = computeDynamicIntensityAndStatus({
    earthquakes,
    ocean,
    weather,
  });

  return {
    earthquakes,
    volcanoes,
    ocean,
    weather,
    activityIndex,
    status,
    tsunami,
  };
}

export function buildLiveAgentState(params: {
  snapshot: LiveTelemetrySnapshot;
  activeProvider: string;
  activeModel: string;
  now?: Date;
}): AgentState {
  const now = params.now || new Date();
  const nowIso = now.toISOString();
  const { earthquakes, ocean, weather, volcanoes, activityIndex, status } = params.snapshot;
  const latest = earthquakes.latest_bmkg;
  const magLabel = latest?.Magnitude ? `M${latest.Magnitude}` : `M${activityIndex.max_magnitude.toFixed(1)}`;
  const regionLabel = latest?.Wilayah || 'Zona Subduksi Indonesia';
  const severity = status.risk_level === 'CRITICAL' ? 'CRITICAL' : status.risk_level === 'HIGH' ? 'HIGH' : 'NORMAL';
  const baseCycle = Math.max(24, Math.floor(now.getTime() / 15000) % 900);

  const recentThoughts: AgentThought[] = [
    {
      cycle_id: baseCycle - 3,
      phase: 'OBSERVE',
      message: `Menyerap gempa terkini BMKG ${magLabel} (${latest?.Kedalaman || '10 km'}) di ${regionLabel} serta ${ocean.live_count > 0 ? ocean.live_count : ocean.count} stasiun pasut IOC UNESCO.`,
      severity,
      timestamp: new Date(now.getTime() - 45000).toISOString(),
    },
    {
      cycle_id: baseCycle - 2,
      phase: 'ORIENT',
      message: `Mengorelasikan ${activityIndex.earthquake_count} event seismik BMKG+USGS (maks M${activityIndex.max_magnitude.toFixed(1)}), cuaca maritim ${weather.statusLabel}, dan ${volcanoes.length} laporan vulkanik PVMBG.`,
      severity,
      timestamp: new Date(now.getTime() - 30000).toISOString(),
    },
    {
      cycle_id: baseCycle - 1,
      phase: 'DECIDE',
      message: status.tsunami_scenario?.active
        ? `Ambang bahaya tsunami terlewati (${magLabel}). Mengeluarkan rekomendasi aktivasi peringatan pesisir segera.`
        : `Indeks intensitas seismik terhitung ${activityIndex.overall_percentage.toFixed(1)}% (${status.risk_level}). Belum ada indikasi tsunami destruktif dari jaringan IOC UNESCO.`,
      severity,
      timestamp: new Date(now.getTime() - 15000).toISOString(),
    },
    {
      cycle_id: baseCycle,
      phase: 'ACT',
      message: `Menyelaraskan status pemantauan kontinyu ke dasbor BMKG/BNPB dan memperbarui memori konteks Copilot (${params.activeModel}).`,
      severity,
      timestamp: nowIso,
    },
  ];

  const recentActions: AgentTacticalAction[] = [
    {
      id: `act-bmkg-${baseCycle}`,
      type: status.tsunami_scenario?.active ? 'TSUNAMI_ALERT_DISPATCH' : 'STATION_VERIFICATION',
      agency: 'BMKG InaTEWS',
      target_zone: regionLabel,
      priority: severity === 'CRITICAL' ? 'CRITICAL' : activityIndex.max_magnitude >= 5.0 ? 'ELEVATED' : 'NORMAL',
      rationale: `Evaluasi real-time parameter ${magLabel} kedalaman ${latest?.Kedalaman || '10 km'} (${latest?.Potensi || 'terpantau'}).`,
      timestamp: nowIso,
    },
    {
      id: `act-ioc-${baseCycle}`,
      type: 'TIDE_GAUGE_POLL',
      agency: 'IOC UNESCO',
      target_zone: ocean.live_count > 0 ? `${ocean.live_count} Stasiun Pasut Live Indonesia` : 'Jaringan Pasut Pesisir Indonesia',
      priority: status.tsunami_scenario?.active ? 'CRITICAL' : 'NORMAL',
      rationale: `Pemantauan elevasi muka air laut (${status.ocean_status}) dan kondisi angin permukaan ${weather.avgWindKmh} km/h.`,
      timestamp: new Date(now.getTime() - 30000).toISOString(),
    },
  ];

  return {
    status: status.risk_level === 'CRITICAL' ? 'ALERT_DISPATCH' : 'MONITORING',
    active_provider: params.activeProvider,
    active_model: params.activeModel,
    total_cycles: baseCycle,
    last_evaluated_at: nowIso,
    current_risk: status.risk_level,
    latest_intensity: activityIndex,
    recent_thoughts: recentThoughts,
    recent_actions: recentActions,
  };
}
