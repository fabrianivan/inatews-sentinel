/**
 * VONA — Volcano Observatory Notice for Aviation — as PVMBG publishes them on MAGMA Indonesia
 * (https://magma.esdm.go.id/v1/vona). This module reads MAGMA's public archive page and states
 * what each notice says: nothing is estimated or filled in, every value comes from the notice's
 * own wording, and a notice is always handed on with its verbatim text and its link on MAGMA.
 */

import { findVolcanoLocation, type VolcanoLocation } from './volcanoData';
import { formatWibTime, toMillis } from './time';

/** MAGMA's VONA archive: page 1 lists the newest notices for every volcano. */
export const VONA_ARCHIVE_URL = 'https://magma.esdm.go.id/v1/vona';

/** Links are passed on only when they point at MAGMA itself. */
const MAGMA_ORIGIN = 'https://magma.esdm.go.id/';

export type VonaColorCode = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

/** Indonesian names for the aviation colour codes, shown beside the official word, never instead of it. */
export const VONA_COLOR_ID: Record<VonaColorCode, string> = {
  GREEN: 'hijau',
  YELLOW: 'kuning',
  ORANGE: 'oranye',
  RED: 'merah',
};

/** Where a VONA says the ash cloud is moving. */
export interface VonaDirection {
  /** The notice's sentence, verbatim: "Ash cloud moving from west to northwest." */
  sentence: string;
  /** Its direction words: "east", "north-northeast", "from west to northwest". */
  phrase: string;
  /** Indonesian rendering: "timur", "barat hingga barat laut"; null when a word is not a compass point. */
  label: string | null;
  /** Degrees clockwise from north when the notice names one compass point; null otherwise. */
  bearing: number | null;
  /** Every compass point the notice names, in its order, as degrees. Empty when a word is not a compass point. */
  bearings: number[];
}

/** One notice from MAGMA's VONA archive. Values are as stated; null where the notice does not state one. */
export interface VonaNotice {
  /** MAGMA's id for the notice, from its "View" link: "23282". */
  id: string;
  /** Volcano name as the notice writes it: "Dukono". */
  volcano: string;
  /** The same volcano in the dashboard's catalogue, or null when the catalogue does not list it. */
  catalogue_name: string | null;
  /** When the notice was issued (ISO, UTC), or null when the page gives no readable time. */
  issued_at: string | null;
  /** Aviation colour code as the page states it, or null for any other word. */
  color_code: VonaColorCode | null;
  /** The notice text, verbatim. */
  text: string;
  /** True when the notice reports an ash cloud, false for "Ash-cloud is not observed", null when it says neither (or both). */
  ash_observed: boolean | null;
  /** Best estimate of the ash-cloud top, metres above sea level, as stated. */
  ash_top_asl_m: number | null;
  /** The same, metres above the summit, as stated. */
  ash_top_above_summit_m: number | null;
  /** Where the ash cloud is moving, or null when the notice does not say. */
  ash_direction: VonaDirection | null;
  /** Issuing observatory as written: "Dukono Volcano Observatory". */
  observatory: string | null;
  /** The notice on MAGMA (https://magma.esdm.go.id/ links only), or null. */
  url: string | null;
}

/** An entry of MAGMA's per-volcano VONA list: the code its archive page is filed under. */
export interface VonaVolcanoCode {
  /** "SMR" */
  code: string;
  /** Volcano name as MAGMA lists it: "Semeru". */
  name: string;
}

export interface VonaPage {
  /** Notices in page order (newest first). */
  notices: VonaNotice[];
  /** MAGMA's list of volcanoes with a VONA archive, as printed on the page. */
  volcanoes: VonaVolcanoCode[];
}

/**
 *  live    MAGMA's page was read within its refresh interval
 *  stale   the last read failed; the copy shown is the last good one, as old as `fetched_at` says
 *  error   no usable copy of the page
 */
export type VonaFeedState = 'live' | 'stale' | 'error';

