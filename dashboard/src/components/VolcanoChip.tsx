'use client';

import { Microscope, Mountain } from 'lucide-react';
import { officialTone, parseVolcanoLevel } from '@/lib/severity';

export const CATALOGUE_LEVEL_NOTE =
  'Tingkat aktivitas dari katalog bawaan — verifikasi di MAGMA Indonesia (magma.esdm.go.id)';

/**
 * A volcano's activity level, quoted from the built-in catalogue: PVMBG's own
 * words in an outline chip, tagged "katalog" so it is never read as a live
 * PVMBG status. Text that names no level reads "Level tidak diketahui".
 */
export function CatalogueLevelChip({ levelText }: { levelText: string | null | undefined }) {
  const info = parseVolcanoLevel(levelText);

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" title={CATALOGUE_LEVEL_NOTE}>
      <span
        className="tone-chip tone-chip--outline"
        data-tone={info ? officialTone(info.level) : 'unknown'}
      >
        {info ? info.label : 'Level tidak diketahui'}
      </span>
      <span className="t-meta text-[var(--text-muted)]">katalog</span>
    </span>
  );
}

interface VolcanoChipProps {
  name: string;
  selected: boolean;
  /** Number of eruption reports currently in the feed for this volcano. */
  reportCount?: number;
  /** Catalogue activity level text (e.g. "LEVEL III (SIAGA)"), quoted in the chip. */
  catalogueLevel?: string;
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
  catalogueLevel,
  size = 'md',
  onSelect,
  onAnalyze,
}: VolcanoChipProps) {
  const sm = size === 'sm';
  const level = parseVolcanoLevel(catalogueLevel);
  const levelNote = level ? ` · ${level.label} (katalog)` : '';
  const reportNote = `${reportCount} laporan erupsi di umpan`;

  return (
    <div
      role="group"
      aria-label={`G. ${name}`}
      data-selected={selected}
      className={`inline-flex shrink-0 items-stretch overflow-hidden border transition-colors ${
        sm ? 'rounded-full text-[11px]' : 'rounded-lg text-xs'
      } ${
        selected
          ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
          : 'border-[var(--border-hairline)] bg-[var(--surface-2)]'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        title={`Tampilkan ilustrasi seismograf G. ${name}${levelNote}`}
        // The wrapper clips its children to its rounded border, so the focus ring is drawn inside the button.
        className={`inline-flex items-center font-semibold transition-colors focus-visible:-outline-offset-2 ${
          sm ? 'min-h-6 gap-1 pl-2 pr-1.5' : 'min-h-8 gap-1.5 pl-2.5 pr-2'
        } ${
          selected
            ? 'text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Mountain className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
        <span>{sm ? name : `G. ${name}`}</span>
        {!sm && level && (
          <span data-tone={officialTone(level.level)} className="tone-text font-mono" aria-hidden="true">
            {level.roman}
          </span>
        )}
        {level && <span className="sr-only">{levelNote}</span>}
        {reportCount > 0 &&
          (sm ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--info)]" title={reportNote}>
              <span className="sr-only">{reportNote}</span>
            </span>
          ) : (
            <span
              className="rounded border border-[var(--info-border)] bg-[var(--info-bg)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--info)]"
              title={reportNote}
            >
              {reportCount}
              <span className="sr-only"> laporan erupsi di umpan</span>
            </span>
          ))}
      </button>

      <button
        type="button"
        onClick={onAnalyze}
        aria-label={`Analisis PVMBG G. ${name}`}
        title={`Analisis PVMBG — G. ${name}`}
        className={`inline-flex items-center justify-center border-l text-[var(--accent)] transition-colors hover:bg-[var(--surface-3)] focus-visible:-outline-offset-2 ${
          sm ? 'min-h-6 min-w-6 px-1.5' : 'min-h-8 min-w-8 px-2'
        } ${selected ? 'border-[var(--accent-border)]' : 'border-[var(--border-hairline)]'}`}
      >
        <Microscope className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      </button>
    </div>
  );
}
