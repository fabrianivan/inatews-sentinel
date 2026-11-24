import type {
  ActivityIndex,
  AgentState,
  AgentTacticalAction,
  AgentThought,
  BMKGGempaDetail,
  FeedProvenance,
  FeedState,
  RealtimeEarthquakesData,
  SeismicEvent,
  SystemStatus,
  TsunamiScenario,
  VolcanoEruption,
} from './types';
import {
  assessAttention,
  attentionToRiskLevel,
  ATTENTION_WINDOW_MS,
  collectQuakeFacts,
  type QuakeFeedHealth,
} from './attention';
import { toTone, TONE_LABEL } from './severity';
import { formatWibDate, formatWibTime, toDate, toMillis } from './time';
import { findTsunamiStatement } from './tsunamiNotice';
import { findVolcanoLocation } from './volcanoData';
import {
  findCameraCards,
  findSeismogramCard,
  mediaCardLabel,
  parseMagmaMediaCards,
  type MagmaMediaCard,
  type VolcanoMediaResponse,
  type VolcanoMediaState,
} from './volcanoMedia';

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
  /** ISO time of the station's last value in the IOC list, when IOC gave a usable one. */
  lastUpdated?: string;
  source: 'IOC_LIVE' | 'SEEDED';
  /** Where `baseLevelMeters` comes from: IOC's last listed value, or a built-in constant. */
  levelSource?: 'IOC_LASTVALUE' | 'BUILT_IN';
  keywords: string[];
}

