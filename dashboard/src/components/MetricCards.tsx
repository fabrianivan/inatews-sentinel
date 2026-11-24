'use client';

import { TONE_LABEL, toTone, type Tone } from '@/lib/severity';
import type { ActivityIndex } from '@/lib/types';

interface MetricCardsProps {
  /** Empty or null when the feed has no reading: the row then says "tidak tersedia". */
  oceanStatus: string | null;
  weatherStatus: string | null;
  /** Only shown in a drill: outside one, no feed reports infrastructure status. */
  infraStatus?: string;
  /** Only its drill deformation text is shown: outside a drill no feed reports deformation. */
  activityIndex: ActivityIndex | null;
  /** Render tanpa pembungkus kartu (untuk disematkan di panel HUD peta). */
  bare?: boolean;
  /** True while a drill is running: every value is then a scenario value, not a feed reading. */
  isSimulasi?: boolean;
  /**
   * True when the statuses come from the Go backend (a payload without provenance): they
   * are then the backend's own wording, shown as such and never mapped to a tone.
   */
  fromBackend?: boolean;
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

/**
 * Standalone statuses open with the agency they come from ("BMKG: …", "IOC: …"). That
 * prefix, when present, is the row's source — a BMKG statement must not sit under an IOC tag.
 */
function splitSource(value: string, fallback: string | undefined): { source: string | undefined; text: string } {
  const match = /^(BMKG|IOC|Open-Meteo|PVMBG|USGS):\s*(\S.*)$/i.exec(value);
  return match ? { source: match[1], text: match[2] } : { source: fallback, text: value };
}

function MetricValue({ value, plain = false }: { value: string; plain?: boolean }) {
  const tone = plain ? null : enumeratedTone(value);
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
  fromBackend = false,
}: MetricCardsProps) {
  const rows: MetricRow[] = isSimulasi
    ? [
        { label: 'Muka laut', value: oceanStatus },
        { label: 'Kondisi pesisir', value: weatherStatus },
        { label: 'Deformasi GPS / InSAR', value: activityIndex?.deformation_trend },
        { label: 'Infrastruktur vital', value: infraStatus },
      ]
    : [
        { label: 'Pasut & muka laut', source: fromBackend ? 'backend' : 'IOC', value: oceanStatus },
        { label: 'Cuaca maritim', source: fromBackend ? 'backend' : 'Open-Meteo', value: weatherStatus },
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
          const raw = row.value?.trim();
          const { source, text: value } =
            raw && !isSimulasi && !fromBackend ? splitSource(raw, row.source) : { source: row.source, text: raw };
          const hasSource = isSimulasi || Boolean(source);
          return (
            <li key={row.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="t-meta">{row.label}</span>
                {isSimulasi ? (
                  <span className="t-micro rounded border border-[var(--drill-border)] px-1.5 text-[var(--drill)]">
                    nilai latihan
                  </span>
                ) : (
                  source && (
                    <span className="t-micro rounded border border-[var(--border-hairline)] px-1.5 normal-case">
                      {source}
                    </span>
                  )
                )}
              </span>
              {hasSource && value ? (
                <MetricValue value={value} plain={fromBackend} />
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