/** One catalogue volcano's newest VONA, as the dashboard's route reports it. */
export interface VonaVolcanoResult {
  /** Catalogue name asked for. */
  name: string;
  /** MAGMA's VONA code for it ("SMR"), or null when MAGMA's list does not include it or could not be read. */
  code: string | null;
  /** MAGMA's VONA archive for this volcano, or the whole archive when its code is not known. */
  archive_url: string;
  /** Its newest VONA, or null when none was found. */
  latest: VonaNotice | null;
  /** Where `latest` was found: MAGMA's newest VONAs, or the volcano's own archive page. */
  found_in: 'latest' | 'archive' | null;
  /** State of the page `latest` comes from, or would have come from. */
  state: VonaFeedState;
  /** When that page was read (ISO), or null when no copy of it could be read. */
  fetched_at: string | null;
}

/** What `/api/realtime/vona` answers. */
export interface VonaResponse {
  /** The page read: MAGMA's VONA archive. */
  source: string;
  state: VonaFeedState;
  /** When the page was read (ISO), or null when no copy of it could be read. */
  fetched_at: string | null;
  /** MAGMA's newest VONAs for every volcano (page 1), newest first. */
  notices: VonaNotice[];
  /** Present when a volcano was asked for (`?volcano=`). */
  volcano?: VonaVolcanoResult;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  deg: '°',
  plusmn: '±',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const codePoint = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/** An HTML fragment's text: tags removed first (so decoded `<` is never read as markup), whitespace collapsed. */
function cleanText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Compares volcano names regardless of case, spacing, hyphens and a "G." / "Gunung" prefix. */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(?:g\.|gunung\s)\s*/, '')
    .replace(/[^a-z0-9]+/g, '');
}

// ---------------------------------------------------------------------------
// Ash-cloud direction
// ---------------------------------------------------------------------------

interface CompassPoint {
  en: string;
  id: string;
  abbreviation: string;
  bearing: number;
}

const COMPASS: CompassPoint[] = [
  { en: 'north', id: 'utara', abbreviation: 'n', bearing: 0 },
  { en: 'north-northeast', id: 'utara-timur laut', abbreviation: 'nne', bearing: 22.5 },
  { en: 'northeast', id: 'timur laut', abbreviation: 'ne', bearing: 45 },
  { en: 'east-northeast', id: 'timur-timur laut', abbreviation: 'ene', bearing: 67.5 },
  { en: 'east', id: 'timur', abbreviation: 'e', bearing: 90 },
  { en: 'east-southeast', id: 'timur-tenggara', abbreviation: 'ese', bearing: 112.5 },
  { en: 'southeast', id: 'tenggara', abbreviation: 'se', bearing: 135 },
  { en: 'south-southeast', id: 'selatan-tenggara', abbreviation: 'sse', bearing: 157.5 },
  { en: 'south', id: 'selatan', abbreviation: 's', bearing: 180 },
  { en: 'south-southwest', id: 'selatan-barat daya', abbreviation: 'ssw', bearing: 202.5 },
  { en: 'southwest', id: 'barat daya', abbreviation: 'sw', bearing: 225 },
  { en: 'west-southwest', id: 'barat-barat daya', abbreviation: 'wsw', bearing: 247.5 },
  { en: 'west', id: 'barat', abbreviation: 'w', bearing: 270 },
  { en: 'west-northwest', id: 'barat-barat laut', abbreviation: 'wnw', bearing: 292.5 },
  { en: 'northwest', id: 'barat laut', abbreviation: 'nw', bearing: 315 },
  { en: 'north-northwest', id: 'utara-barat laut', abbreviation: 'nnw', bearing: 337.5 },
];

const compassKey = (word: string) => word.toLowerCase().replace(/[^a-z]/g, '');

/** "north-northeast", "north east", "NNE" → the same point. */
const COMPASS_BY_KEY = new Map<string, CompassPoint>(
  COMPASS.flatMap((point) => [
    [compassKey(point.en), point] as const,
    [point.abbreviation, point] as const,
  ])
);