export interface OceanFeedResponse {
  stations: IOCStationReading[];
  count: number;
  live_count: number;
  anomaly_count: number;
  source: 'IOC_LIVE' | 'FALLBACK';
  /**
   * What the station levels are. Only the IOC station list is fetched, never a sea-level
   * series, so a level is the station's last listed value or a built-in constant: a
   * reference for display, not a live observation, and no anomaly is derived from it.
   * Absent on Go-backend payloads.
   */
  level_kind?: 'reference';
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

/**
 * Built-in placeholder set, served only when no quake feed answered. Every record is
 * marked `seeded` so nothing downstream reads it as a report from BMKG or USGS.
 */
export const FALLBACK_EARTHQUAKES: RealtimeEarthquakesData = {
  latest_bmkg: {
    Tanggal: 'Tidak tersedia',
    Jam: '—',
    DateTime: new Date().toISOString(),
    Coordinates: '-6.92,105.49',
    Lintang: '6.92 LS',
    Bujur: '105.49 BT',
    Magnitude: '3.8',
    Kedalaman: '25 km',
    Wilayah: 'Selat Sunda — Zona Pemantauan Subduksi Jawa-Sumatra',
    Potensi: '',
    seeded: true,
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
      seeded: true,
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
      seeded: true,
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
      seeded: true,
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
      seeded: true,
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
      seeded: true,
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

/** Shapes a feed-reported quake. Callers pass a magnitude and time the feed actually gave. */
export function buildSeismicEvent(params: {
  magnitude: number;
  depth: number;
  latitude: number;
  longitude: number;
  faultZone: string;
  timestamp: string;
}): SeismicEvent {
  const mag = params.magnitude;
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
    timestamp: params.timestamp,
  };
}

/** One upstream read: the parsed body (null on any failure) and when the request was really made. */
export interface UpstreamRead {
  body: unknown;
  fetchedAt: string;
  /** True when the caller stopped waiting (`waitMs`) while the request is still running. */
  pending?: boolean;
}

export interface UpstreamOptions {
  timeoutMs: number;
  /** How long a good answer is reused before the upstream is asked again. */
  ttlSeconds: number;
  parse: 'json' | 'text';
  headers?: HeadersInit;
  /**
   * How long the last good body may stand in for a failed read. Defaults to twice the TTL:
   * long enough to absorb one slow or dropped response, short enough that an outage is
   * reported within a minute or two.
   */
  staleIfErrorSeconds?: number;
  /**
   * How long a caller waits for a slow read before going on with the last good body (or,
   * without one, a failure). The read itself keeps running until `timeoutMs` and serves
   * later callers. For feeds that answer slowly and change rarely; by default a caller
   * waits for the read.
   */
  waitMs?: number;
}

/** A failed read is retried this soon instead of being held for the whole interval. */
const FAILED_READ_TTL_MS = 5_000;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Reads upstream URLs through a short in-process memo, so the dashboard's own polling
 * (several routes, every client, every 20 s) does not multiply into upstream requests.
 *
 * Next's data cache is deliberately not used: with `next.revalidate` it keeps serving the
 * last good body for as long as revalidation fails, with nothing to say how old it is, so
 * an outage reads as live data fetched just now. Here the tolerance is explicit and
 * bounded: after a failed read the last good body stands in for `staleIfErrorSeconds`,
 * always carrying the time of the request that really produced it; past that the read is
 * reported as failed.
 */
export function createUpstreamReader(
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
  now: () => number = Date.now
): (url: string, options: UpstreamOptions) => Promise<UpstreamRead> {
  const memo = new Map<string, { expiresAtMs: number; settled: boolean; read: Promise<UpstreamRead> }>();
  const lastGood = new Map<string, { atMs: number; read: UpstreamRead }>();

  /** The last good body, while it is still within the tolerance for this feed. */
  const standIn = (url: string, options: UpstreamOptions): UpstreamRead | null => {
    const previous = lastGood.get(url);
    const graceMs = (options.staleIfErrorSeconds ?? options.ttlSeconds * 2) * 1000;
    return previous && now() - previous.atMs <= graceMs ? previous.read : null;
  };

  /**
   * Hands a caller the read. For a feed with `waitMs` whose request is still running, the
   * caller gets what is already known instead: the last good body straight away, or, with
   * nothing known yet, a read marked `pending` once `waitMs` has passed.
   */
  const forCaller = (
    url: string,
    options: UpstreamOptions,
    entry: { settled: boolean; read: Promise<UpstreamRead> }
  ): Promise<UpstreamRead> => {
    if (options.waitMs === undefined || entry.settled) return entry.read;
    const known = standIn(url, options);
    if (known) return Promise.resolve(known);
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ body: null, fetchedAt: new Date(now()).toISOString(), pending: true }),
        options.waitMs
      );
      // `read` never rejects: every failure inside it resolves to a stand-in or a failed read.
      void entry.read.then((result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
  };

  return (url, options) => {
    const startedMs = now();
    const hit = memo.get(url);
    if (hit && hit.expiresAtMs > startedMs) return forCaller(url, options, hit);

    const fetchedAt = new Date(startedMs).toISOString();
    const failed: UpstreamRead = { body: null, fetchedAt };
    const entry = { expiresAtMs: startedMs + options.ttlSeconds * 1000, settled: false, read: Promise.resolve(failed) };
    entry.read = (async (): Promise<UpstreamRead> => {
      try {
        const response = await fetchImpl(url, {
          headers: options.headers,
          signal: AbortSignal.timeout(options.timeoutMs),
          cache: 'no-store',
        });
        if (response.ok) {
          const body: unknown = options.parse === 'text' ? await response.text() : await response.json();
          if (body !== null && body !== undefined) {
            const good: UpstreamRead = { body, fetchedAt };
            lastGood.set(url, { atMs: startedMs, read: good });
            return good;
          }
        }
      } catch {
        // timeout, network error or an unparseable body: handled as a failed read below
      }
      entry.expiresAtMs = Math.min(entry.expiresAtMs, now() + FAILED_READ_TTL_MS);
      return standIn(url, options) ?? failed;
    })();
    void entry.read.then(() => {
      entry.settled = true;
    });
    memo.set(url, entry);
    return forCaller(url, options, entry);
  };
}

const readUpstream = createUpstreamReader();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function bmkgGempa(json: unknown): unknown {
  return asRecord(asRecord(json)?.Infogempa)?.gempa;
}

/**
 * Shapes an untyped record (upstream JSON, or a quake a client echoes back) as a BMKG
 * report: every field the dashboard reads as text is made text, so a number where a
 * string is expected cannot throw further down.
 */
export function toBMKGDetail(gempa: Record<string, unknown>): BMKGGempaDetail {
  const text = (value: unknown): string =>
    typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  return {
    Tanggal: text(gempa.Tanggal),
    Jam: text(gempa.Jam),
    DateTime: text(gempa.DateTime),
    Coordinates: text(gempa.Coordinates),
    Lintang: text(gempa.Lintang),
    Bujur: text(gempa.Bujur),
    Magnitude: text(gempa.Magnitude),
    Kedalaman: text(gempa.Kedalaman),
    Wilayah: text(gempa.Wilayah),
    Potensi: text(gempa.Potensi),
    ...(gempa.Dirasakan === undefined || gempa.Dirasakan === null ? {} : { Dirasakan: text(gempa.Dirasakan) }),
    ...(gempa.Shakemap === undefined || gempa.Shakemap === null ? {} : { Shakemap: text(gempa.Shakemap) }),
    ...(gempa.seeded === true ? { seeded: true } : {}),
  };
}

/** BMKG's latest report (autogempa.json), or null when it lacks a usable time or magnitude. */
export function parseBMKGLatest(json: unknown): BMKGGempaDetail | null {
  const gempa = asRecord(bmkgGempa(json));
  if (!gempa) return null;
  const magnitude = parseFloat(String(gempa.Magnitude ?? ''));
  if (toDate(String(gempa.DateTime ?? '')) === null || !Number.isFinite(magnitude) || magnitude <= 0) return null;
  const detail = toBMKGDetail(gempa);
  // BMKG's feed never marks a record as a placeholder; that flag is the dashboard's own.
  delete detail.seeded;
  return detail;
}

/**
 * BMKG's felt-earthquake list (gempadirasakan.json): the same fields as the latest report,
 * with "Dirasakan". An entry without a usable time or magnitude is skipped.
 */
export function parseBMKGFelt(json: unknown): BMKGGempaDetail[] {
  const list = bmkgGempa(json);
  if (!Array.isArray(list)) return [];
  const reports: BMKGGempaDetail[] = [];
  for (const item of list) {
    const gempa = asRecord(item);
    if (!gempa) continue;
    const magnitude = parseFloat(String(gempa.Magnitude ?? ''));
    if (toDate(String(gempa.DateTime ?? '')) === null || !Number.isFinite(magnitude) || magnitude <= 0) continue;
    const report = toBMKGDetail(gempa);
    delete report.seeded;
    reports.push(report);
  }
  return reports;
}

/**
 * BMKG's M ≥ 5 list (gempaterkini.json). An entry without a parseable time, magnitude or
 * position is skipped: stamping it "now" or assuming a magnitude would invent an earthquake.
 */
export function parseBMKGRecent(json: unknown): SeismicEvent[] {
  const list = bmkgGempa(json);
  if (!Array.isArray(list)) return [];

  const events: SeismicEvent[] = [];
  for (const item of list) {
    const gempa = asRecord(item);
    if (!gempa) continue;
    const coords = parseBMKGCoords(String(gempa.Coordinates ?? ''));
    const magnitude = parseFloat(String(gempa.Magnitude ?? ''));
    const dateTime = String(gempa.DateTime ?? '');
    if (!coords || !Number.isFinite(magnitude) || magnitude <= 0 || toDate(dateTime) === null) continue;

    const event = buildSeismicEvent({
      magnitude,
      depth: parseBMKGDepth(String(gempa.Kedalaman ?? '')),
      latitude: coords.lat,
      longitude: coords.lon,
      faultZone: String(gempa.Wilayah ?? ''),
      timestamp: dateTime,
    });
    const potensi = typeof gempa.Potensi === 'string' ? gempa.Potensi.trim() : '';
    events.push(potensi ? { ...event, potensi } : event);
  }
  return events;
}

/** USGS regional catalogue (GeoJSON); the same skip rule as the BMKG list applies. */
export function parseUSGSRecent(json: unknown): SeismicEvent[] {
  const features = asRecord(json)?.features;
  if (!Array.isArray(features)) return [];

  const events: SeismicEvent[] = [];
  for (const item of features) {
    const feature = asRecord(item);
    const properties = asRecord(feature?.properties);
    const coords = asRecord(feature?.geometry)?.coordinates;
    if (!properties || !Array.isArray(coords)) continue;
    const [longitude, latitude, depth] = coords.map(Number);
    const magnitude = typeof properties.mag === 'number' ? properties.mag : NaN;
    const time = typeof properties.time === 'number' ? toDate(properties.time) : null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !(magnitude > 0) || !time) continue;

    events.push(
      buildSeismicEvent({
        magnitude,
        depth,
        latitude,
        longitude,
        faultZone: typeof properties.place === 'string' ? properties.place : '',
        timestamp: time.toISOString(),
      })
    );
  }
  return events;
}

