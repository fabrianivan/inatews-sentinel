/**
 * Severity vocabulary for the whole dashboard.
 *
 * Two kinds of words exist and must never be mixed:
 *
 *  · Tones — this product's own, unofficial scale (RUTIN / MENINGKAT / TINGGI /
 *    KRITIS, plus TIDAK DIKETAHUI). Every heuristic the dashboard computes
 *    itself is worded with these.
 *
 *  · Official levels — Normal / Waspada / Siaga / Awas. Those words belong to
 *    BMKG (tsunami warning levels) and PVMBG (volcano activity levels) and each
 *    carries a defined public action. They are only ever shown as a quotation
 *    of an agency, or inside a drill that is marked as a simulation.
 *
 * Feeds, the Go backend, the drill presets and the AI engine each speak their
 * own dialect (NORMAL/ADVISORY/ELEVATED/HIGH/CRITICAL, LOW/MEDIUM/…,
 * IMMEDIATE/URGENT/STANDBY, …). `toTone` maps all of them onto one tone so a
 * colour means the same thing on every surface.
 */

/** Unofficial priority tone; drives colour, icon and fill weight. */
export type Tone = 'unknown' | 'rutin' | 'meningkat' | 'tinggi' | 'kritis';

export const TONE_LABEL: Record<Tone, string> = {
  unknown: 'TIDAK DIKETAHUI',
  rutin: 'RUTIN',
  meningkat: 'MENINGKAT',
  tinggi: 'TINGGI',
  kritis: 'KRITIS',
};

/**
 * Ascending concern. "Unknown" outranks "rutin": when part of the picture is
 * missing, the combined picture cannot be called routine.
 */
const TONE_RANK: Record<Tone, number> = { rutin: 0, unknown: 1, meningkat: 2, tinggi: 3, kritis: 4 };

const KRITIS_WORDS = new Set(['CRITICAL', 'AWAS', 'IMMEDIATE', 'KRITIS']);
const TINGGI_WORDS = new Set(['HIGH', 'SIAGA', 'URGENT', 'TINGGI']);
const MENINGKAT_WORDS = new Set(['ELEVATED', 'WASPADA', 'MEDIUM', 'MODERATE', 'MENINGKAT']);
const RUTIN_WORDS = new Set(['NORMAL', 'LOW', 'STABLE', 'STANDBY', 'ADVISORY', 'RUTIN', 'OPERATIONAL']);

export function toneRank(tone: Tone): number {
  return TONE_RANK[tone];
}

/** The most concerning of the given tones (`rutin` when called with none). */
export function maxTone(...tones: Tone[]): Tone {
  return tones.reduce<Tone>((highest, tone) => (TONE_RANK[tone] > TONE_RANK[highest] ? tone : highest), 'rutin');
}

/**
 * Maps an enumerated severity string from any source onto a tone, matching
 * whole words ("LEVEL III (SIAGA)" resolves, "HIGHLIGHT" does not). The mapping
 * is total: anything unrecognised, including an empty value, is `unknown` —
 * never silently "rutin". Not meant for free text.
 */
