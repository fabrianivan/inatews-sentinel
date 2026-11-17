'use client';

import { useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, ShieldAlert, Waves, X } from 'lucide-react';
import type { TsunamiScenario } from '@/lib/types';

interface TsunamiPanelProps {
  scenario: TsunamiScenario;
  isSimulasi?: boolean;
  onDismiss?: () => void;
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString('id-ID', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export default function TsunamiPanel({
  scenario,
  isSimulasi = false,
  onDismiss,
}: TsunamiPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!scenario.active) return null;

  return (
    <div
      role="alert"
      className="matte-card border-l-4 border-l-[var(--sev-critical)] bg-[var(--sev-critical-bg)] px-5 py-3.5 text-[var(--text-primary)]"
    >
      {/* Compact Critical Ticker Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--sev-critical)] text-slate-950">
            <span className="animate-ping absolute inset-0 rounded-xl bg-[var(--sev-critical)] opacity-45" />
            <AlertOctagon className="relative h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold tracking-wide text-[var(--sev-critical)] uppercase">
                PERINGATAN TSUNAMI {isSimulasi ? '(SIMULASI)' : 'AKTIF'}
              </span>
              <span className="rounded-full border border-[var(--sev-critical-border)] bg-[var(--surface-1)] px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[var(--sev-critical)]">
                CREST +{scenario.wave_anomaly?.toFixed(2)} m
              </span>
              <span className="hidden rounded-full bg-[var(--accent-muted)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent)] md:inline">
                ~720 km/jam · Laut Dalam
              </span>
              <span className="hidden font-mono text-[10px] text-[var(--text-secondary)] xl:inline">
                {scenario.sensor_id} · {formatTime(scenario.detection_time)} WIB
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--text-primary)]">
              Zona terdampak: {scenario.affected_zones?.join(' · ') || 'Wilayah Pesisir'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--sev-critical-border)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
          >
            <span>{expanded ? 'Tutup Detail' : 'Arahan Evakuasi'}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Sembunyikan banner peringatan"
              title="Sembunyikan sementara"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Evacuation & Zone Matrix */}
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--sev-critical-border)] pt-3 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[var(--text-secondary)] uppercase">
              <Waves className="h-3.5 w-3.5 text-[var(--ocean-cyan)]" />
              <span>Zona Berpotensi Terdampak ({scenario.severity})</span>
            </div>
            <ul className="space-y-1 text-xs text-[var(--text-primary)]">
              {scenario.affected_zones?.map((zone, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--sev-critical)]" />
                  <span>{zone}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[var(--text-secondary)] uppercase">
              <ShieldAlert className="h-3.5 w-3.5 text-[var(--sev-high)]" />
              <span>Instruksi Respons Cepat</span>
            </div>
            <ul className="space-y-1 text-xs text-[var(--text-primary)]">
              {scenario.response_actions?.map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] font-bold text-[var(--sev-critical)]">
                    {i + 1}.
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