/**
 * Stand-in for the latest report while autogempa is unreachable, built from the newest
 * entry of BMKG's list. Marked `seeded` because it is not BMKG's latest report, and it
 * carries no Potensi: the list entry keeps BMKG's own text in `potensi`.
 */
function latestFromRecent(recent: SeismicEvent[]): BMKGGempaDetail {
  const newest = recent.reduce((a, b) => ((toMillis(b.timestamp) ?? 0) > (toMillis(a.timestamp) ?? 0) ? b : a));
  return {
    Tanggal: formatWibDate(newest.timestamp),
    Jam: formatWibTime(newest.timestamp),
    DateTime: newest.timestamp,
    Coordinates: `${newest.latitude},${newest.longitude}`,
    Lintang: `${Math.abs(newest.latitude).toFixed(2)} ${newest.latitude < 0 ? 'LS' : 'LU'}`,
    Bujur: `${Math.abs(newest.longitude).toFixed(2)} ${newest.longitude < 0 ? 'BB' : 'BT'}`,
    Magnitude: newest.magnitude.toFixed(1),
    Kedalaman: `${newest.depth.toFixed(0)} km`,
    Wilayah: newest.fault_zone,
    Potensi: '',
    seeded: true,
  };
}

/** Assembles the quake payload and records what each sub-feed delivered. */
type QuakeFeedId = 'bmkg_latest' | 'bmkg_recent' | 'bmkg_felt' | 'usgs';

export function buildEarthquakesPayload(feeds: {
  latest: BMKGGempaDetail | null;
  recentBMKG: SeismicEvent[];
  recentUSGS: SeismicEvent[];
  /** BMKG's felt-earthquake list; omitted by callers that do not read it. */
  feltBMKG?: BMKGGempaDetail[];
  /** When the payload was assembled. */
  fetchedAt: string;
  /** When each sub-feed was really read, where that differs from `fetchedAt` (memoised reads). */
  fetchedAtByFeed?: Partial<Record<QuakeFeedId, string>>;
}): RealtimeEarthquakesData {
  const { latest, recentBMKG, recentUSGS, feltBMKG, fetchedAt, fetchedAtByFeed } = feeds;
  const outcome = (feed: QuakeFeedId, state: FeedState): FeedProvenance => ({
    state,
    fetched_at: fetchedAtByFeed?.[feed] ?? fetchedAt,
  });

  // The placeholder set is only ever served whole. Topping up a partly live payload with
  // it would put invented quakes on the same map as real ones, so a feed that failed
  // alongside a working one contributes nothing instead.
  if (!latest && recentBMKG.length === 0 && recentUSGS.length === 0) {
    return {
      ...FALLBACK_EARTHQUAKES,
      timestamp: fetchedAt,
      provenance: {
        bmkg_latest: outcome('bmkg_latest', 'seed'),
        bmkg_recent: outcome('bmkg_recent', 'seed'),
        usgs: outcome('usgs', 'seed'),
      },
    };
  }

  const standIn = !latest && recentBMKG.length > 0 ? latestFromRecent(recentBMKG) : null;
  return {
    latest_bmkg: latest ?? standIn,
    recent_bmkg: recentBMKG,
    recent_usgs: recentUSGS,
    ...(feltBMKG ? { felt_bmkg: feltBMKG } : {}),
    timestamp: fetchedAt,
    provenance: {
      bmkg_latest: outcome('bmkg_latest', latest ? 'live' : standIn ? 'seed' : 'failed'),
      bmkg_recent: outcome('bmkg_recent', recentBMKG.length > 0 ? 'live' : 'failed'),
      ...(feltBMKG ? { bmkg_felt: outcome('bmkg_felt', feltBMKG.length > 0 ? 'live' : 'failed') } : {}),
      usgs: outcome('usgs', recentUSGS.length > 0 ? 'live' : 'failed'),
    },
  };
}

