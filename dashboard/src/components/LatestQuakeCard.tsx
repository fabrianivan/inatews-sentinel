'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  Crosshair,
  FlaskConical,
  Map as MapIcon,
  OctagonAlert,
} from 'lucide-react';
import { EventAge, EventElapsed } from './SentinelClocks';
import type { QuakeFeedHealth } from '@/lib/attention';
import { feedStateWord } from '@/lib/feeds';
import { classifyPotensi, depthClass, parseDirasakanMaxMmi, toneFromMagnitude } from '@/lib/severity';
import { formatDecimal, formatRowStamp, formatWibDate, formatWibTime, toMillis } from '@/lib/time';
import type { BMKGGempaDetail, RealtimeEarthquakesData, SeismicEvent } from '@/lib/types';

interface LatestQuakeCardProps {
  /** BMKG's latest report, or the scenario earthquake in a drill. */
  quake: BMKGGempaDetail | null;
  /** Live lists for the recent-earthquake rows; always real data, also during a drill. */
  realQuakes?: RealtimeEarthquakesData | null;
  onFocusMap?: (lat: number, lon: number) => void;
  isDrill?: boolean;
  /** State of the BMKG feed, shown beside the mandatory source attribution. */
  feedState?: QuakeFeedHealth;
}

interface RecentRow {
  source: 'BMKG' | 'USGS';
  event: SeismicEvent;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const FEED_DOT: Record<QuakeFeedHealth, string | undefined> = {
  live: 'live',
  loading: undefined,
  stale: 'stale',
  seed: 'seed',
  failed: 'failed',
  unreported: undefined,
};

/** BMKG's "Potensi" text, shown for what it is rather than under a fixed "Tsunami:" label. */
function BmkgRemark({ potensi }: { potensi: string }) {
  const kind = classifyPotensi(potensi);

  if (kind === 'tsunami') {
    return (
      <div data-tone="kritis" className="alert-surface flex items-start gap-2 rounded-xl p-2.5">
        <OctagonAlert className="tone-text mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="t-status tone-text">BMKG: berpotensi tsunami</p>
          <p className="t-body mt-0.5">{potensi}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2">
      <p className="t-micro">Keterangan BMKG</p>
      <p className="t-body mt-0.5">
        {kind === 'empty' ? <span className="text-[var(--text-muted)]">tidak tersedia</span> : potensi}
      </p>
      {kind === 'unclear' && (
        <p className="t-meta mt-1 text-[var(--tone-meningkat)]">
          Menyebut tsunami tanpa pernyataan yang jelas — periksa BMKG.
        </p>
      )}
    </div>
  );
}

export default function LatestQuakeCard({
  quake,
  realQuakes,
  onFocusMap,
  isDrill = false,
  feedState = 'unreported',
}: LatestQuakeCardProps) {
  const [showShakemap, setShowShakemap] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  const recentRows: RecentRow[] = useMemo(() => {
    const rows: RecentRow[] = [
      ...(realQuakes?.recent_bmkg ?? []).map((event) => ({ source: 'BMKG' as const, event })),
      ...(realQuakes?.recent_usgs ?? []).map((event) => ({ source: 'USGS' as const, event })),
    ];
    return rows
      .filter(({ event }) => !event.seeded && toMillis(event.timestamp) !== null)
      .sort((a, b) => (toMillis(b.event.timestamp) ?? 0) - (toMillis(a.event.timestamp) ?? 0))
      .slice(0, 8);
  }, [realQuakes]);

  const usable = quake !== null && !quake.seeded;
  const magnitude = usable ? parseFloat(quake.Magnitude) : Number.NaN;
  const originMs = usable ? toMillis(quake.DateTime) : null;
  const depthKm = usable ? parseFloat(quake.Kedalaman) : Number.NaN;
  const feltMmi = usable ? parseDirasakanMaxMmi(quake.Dirasakan) : null;
  const hasFelt = usable && feltMmi !== null;
  const remarkKind = usable ? classifyPotensi(quake.Potensi) : 'empty';

  // Only events that matter get a running clock, and only while they are fresh; everything
  // else shows a coarse age, so a routine quake from hours ago does not tick on screen.
  // Date.now() is only reached once a record exists, i.e. on the client after the first poll.
  const ageMs = originMs !== null ? Date.now() - originMs : null;
  const significant = magnitude >= 5.0 || (feltMmi ?? 0) >= 4 || remarkKind === 'tsunami';
  const tickSeconds = !isDrill && ageMs !== null && ageMs < HOUR_MS && significant;
  const fresh = ageMs !== null && ageMs < DAY_MS;
  const heroTone = Number.isFinite(magnitude) && (fresh || isDrill) ? toneFromMagnitude(magnitude) : 'rutin';

  const coords = (usable ? quake.Coordinates : '').split(',');
  const lat = coords.length === 2 ? parseFloat(coords[0]) : Number.NaN;
  const lon = coords.length === 2 ? parseFloat(coords[1]) : Number.NaN;
  const canFocus = Number.isFinite(lat) && Number.isFinite(lon) && Boolean(onFocusMap);
  const shakemapUrl =
    usable && !isDrill && quake.Shakemap ? `https://data.bmkg.go.id/DataMKG/TEWS/${quake.Shakemap}` : null;
  const visibleRows = showAllRecent ? recentRows : recentRows.slice(0, 3);

  return (
    <div className={`glass-hud flex flex-col gap-4 rounded-2xl p-4 ${isDrill ? 'drill-frame' : ''}`}>
      {/* Header: what this is and where it comes from */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="t-micro">{isDrill ? 'Gempa skenario' : 'Gempa terkini'}</h2>
        {isDrill ? (
          <span className="drill-chip">
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            Skenario latihan
          </span>
        ) : (
          <span className="t-meta inline-flex items-center gap-1.5" title="Data gempa bersumber dari BMKG">
            <span className="status-dot" data-state={FEED_DOT[feedState]} aria-hidden="true" />
            Sumber: BMKG
            {feedState !== 'live' && feedState !== 'unreported' && (
              <span className="text-[var(--text-muted)]">· {feedStateWord(feedState)}</span>
            )}
          </span>
        )}
      </div>

      {usable ? (
        <div className="space-y-3">
          {/* Fields in the order BMKG reports them: magnitude, time, location, depth, remarks, felt */}
          <div className="flex items-end justify-between gap-3">
            <p data-tone={heroTone} className="t-hero tone-text">
              {Number.isFinite(magnitude) ? `M${formatDecimal(magnitude)}` : 'M—'}
            </p>
            {!isDrill && originMs !== null && (
              <p className="pb-0.5 text-right">
                {tickSeconds ? (
                  <>
                    <EventElapsed since={originMs} className="t-data-lg block text-[var(--text-primary)]" />
                    <span className="t-meta">sejak gempa</span>
                  </>
                ) : (
                  <EventAge at={originMs} className="t-data block text-[var(--text-secondary)]" />
                )}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="t-micro pt-0.5">Waktu</dt>
            <dd className="t-data">
              {isDrill
                ? 'waktu skenario'
                : originMs !== null
                  ? `${formatWibDate(originMs)} · ${formatWibTime(originMs)}`
                  : `${quake.Tanggal} · ${quake.Jam}`}
            </dd>
            <dt className="t-micro pt-0.5">Lokasi</dt>
            <dd className="t-body">
              <span className="t-data">
                {quake.Lintang}, {quake.Bujur}
              </span>
              <br />
              {quake.Wilayah}
            </dd>
            <dt className="t-micro pt-0.5">Kedalaman</dt>
            <dd className="t-data">
              {quake.Kedalaman}
              {Number.isFinite(depthKm) && (
                <span className="t-meta ml-1.5 font-sans font-normal">({depthClass(depthKm)})</span>
              )}
            </dd>
            {hasFelt && (
              <>
                <dt className="t-micro pt-0.5">Dirasakan</dt>
                <dd className="t-body">
                  {quake.Dirasakan} <span className="t-meta">(MMI)</span>
                </dd>
              </>
            )}
          </dl>

          {isDrill ? (
            <p className="t-meta rounded-xl border border-[var(--drill-border)] bg-[var(--drill-bg)] px-3 py-2 text-[var(--drill)]">
              Parameter skenario latihan — bukan laporan BMKG.
            </p>
          ) : (
            <BmkgRemark potensi={quake.Potensi} />
          )}

          <div className="flex flex-wrap gap-2">
            {canFocus && (
              <button
                type="button"
                onClick={() => onFocusMap?.(lat, lon)}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--accent)] px-3 text-[13px] font-bold text-[var(--accent-ink)] hover:opacity-90"
              >
                <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                Fokus episenter
              </button>
            )}
            {shakemapUrl && (
              <button
                type="button"
                onClick={() => setShowShakemap((prev) => !prev)}
                aria-expanded={showShakemap}
                title="ShakeMap BMKG untuk gempa ini"
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-strong)] px-3 text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)]"
              >
                <MapIcon className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                {showShakemap ? 'Tutup ShakeMap' : 'ShakeMap'}
              </button>
            )}
          </div>

          {showShakemap && shakemapUrl && (
            <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shakemapUrl}
                alt={`ShakeMap BMKG — ${quake.Wilayah}`}
                className="h-auto w-full rounded-lg object-contain"
                loading="lazy"
              />
            </div>
          )}
        </div>
      ) : (
        <p className="t-body py-6 text-center text-[var(--text-muted)]">
          {isDrill
            ? 'Belum ada gempa utama pada fase ini.'
            : feedState === 'loading'
              ? 'Memuat data gempa BMKG…'
              : 'Data gempa BMKG tidak tersedia. Periksa bmkg.go.id.'}
        </p>
      )}

      {/* Recent significant earthquakes: always live data */}
      {recentRows.length > 0 && (
        <div className="border-t border-[var(--border-hairline)] pt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="t-micro">
              Gempa signifikan terkini{isDrill ? ' · data nyata' : ''}
            </h3>
            {recentRows.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllRecent((prev) => !prev)}
                aria-expanded={showAllRecent}
                className="inline-flex min-h-6 items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
              >
                {showAllRecent ? 'Ringkas' : `Lihat ${recentRows.length}`}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showAllRecent ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>

          <ul className="divide-y divide-[var(--border-hairline)]">
            {visibleRows.map(({ source, event }) => {
              const eventMs = toMillis(event.timestamp) ?? 0;
              const rowFresh = Date.now() - eventMs < DAY_MS;
              return (
                <li
                  key={`${source}-${event.timestamp}-${event.magnitude}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                    <span
                      data-tone={rowFresh ? toneFromMagnitude(event.magnitude) : 'rutin'}
                      className="t-data tone-text shrink-0"
                    >
                      M{formatDecimal(event.magnitude)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="t-body truncate" title={event.fault_zone}>
                        {event.fault_zone}
                      </p>
                      <p className="t-meta text-[var(--text-muted)]">
                        {source} · {Math.round(event.depth)} km · {formatRowStamp(eventMs, Date.now())}
                      </p>
                    </div>
                  </div>
                  {onFocusMap && Number.isFinite(event.latitude) && Number.isFinite(event.longitude) && (
                    <button
                      type="button"
                      onClick={() => onFocusMap(event.latitude, event.longitude)}
                      aria-label={`Lihat M${formatDecimal(event.magnitude)} ${event.fault_zone} di peta`}
                      className="inline-flex min-h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-muted)]"
                    >
                      Lihat
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </div>
  );
}
