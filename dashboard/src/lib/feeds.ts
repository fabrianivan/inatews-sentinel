/**
 * Client-side view of where the dashboard's data comes from and whether each
 * source can be trusted right now. Route payloads carry per-feed provenance
 * (live / seed / failed); this adds what only the browser knows — whether a
 * poll has completed at all, and how long ago the last good one was.
 */

import type { FeedState, ProvenanceMap } from './types';

export type FeedKey = 'bmkg' | 'usgs' | 'ioc' | 'pvmbg' | 'weather' | 'ai';

/**
 *  loading     no poll has completed yet
 *  live        the upstream answered and its data is on screen
 *  stale       the last good poll is too old to trust
 *  seed        the route answered with built-in placeholder data
 *  failed      the poll failed
 *  unreported  the payload carries no provenance (Go backend path)
 */
export type FeedHealthState = 'loading' | 'live' | 'stale' | 'seed' | 'failed' | 'unreported';

export interface FeedHealth {
  key: FeedKey;
  /** Short name for the masthead: "BMKG". */
  label: string;
  /** What the feed is used for. */
  role: string;
  /** Official page a reader should check when this feed is not live. */
  href?: string;
  state: FeedHealthState;
  /** Last successful poll (epoch ms), or null. */
  lastOkAt: number | null;
  /** Extra detail, e.g. the AI model in use. */
  note?: string;
}

export const FEED_INFO: Record<FeedKey, { label: string; role: string; href?: string }> = {
  bmkg: {
    label: 'BMKG',
    role: 'Gempa terkini, daftar gempa M≥5 dan daftar gempa dirasakan',
    href: 'https://www.bmkg.go.id/gempabumi',
  },
  usgs: { label: 'USGS', role: 'Katalog regional sebagai pembanding' },
  ioc: {
    label: 'IOC',
    role: 'Daftar stasiun pasang surut (tanpa data muka laut langsung)',
    href: 'https://www.ioc-sealevelmonitoring.org',
  },
  pvmbg: {
    label: 'PVMBG',
    role: 'Laporan erupsi MAGMA Indonesia; seismogram langsung dan kamera gunung dibaca saat panel gunung dibuka',
    href: 'https://magma.esdm.go.id',
  },
  weather: { label: 'Open-Meteo', role: 'Cuaca pesisir' },
  ai: { label: 'Ringkasan', role: 'Mesin ringkasan situasi' },
};

export const FEED_ORDER: FeedKey[] = ['bmkg', 'usgs', 'ioc', 'pvmbg', 'weather', 'ai'];

/** A feed is stale once three polls' worth of time has passed without a good one. */
export const STALE_AFTER_MS = 60_000;

const STATE_WORD: Record<FeedHealthState, string> = {
  loading: 'memuat',
  live: 'langsung',
  stale: 'usang',
  seed: 'cadangan',
  failed: 'gagal',
  unreported: 'tidak dilaporkan',
};

export function feedStateWord(state: FeedHealthState): string {
  return STATE_WORD[state];
}

/** The less trustworthy of two provenance states. */
export function worseFeedState(a: FeedState | undefined, b: FeedState | undefined): FeedState | undefined {
  const rank: Record<FeedState, number> = { live: 0, seed: 1, failed: 2 };
  if (!a) return b;
  if (!b) return a;
  return rank[a] >= rank[b] ? a : b;
}

export interface FeedRecord {
  /** Outcome of the most recent poll, or null before the first one. */
  lastOutcome: 'ok' | 'failed' | null;
  lastOkAt: number | null;
  /** Provenance reported by the payload of the last good poll, if any. */
  reported: FeedState | undefined;
}

export const EMPTY_FEED_RECORD: FeedRecord = { lastOutcome: null, lastOkAt: null, reported: undefined };

/** Health of one feed at `nowMs`, from its poll record. */
export function feedHealthState(record: FeedRecord, nowMs: number): FeedHealthState {
  if (record.lastOutcome === null) return 'loading';
  if (record.lastOutcome === 'failed') return 'failed';
  if (record.lastOkAt !== null && nowMs - record.lastOkAt > STALE_AFTER_MS) return 'stale';
  if (record.reported === undefined) return 'unreported';
  return record.reported;
}

/** Reads one or more feeds out of a provenance map, keeping the worst state. */
export function reportedState(provenance: ProvenanceMap | undefined, ...feeds: Array<keyof ProvenanceMap>): FeedState | undefined {
  if (!provenance) return undefined;
  return feeds.reduce<FeedState | undefined>(
    (worst, feed) => worseFeedState(worst, provenance[feed]?.state),
    undefined
  );
}

/** True when a feed should be called out: anything but live, or backend-unreported. */
export function isDegraded(state: FeedHealthState): boolean {
  return state === 'stale' || state === 'seed' || state === 'failed';
}
