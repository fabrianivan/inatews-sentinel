'use client';

import { Microscope, Mountain } from 'lucide-react';

interface VolcanoChipProps {
  name: string;
  selected: boolean;
  /** Number of MAGMA PVMBG reports currently in the feed for this volcano. */
  reportCount?: number;
  /** `sm` for the map HUD strip, `md` for full-width panels. */
  size?: 'sm' | 'md';
  onSelect: () => void;
  onAnalyze: () => void;
}

/**
 * Volcano selector chip with its own "Analisis PVMBG" action, so the analysis
 * modal is one click away for every volcano instead of only the selected one.
 */
export default function VolcanoChip({
  name,
  selected,
  reportCount = 0,
  size = 'md',
  onSelect,
  onAnalyze,
}: VolcanoChipProps) {
  const sm = size === 'sm';

  return (
    <div
      role="group"
      aria-label={`G. ${name}`}
      data-selected={selected}
      className={`inline-flex shrink-0 items-stretch overflow-hidden border transition-colors ${
        sm ? 'rounded-full text-[10px]' : 'rounded-lg text-xs'
      } ${
        selected
          ? 'border-[var(--sev-high-border)] bg-[var(--sev-high-bg)]'
          : 'border-[var(--border-hairline)] bg-[var(--surface-2)]'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        title={`Tampilkan seismograf G. ${name}`}
        className={`inline-flex items-center font-semibold transition-colors ${
          sm ? 'min-h-6 gap-1 pl-2 pr-1.5' : 'gap-1.5 py-1.5 pl-2.5 pr-2'
        } ${
          selected
            ? 'text-[var(--sev-high)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Mountain className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
        <span>{sm ? name : `G. ${name}`}</span>
        {reportCount > 0 &&
          (sm ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--sev-critical)]"
              title={`${reportCount} laporan MAGMA PVMBG`}
            />
          ) : (
            <span
              className="rounded bg-[var(--sev-critical)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white"
              title={`${reportCount} laporan MAGMA PVMBG`}
            >
              {reportCount}
            </span>
          ))}
      </button>

      <button
        type="button"
        onClick={onAnalyze}
        aria-label={`Analisis PVMBG G. ${name}`}
        title={`Analisis PVMBG — G. ${name}`}
        className={`inline-flex items-center justify-center border-l text-[var(--satellite-purple)] transition-colors hover:bg-[var(--surface-3)] ${
          sm ? 'min-h-6 px-1.5' : 'px-2'
        } ${selected ? 'border-[var(--sev-high-border)]' : 'border-[var(--border-hairline)]'}`}
      >
        <Microscope className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      </button>
    </div>
  );
}
