'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown, Crosshair, Search, Waves } from 'lucide-react';
import type { TsunamiScenario } from '@/lib/types';
import { formatDecimal, formatWibDateTime } from '@/lib/time';
import {
  SEEDED_IOC_STATIONS,
  applyTsunamiToStations,
  type IOCStationReading,
} from '@/lib/telemetry';

interface OceanPanelProps {
  tsunami: TsunamiScenario | null;
  stations?: IOCStationReading[];
  oceanSource?: 'IOC_LIVE' | 'FALLBACK';
  onFocusMap?: (lat: number, lon: number) => void;
  /** Drill mode: the only mode in which station surges are synthesized and shown. */
  isSimulasi?: boolean;
  /**
   * What the per-station level is. The IOC station list carries no live
   * sea-level observation, so levels are reference constants unless the feed
   * says otherwise.
   */
  levelKind?: 'reference' | 'observed';
}

type DrillFilter = 'ALL' | 'SURGED' | 'UNCHANGED';

const COLLAPSED_ROWS = 7;

/** "+0.83m" -> "+0,83 m" */
function formatMetresText(text: string): string {
  return text.replace('.', ',').replace(/m$/, ' m');
}

export default function OceanPanel({
  tsunami,
  stations,
  oceanSource,
  onFocusMap,
  isSimulasi = false,
  levelKind = 'reference',
}: OceanPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [drillFilter, setDrillFilter] = useState<DrillFilter>('ALL');
  const [showAllRows, setShowAllRows] = useState(false);
  const searchId = useId();
  const tableId = useId();

  const baseStations = stations && stations.length > 0 ? stations : SEEDED_IOC_STATIONS;

  // Surges exist only inside a drill; in REAL mode the feed's rows are shown untouched.
  const rows = useMemo(
    () => (isSimulasi ? applyTsunamiToStations(baseStations, tsunami) : baseStations),
    [baseStations, isSimulasi, tsunami]
  );
  const isSurged = (station: IOCStationReading) => isSimulasi && station.isAnomaly;

  const liveCount = baseStations.filter((station) => station.source === 'IOC_LIVE').length;
  const seededCount = baseStations.length - liveCount;
  const registryLive = oceanSource === 'IOC_LIVE' || liveCount > 0;
  // No answer yet is not the same as IOC being unreachable.
  const registryLoading = stations === undefined;
  const surgedCount = isSimulasi ? rows.filter((station) => station.isAnomaly).length : 0;

  const activeFilter: DrillFilter = isSimulasi ? drillFilter : 'ALL';
  const query = searchQuery.trim().toLowerCase();

  const filteredStations = rows
    .filter((station) => {
      if (activeFilter === 'SURGED' && !station.isAnomaly) return false;
      if (activeFilter === 'UNCHANGED' && station.isAnomaly) return false;
      if (!query) return true;
      return (
        station.code.toLowerCase().includes(query) ||
        station.name.toLowerCase().includes(query) ||
        station.type.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => Number(isSurged(b)) - Number(isSurged(a)));

  const isNarrowed = Boolean(query) || activeFilter !== 'ALL';
  const displayedStations =
    isNarrowed || showAllRows ? filteredStations : filteredStations.slice(0, COLLAPSED_ROWS);

  const levelHeading = levelKind === 'observed' ? 'Muka air' : 'Acuan';
  const columnCount = 4 + (isSimulasi ? 1 : 0) + (onFocusMap ? 1 : 0);

  return (
    <div className="@container matte-card overflow-hidden p-4 @xl:p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-5 @4xl:flex-row @4xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="t-heading inline-flex items-center gap-1.5">
              <Waves className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              Stasiun pasang surut (IOC)
            </h3>
            <span className="t-meta inline-flex items-center gap-1.5 font-semibold">
              <span
                className="status-dot"
                data-state={registryLive ? 'live' : registryLoading ? undefined : 'seed'}
                aria-hidden="true"
              />
              {registryLive
                ? 'Daftar stasiun: live dari IOC'
                : registryLoading
                  ? 'Daftar stasiun: memuat dari IOC — sementara daftar bawaan'
                  : 'Daftar stasiun: cadangan bawaan (IOC tidak terjangkau)'}
            </span>
          </div>
          <p className="t-meta mt-1 max-w-2xl">
            {levelKind === 'observed'
              ? 'Daftar stasiun dan nilai muka air dari IOC Sea Level Station Monitoring Facility.'
              : 'Hanya daftar stasiun yang berasal dari IOC. Pengamatan muka laut langsung tidak tersedia di umpan ini — kolom “Acuan” adalah nilai acuan per stasiun, bukan pengukuran.'}
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-3 divide-x divide-[var(--border-hairline)] @4xl:min-w-[380px]">
          <div className="pr-4">
            <dt className="t-micro">Terdaftar</dt>
            <dd className="font-display mt-0.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {baseStations.length}
            </dd>
          </div>
          <div className="px-4">
            <dt className="t-micro">Dari IOC</dt>
            <dd className="font-display mt-0.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {liveCount}
            </dd>
          </div>
          <div className="pl-4">
            <dt className="t-micro">Cadangan</dt>
            <dd className="font-display mt-0.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {seededCount}
            </dd>
          </div>
        </dl>
      </div>

      {isSimulasi && (
        <p className="t-meta mt-4 flex flex-wrap items-center gap-2">
          <span className="drill-chip">Simulasi</span>
          {surgedCount > 0
            ? `${surgedCount} stasiun diberi lonjakan latihan — nilai latihan, bukan hasil pemodelan dan bukan pengamatan IOC.`
            : 'Belum ada lonjakan latihan pada fase skenario ini.'}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="relative min-w-[220px] flex-1 @xl:max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            Cari stasiun pasang surut
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pelabuhan, pulau, atau kode…"
            className="min-h-8 w-full rounded-full border border-[var(--border-hairline)] bg-[var(--surface-2)] py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)]"
          />
        </div>

        {isSimulasi && (
          <div role="group" aria-label="Saring stasiun (latihan)" className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `Semua (${rows.length})` },
                { id: 'SURGED', label: `Lonjakan latihan (${surgedCount})` },
                { id: 'UNCHANGED', label: `Tanpa lonjakan (${rows.length - surgedCount})` },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={activeFilter === option.id}
                onClick={() => setDrillFilter(option.id)}
                className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  activeFilter === option.id
                    ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div id={tableId}>
        {/* A four-column table cannot fit a phone: each station becomes one stacked entry there */}
        <ul className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] @xl:hidden">
          {displayedStations.length === 0 ? (
            <li className="t-meta py-8 text-center">Tidak ada stasiun yang sesuai pencarian.</li>
          ) : (
            displayedStations.map((station) => {
              const surged = isSurged(station);
              return (
                <li
                  key={station.code}
                  className={`flex items-center gap-3 py-3 ${surged ? '-mx-2 rounded-lg bg-[var(--drill-bg)] px-2' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="t-data text-[var(--text-primary)]">{station.code.toUpperCase()}</span>
                      <span className="t-data text-[var(--text-secondary)]">
                        {formatDecimal(station.baseLevelMeters, 2)} m{' '}
                        <span className="t-meta font-sans font-normal text-[var(--text-muted)]">
                          {levelHeading.toLowerCase()}
                        </span>
                      </span>
                    </div>
                    <p className="t-body mt-0.5">{station.name}</p>
                    <p className="t-meta text-[var(--text-muted)]">
                      {station.source === 'IOC_LIVE' ? 'IOC' : 'Cadangan bawaan'}
                      {station.lastUpdated ? ` · data terakhir ${formatWibDateTime(station.lastUpdated)}` : ''}
                    </p>
                    {surged && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="drill-chip">Simulasi</span>
                        <span className="t-data text-[var(--drill)]">{formatMetresText(station.anomaly)}</span>
                        <span className="t-meta text-[var(--text-muted)]">nilai latihan</span>
                      </p>
                    )}
                  </div>
                  {onFocusMap && (
                    <button
                      type="button"
                      onClick={() => onFocusMap(station.lat, station.lon)}
                      aria-label={`Fokuskan peta ke ${station.name}`}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 text-[12px] font-semibold text-[var(--accent)]"
                    >
                      <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                      Lihat
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <div className="hidden overflow-x-auto @xl:block">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Stasiun pasang surut Indonesia yang terdaftar di IOC
            {levelKind === 'reference' ? '; nilai acuan, bukan pengamatan langsung' : ''}
          </caption>
          <thead>
            <tr className="border-b border-[var(--border-hairline)]">
              <th scope="col" className="t-micro py-2.5 pr-4">Kode</th>
              <th scope="col" className="t-micro py-2.5 pr-4">Lokasi stasiun</th>
              <th scope="col" className="t-micro py-2.5 pr-4">{levelHeading}</th>
              {isSimulasi && (
                <th scope="col" className="t-micro py-2.5 pr-4">Lonjakan (latihan)</th>
              )}
              <th scope="col" className="t-micro py-2.5 pr-4">Sumber daftar</th>
              {onFocusMap && (
                <th scope="col" className="t-micro py-2.5 text-right">Peta</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {displayedStations.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="t-meta py-8 text-center">
                  Tidak ada stasiun yang sesuai pencarian.
                </td>
              </tr>
            ) : (
              displayedStations.map((station) => {
                const surged = isSurged(station);
                return (
                  <tr
                    key={station.code}
                    className={surged ? 'bg-[var(--drill-bg)]' : 'hover:bg-[var(--surface-subtle)]'}
                  >
                    <th scope="row" className="t-data py-2.5 pr-4 text-[var(--text-primary)]">
                      {station.code.toUpperCase()}
                    </th>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-[var(--text-primary)]">{station.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {station.type} ·{' '}
                        <span className="font-mono tabular-nums">
                          {formatDecimal(station.lat, 2)}, {formatDecimal(station.lon, 2)}
                        </span>
                      </div>
                    </td>
                    <td className="t-data py-2.5 pr-4 text-[var(--text-secondary)]">
                      {formatDecimal(station.baseLevelMeters, 2)} m
                    </td>
                    {isSimulasi && (
                      <td className="py-2.5 pr-4">
                        {surged ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="drill-chip">Simulasi</span>
                            <span className="t-data text-[var(--drill)]">
                              {formatMetresText(station.anomaly)}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)]">nilai latihan</span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 pr-4">
                      <div className="text-[var(--text-secondary)]">
                        {station.source === 'IOC_LIVE' ? 'IOC' : 'Cadangan bawaan'}
                      </div>
                      {station.lastUpdated && (
                        <div className="text-[11px] text-[var(--text-muted)]">
                          data terakhir {formatWibDateTime(station.lastUpdated)}
                        </div>
                      )}
                    </td>
                    {onFocusMap && (
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onFocusMap(station.lat, station.lon)}
                          aria-label={`Fokuskan peta ke ${station.name}`}
                          className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-3)]"
                        >
                          <Crosshair className="h-3 w-3" aria-hidden="true" />
                          <span>Lihat</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {!isNarrowed && filteredStations.length > COLLAPSED_ROWS && (
        <div className="mt-4 flex justify-center border-t border-[var(--border-hairline)] pt-3">
          <button
            type="button"
            aria-expanded={showAllRows}
            aria-controls={tableId}
            onClick={() => setShowAllRows((prev) => !prev)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>
              {showAllRows
                ? 'Ringkas daftar stasiun'
                : `Tampilkan seluruh ${filteredStations.length} stasiun`}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showAllRows ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      )}
    </div>
  );
}
