'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CircleDot,
  CircleHelp,
  ExternalLink,
  FlaskConical,
  Moon,
  OctagonAlert,
  Radio,
  ShieldAlert,
  Sun,
  TriangleAlert,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { EventElapsed, WallClock } from './SentinelClocks';
import { feedStateWord, isDegraded, type FeedHealth } from '@/lib/feeds';
import type { Tone } from '@/lib/severity';
import { formatWibDateTime } from '@/lib/time';

export type DashboardMode = 'REAL' | 'SIMULASI';

/** What the masthead says about the situation right now. */
export interface MastheadStatus {
  /**
   * `attention` is the dashboard's own unofficial level; `tsunami` is a
   * statement in force — BMKG's words in the live view, the scenario in a drill.
   */
  kind: 'attention' | 'tsunami';
  tone: Tone;
  /** Chip text: "PANTAUAN · MENINGKAT", "BMKG: BERPOTENSI TSUNAMI". */
  label: string;
  /** One line beside the chip: "M6,1 · Laut Banda · 3 jam lalu". */
  headline: string;
  /** Facts behind the status, shown when the chip is opened. */
  reasons: string[];
  /** Origin of the event (epoch ms): the masthead then shows a running T+. */
  sinceMs?: number | null;
  /** When the level returns to RUTIN if nothing new happens (epoch ms). */
  expiresAtMs?: number | null;
}

interface StatusBarProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  status: MastheadStatus;
  feeds: FeedHealth[];
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  /** Opens the "Sumber Data" panel. */
  onOpenSources?: () => void;
}

/** Each tone has its own icon shape, so the status never depends on colour alone. */
const TONE_ICON: Record<Tone, LucideIcon> = {
  unknown: CircleHelp,
  rutin: CircleDot,
  meningkat: TriangleAlert,
  tinggi: ShieldAlert,
  kritis: OctagonAlert,
};

const BMKG_TSUNAMI_URL = 'https://www.bmkg.go.id/gempabumi/berpotensi-tsunami';