export function toTone(raw: string | null | undefined): Tone {
  const words = (raw || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  if (words.some((word) => KRITIS_WORDS.has(word))) return 'kritis';
  if (words.some((word) => TINGGI_WORDS.has(word))) return 'tinggi';
  if (words.some((word) => MENINGKAT_WORDS.has(word))) return 'meningkat';
  if (words.some((word) => RUTIN_WORDS.has(word))) return 'rutin';
  return 'unknown';
}

/** One magnitude-to-emphasis rule for every list, pill and marker. */
export function toneFromMagnitude(magnitude: number): Tone {
  if (!Number.isFinite(magnitude) || magnitude <= 0) return 'unknown';
  if (magnitude >= 7.0) return 'kritis';
  if (magnitude >= 6.0) return 'tinggi';
  if (magnitude >= 5.0) return 'meningkat';
  return 'rutin';
}

// ---------------------------------------------------------------------------
// Official levels (BMKG tsunami warning levels, PVMBG volcano activity levels)
// ---------------------------------------------------------------------------

export type OfficialLevel = 'normal' | 'waspada' | 'siaga' | 'awas';

export const OFFICIAL_LEVEL_LABEL: Record<OfficialLevel, string> = {
  normal: 'Normal',
  waspada: 'Waspada',
  siaga: 'Siaga',
  awas: 'Awas',
};

const OFFICIAL_TONE: Record<OfficialLevel, Tone> = {
  normal: 'rutin',
  waspada: 'meningkat',
  siaga: 'tinggi',
  awas: 'kritis',
};

/** Colour tone for an official level. */
export function officialTone(level: OfficialLevel): Tone {
  return OFFICIAL_TONE[level];
}

export type TsunamiWarningLevel = Exclude<OfficialLevel, 'normal'>;

/**
 * InaTEWS warning level for an estimated tsunami height at the coast:
 * Awas from 3 m, Siaga from 0.5 m up to 3 m, Waspada below 0.5 m.
 * Returns null when there is no positive estimate.
 */
export function tsunamiLevelFromHeight(heightM: number): TsunamiWarningLevel | null {
  if (!Number.isFinite(heightM) || heightM <= 0) return null;
  if (heightM >= 3) return 'awas';
  if (heightM >= 0.5) return 'siaga';
  return 'waspada';
}

/** BMKG's standing advice to local government for each tsunami warning level. */
export const TSUNAMI_LEVEL_ADVICE: Record<TsunamiWarningLevel, string> = {
  waspada: 'Jauhi pantai dan tepian sungai',
  siaga: 'Evakuasi',
  awas: 'Evakuasi menyeluruh',
};

export interface VolcanoLevelInfo {
  level: OfficialLevel;
  roman: 'I' | 'II' | 'III' | 'IV';
  /** "Level III · Siaga" */
  label: string;
}

const VOLCANO_LEVELS: Record<OfficialLevel, VolcanoLevelInfo> = {
  normal: { level: 'normal', roman: 'I', label: 'Level I · Normal' },
  waspada: { level: 'waspada', roman: 'II', label: 'Level II · Waspada' },
  siaga: { level: 'siaga', roman: 'III', label: 'Level III · Siaga' },
  awas: { level: 'awas', roman: 'IV', label: 'Level IV · Awas' },
};

const VOLCANO_ROMAN_TO_LEVEL: Record<string, OfficialLevel> = {
  I: 'normal',
  II: 'waspada',
  III: 'siaga',
  IV: 'awas',
};

/**
 * Parses a PVMBG status such as "LEVEL III (SIAGA)" or "Siaga".
 * Returns null when the text names no level, so callers show "tidak diketahui"
 * instead of inventing Level I.
 */
export function parseVolcanoLevel(alertLevelText: string | null | undefined): VolcanoLevelInfo | null {
  const text = (alertLevelText || '').toUpperCase();
  const roman = /LEVEL\s+(IV|I{1,3})\b/.exec(text);
  if (roman) return VOLCANO_LEVELS[VOLCANO_ROMAN_TO_LEVEL[roman[1]]];
  const words = text.split(/[^A-Z]+/);
  if (words.includes('AWAS')) return VOLCANO_LEVELS.awas;
  if (words.includes('SIAGA')) return VOLCANO_LEVELS.siaga;
  if (words.includes('WASPADA')) return VOLCANO_LEVELS.waspada;
  if (words.includes('NORMAL')) return VOLCANO_LEVELS.normal;
  return null;
}

// ---------------------------------------------------------------------------
// BMKG free-text fields
// ---------------------------------------------------------------------------

/**
 * True when BMKG's free-text "Potensi" field states tsunami potential.
 * Only "tidak berpotensi" negates it: an unrelated "tidak" later in the
 * sentence must not silence a warning. A statement that the warning has ended
 * is not a statement of potential.
 */
export function isTsunamiPotential(potensi: string | null | undefined): boolean {
  const text = (potensi || '').toLowerCase();
  if (!text.includes('berpotensi tsunami')) return false;
  if (/tidak\s+berpotensi/.test(text)) return false;
  return !isTsunamiTermination(text);
}

/** True when the text says a tsunami warning has ended ("…dinyatakan berakhir"). */
export function isTsunamiTermination(potensi: string | null | undefined): boolean {
  const text = (potensi || '').toLowerCase();
  return text.includes('tsunami') && /\b(berakhir|diakhiri)\b/.test(text);
}

/**
 * What BMKG's "Potensi" text is about. It is not always a tsunami statement —
 * for felt quakes it reads "Gempa ini dirasakan untuk diteruskan pada
 * masyarakat" — so the UI must not print it under a "Tsunami:" label blindly.
 *
 *  tsunami      states tsunami potential
 *  ended        states that a tsunami warning has ended
 *  no-tsunami   states there is no tsunami potential
 *  unclear      mentions tsunami but matches none of the above — check BMKG
 *  other        does not mention tsunami at all
 *  empty        no text
 */
export type PotensiKind = 'tsunami' | 'ended' | 'no-tsunami' | 'unclear' | 'other' | 'empty';

export function classifyPotensi(potensi: string | null | undefined): PotensiKind {
  const text = (potensi || '').trim().toLowerCase();
  if (!text) return 'empty';
  if (isTsunamiTermination(text)) return 'ended';
  if (isTsunamiPotential(text)) return 'tsunami';
  if (/tidak\s+berpotensi\s+tsunami/.test(text)) return 'no-tsunami';
  if (text.includes('tsunami')) return 'unclear';
  return 'other';
}

const ROMAN_VALUES: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

/**
 * Highest felt intensity in BMKG's "Dirasakan" text ("II-III Kupang, IV Soe" → 4),
 * on the MMI scale BMKG reports it in. Null when the text carries no intensity.
 */
export function parseDirasakanMaxMmi(dirasakan: string | null | undefined): number | null {
  const matches = (dirasakan || '').toUpperCase().match(/\b(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/g);
  if (!matches) return null;
  return Math.max(...matches.map((numeral) => ROMAN_VALUES[numeral]));
}

/** BMKG's depth classes: dangkal below 60 km, menengah to 300 km, dalam beyond. */
export function depthClass(depthKm: number): 'dangkal' | 'menengah' | 'dalam' {
  if (depthKm < 60) return 'dangkal';
  if (depthKm <= 300) return 'menengah';
  return 'dalam';
}
