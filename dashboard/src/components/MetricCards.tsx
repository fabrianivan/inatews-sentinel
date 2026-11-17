'use client';

import type { ActivityIndex } from '@/lib/types';

interface MetricCardsProps {
  oceanStatus: string;
  weatherStatus: string;
  infraStatus?: string;
  activityIndex: ActivityIndex | null;
  /** Render tanpa pembungkus kartu (untuk disematkan di panel HUD peta). */
  bare?: boolean;
}

function statusTone(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('CRITICAL') || s.includes('ANOMAL') || s.includes('TSUNAMI') || s.includes('EVAKUASI')) {
    return 'text-[var(--sev-critical)]';
  }
  if (s.includes('ELEVATED') || s.includes('WARNING') || s.includes('SIAGA') || s.includes('CLIPPING')) {
    return 'text-[var(--sev-high)]';
  }
  return 'text-[var(--sev-normal)]';
}

export default function MetricCards({
  oceanStatus,
  weatherStatus,
  infraStatus = 'OPERASIONAL',
  activityIndex,
  bare = false,
}: MetricCardsProps) {
  const deformation = activityIndex?.deformation_trend || 'TERPANTAU';
  const deformAlert =
    deformation.includes('INCREASING') ||
    deformation.includes('RUPTURE') ||
    deformation.includes('SLIP');

  const rows = [
    { label: 'Jaringan Buoy & Pasut IOC', value: oceanStatus, tone: statusTone(oceanStatus) },
    { label: 'Triangulasi Gelombang P/S', value: 'REAL-TIME (±0.4s)', tone: 'text-[var(--sev-normal)]' },
    { label: 'Cuaca Maritim Open-Meteo', value: weatherStatus, tone: statusTone(weatherStatus) },
    {
      label: 'Deformasi GPS / InSAR',
      value: deformation,
      tone: deformAlert ? 'text-[var(--sev-high)]' : 'text-[var(--text-primary)]',
    },
    { label: 'Infrastruktur Vital', value: infraStatus, tone: statusTone(infraStatus) },
  ];

  return (
    <div className={bare ? '' : 'matte-card p-5'}>
      <div className="mb-3 font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
        Parameter Lintas Sensor
      </div>
      <div className="divide-y divide-[var(--border-hairline)]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <span className="text-[var(--text-secondary)]">{row.label}</span>
            <span className={`truncate font-mono text-[11px] font-bold ${row.tone}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