export async function fetchRealtimeEarthquakesData(): Promise<RealtimeEarthquakesData> {
  const [latest, recent, felt, usgs] = await Promise.all([
    readUpstream('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', { timeoutMs: 4000, ttlSeconds: 30, parse: 'json' }),
    readUpstream('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', { timeoutMs: 4000, ttlSeconds: 30, parse: 'json' }),
    readUpstream('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json', { timeoutMs: 4000, ttlSeconds: 30, parse: 'json' }),
    readUpstream(
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&limit=12&orderby=time',
      { timeoutMs: 4000, ttlSeconds: 45, parse: 'json' }
    ),
  ]);

  return buildEarthquakesPayload({
    latest: parseBMKGLatest(latest.body),
    recentBMKG: parseBMKGRecent(recent.body),
    recentUSGS: parseUSGSRecent(usgs.body),
    feltBMKG: parseBMKGFelt(felt.body),
    fetchedAt: new Date().toISOString(),
    fetchedAtByFeed: {
      bmkg_latest: latest.fetchedAt,
      bmkg_recent: recent.fetchedAt,
      bmkg_felt: felt.fetchedAt,
      usgs: usgs.fetchedAt,
    },
  });
}

/** Hazard radii and closures are PVMBG's to state; MAGMA's eruption page carries none, so readers are pointed there. */
const PVMBG_RECOMMENDATION = 'Ikuti rekomendasi resmi PVMBG di MAGMA Indonesia (magma.esdm.go.id).';

/**
 * MAGMA's eruption page does not state the activity level, so a report carries the level
 * of the built-in volcano catalogue — the same table every other surface quotes, tagged
 * "katalog" there. It is not a live PVMBG status.
 */
function getVolcanoAlertLevel(name: string): string {
  return findVolcanoLocation(name)?.defaultLevel ?? 'Tidak tercantum di katalog';
}

/**
 * Opens every built-in volcano record. These stand in while MAGMA is unreachable so the
 * volcano surfaces have something to open; they describe no observation and name no author.
 */
const SEEDED_VOLCANO_NOTE = 'Data cadangan bawaan — MAGMA Indonesia tidak terjangkau. Bukan laporan PVMBG untuk';

export function fallbackVolcanoEruptions(now = new Date()): VolcanoEruption[] {
  const dateLabel = formatWibDate(now);
  const iso = now.toISOString();

  return [
    {
      id: 'volcano-ibu-fallback',
      volcano_name: 'Ibu',
      time: 'Data cadangan',
      date: dateLabel,
      description: `${SEEDED_VOLCANO_NOTE} G. Ibu.`,
      amplitude: '28 mm',
      duration: '44 detik',
      visual_ash: 'Tidak tersedia (data cadangan)',
      author: 'Tidak ada (data cadangan)',
      alert_level: 'LEVEL III (SIAGA)',
      recommendation: PVMBG_RECOMMENDATION,
      timestamp: iso,
      source: 'SEEDED',
    },
    {
      id: 'volcano-krakatau-fallback',
      volcano_name: 'Anak Krakatau',
      time: 'Data cadangan',
      date: dateLabel,
      description: `${SEEDED_VOLCANO_NOTE} G. Anak Krakatau.`,
      amplitude: '24 mm',
      duration: '36 detik',
      visual_ash: 'Tidak tersedia (data cadangan)',
      author: 'Tidak ada (data cadangan)',
      alert_level: 'LEVEL III (SIAGA)',
      recommendation: PVMBG_RECOMMENDATION,
      timestamp: iso,
      source: 'SEEDED',
    },
    {
      id: 'volcano-semeru-fallback',
      volcano_name: 'Semeru',
      time: 'Data cadangan',
      date: dateLabel,
      description: `${SEEDED_VOLCANO_NOTE} G. Semeru.`,
      amplitude: '22 mm',
      duration: '110 detik',
      visual_ash: 'Tidak tersedia (data cadangan)',
      author: 'Tidak ada (data cadangan)',
      alert_level: 'LEVEL III (SIAGA)',
      recommendation: PVMBG_RECOMMENDATION,
      timestamp: iso,
      source: 'SEEDED',
    },
  ];
}

const MAGMA_MONTHS = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
];

/** Hours ahead of UTC for the three zones MAGMA writes report times in. */
const MAGMA_ZONE_OFFSET: Record<string, number> = { WIB: 7, WITA: 8, WIT: 9 };