function StatusChip({ status, isDrill }: { status: MastheadStatus; isDrill: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const Icon = TONE_ICON[status.tone];
  const solid = status.kind === 'tsunami' || status.tone === 'kritis';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center gap-2.5">
      <button
        type="button"
        data-tone={status.tone}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        title="Lihat dasar status ini"
        className={`tone-chip min-h-8 shrink-0 cursor-pointer ${solid ? 'tone-chip--solid' : ''} ${
          isDrill ? 'drill-frame' : ''
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{status.label}</span>
      </button>

      <p className="hidden min-w-0 items-baseline gap-2 lg:flex">
        <span className="t-meta max-w-[30ch] truncate xl:max-w-[44ch]" title={status.headline}>
          {status.headline}
        </span>
        {status.kind === 'tsunami' && status.sinceMs ? (
          <EventElapsed since={status.sinceMs} className="t-data shrink-0 text-[var(--text-primary)]" />
        ) : null}
      </p>

      {/* Announced once per change; the ticking clock above is not part of it */}
      <span className="sr-only" role="status" aria-live="polite">
        {status.label}. {status.headline}
      </span>

      {open && (
        <div
          role="dialog"
          aria-label="Dasar status"
          className="alert-surface absolute left-0 top-[calc(100%+10px)] z-10 w-[min(92vw,380px)] rounded-2xl p-4"
          data-tone={status.tone}
        >
          <p className="t-micro">
            {status.kind === 'tsunami'
              ? isDrill
                ? 'Skenario latihan'
                : 'Pernyataan BMKG'
              : 'Tingkat pantauan Sentinel · tidak resmi'}
          </p>
          <p className="t-heading mt-1">{status.headline}</p>

          <ul className="mt-3 space-y-1.5">
            {status.reasons.map((reason) => (
              <li key={reason} className="t-body flex gap-2 text-[var(--text-secondary)]">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          {status.kind === 'attention' && status.expiresAtMs ? (
            <p className="t-meta mt-3">
              Kembali ke RUTIN sekitar {formatWibDateTime(status.expiresAtMs)} jika tidak ada gempa baru.
            </p>
          ) : null}

          <p className="t-meta mt-3 border-t border-[var(--border-hairline)] pt-3 text-[var(--text-muted)]">
            {status.kind === 'attention'
              ? 'Dihitung dari data BMKG 24 jam terakhir: gempa M≥5 dangkal atau dirasakan luas. Bukan prakiraan dan bukan peringatan BMKG.'
              : isDrill
                ? 'Seluruh nilai adalah nilai latihan, bukan hasil pemodelan BMKG.'
                : 'Status per wilayah dan estimasi waktu tiba hanya ada di buletin BMKG.'}
          </p>

          {status.kind === 'tsunami' && !isDrill && (
            <a
              href={BMKG_TSUNAMI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="t-meta mt-2 inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
            >
              Buka peringatan BMKG
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Quiet when every feed is live; names the feed when one is not. */
function DataHealth({ feeds, onOpen }: { feeds: FeedHealth[]; onOpen?: () => void }) {
  const degraded = feeds.filter((feed) => isDegraded(feed.state));
  const bmkg = feeds.find((feed) => feed.key === 'bmkg');
  const loading = bmkg?.state === 'loading';
  const worst = degraded.find((feed) => feed.key === 'bmkg') ?? degraded[0];
  const others = worst ? degraded.length - 1 : 0;

  if (worst) {
    const critical = worst.key === 'bmkg';
    return (
      <button
        type="button"
        onClick={onOpen}
        data-tone={critical ? 'kritis' : 'meningkat'}
        title="Buka panel Sumber Data"
        className="tone-chip min-h-8 shrink-0 cursor-pointer"
      >
        <span className="status-dot" data-state={worst.state} aria-hidden="true" />
        <span className="normal-case tracking-normal">
          {worst.label}: {feedStateWord(worst.state)}
          {others > 0 ? ` +${others}` : ''}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Buka panel Sumber Data"
      className="t-meta hidden shrink-0 cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 hover:text-[var(--text-primary)] md:inline-flex"
    >
      <span className="status-dot" data-state={loading ? undefined : 'live'} aria-hidden="true" />
      <span>{loading ? 'Memuat data…' : 'Data langsung'}</span>
    </button>
  );
}

export default function StatusBar({
  mode,
  onModeChange,
  status,
  feeds,
  theme = 'dark',
  onToggleTheme,
  isAudioMuted = true,
  onToggleAudio,
  onOpenSources,
}: StatusBarProps) {
  const isDrill = mode === 'SIMULASI';

  return (
    <div className="glass-hud mx-auto flex h-[var(--masthead-height)] max-w-[1600px] items-center justify-between gap-3 rounded-2xl px-3 sm:px-4">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5">
        <BrandLogo size={34} />
        <div className="hidden sm:block">
          <h1 className="font-display text-[15px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
            INATEWS <span className="text-[var(--accent)]">SENTINEL</span>
          </h1>
          <p className="t-meta hidden leading-tight text-[var(--text-muted)] md:block">
            Dasbor pemantauan tidak resmi
          </p>
        </div>
        <h1 className="sr-only sm:hidden">INATEWS SENTINEL — dasbor pemantauan tidak resmi</h1>
      </div>

      {/* Status: the one thing that must be readable at any width */}
      <div className="flex min-w-0 flex-1 items-center sm:pl-2">
        <StatusChip status={status} isDrill={isDrill} />
      </div>

      {/* Clock, data health and controls */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-1 lg:flex">
          <WallClock />
        </div>

        <DataHealth feeds={feeds} onOpen={onOpenSources} />

        {onToggleAudio && (
          <button
            type="button"
            onClick={onToggleAudio}
            aria-pressed={!isAudioMuted}
            aria-label="Nada peringatan"
            title={isAudioMuted ? 'Aktifkan nada peringatan' : 'Bisukan nada peringatan'}
            className="icon-btn"
          >
            {isAudioMuted ? (
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            className="icon-btn hidden sm:inline-flex"
          >
            {theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}

        {/* Operation mode: icon + short label, icon only on phones */}
        <div
          className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-0.5"
          role="group"
          aria-label="Mode operasi"
        >
          <button
            type="button"
            aria-pressed={!isDrill}
            aria-label="Operasi Live"
            title="Operasi Live — data sensor real-time"
            onClick={() => onModeChange('REAL')}
            className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-colors sm:px-3 ${
              !isDrill
                ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Radio className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">LIVE</span>
          </button>
          <button
            type="button"
            aria-pressed={isDrill}
            aria-label="Simulasi"
            title="Mode simulasi — latihan skenario tsunami"
            onClick={() => onModeChange('SIMULASI')}
            className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-colors sm:px-3 ${
              isDrill
                ? 'bg-[var(--drill-border)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">SIMULASI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
