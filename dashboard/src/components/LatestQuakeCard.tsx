'use client';

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Calendar,
  ChevronDown,
  Crosshair,
  Map as MapIcon,
  MapPin,
} from 'lucide-react';
import type { BMKGGempaDetail, RealtimeEarthquakesData, SeismicEvent } from '@/lib/types';

interface LatestQuakeCardProps {
  quake: BMKGGempaDetail | null;
  realQuakes?: RealtimeEarthquakesData | null;
  onFocusMap?: (lat: number, lon: number) => void;
  activityPercentage?: number;
  deepDiveTargetId?: string;
}

interface CombinedRecentQuake {
  source: 'BMKG' | 'USGS';
  event: SeismicEvent;
}

export default function LatestQuakeCard({
  quake,
  realQuakes,
  onFocusMap,
  activityPercentage,
  deepDiveTargetId,
}: LatestQuakeCardProps) {
  const [showShakemap, setShowShakemap] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  const combinedRecent: CombinedRecentQuake[] = useMemo(() => {
    const bmkgList = (realQuakes?.recent_bmkg || []).map((event) => ({
      source: 'BMKG' as const,
      event,
    }));
    const usgsList = (realQuakes?.recent_usgs || []).map((event) => ({
      source: 'USGS' as const,
      event,
    }));
    return [...bmkgList, ...usgsList]
      .sort(
        (a, b) =>
          new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime()
      )
      .slice(0, 8);
  }, [realQuakes]);

  if (!quake && combinedRecent.length === 0) {
    return (
      <div className="glass-hud rounded-2xl p-5">
        <p className="py-8 text-center text-xs text-[var(--text-muted)]">
          Memuat telemetri gempa BMKG TEWS...
        </p>
      </div>
    );
  }

  const mag = quake?.Magnitude ? parseFloat(quake.Magnitude) || 0 : 0;
  const isTsunami =
    (quake?.Potensi || '').toLowerCase().includes('berpotensi tsunami') &&
    !(quake?.Potensi || '').toLowerCase().includes('tidak');

  const hasDirasakan = Boolean(
    quake?.Dirasakan &&
      quake.Dirasakan.trim() !== '' &&
      quake.Dirasakan.trim() !== '-' &&
      !quake.Dirasakan.toLowerCase().includes('belum ada')
  );

  const shakemapUrl = quake?.Shakemap
    ? `https://data.bmkg.go.id/DataMKG/TEWS/${quake.Shakemap}`
    : null;

  const coords = (quake?.Coordinates || '').split(',');
  const lat = coords.length === 2 ? parseFloat(coords[0]) : null;
  const lon = coords.length === 2 ? parseFloat(coords[1]) : null;
  const visibleRecent = showAllRecent ? combinedRecent : combinedRecent.slice(0, 3);

  return (
    <div className="glass-hud flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
          Gempa Terkini BMKG
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-muted)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--accent)]">
          <span className="live-dot-pulse" />
          TEWS LIVE
        </span>
      </div>

      {/* Hero Display Magnitude */}
      {quake && (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div
                className={`font-display text-5xl font-bold leading-none tracking-tight tabular-nums ${
                  mag >= 6.5 || isTsunami
                    ? 'text-[var(--sev-critical)]'
                    : mag >= 5.0
                      ? 'text-[var(--sev-high)]'
                      : 'text-[var(--text-primary)]'
                }`}
              >
                M{mag > 0 ? mag.toFixed(1) : '—'}
              </div>
              <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
                <span>Kedalaman {quake.Kedalaman}</span>
                <span>·</span>
                <span>{quake.Jam}</span>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] text-[var(--text-muted)]">
              <div className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{quake.Tanggal}</span>
              </div>
              {typeof activityPercentage === 'number' && (
                <div className="mt-1 font-bold text-[var(--accent)]">
                  MMI {Math.round(activityPercentage)}%
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs font-semibold leading-snug text-[var(--text-primary)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sev-critical)]" />
            <span>{quake.Wilayah}</span>
          </div>

          {isTsunami ? (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] p-2.5 text-xs text-[var(--sev-critical)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-bold tracking-wide uppercase">Peringatan Dini Tsunami</div>
                <div className="mt-0.5 text-[11px] opacity-90">{quake.Potensi}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--sev-normal)]">Tsunami:</span>{' '}
              {quake.Potensi || 'Tidak berpotensi tsunami'}
            </div>
          )}

          {/* Spatial Strip */}
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-2.5 sm:grid-cols-2">
            <div>
              <div className="text-[9px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                Episenter
              </div>
              <div className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-[var(--text-primary)]">
                {quake.Lintang}, {quake.Bujur}
              </div>
            </div>
            {hasDirasakan && (
              <div>
                <div className="text-[9px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                  Skala Dirasakan
                </div>
                <div className="mt-0.5 truncate text-[11px] font-bold text-[var(--sev-high)]">
                  {quake.Dirasakan}
                </div>
              </div>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap gap-2">
            {lat !== null && lon !== null && onFocusMap && (
              <button
                type="button"
                onClick={() => onFocusMap(lat, lon)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-bold text-slate-950 transition-opacity hover:opacity-90"
              >
                <Crosshair className="h-3.5 w-3.5" />
                <span>Fokus Episenter</span>
              </button>
            )}
            {shakemapUrl && (
              <button
                type="button"
                onClick={() => setShowShakemap(!showShakemap)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
              >
                <MapIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>{showShakemap ? 'Tutup ShakeMap' : 'ShakeMap'}</span>
              </button>
            )}
          </div>

          {showShakemap && shakemapUrl && (
            <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shakemapUrl}
                alt={`ShakeMap BMKG ${quake.Wilayah}`}
                className="h-auto w-full rounded-lg object-contain"
                loading="lazy"
              />
            </div>
          )}
        </div>
      )}

      {/* Compact Significant Earthquakes Feed */}
      <div className="border-t border-[var(--border-hairline)] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
            Gempa Signifikan Terkini
          </span>
          {combinedRecent.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllRecent((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
            >
              <span>{showAllRecent ? 'Ringkas' : `Lihat ${combinedRecent.length}`}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showAllRecent ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        <div className="divide-y divide-[var(--border-hairline)]">
          {visibleRecent.map(({ source, event: q }, idx) => {
            const qMag = q.magnitude || 4.5;
            return (
              <div
                key={`${source}-${idx}`}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    className={`shrink-0 font-mono text-xs font-extrabold tabular-nums ${
                      qMag >= 6.0
                        ? 'text-[var(--sev-critical)]'
                        : qMag >= 5.5
                          ? 'text-[var(--sev-high)]'
                          : 'text-[var(--text-primary)]'
                    }`}
                  >
                    M{qMag.toFixed(1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[11px] font-medium text-[var(--text-primary)]"
                      title={q.fault_zone}
                    >
                      {q.fault_zone}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tabular-nums">
                      {source} · {q.depth.toFixed(0)} km ·{' '}
                      {new Date(q.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      WIB
                    </div>
                  </div>
                </div>

                {onFocusMap && q.latitude && q.longitude && (
                  <button
                    type="button"
                    onClick={() => onFocusMap(q.latitude, q.longitude)}
                    className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold text-[var(--accent)] hover:bg-[var(--accent-muted)]"
                  >
                    Lihat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {deepDiveTargetId && (
        <button
          type="button"
          onClick={() =>
            document
              .getElementById(deepDiveTargetId)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] py-2 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
        >
          <span>AI Sentinel · IOC Pasut · Gunung Api</span>
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
