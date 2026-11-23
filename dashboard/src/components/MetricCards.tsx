'use client';

import { TONE_LABEL, toTone, type Tone } from '@/lib/severity';
import type { ActivityIndex } from '@/lib/types';

interface MetricCardsProps {
  oceanStatus: string;
  weatherStatus: string;
  /** Only shown in a drill: outside one, no feed reports infrastructure status. */
  infraStatus?: string;
  /** Only its drill deformation text is shown: outside a drill no feed reports deformation. */
  activityIndex: ActivityIndex | null;
  /** Render tanpa pembungkus kartu (untuk disematkan di panel HUD peta). */
  bare?: boolean;
  /** True while a drill is running: every value is then a scenario value, not a feed reading. */
  isSimulasi?: boolean;
}

interface MetricRow {
  label: string;
  /** Feed the value comes from; absent when nothing reports this parameter. */
  source?: string;
  value?: string | null;
}

/**
 * A status counts as enumerated only when it is a single recognised severity
 * word. Anything longer is free text and stays neutral: guessing a colour from
 * a substring would invent a severity nobody reported.
 */
function enumeratedTone(value: string): Tone | null {
  if (!/^[A-Za-z]+$/.test(value)) return null;
  const tone = toTone(value);
  return tone === 'unknown' ? null : tone;
}

function MetricValue({ value }: { value: string }) {
  const tone = enumeratedTone(value);
  if (!tone) {
    return <span className="t-data min-w-0 break-words text-right text-[var(--text-primary)]">{value}</span>;
  }
  return (
    <span data-tone={tone} className="t-status inline-flex items-center gap-1.5 text-[var(--tone)]">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--tone-border)]" />
      {TONE_LABEL[tone]}
    </span>
  );
}

export default function MetricCards({
  oceanStatus,
  weatherStatus,
  infraStatus,
  activityIndex,
  bare = false,
  isSimulasi = false,
}: MetricCardsProps) {
  const rows: MetricRow[] = isSimulasi
    ? [
        { label: 'Muka laut', value: oceanStatus },
        { label: 'Kondisi pesisir', value: weatherStatus },
        { label: 'Deformasi GPS / InSAR', value: activityIndex?.deformation_trend },
        { label: 'Infrastruktur vital', value: infraStatus },
      ]
    : [
        { label: 'Pasut & muka laut', source: 'IOC', value: oceanStatus },
        { label: 'Cuaca maritim', source: 'Open-Meteo', value: weatherStatus },
        { label: 'Telemetri stasiun seismik' },
        { label: 'Deformasi GPS / InSAR' },
        { label: 'Infrastruktur vital' },
      ];

  return (
    <div className={bare ? '' : 'matte-card p-5'}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="t-micro">Parameter Lintas Sensor</h3>
        {isSimulasi && <span className="drill-chip">SIMULASI</span>}
      </div>
      <ul className="divide-y divide-[var(--border-hairline)]">
        {rows.map((row) => {
          const value = row.value?.trim();
          const hasSource = isSimulasi || Boolean(row.source);
          return (
            <li key={row.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="t-meta">{row.label}</span>
                {isSimulasi ? (
                  <span className="t-micro rounded border border-[var(--drill-border)] px-1.5 text-[var(--drill)]">
                    nilai latihan
                  </span>
                ) : (
                  row.source && (
                    <span className="t-micro rounded border border-[var(--border-hairline)] px-1.5 normal-case">
                      {row.source}
                    </span>
                  )
                )}
              </span>
              {hasSource && value ? (
                <MetricValue value={value} />
              ) : (
                <span className="t-meta text-[var(--text-muted)]">
                  {hasSource ? 'tidak tersedia' : 'tidak ada sumber data'}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