/** Separators between compass words, kept so the Indonesian rendering follows the notice's own list. */
const DIRECTION_SEPARATOR = /(\s*,\s*|\s+and\s+(?:the\s+)?|\s+to\s+(?:the\s+)?)/i;

function separatorId(separator: string): string {
  const word = separator.trim().toLowerCase();
  if (word === ',') return ', ';
  if (word.startsWith('and')) return ' dan ';
  return ' hingga ';
}

/**
 * Reads the words after "Ash cloud moving": "to east", "to the north-northeast", "from west to
 * northwest", "from southwest, west to northwest".
 *
 * MAGMA writes one direction as "to X" and several as "from X(, Y) to Z": the compass points the
 * observer named, in order. The Indonesian rendering keeps that list ("barat hingga barat laut")
 * and a bearing is given only for a single point. A word that is not a compass point leaves the
 * phrase as written with no rendering and no bearing, rather than a guess.
 */
export function parseVonaDirection(sentence: string, phrase: string): VonaDirection {
  const words = phrase.replace(/\s+/g, ' ').trim().replace(/[\s.]+$/, '');
  const lead = words.match(/^(to(?:wards?)?|from)\s+(?:the\s+)?/i);
  const unread: VonaDirection = { sentence, phrase: words, label: null, bearing: null, bearings: [] };
  if (!lead) return unread;

  const isList = lead[1].toLowerCase() === 'from';
  const body = words.slice(lead[0].length);
  const pieces = body.split(DIRECTION_SEPARATOR);
  const names = pieces.filter((_, index) => index % 2 === 0);
  const separators = pieces.filter((_, index) => index % 2 === 1);
  const points = names.map((name) => COMPASS_BY_KEY.get(compassKey(name)) ?? null);
  const shown = { ...unread, phrase: isList ? words : body };

  // "from X" alone would read as where the cloud came from; only a list of two or more is the "from … to …" form.
  if (points.length === 0 || points.some((point) => point === null) || (isList && points.length < 2)) {
    return shown;
  }
  const known = points as CompassPoint[];
  const label = known.map((point, index) => point.id + (index < separators.length ? separatorId(separators[index]) : '')).join('');
  return {
    ...shown,
    label,
    bearing: known.length === 1 ? known[0].bearing : null,
    bearings: known.map((point) => point.bearing),
  };
}

// ---------------------------------------------------------------------------
// Notice text
// ---------------------------------------------------------------------------

const DIRECTION_SENTENCE =
  /\bash[- ]?clouds?\s+(?:is\s+|are\s+|was\s+)?(?:moving|drifting|moved|drifted|heading)\s+((?:to(?:wards?)?|from)\s[^.]*)(?:\.|$)/i;
/** "Best estimate of ash-cloud top is around 6358 FT (1987 M) above sea level or 2880 FT (900 M) above summit." */
const CLOUD_TOP_SENTENCE = /ash[- ]?cloud\s+top[^.]*(?:\.\d[^.]*)*(?:\.|$)/i;
const TOP_ABOVE_SEA_LEVEL = /(\d[\d,]*(?:\.\d+)?)\s*M\)?\s*above\s+(?:the\s+)?(?:mean\s+)?sea\s+level/i;
const TOP_ABOVE_SUMMIT = /(\d[\d,]*(?:\.\d+)?)\s*M\)?\s*above\s+(?:the\s+)?(?:summit|crater|vent)\b/i;
const NOT_OBSERVED = /\b(?:volcanic\s+)?ash(?:[- ]?cloud)?\s+(?:is\s+|was\s+)?not\s+(?:observed|visible|seen)\b/i;
const WITH_ASH = /\bwith\s+(?:an?\s+)?volcanic\s+ash(?:[- ]?cloud)?\b/i;