const HTML_ENTITIES: Record<string, string> = {
  '&plusmn;': '±',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&deg;': '°',
  '&quot;': '"',
  '&#039;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

/** The handful of entities MAGMA's report text uses; anything else is left as written. */
function decodeHtmlText(text: string): string {
  return text.replace(/&(?:plusmn|nbsp|amp|deg|quot|#039|lt|gt);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

interface CalendarDay {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

/** "Hari Ini, Senin, 23 November 2026" or "Minggu, 22 November 2026, 1 hari yang lalu" → that calendar day. */
function parseMagmaDay(text: string): CalendarDay | null {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;
  const month = MAGMA_MONTHS.indexOf(match[2].toLowerCase());
  const day = Number(match[1]);
  if (month < 0 || day < 1 || day > 31) return null;
  return { year: Number(match[3]), month: month + 1, day };
}

/**
 * The day header inside a chunk of the timeline: `undefined` when there is none, `null`
 * when there is one that cannot be read (the items after it then have no known date).
 */
function lastMagmaDayHeader(chunk: string): CalendarDay | null | undefined {
  const headers = [...chunk.matchAll(/<p class="timeline-date">([^<]*)<\/p>/gi)];
  if (headers.length === 0) return undefined;
  return parseMagmaDay(headers[headers.length - 1][1]);
}

/** "18:24 WIT" on a calendar day → the instant, in the zone MAGMA wrote (WIB when it names none). */
function magmaInstant(day: CalendarDay, timeText: string): Date | null {
  const match = timeText.match(/(\d{1,2})[:.](\d{2})\s*(WITA|WIB|WIT)?/i);
  if (!match) return null;
  const offset = MAGMA_ZONE_OFFSET[(match[3] ?? 'WIB').toUpperCase()];
  const instant = new Date(Date.UTC(day.year, day.month - 1, day.day, Number(match[1]) - offset, Number(match[2])));
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * Reads MAGMA's eruption timeline. The page groups reports under day headers, and each
 * report is dated from its own header (or, failing that, from the date in its text) —
 * never from the time the page was fetched, which would present last week's eruption as
 * today's. A report whose date cannot be read says so and carries no timestamp.
 */
export function parseMagmaVolcanoHTML(html: string): VolcanoEruption[] {
  const chunks = html.split('<div class="timeline-item">');
  if (chunks.length <= 1) return [];

  const list: VolcanoEruption[] = [];
  // The header before the first report sits ahead of the first split point.
  let headerDay = lastMagmaDayHeader(chunks[0]) ?? null;

  for (let i = 1; i < chunks.length && list.length < 12; i++) {
    const chunk = chunks[i];
    const reportDay = headerDay;
    // A header at the tail of this chunk opens the next day's group.
    const nextHeader = lastMagmaDayHeader(chunk);
    if (nextHeader !== undefined) headerDay = nextHeader;

    const titleMatch = chunk.match(/<p class="timeline-title"><a[^>]*>([^<]+)<\/a><\/p>/i);
    if (!titleMatch) continue;

    const rawName = titleMatch[1].trim();
    const volcanoName = rawName.replace(/^Gunung\s+/i, '').trim();
    const timeMatch = chunk.match(/<div class="timeline-time"><small>([^<]+)<\/small><\/div>/i);
    const authorMatch = chunk.match(/<p class="timeline-author">Dibuat oleh <a[^>]*>([^<]+)<\/a><\/p>/i);
    const textMatch = chunk.match(/<p class="timeline-text">([\s\S]*?)<\/p>/i);
    const imgMatch = chunk.match(/src="(https:\/\/magma\.vsi\.esdm\.go\.id\/img\/crs\/[^"]+)"/i);
    const detailMatch = chunk.match(/href="(https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/informasi-letusan\/([^"/]+)\/show)"/i);

    const desc = textMatch
      ? decodeHtmlText(textMatch[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      : 'Laporan visual letusan MAGMA ESDM.';
    const ampMatch = desc.match(/amplitudo maksimum\s*([0-9]+(?:\.[0-9]+)?\s*mm)/i);
    const durMatch = desc.match(/durasi\s*([0-9]+(?:\.[0-9]+)?\s*detik)/i);
    const lowerDesc = desc.toLowerCase();
    // Only what the report's own wording supports; no cause is supplied on its behalf.
    const visualAsh = lowerDesc.includes('kolom abu teramati')
      ? 'Kolom abu teramati di atas puncak'
      : lowerDesc.includes('tidak teramati')
      ? 'Visual letusan tidak teramati'
      : 'Tidak dirangkum — baca teks laporan';

    const time = timeMatch ? timeMatch[1].trim() : '';
    const day = reportDay ?? parseMagmaDay(desc);
    const instant = day ? magmaInstant(day, time) : null;
    const slug = volcanoName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    list.push({
      // MAGMA's own report id keeps a record's identity stable as newer reports push it down the page.
      id: `erup-${slug}-${detailMatch ? detailMatch[2] : i}`,
      volcano_name: volcanoName,
      time: time || 'Waktu tidak tersedia',
      // The calendar day as MAGMA wrote it, in the report's own zone (05:00 UTC is midday in WIB).
      date: day ? formatWibDate(Date.UTC(day.year, day.month - 1, day.day, 5)) : 'Tanggal tidak tersedia',
      description: desc,
      amplitude: ampMatch ? ampMatch[1] : '—',
      duration: durMatch ? durMatch[1] : '—',
      visual_ash: visualAsh,
      image_url: imgMatch ? imgMatch[1] : undefined,
      detail_url: detailMatch ? detailMatch[1] : undefined,
      author: authorMatch ? authorMatch[1].trim() : 'Petugas Pos PVMBG',
      alert_level: getVolcanoAlertLevel(volcanoName),
      recommendation: PVMBG_RECOMMENDATION,
      timestamp: instant ? instant.toISOString() : '',
      source: 'PVMBG_LIVE',
    });
  }

  return list;
}

const MAGMA_PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; INATEWS-Sentinel/1.0)',
  Accept: 'text/html,application/xhtml+xml',
};

export async function fetchRealtimeVolcanoesData(): Promise<VolcanoEruption[]> {
  const page = await readUpstream('https://magma.esdm.go.id/v1/gunung-api/informasi-letusan', {
    timeoutMs: 4500,
    ttlSeconds: 120,
    parse: 'text',
    headers: MAGMA_PAGE_HEADERS,
  });
  if (typeof page.body === 'string') {
    const parsed = parseMagmaVolcanoHTML(page.body);
    if (parsed.length > 0) return parsed;
  }
  return fallbackVolcanoEruptions();
}

/**
 * MAGMA's media pages embed every image as base64, so they are large (the seismogram page
 * is several megabytes) and slow. They are read in the background, kept for five minutes,
 * and the last good copy stands in for an hour if MAGMA stops answering.
 */
const MAGMA_MEDIA_READ = {
  waitMs: 4000,
  ttlSeconds: 300,
  staleIfErrorSeconds: 60 * 60,
  parse: 'text' as const,
  headers: MAGMA_PAGE_HEADERS,
};

const parsedMediaPages = new Map<string, { fetchedAt: string; cards: MagmaMediaCard[] }>();

/** The cards of a media page, parsed once per read. Null when the page gave nothing usable. */
function mediaCards(page: 'seismogram' | 'cctv', read: UpstreamRead): MagmaMediaCard[] | null {
  if (typeof read.body !== 'string') return null;
  let parsed = parsedMediaPages.get(page);
  if (!parsed || parsed.fetchedAt !== read.fetchedAt) {
    parsed = { fetchedAt: read.fetchedAt, cards: parseMagmaMediaCards(read.body) };
    parsedMediaPages.set(page, parsed);
  }
  // A page without a single card has changed shape; that is a failed read, not "unlisted".
  return parsed.cards.length > 0 ? parsed.cards : null;
}

function mediaState(read: UpstreamRead, cards: MagmaMediaCard[] | null, found: boolean): VolcanoMediaState {
  if (found) return 'available';
  if (cards) return 'unlisted';
  return read.pending ? 'loading' : 'failed';
}

/** PVMBG's live seismogram and camera frames for one catalogue volcano, as MAGMA publishes them. */
export async function fetchVolcanoMedia(catalogueName: string): Promise<VolcanoMediaResponse> {
  const [seismogramPage, cameraPage] = await Promise.all([
    readUpstream('https://magma.esdm.go.id/v1/gunung-api/live-seismogram', { ...MAGMA_MEDIA_READ, timeoutMs: 45_000 }),
    readUpstream('https://magma.esdm.go.id/v1/gunung-api/cctv', { ...MAGMA_MEDIA_READ, timeoutMs: 20_000 }),
  ]);
  const seismogramCards = mediaCards('seismogram', seismogramPage);
  const cameraCards = mediaCards('cctv', cameraPage);
  const seismogram = seismogramCards ? findSeismogramCard(seismogramCards, catalogueName) : null;
  const cameras = cameraCards ? findCameraCards(cameraCards, catalogueName) : [];

  return {
    volcano: catalogueName,
    seismogram: seismogram
      ? {
          label: mediaCardLabel(seismogram),
          station: seismogram.detail,
          image: seismogram.image,
          fetched_at: seismogramPage.fetchedAt,
        }
      : null,
    seismogram_state: mediaState(seismogramPage, seismogramCards, seismogram !== null),
    cameras: cameras.map((card) => ({
      label: mediaCardLabel(card),
      camera: card.detail,
      image: card.image,
      fetched_at: cameraPage.fetchedAt,
    })),
    cameras_state: mediaState(cameraPage, cameraCards, cameras.length > 0),
  };
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
    // IOC writes "2026-11-16 01:00:00" in UTC with no zone designator; toDate reads it that way.
    const lastUpdated = toDate(String(rec.lasttime ?? rec.LastTime ?? ''))?.toISOString();

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
      levelSource: validLevel ? 'IOC_LASTVALUE' : 'BUILT_IN',
      keywords: seed?.keywords || deriveKeywordsForStation(name, code),
    });
  }

  return parsed.sort((a, b) => a.lon - b.lon);
}

