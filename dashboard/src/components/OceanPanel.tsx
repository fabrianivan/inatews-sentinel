'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Crosshair,
  Search,
  Waves,
} from 'lucide-react';
import type { TsunamiScenario } from '@/lib/types';
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
}

type OceanFilter = 'ALL' | 'ANOMALY' | 'NOMINAL';

export default function OceanPanel({
  tsunami,
  stations,
  oceanSource,
  onFocusMap,
}: OceanPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OceanFilter>('ALL');
  const [showAllRows, setShowAllRows] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tsunamiStateRef = useRef<{ active: boolean; anomaly: number }>({
    active: Boolean(tsunami?.active),
    anomaly: tsunami?.wave_anomaly ?? 0,
  });

  useEffect(() => {
    tsunamiStateRef.current = {
      active: Boolean(tsunami?.active),
      anomaly: tsunami?.wave_anomaly ?? 0,
    };
  }, [tsunami?.active, tsunami?.wave_anomaly]);

  // Live animated ocean tide & tsunami bore wave monitor canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 640);
    const height = (canvas.height = 84);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 640;
    };
    window.addEventListener('resize', handleResize);

    let rafId: number | null = null;
    let phase = 0;

    const render = () => {
      if (!document.hidden) {
        phase += tsunamiStateRef.current.active ? 0.085 : 0.032;
        const { active, anomaly } = tsunamiStateRef.current;

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.fillStyle = isLight ? '#f4f8fc' : '#050914';
        ctx.fillRect(0, 0, width, height);

        // Baseline horizon grid
        const midY = height * 0.58;
        ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(148, 163, 184, 0.09)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        const amp = active ? Math.min(28, 12 + anomaly * 1.1) : 6.5;

        // Draw Secondary Back Wave
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const norm = x / width;
          const envelope = active ? 0.65 + 0.35 * Math.sin(norm * Math.PI * 2 - phase * 0.6) : 1;
          const y =
            midY -
            Math.sin(x * 0.018 - phase * 0.75) * (amp * 0.55) * envelope -
            Math.cos(x * 0.042 - phase * 1.1) * (amp * 0.25);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = active ? 'rgba(251, 113, 133, 0.35)' : 'rgba(34, 211, 238, 0.32)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Draw Primary Tsunami / Tide Crest Wave with Gradient Fill
        ctx.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const norm = x / width;
          const surgePeak = active
            ? Math.exp(-Math.pow((norm - ((phase * 0.14) % 1.2) + 0.1) * 4.5, 2)) * amp * 0.9
            : 0;
          const y =
            midY -
            Math.sin(x * 0.024 - phase) * (amp * 0.65) -
            Math.sin(x * 0.055 - phase * 1.4) * (amp * 0.22) -
            surgePeak;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = active ? '#fb7185' : '#22d3ee';
        ctx.lineWidth = active ? 2.4 : 1.8;
        ctx.stroke();

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 8, 0, height);
        if (active) {
          grad.addColorStop(0, 'rgba(251, 113, 133, 0.34)');
          grad.addColorStop(1, 'rgba(251, 113, 133, 0.02)');
        } else {
          grad.addColorStop(0, 'rgba(34, 211, 238, 0.26)');
          grad.addColorStop(1, 'rgba(34, 211, 238, 0.02)');
        }
        ctx.fillStyle = grad;
        ctx.fill();
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const baseStations = stations && stations.length > 0 ? stations : SEEDED_IOC_STATIONS;

  const computedStations = useMemo(
    () => applyTsunamiToStations(baseStations, tsunami),
    [baseStations, tsunami]
  );

  const anomalyCount = useMemo(
    () => computedStations.filter((st) => st.isAnomaly).length,
    [computedStations]
  );

  const liveFeedCount = useMemo(
    () => baseStations.filter((st) => st.source === 'IOC_LIVE').length,
    [baseStations]
  );

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return computedStations
      .filter((st) => {
        if (statusFilter === 'ANOMALY' && !st.isAnomaly) return false;
        if (statusFilter === 'NOMINAL' && st.isAnomaly) return false;
        if (!q) return true;
        return (
          st.code.toLowerCase().includes(q) ||
          st.name.toLowerCase().includes(q) ||
          st.type.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.isAnomaly) - Number(a.isAnomaly));
  }, [computedStations, searchQuery, statusFilter]);

  const displayedStations =
    searchQuery.trim() || statusFilter !== 'ALL' || showAllRows
      ? filteredStations
      : filteredStations.slice(0, 7);

  return (
    <div className="matte-card overflow-hidden p-5 sm:p-6">
      {/* Header Summary */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
              <Waves className="h-4 w-4 text-[var(--accent)]" />
              Pemantauan Muka Air Laut (IOC UNESCO &amp; DART)
            </span>
            <span className="rounded-full bg-[var(--sev-normal-bg)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--sev-normal)]">
              {oceanSource === 'IOC_LIVE' || liveFeedCount > 0
                ? `IOC LIVE · ${liveFeedCount} STASIUN`
                : 'JARINGAN STANDBY'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Deteksi anomali kenaikan gelombang pesisir dan verifikasi propagasi tsunami Nusantara.
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-[var(--border-hairline)] lg:min-w-[380px]">
          <div className="pr-4">
            <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Total Pasut
            </div>
            <div className="font-display mt-0.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {baseStations.length}
            </div>
          </div>
          <div className="px-4">
            <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Anomali
            </div>
            <div
              className={`font-display mt-0.5 text-2xl font-bold tabular-nums ${
                anomalyCount > 0 ? 'text-[var(--sev-critical)]' : 'text-[var(--sev-normal)]'
              }`}
            >
              {anomalyCount}
            </div>
          </div>
          <div className="pl-4">
            <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Status Tsunami
            </div>
            <div
              className={`mt-1.5 font-mono text-xs font-bold ${
                tsunami?.active ? 'text-[var(--sev-critical)]' : 'text-[var(--sev-normal)]'
              }`}
            >
              {tsunami?.active ? 'GELOMBANG AKTIF' : 'AMAN'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Animated Tide & Tsunami Surge Waveform Strip */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-hairline)]">
        <div className="flex items-center justify-between bg-[var(--surface-subtle)] px-3.5 py-1.5 font-mono text-[10px]">
          <span className="inline-flex items-center gap-2 font-bold text-[var(--text-secondary)]">
            <span
              className={`h-2 w-2 rounded-full ${
                tsunami?.active ? 'animate-ping bg-[var(--sev-critical)]' : 'bg-[var(--accent)]'
              }`}
            />
            PROGRESI PROFIL GELOMBANG PASUT &amp; DART BUOY
          </span>
          <span
            className={`font-bold ${
              tsunami?.active ? 'text-[var(--sev-critical)]' : 'text-[var(--accent)]'
            }`}
          >
            {tsunami?.active
              ? `LONJAKAN +${(tsunami.wave_anomaly ?? 0).toFixed(2)}m · PROPAGASI AKTIF`
              : 'HARMONIK PASUT NOMINAL'}
          </span>
        </div>
        <canvas ref={canvasRef} className="block h-[84px] w-full" />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pelabuhan, pulau, atau kode..."
            aria-label="Cari stasiun pasang surut"
            className="w-full rounded-full border border-[var(--border-hairline)] bg-[var(--surface-2)] py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-border)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `Semua (${baseStations.length})` },
              { id: 'ANOMALY', label: `Anomali (${anomalyCount})` },
              { id: 'NOMINAL', label: `Nominal (${baseStations.length - anomalyCount})` },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setStatusFilter(btn.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                statusFilter === btn.id
                  ? 'bg-[var(--accent-strong)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase">
              <th className="py-2.5 pr-4">Kode</th>
              <th className="py-2.5 pr-4">Lokasi Stasiun</th>
              <th className="py-2.5 pr-4">Muka Air</th>
              <th className="py-2.5 pr-4">Anomali</th>
              <th className="py-2.5 pr-4">Status</th>
              {onFocusMap && <th className="py-2.5 text-right">Peta</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {displayedStations.length === 0 ? (
              <tr>
                <td
                  colSpan={onFocusMap ? 6 : 5}
                  className="py-8 text-center text-xs text-[var(--text-muted)]"
                >
                  Tidak ada stasiun yang sesuai filter pencarian.
                </td>
              </tr>
            ) : (
              displayedStations.map((st) => (
                <tr
                  key={st.code}
                  className={
                    st.isAnomaly
                      ? 'bg-[var(--sev-critical-bg)]'
                      : 'hover:bg-[var(--surface-2)]/70'
                  }
                >
                  <td className="py-2.5 pr-4 font-mono font-bold text-[var(--accent)]">
                    {st.code.toUpperCase()}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[var(--text-primary)]">{st.name}</div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tabular-nums">
                      {st.type.toUpperCase()} · {st.lat.toFixed(2)}, {st.lon.toFixed(2)}
                    </div>
                  </td>
                  <td
                    className={`py-2.5 pr-4 font-mono font-bold tabular-nums ${
                      st.isAnomaly ? 'text-[var(--sev-critical)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {st.level}
                  </td>
                  <td
                    className={`py-2.5 pr-4 font-mono font-semibold tabular-nums ${
                      st.isAnomaly ? 'text-[var(--sev-critical)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {st.anomaly}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        st.isAnomaly
                          ? 'bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]'
                          : 'bg-[var(--sev-normal-bg)] text-[var(--sev-normal)]'
                      }`}
                    >
                      {st.isAnomaly && (
                        <AlertTriangle className="h-3 w-3 animate-pulse" />
                      )}
                      {st.status}
                    </span>
                  </td>
                  {onFocusMap && (
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onFocusMap(st.lat, st.lon)}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-3)]"
                        title={`Fokuskan peta ke ${st.name}`}
                      >
                        <Crosshair className="h-3 w-3" />
                        <span>Lihat</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Expand Toggle */}
      {!searchQuery.trim() && statusFilter === 'ALL' && filteredStations.length > 7 && (
        <div className="mt-4 flex justify-center border-t border-[var(--border-hairline)] pt-3">
          <button
            type="button"
            onClick={() => setShowAllRows((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>
              {showAllRows
                ? 'Ringkas daftar pasut'
                : `Tampilkan seluruh ${filteredStations.length} stasiun IOC UNESCO`}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showAllRows ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
