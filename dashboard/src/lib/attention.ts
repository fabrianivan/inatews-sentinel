/**
 * "Tingkat Pantauan" — the dashboard's own, unofficial attention level.
 *
 * It answers one narrow question from facts BMKG has already published: has a
 * shallow, sizeable or widely felt earthquake happened in the last 24 hours?
 * It is not a forecast, never states tsunami potential (that only ever comes
 * from BMKG's own words) and tops out at TINGGI. Without live BMKG data it is
 * TIDAK DIKETAHUI rather than a reassuring guess.
 *
 * Rules, per BMKG event inside the 24-hour window:
 *   TINGGI     M ≥ 6,0 at ≤ 100 km depth, or felt at MMI VI or above
 *   MENINGKAT  M ≥ 5,0 at ≤ 100 km depth, or felt at MMI IV–V,
 *              or M ≥ 6,0 deeper than 100 km (deep events raise one step only)
 *   RUTIN      nothing of the above
 */

import type { BMKGGempaDetail, SeismicEvent } from './types';
import { parseDirasakanMaxMmi } from './severity';
import { formatAge, formatDecimal, formatWibDate, toMillis, type TimeInput } from './time';

export type AttentionLevel = 'unknown' | 'rutin' | 'meningkat' | 'tinggi';

/**
 * What is known about the BMKG quake feed:
 *  live        fetched successfully and recently
 *  loading     no fetch has completed yet
 *  stale       the last successful fetch is too old to trust
 *  seed        the route answered with built-in placeholder data
 *  failed      the fetch failed
 *  unreported  the payload carries no provenance (Go backend path)
 */
export type QuakeFeedHealth = 'live' | 'loading' | 'stale' | 'seed' | 'failed' | 'unreported';

export const ATTENTION_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAY_MS = ATTENTION_WINDOW_MS;
const DEEP_KM = 100;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Days the activity strip draws, today included. */
const STRIP_DAYS = 7;

/** Index of the WIB calendar day an instant falls on. */
function wibDayIndex(ms: number): number {
  return Math.floor((ms + WIB_OFFSET_MS) / DAY_MS);
}

/** Start (epoch ms) of the WIB calendar day with this index. */
function wibDayStartMs(index: number): number {
  return index * DAY_MS - WIB_OFFSET_MS;
}

export interface QuakeFact {
  magnitude: number;
  /** Null when the feed gave no usable depth. */
  depthKm: number | null;
  region: string;
  timeMs: number;
  /** Highest felt intensity (MMI) BMKG reported, when it reported one. */
  feltMmi: number | null;
}

export interface AttentionAssessment {
  level: AttentionLevel;
  /** One line for the masthead, e.g. "M6,1 · Laut Banda · 3 jam lalu". */
  headline: string;
  /** The facts behind the level, most significant first. */
  reasons: string[];
  /** The event that sets the level, or null when nothing does. */
  driver: QuakeFact | null;
  /** Every in-window event that raises the level, most significant first, each with the level it alone would give. */
  raising: Array<{ fact: QuakeFact; level: AttentionLevel }>;
  /**
   * Origin time (epoch ms) of the newest event at the level's own step, or null. It moves
   * forward only when another such event arrives — what "a new event" means for the alert tone.
   */
  newestDriverMs: number | null;
  /**
   * When the level is back at RUTIN if nothing new happens (epoch ms): the moment the last
   * event that raises it leaves the 24-hour window. A TINGGI level may pass through
   * MENINGKAT before then.
   */
  expiresAtMs: number | null;
  counts: {
    /** BMKG events of M ≥ 5,0 in the last 24 hours. */
    last24h: number;
    /**
     * BMKG events of M ≥ 5,0 in the last 7 WIB calendar days, today included — the same
     * days `summarizeDays` draws, so this figure and the strip can never disagree.
     */
    last7d: number;
    /** Largest magnitude among them, or null. */
    largest7d: number | null;
  };
}