export function applyTsunamiToStations(
  stations: IOCStationReading[],
  tsunami: TsunamiScenario | null
): IOCStationReading[] {
  // A statement without a height (the live BMKG case) paints nothing: only a positive
  // drill height may move a gauge.
  if (!tsunami?.active || !(tsunami.wave_anomaly > 0)) {
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
  const baseWave = Math.max(0.6, tsunami.wave_anomaly);

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

function seededOceanFeed(nowIso: string): OceanFeedResponse {
  return {
    stations: SEEDED_IOC_STATIONS,
    count: SEEDED_IOC_STATIONS.length,
    live_count: 0,
    anomaly_count: 0,
    source: 'FALLBACK',
    level_kind: 'reference',
    timestamp: nowIso,
  };
}

export async function fetchRealtimeOceanData(): Promise<OceanFeedResponse> {
  // IOC's station list is a large document that can take ten seconds to arrive and changes
  // rarely. No route waits that long for it: a slow read finishes in the background, is
  // kept for ten minutes, and the list it brought stands in for hours if IOC stops answering.
  const list = await readUpstream('http://www.ioc-sealevelmonitoring.org/service.php?format=json&query=stationlist', {
    timeoutMs: 25_000,
    waitMs: 4500,
    ttlSeconds: 600,
    staleIfErrorSeconds: 6 * 60 * 60,
    parse: 'json',
  });
  const parsed = parseIOCStations(list.body);
  if (parsed.length > 0) {
    return {
      stations: parsed,
      count: parsed.length,
      live_count: parsed.length,
      anomaly_count: 0,
      source: 'IOC_LIVE',
      level_kind: 'reference',
      timestamp: list.fetchedAt,
    };
  }
  return seededOceanFeed(list.fetchedAt);
}

const WEATHER_PROBE_POINTS = [
  { name: 'Selat Sunda', lat: -6.15, lon: 105.85 },
  { name: 'Selatan Jawa', lat: -7.72, lon: 109.01 },
];

/** Placeholder returned when Open-Meteo gave nothing; `source: 'FALLBACK'` marks its numbers as such. */
function unavailableWeather(nowIso: string): WeatherSummary {
  return {
    statusLabel: 'Open-Meteo: tidak tersedia',
    avgWindKmh: 16,
    maxWindKmh: 20,
    avgTempC: 28.5,
    stationName: 'Zona Subduksi Indonesia',
    source: 'FALLBACK',
    timestamp: nowIso,
  };
}

export async function fetchOpenMeteoWeatherSummary(): Promise<WeatherSummary> {
  const reads = await Promise.all(
    WEATHER_PROBE_POINTS.map((p) =>
      readUpstream(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current_weather=true`,
        { timeoutMs: 3500, ttlSeconds: 120, parse: 'json' }
      )
    )
  );

  const winds: number[] = [];
  const temps: number[] = [];
  const usedAt: string[] = [];

  for (const read of reads) {
    const current = asRecord(asRecord(read.body)?.current_weather);
    if (current && typeof current.windspeed === 'number' && typeof current.temperature === 'number') {
      winds.push(current.windspeed);
      temps.push(current.temperature);
      usedAt.push(read.fetchedAt);
    }
  }

  if (winds.length > 0) {
    const avgWind = winds.reduce((a, b) => a + b, 0) / winds.length;
    const maxWind = Math.max(...winds);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    return {
      statusLabel: `${avgWind.toFixed(0)} km/jam • ${avgTemp.toFixed(1)}°C${maxWind >= 35 ? ' (ANGIN KENCANG)' : ''}`,
      avgWindKmh: Number(avgWind.toFixed(1)),
      maxWindKmh: Number(maxWind.toFixed(1)),
      avgTempC: Number(avgTemp.toFixed(1)),
      stationName: 'Selat Sunda & Selatan Jawa',
      source: 'OPEN_METEO',
      // The older of the readings behind the averages.
      timestamp: usedAt.sort()[0],
    };
  }

  return unavailableWeather(reads[0]?.fetchedAt ?? new Date().toISOString());
}

/**
 * Health of the BMKG quake feed as the attention level needs it: the worse of the two
 * sub-feeds, because a routine reading needs both the latest report and the M ≥ 5 list.
 */
function bmkgFeedHealth(earthquakes: RealtimeEarthquakesData): QuakeFeedHealth {
  const reported = [earthquakes.provenance?.bmkg_latest?.state, earthquakes.provenance?.bmkg_recent?.state];
  if (reported.includes('failed')) return 'failed';
  if (reported.includes('seed')) return 'seed';
  if (reported.includes('live')) return 'live';
  // No provenance (Go-backend shape, older callers). A payload holding no real BMKG
  // record still cannot be read as routine.
  if (collectQuakeFacts(earthquakes.latest_bmkg, earthquakes.recent_bmkg ?? []).length > 0) return 'unreported';
  return earthquakes.latest_bmkg?.seeded ? 'seed' : 'failed';
}

/** In-window BMKG events that would each raise the attention level on their own. */
function countRaisingEvents(latest: BMKGGempaDetail | null, recent: SeismicEvent[], now: Date): number {
  const raises = (l: BMKGGempaDetail | null, r: SeismicEvent[]) =>
    assessAttention({ latest: l, recent: r, feed: 'live', now }).level !== 'rutin';
  const latestFacts = collectQuakeFacts(latest, []).length;
  let count = raises(latest, []) ? 1 : 0;
  for (const event of recent) {
    // An entry that adds no fact is a placeholder, undated, or the latest report's own list entry.
    const addsFact = collectQuakeFacts(latest, [event]).length > latestFacts;
    if (addsFact && raises(null, [event])) count += 1;
  }
  return count;
}

/**
 * The 0–100 activity index, kept in the payload for parity with the Go backend. It is
 * banded by the level so the two can never disagree, and placed inside its band by the
 * magnitude of the event that sets the level (the largest in-window event for RUTIN):
 * each band is [floor, span, magnitude at the floor, magnitude at the ceiling].
 * An unknown level has no index and reads 0.
 */
const INDEX_BANDS = {
  rutin: [10, 29, 3, 5],
  meningkat: [40, 29, 5, 6],
  tinggi: [70, 19, 6, 8],
  tsunami: [90, 8, 6.5, 9],
} as const;

function activityPercentage(band: keyof typeof INDEX_BANDS | 'unknown', magnitude: number): number {
  if (band === 'unknown') return 0;
  const [floor, span, from, to] = INDEX_BANDS[band];
  const position = Number.isFinite(magnitude) ? Math.min(1, Math.max(0, (magnitude - from) / (to - from))) : 0;
  return Number((floor + span * position).toFixed(1));
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
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const { earthquakes, ocean, weather } = params;
  const latest = earthquakes.latest_bmkg;
  const recent = earthquakes.recent_bmkg ?? [];

  // The level comes from BMKG's own records only. USGS is a comparison catalogue and never drives it.
  const attention = assessAttention({
    latest,
    recent,
    felt: earthquakes.felt_bmkg ?? [],
    feed: bmkgFeedHealth(earthquakes),
    now,
  });
  // BMKG's statement outlives the latest report (an aftershock replaces it within minutes),
  // so the M ≥ 5 list is read too; past the hold period it is no longer treated as in force.
  const statementQuake = findTsunamiStatement(latest, recent, nowMs);
  const riskLevel = statementQuake ? 'CRITICAL' : attentionToRiskLevel(attention.level);
  const riskReasons = statementQuake
    ? [`Pernyataan BMKG: ${statementQuake.Potensi.trim()}`, ...attention.reasons]
    : attention.reasons;

  // Same window as the attention level, so the numbers below describe the facts behind it.
  const windowed = collectQuakeFacts(latest, recent).filter(
    (fact) => nowMs - fact.timeMs <= ATTENTION_WINDOW_MS && fact.timeMs <= nowMs + 60_000
  );
  const magnitudes = windowed.map((fact) => fact.magnitude);
  const maxMag = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;
  const avgMag = magnitudes.length > 0 ? magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length : 0;

  const overallPercentage = statementQuake
    ? activityPercentage('tsunami', parseFloat(statementQuake.Magnitude))
    : activityPercentage(attention.level, attention.driver?.magnitude ?? maxMag);

  const trendDirection =
    attention.level === 'unknown' ? 'DATA BMKG TIDAK TERSEDIA' : `M≥5: ${attention.counts.last24h} dalam 24 jam`;

  const oceanStatus = statementQuake
    ? 'BMKG: BERPOTENSI TSUNAMI'
    : ocean.source === 'IOC_LIVE' && ocean.live_count > 0
    ? `IOC: ${ocean.live_count} stasiun terdaftar`
    : 'IOC: tidak tersedia';

  // Only what BMKG's public feed states. Heights, arrival times and warning zones exist
  // solely in its bulletins, so none are estimated here; the times are the earthquake's
  // own, which keeps the record identical from one poll to the next.
  const tsunami: TsunamiScenario | null = statementQuake
    ? {
        active: true,
        detection_time: statementQuake.DateTime,
        sensor_id: 'BMKG — pernyataan potensi tsunami',
        wave_anomaly: 0,
        affected_zones: statementQuake.Wilayah ? [statementQuake.Wilayah] : [],
        response_actions: ['Rujuk buletin Peringatan Dini Tsunami BMKG untuk status dan estimasi tiba per wilayah.'],
        severity: 'CRITICAL',
        timestamp: statementQuake.DateTime,
      }
    : null;

  const activityIndex: ActivityIndex = {
    overall_percentage: overallPercentage,
    // No feed measures change rates, deformation or thermal output, so none is reported.
    seismic_change: 0,
    tremor_change: 0,
    deformation_trend: 'tidak tersedia',
    thermal_trend: 'tidak tersedia',
    trend_direction: trendDirection,
    earthquake_count: windowed.length,
    avg_magnitude: Number(avgMag.toFixed(1)),
    max_magnitude: Number(maxMag.toFixed(1)),
    timestamp: nowIso,
  };

  const status: SystemStatus = {
    seismic_intensity: overallPercentage,
    ocean_status: oceanStatus,
    weather_status: weather.statusLabel,
    infra_status: 'tidak tersedia',
    active_alerts: countRaisingEvents(latest, recent, now) + (statementQuake ? 1 : 0),
    risk_level: riskLevel,
    trend_direction: trendDirection,
    last_update: nowIso,
    tsunami_scenario: tsunami ?? undefined,
    risk_reasons: riskReasons,
    provenance: {
      ...earthquakes.provenance,
      ioc: { state: ocean.source === 'IOC_LIVE' ? 'live' : 'seed', fetched_at: ocean.timestamp },
      open_meteo: { state: weather.source === 'OPEN_METEO' ? 'live' : 'seed', fetched_at: weather.timestamp },
    },
  };

  return { activityIndex, status, tsunami };
}

export async function fetchLiveTelemetrySnapshot(): Promise<LiveTelemetrySnapshot> {
  // None of the four fetchers rejects: each resolves to live data or its own marked fallback.
  const [earthquakes, volcanoes, ocean, weather] = await Promise.all([
    fetchRealtimeEarthquakesData(),
    fetchRealtimeVolcanoesData(),
    fetchRealtimeOceanData(),
    fetchOpenMeteoWeatherSummary(),
  ]);

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
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const { earthquakes, ocean, weather, volcanoes, activityIndex, status } = params.snapshot;
  const latest = earthquakes.latest_bmkg && !earthquakes.latest_bmkg.seeded ? earthquakes.latest_bmkg : null;
  const quakeLabel = latest
    ? `M${latest.Magnitude} (${latest.Kedalaman}) di ${latest.Wilayah}`
    : 'tidak tersedia';
  const stationLabel = ocean.source === 'IOC_LIVE' ? `${ocean.live_count} stasiun` : 'tidak tersedia';
  const eruptionReports = volcanoes.filter((volcano) => volcano.source !== 'SEEDED').length;
  const statement = findTsunamiStatement(earthquakes.latest_bmkg, earthquakes.recent_bmkg, now.getTime());
  const severity = status.risk_level;
  const baseCycle = Math.max(24, Math.floor(now.getTime() / 15000) % 900);

  const recentThoughts: AgentThought[] = [
    {
      cycle_id: baseCycle - 3,
      phase: 'OBSERVE',
      message: `Gempa terkini BMKG: ${quakeLabel}. Daftar stasiun pasut IOC: ${stationLabel}.`,
      severity,
      timestamp: new Date(now.getTime() - 45000).toISOString(),
    },
    {
      cycle_id: baseCycle - 2,
      phase: 'ORIENT',
      message: `${status.risk_reasons?.[0] ?? 'Dasar tingkat pantauan tidak tersedia'}. Laporan erupsi PVMBG: ${eruptionReports}. Cuaca: ${weather.statusLabel}.`,
      severity,
      timestamp: new Date(now.getTime() - 30000).toISOString(),
    },
    {
      cycle_id: baseCycle - 1,
      phase: 'DECIDE',
      message: statement
        ? `BMKG menyatakan potensi tsunami untuk gempa M${statement.Magnitude} (${statement.Wilayah || 'lokasi tidak tersedia'}). Rujuk buletin Peringatan Dini Tsunami BMKG; dasbor tidak memperkirakan tinggi maupun waktu tiba.`
        : `Tingkat pantauan (tidak resmi): ${TONE_LABEL[toTone(status.risk_level)]}. Status tsunami hanya bersumber dari pernyataan BMKG.`,
      severity,
      timestamp: new Date(now.getTime() - 15000).toISOString(),
    },
    {
      cycle_id: baseCycle,
      phase: 'ACT',
      message: `Memperbarui ringkasan dasbor (${params.activeModel}).`,
      severity,
      timestamp: nowIso,
    },
  ];

  const recentActions: AgentTacticalAction[] = [
    {
      id: `act-bmkg-${baseCycle}`,
      type: 'BMKG_FEED_READ',
      agency: 'BMKG',
      target_zone: latest?.Wilayah || 'tidak tersedia',
      priority: severity,
      rationale: latest
        ? `Membaca gempa terkini ${quakeLabel}. Keterangan BMKG: ${latest.Potensi?.trim() || 'tidak tersedia'}.`
        : 'Data gempa terkini BMKG tidak tersedia.',
      timestamp: nowIso,
    },
    {
      id: `act-ioc-${baseCycle}`,
      type: 'IOC_STATION_LIST_READ',
      agency: 'IOC UNESCO',
      target_zone: `Daftar stasiun pasut Indonesia: ${stationLabel}`,
      priority: 'NORMAL',
      rationale: 'Hanya daftar stasiun yang dibaca; dasbor tidak mengambil data muka laut langsung dan tidak menghitung anomali.',
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