function metres(text: string | undefined): number | null {
  if (!text) return null;
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface VonaTextFacts {
  ash_observed: boolean | null;
  ash_top_asl_m: number | null;
  ash_top_above_summit_m: number | null;
  ash_direction: VonaDirection | null;
}

/** What a notice's text states about the ash cloud. Only MAGMA's fixed English phrasing is read. */
export function readVonaText(text: string): VonaTextFacts {
  const top = text.match(CLOUD_TOP_SENTENCE)?.[0] ?? '';
  const ash_top_asl_m = metres(top.match(TOP_ABOVE_SEA_LEVEL)?.[1]);
  const ash_top_above_summit_m = metres(top.match(TOP_ABOVE_SUMMIT)?.[1]);
  const directionMatch = text.match(DIRECTION_SENTENCE);
  const ash_direction = directionMatch ? parseVonaDirection(directionMatch[0].trim(), directionMatch[1]) : null;

  const reported = WITH_ASH.test(text) || ash_top_asl_m !== null || ash_top_above_summit_m !== null || ash_direction !== null;
  const notObserved = NOT_OBSERVED.test(text);
  // A notice that says both is not settled here: the reader is sent to its text.
  const ash_observed = reported && !notObserved ? true : notObserved && !reported ? false : null;
  return { ash_observed, ash_top_asl_m, ash_top_above_summit_m, ash_direction };
}

// ---------------------------------------------------------------------------
// Catalogue matching
// ---------------------------------------------------------------------------

/**
 * The catalogue volcano a VONA name refers to, or null.
 *
 * `findVolcanoLocation` also matches by substring ("Sorikmarapi" finds Marapi), so its answer
 * counts only when the name is that volcano's own name or one of its aliases ("Krakatau" for
 * Anak Krakatau). An alias that MAGMA lists as a volcano of its own — Lewotobi Perempuan, beside
 * Lewotobi Laki-laki — is that other volcano: pass MAGMA's list as `listedNames` to apply this.
 */
export function catalogueVolcanoForVona(vonaName: string, listedNames: readonly string[] = []): VolcanoLocation | null {
  const key = nameKey(vonaName);
  if (!key) return null;
  const volcano = findVolcanoLocation(vonaName);
  if (!volcano) return null;
  const ownKey = nameKey(volcano.name);
  if (ownKey === key) return volcano;
  if (!volcano.aliases.some((alias) => nameKey(alias) === key)) return null;
  const listed = new Set(listedNames.map(nameKey));
  if (listed.has(key) && listed.has(ownKey)) return null;
  return volcano;
}

/** MAGMA's VONA code for a catalogue volcano, from the list printed on the page. */
export function vonaCodeFor(catalogueName: string, volcanoes: readonly VonaVolcanoCode[]): VonaVolcanoCode | null {
  const listedNames = volcanoes.map((entry) => entry.name);
  return volcanoes.find((entry) => catalogueVolcanoForVona(entry.name, listedNames)?.name === catalogueName) ?? null;
}

/** MAGMA's archive page for one volcano's VONAs. */
export function vonaArchiveUrl(code: string): string {
  return `${VONA_ARCHIVE_URL}?code=${encodeURIComponent(code)}`;
}

/** A catalogue volcano's newest notice among `notices` (by issue time; page order breaks ties). */
export function latestVonaFor(catalogueName: string, notices: readonly VonaNotice[]): VonaNotice | null {
  let latest: VonaNotice | null = null;
  let latestMs = -Infinity;
  for (const notice of notices) {
    if (notice.catalogue_name !== catalogueName) continue;
    const issuedMs = toMillis(notice.issued_at) ?? -Infinity;
    if (latest === null || issuedMs > latestMs) {
      latest = notice;
      latestMs = issuedMs;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ITEM_OPEN = /<div class="timeline-item(?:\s+([^"]*))?"\s*>/g;
/** Where the last notice's markup ends: the pagination below the list, or the colour-code legend beside it. */
const LIST_END = /<div class="(?:mg-t-30|col-lg-3)\b/;
const TIME_BLOCK = /<div class="timeline-time">([\s\S]*?)<\/div>/i;
const ISSUED_UTC = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*UTC/i;
const COLOR_WORD = /<a\b[^>]*>([^<]*)<\/a>/i;
const TITLE = /<p class="timeline-title">\s*<a\b[^>]*>([\s\S]*?)<\/a>/i;
/** "Dukono - 20261123/0923Z": the volcano, then the notice's own date-time group. */
const TITLE_STAMP = /\s+-\s+(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z\s*$/i;
const AUTHOR = /<p class="timeline-author">([\s\S]*?)<\/p>/i;
const TEXT = /<p class="timeline-text">([\s\S]*?)<\/p>/i;
const VIEW_LINK = /<a\b[^>]*\bhref="([^"]+)"[^>]*>\s*View\s*<\/a>/i;
const NOTICE_ID = /^https:\/\/magma\.esdm\.go\.id\/v1\/vona\/(\d+)(?:[?#]|$)/;
const CODE_BUTTON = /<a\b[^>]*\bhref="(?:https:\/\/magma\.esdm\.go\.id)?\/v1\/vona\?code=([A-Za-z0-9]{2,6})"[^>]*>([\s\S]*?)<\/a>/g;
const COLOR_CODES: readonly VonaColorCode[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

/** The markup of each notice; MAGMA's day headers share the class and are skipped. */
function noticeChunks(html: string): string[] {
  const opens = [...html.matchAll(ITEM_OPEN)];
  const chunks: string[] = [];
  opens.forEach((open, index) => {
    if (/\btimeline-day\b/.test(open[1] ?? '')) return;
    const start = (open.index ?? 0) + open[0].length;
    const end = index + 1 < opens.length ? (opens[index + 1].index ?? html.length) : html.length;
    const chunk = html.slice(start, end);
    const listEnd = chunk.search(LIST_END);
    chunks.push(listEnd >= 0 ? chunk.slice(0, listEnd) : chunk);
  });
  return chunks;
}

function utcInstant(year: string, month: string, day: string, hour: string, minute: string, second = '0'): string | null {
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const date = new Date(ms);
  // Date.UTC rolls 25:00 over into the next day; a time that does not survive the round trip is not a time.
  if (Number.isNaN(ms) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCHours() !== Number(hour)) return null;
  return date.toISOString();
}

/** A link on MAGMA itself, or null. */
function magmaLink(href: string | undefined): string | null {
  if (!href) return null;
  const url = decodeEntities(href).trim();
  return url.startsWith(MAGMA_ORIGIN) && !/[\s"'<>]/.test(url) ? url : null;
}

/** "<a>Name</a>, Dukono Volcano Observatory - 16 hours ago" → "Dukono Volcano Observatory". */
function observatoryOf(authorHtml: string): string | null {
  const nameEnd = authorHtml.indexOf('</a>');
  const rest = nameEnd >= 0 ? authorHtml.slice(nameEnd + 4) : authorHtml;
  const text = cleanText(rest)
    .replace(/^[\s,]+/, '')
    .replace(/\s+-\s+[^-]*\bago\s*$/i, '')
    .trim();
  return text || null;
}

function parseNotice(chunk: string, listedNames: readonly string[]): VonaNotice | null {
  const titleMatch = chunk.match(TITLE);
  if (!titleMatch) return null;
  const title = cleanText(titleMatch[1]);
  const stamp = title.match(TITLE_STAMP);
  const volcano = (stamp ? title.slice(0, stamp.index) : title).trim();
  if (!volcano) return null;

  const timeBlock = chunk.match(TIME_BLOCK)?.[1] ?? '';
  const issued = cleanText(timeBlock).match(ISSUED_UTC);
  const issued_at =
    (issued ? utcInstant(issued[1], issued[2], issued[3], issued[4], issued[5], issued[6]) : null) ??
    (stamp ? utcInstant(stamp[1], stamp[2], stamp[3], stamp[4], stamp[5]) : null);
  const colorWord = cleanText(timeBlock.match(COLOR_WORD)?.[1] ?? '').toUpperCase();
  const color_code = COLOR_CODES.find((code) => code === colorWord) ?? null;

  const text = cleanText(chunk.match(TEXT)?.[1] ?? '');
  const authorHtml = chunk.match(AUTHOR)?.[1];
  const url = magmaLink(chunk.match(VIEW_LINK)?.[1]);
  const noticeId = url?.match(NOTICE_ID)?.[1];
  const id = noticeId ?? `${nameKey(volcano)}-${issued_at ? issued_at.slice(0, 16).replace(/\D/g, '') : 'tanpa-waktu'}`;

  return {
    id,
    volcano,
    catalogue_name: catalogueVolcanoForVona(volcano, listedNames)?.name ?? null,
    issued_at,
    color_code,
    text,
    ...readVonaText(text),
    observatory: authorHtml === undefined ? null : observatoryOf(authorHtml),
    url,
  };
}

/** MAGMA's list of volcanoes with a VONA archive: "Agung (138)" → { code: 'AGU', name: 'Agung' }. */
function parseVolcanoCodes(html: string): VonaVolcanoCode[] {
  const seen = new Set<string>();
  const codes: VonaVolcanoCode[] = [];
  for (const match of html.matchAll(CODE_BUTTON)) {
    const code = match[1].toUpperCase();
    const name = cleanText(match[2]).replace(/\s*\(\d+\)\s*$/, '').trim();
    if (!name || seen.has(code)) continue;
    seen.add(code);
    codes.push({ code, name });
  }
  return codes;
}

/**
 * Reads a page of MAGMA's VONA archive — page 1 (`/v1/vona`) or one volcano's page
 * (`/v1/vona?code=SMR`), which share one layout. A notice without a volcano name is skipped; a
 * page of another shape yields no notices rather than a guess.
 */
export function parseVonaPage(html: string): VonaPage {
  const volcanoes = parseVolcanoCodes(html);
  const listedNames = volcanoes.map((entry) => entry.name);
  const notices: VonaNotice[] = [];
  for (const chunk of noticeChunks(html)) {
    const notice = parseNotice(chunk, listedNames);
    if (notice) notices.push(notice);
  }
  return { notices, volcanoes };
}

/**
 * The state of a read page. A good read is reused for `ttlMs`; a copy older than that is the
 * last good one standing in after a failed read, so it is stale. No copy at all is an error.
 */
export function vonaReadState(fetchedAt: string | null, nowMs: number, ttlMs: number): VonaFeedState {
  const fetchedMs = toMillis(fetchedAt);
  if (fetchedMs === null) return 'error';
  return nowMs - fetchedMs >= ttlMs ? 'stale' : 'live';
}

// ---------------------------------------------------------------------------
// Map indicator
// ---------------------------------------------------------------------------

/** A VONA's direction is drawn on the map for this long after it was issued. */
export const VONA_MAP_WINDOW_MS = 6 * 60 * 60 * 1000;
/** A notice stamped a little ahead of this machine's clock is still current. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

export interface VonaMapArrow {
  /** Compass points to draw, in degrees clockwise from north (no repeats). */
  bearings: number[];
  /** "VONA MAGMA · 16:23 WIB · ke timur" */
  title: string;
  /** When the notice passes the six-hour window and leaves the map (epoch ms). */
  expiresAtMs: number;
}

/**
 * The direction arrow for the map, or null when there is nothing to draw: the notice must report
 * an ash cloud with a direction made of compass points and be under six hours old. A VONA states
 * no distance, so this carries directions only.
 */
export function vonaMapArrow(notice: VonaNotice, nowMs: number): VonaMapArrow | null {
  const direction = notice.ash_direction;
  const issuedMs = toMillis(notice.issued_at);
  if (notice.ash_observed !== true || !direction?.label || direction.bearings.length === 0 || issuedMs === null) {
    return null;
  }
  const age = nowMs - issuedMs;
  if (age < -CLOCK_SKEW_MS || age >= VONA_MAP_WINDOW_MS) return null;
  return {
    bearings: [...new Set(direction.bearings)],
    title: `VONA MAGMA · ${formatWibTime(issuedMs, { seconds: false })} · ke ${direction.label}`,
    expiresAtMs: issuedMs + VONA_MAP_WINDOW_MS,
  };
}
