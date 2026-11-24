'use client';

import { Activity, FlaskConical, ListOrdered } from 'lucide-react';
import { EventAge } from './SentinelClocks';
import { shortRegion, type AttentionAssessment, type QuakeFeedHealth } from '@/lib/attention';
import { toneFromMagnitude } from '@/lib/severity';
import { formatDecimal, toMillis } from '@/lib/time';
import type { BMKGGempaDetail } from '@/lib/types';

interface QuakePillsProps {
  /** Latest BMKG record, or the scenario earthquake in a drill. Null while nothing is known. */
  quake: BMKGGempaDetail | null;
  isDrill: boolean;
  /** BMKG M≥5 counts; omitted in drills and while the feed is not live. */
  counts?: AttentionAssessment['counts'] | null;
  /** State of the BMKG feed, so "no record yet" is not worded as "unavailable". */
  feedState?: QuakeFeedHealth;
  /** Only the latest-quake pill: used while a warning card needs the space. */
  compact?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The one row of facts that floats over the map: what the latest earthquake
 * was and how busy the last week has been. Inventory (station counts, which
 * model is running) lives in the Sumber Data panel, not here.
 */
export default function QuakePills({ quake, isDrill, counts, feedState, compact = false }: QuakePillsProps) {
  const usable = quake !== null && !quake.seeded;
  const magnitude = usable ? parseFloat(quake.Magnitude) : Number.NaN;
  const originMs = usable ? toMillis(quake.DateTime) : null;
  // Colour is for recent events only; an old quake is a neutral fact. Date.now() is only
  // reached once a record exists, i.e. on the client after the first poll.
  const fresh = originMs !== null && Date.now() - originMs < DAY_MS;
  const tone = Number.isFinite(magnitude) && (fresh || isDrill) ? toneFromMagnitude(magnitude) : 'rutin';

  return (
    <div className="pointer-events-none flex flex-wrap items-center gap-2">
      <div
        data-tone={tone}
        className={`hud-solid pointer-events-auto flex min-h-8 max-w-full items-center gap-2 rounded-full px-3 ${
          isDrill ? 'border-[var(--drill-border)]' : ''
        }`}
      >
        {isDrill ? (
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-[var(--drill)]" aria-hidden="true" />
        ) : (
          <Activity className="tone-text h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        {usable && Number.isFinite(magnitude) ? (
          <p className="flex min-w-0 items-baseline gap-2">
            {isDrill ? (
              <span className="t-micro shrink-0 text-[var(--drill)]">Simulasi</span>
            ) : (
              <span className="t-micro shrink-0">BMKG</span>
            )}
            <span className="t-data tone-text shrink-0">M{formatDecimal(magnitude)}</span>
            <span className="t-meta min-w-0 truncate" title={quake.Wilayah}>
              {shortRegion(quake.Wilayah, 34)}
            </span>
            {!isDrill && originMs !== null && (
              <EventAge at={originMs} className="t-meta shrink-0 text-[var(--text-muted)]" />
            )}
          </p>
        ) : (
          <p className="t-meta">
            {isDrill
              ? 'Simulasi — belum ada gempa utama'
              : feedState === 'loading'
                ? 'Memuat data gempa BMKG…'
                : 'Data gempa BMKG tidak tersedia'}
          </p>
        )}
      </div>

      {!compact && !isDrill && counts && (
        <div className="hud-solid pointer-events-auto hidden min-h-8 items-center gap-2 rounded-full px-3 sm:flex">
          <ListOrdered className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="t-meta">
            Gempa M≥5 (BMKG): <span className="t-data text-[var(--text-primary)]">{counts.last24h}</span> dalam 24 jam
            {' · '}
            <span className="t-data text-[var(--text-primary)]">{counts.last7d}</span> dalam 7 hari
          </p>
        </div>
      )}
    </div>
  );
}