export interface AttentionInput {
  latest: BMKGGempaDetail | null;
  /** BMKG's recent M ≥ 5 list. USGS is deliberately not an input. */
  recent: SeismicEvent[];
  /**
   * BMKG's list of felt earthquakes (gempadirasakan), each with its "Dirasakan" text. Without
   * it a felt intensity is only known while that quake is the latest report, and the level
   * would drop as soon as any other quake replaced it.
   */
  felt?: BMKGGempaDetail[];
  feed: QuakeFeedHealth;
  now: TimeInput;
}

const UNKNOWN_HEADLINE: Record<Exclude<QuakeFeedHealth, 'live' | 'unreported'>, string> = {
  loading: 'Memuat data gempa BMKG…',
  stale: 'Data gempa BMKG usang',
  seed: 'Data gempa BMKG tidak tersedia',
  failed: 'Data gempa BMKG tidak tersedia',
};

/** "Pusat gempa berada di laut 98 km BaratDaya Melonguane" → "laut 98 km BaratDaya Melonguane". */
export function shortRegion(wilayah: string | null | undefined, maxLength = 28): string {
  const text = (wilayah || '').replace(/^pusat gempa berada di\s+/i, '').trim();
  if (!text) return 'lokasi tidak tersedia';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function parseDepthKm(text: string | null | undefined): number | null {
  const value = parseFloat((text || '').replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Same earthquake on two BMKG lists: origin within two minutes, magnitude within 0.2. */
function findSameQuake(facts: QuakeFact[], timeMs: number, magnitude: number): QuakeFact | undefined {
  return facts.find((fact) => Math.abs(fact.timeMs - timeMs) <= 120_000 && Math.abs(fact.magnitude - magnitude) <= 0.2);
}

/**
 * Real BMKG events with a usable time and magnitude, newest first. Placeholder records are
 * dropped, and one earthquake is never counted twice: the latest report, its entry in the
 * felt list and its entry in the M ≥ 5 list are merged, keeping the highest felt intensity.
 */
export function collectQuakeFacts(
  latest: BMKGGempaDetail | null,
  recent: SeismicEvent[],
  felt: BMKGGempaDetail[] = []
): QuakeFact[] {
  const facts: QuakeFact[] = [];

  for (const report of [latest, ...(felt || [])]) {
    if (!report || report.seeded) continue;
    const timeMs = toMillis(report.DateTime);
    const magnitude = parseFloat(report.Magnitude);
    if (timeMs === null || !Number.isFinite(magnitude) || magnitude <= 0) continue;
    const feltMmi = parseDirasakanMaxMmi(report.Dirasakan);
    const same = findSameQuake(facts, timeMs, magnitude);
    if (same) {
      if (feltMmi !== null && (same.feltMmi === null || feltMmi > same.feltMmi)) same.feltMmi = feltMmi;
      continue;
    }
    facts.push({
      magnitude,
      depthKm: parseDepthKm(report.Kedalaman),
      region: report.Wilayah || '',
      timeMs,
      feltMmi,
    });
  }

  for (const event of recent || []) {
    if (event.seeded) continue;
    const timeMs = toMillis(event.timestamp);
    if (timeMs === null || !Number.isFinite(event.magnitude) || event.magnitude <= 0) continue;
    if (findSameQuake(facts, timeMs, event.magnitude)) continue;
    facts.push({
      magnitude: event.magnitude,
      depthKm: Number.isFinite(event.depth) && event.depth >= 0 ? event.depth : null,
      region: event.fault_zone || '',
      timeMs,
      feltMmi: null,
    });
  }

  return facts.sort((a, b) => b.timeMs - a.timeMs);
}

function isDeep(fact: QuakeFact): boolean {
  return fact.depthKm !== null && fact.depthKm > DEEP_KM;
}

/** 0 = rutin, 1 = meningkat, 2 = tinggi. */
function factStep(fact: QuakeFact): 0 | 1 | 2 {
  let step: 0 | 1 | 2 = 0;
  if (fact.magnitude >= 6.0) step = isDeep(fact) ? 1 : 2;
  else if (fact.magnitude >= 5.0) step = isDeep(fact) ? 0 : 1;
  if (fact.feltMmi !== null) {
    if (fact.feltMmi >= 6) step = 2;
    else if (fact.feltMmi >= 4 && step < 1) step = 1;
  }
  return step;
}

const STEP_LEVEL: Record<0 | 1 | 2, AttentionLevel> = { 0: 'rutin', 1: 'meningkat', 2: 'tinggi' };

const MMI_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * A depth worded against this rule's own split at 100 km: "80 km (dangkal, ≤100 km)". Not
 * BMKG's depth classes (dangkal / menengah / dalam), which would contradict the scale shown
 * beside it for anything between 60 and 300 km.
 */
export function ruleDepthLabel(depthKm: number): string {
  return `${Math.round(depthKm)} km (${depthKm > DEEP_KM ? 'dalam, >100 km' : 'dangkal, ≤100 km'})`;
}

function describeFact(fact: QuakeFact, nowMs: number): string {
  const parts = [`M${formatDecimal(fact.magnitude)}`];
  if (fact.depthKm !== null) parts.push(ruleDepthLabel(fact.depthKm));
  parts.push(shortRegion(fact.region, 44));
  parts.push(formatAge(fact.timeMs, nowMs));
  let line = parts.join(' · ');
  if (fact.feltMmi !== null && fact.feltMmi >= 4) line += ` · dirasakan ${MMI_NUMERALS[fact.feltMmi]} MMI`;
  // Only true when the felt intensity did not lift it further.
  if (isDeep(fact) && fact.magnitude >= 6.0 && factStep(fact) === 1) line += ' — gempa dalam, hanya menaikkan satu tingkat';
  return line;
}

export function assessAttention(input: AttentionInput): AttentionAssessment {
  const nowMs = toMillis(input.now) ?? Date.now();
  const facts = collectQuakeFacts(input.latest, input.recent, input.felt);

  const strong = facts.filter((fact) => fact.magnitude >= 5.0);
  const inDay = strong.filter((fact) => nowMs - fact.timeMs <= ATTENTION_WINDOW_MS && fact.timeMs <= nowMs + 60_000);
  const weekStartMs = wibDayStartMs(wibDayIndex(nowMs) - (STRIP_DAYS - 1));
  const inWeek = strong.filter((fact) => fact.timeMs >= weekStartMs && fact.timeMs <= nowMs + 60_000);
  const counts = {
    last24h: inDay.length,
    last7d: inWeek.length,
    largest7d: inWeek.length > 0 ? Math.max(...inWeek.map((fact) => fact.magnitude)) : null,
  };
  const countsLine =
    counts.last7d > 0
      ? `Gempa M≥5 (BMKG): 24 jam ${counts.last24h} · 7 hari ${counts.last7d} · terbesar M${formatDecimal(counts.largest7d ?? 0)}`
      : 'Tidak ada gempa M≥5 pada daftar BMKG dalam 7 hari terakhir';

  if (input.feed !== 'live' && input.feed !== 'unreported') {
    return {
      level: 'unknown',
      headline: UNKNOWN_HEADLINE[input.feed],
      reasons: ['Tingkat pantauan hanya dihitung dari data BMKG yang langsung dan terkini.'],
      driver: null,
      raising: [],
      newestDriverMs: null,
      expiresAtMs: null,
      counts,
    };
  }

  // Felt reports count even below M5, so the window is applied to every real event.
  const windowed = facts
    .filter((fact) => nowMs - fact.timeMs <= ATTENTION_WINDOW_MS && fact.timeMs <= nowMs + 60_000)
    .map((fact) => ({ fact, step: factStep(fact) }))
    .filter((entry) => entry.step > 0)
    .sort((a, b) => b.step - a.step || b.fact.magnitude - a.fact.magnitude || b.fact.timeMs - a.fact.timeMs);

  if (windowed.length === 0) {
    return {
      level: 'rutin',
      headline: 'Tidak ada gempa M≥5 dangkal dalam 24 jam',
      reasons: [countsLine],
      driver: null,
      raising: [],
      newestDriverMs: null,
      expiresAtMs: null,
      counts,
    };
  }

  const top = windowed[0];
  // Every raising event counts, not only those at the top step: a TINGGI level with a newer
  // M5 behind it is not back at RUTIN when the M6 alone leaves the window.
  const expiresAtMs = Math.max(...windowed.map((entry) => entry.fact.timeMs + ATTENTION_WINDOW_MS));

  return {
    level: STEP_LEVEL[top.step],
    headline: `M${formatDecimal(top.fact.magnitude)} · ${shortRegion(top.fact.region, 22)} · ${formatAge(top.fact.timeMs, nowMs)}`,
    reasons: [...windowed.slice(0, 3).map((entry) => describeFact(entry.fact, nowMs)), countsLine],
    driver: top.fact,
    raising: windowed.map((entry) => ({ fact: entry.fact, level: STEP_LEVEL[entry.step] })),
    newestDriverMs: Math.max(...windowed.filter((entry) => entry.step === top.step).map((entry) => entry.fact.timeMs)),
    expiresAtMs,
    counts,
  };
}

/** The three levels the dashboard computes, lowest first, with what puts the reading there. */
export const ATTENTION_SCALE: Array<{ level: Exclude<AttentionLevel, 'unknown'>; criterion: string }> = [
  { level: 'rutin', criterion: 'Tidak ada gempa M≥5 dangkal dan tidak ada gempa yang dirasakan cukup kuat' },
  { level: 'meningkat', criterion: 'Gempa M≥5 dangkal (≤100 km), dirasakan MMI IV–V, atau M≥6 dalam (>100 km)' },
  { level: 'tinggi', criterion: 'Gempa M≥6 dangkal (≤100 km), atau dirasakan MMI VI ke atas' },
];

/** What the current level means, in one sentence. */
export const ATTENTION_MEANING: Record<AttentionLevel, string> = {
  unknown: 'Data gempa BMKG tidak tersedia atau usang, jadi tingkat pantauan tidak dihitung.',
  rutin: 'Tidak ada gempa M≥5 dangkal atau gempa yang dirasakan cukup kuat dalam 24 jam terakhir.',
  meningkat: 'Ada gempa M≥5 dangkal, gempa yang dirasakan (MMI IV–V), atau gempa dalam M≥6 dalam 24 jam terakhir.',
  tinggi: 'Ada gempa M≥6 dangkal atau gempa yang dirasakan kuat (MMI VI ke atas) dalam 24 jam terakhir.',
};

/** Status-payload vocabulary for an attention level (the English scale the Go backend also speaks). */
export function attentionToRiskLevel(level: AttentionLevel): 'UNKNOWN' | 'NORMAL' | 'ELEVATED' | 'HIGH' {
  if (level === 'tinggi') return 'HIGH';
  if (level === 'meningkat') return 'ELEVATED';
  if (level === 'rutin') return 'NORMAL';
  return 'UNKNOWN';
}

export interface DayActivity {
  /** Start of the WIB calendar day (epoch ms). */
  dayStartMs: number;
  /** "17 Nov" */
  label: string;
  /** BMKG events of M ≥ 5,0 that day. */
  count: number;
  largest: number | null;
  /** True when one of the day's events is inside the 24-hour attention window. */
  inWindow: boolean;
}

/** BMKG M ≥ 5 activity per WIB calendar day, oldest first, ending today. */
export function summarizeDays(
  latest: BMKGGempaDetail | null,
  recent: SeismicEvent[],
  now: TimeInput,
  felt: BMKGGempaDetail[] = [],
  days = STRIP_DAYS
): DayActivity[] {
  const nowMs = toMillis(now) ?? Date.now();
  const today = wibDayIndex(nowMs);
  // Same cut-off as the counts: an event stamped ahead of the clock (beyond skew) is not drawn.
  const strong = collectQuakeFacts(latest, recent, felt).filter(
    (fact) => fact.magnitude >= 5.0 && fact.timeMs <= nowMs + 60_000
  );

  return Array.from({ length: days }, (_, offset) => {
    const index = today - (days - 1 - offset);
    const dayStartMs = wibDayStartMs(index);
    const events = strong.filter((fact) => wibDayIndex(fact.timeMs) === index);
    return {
      dayStartMs,
      label: formatWibDate(dayStartMs, { year: false }),
      count: events.length,
      largest: events.length > 0 ? Math.max(...events.map((fact) => fact.magnitude)) : null,
      inWindow: events.some((fact) => nowMs - fact.timeMs <= ATTENTION_WINDOW_MS),
    };
  });
}
