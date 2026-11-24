'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  BellRing,
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
import { useNow } from '@/hooks/useNow';
import {
  ATTENTION_MEANING,
  ATTENTION_SCALE,
  ruleDepthLabel,
  shortRegion,
  type AttentionAssessment,
} from '@/lib/attention';
import { feedStateWord, isDegraded, type FeedHealth } from '@/lib/feeds';
import { TONE_LABEL, type Tone } from '@/lib/severity';
import { formatAge, formatClockStamp, formatDecimal, formatWibDateTime } from '@/lib/time';

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
  /** Shorter chip text for phones; falls back to `label`. */
  shortLabel?: string;
  /** One line on the situation: "M6,1 · Laut Banda · 3 jam lalu". Shown in the chip's popup. */
  headline: string;
  /**
   * What a screen reader is told when the status changes. Defaults to `headline`; set it
   * when the headline carries a relative age, which would otherwise be re-announced as it ticks.
   */
  announcement?: string;
  /** Facts behind the status, shown when the chip is opened. */
  reasons: string[];
  /** Origin of the event (epoch ms): the popup then shows a running T+. */
  sinceMs?: number | null;
  /** When the level is back at RUTIN if nothing new happens (epoch ms). */
  expiresAtMs?: number | null;
  /** The live attention assessment behind an `attention` status, for the popup's full explanation. */
  attention?: AttentionAssessment;
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
  /** Whether location-based notifications are switched on. */
  alertsEnabled?: boolean;
  /** Opens the "Notifikasi lokasi" panel. */
  onOpenAlerts?: () => void;
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
const BMKG_QUAKE_URL = 'https://www.bmkg.go.id/gempabumi';

const MMI_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** "±10 jam lagi", "±25 mnt lagi": a rough wait, since a new earthquake can change it at any time. */
function roughWait(remainingMs: number): string {
  if (remainingMs >= 3_600_000) return `±${Math.round(remainingMs / 3_600_000)} jam lagi`;
  return `±${Math.max(1, Math.round(remainingMs / 60_000))} mnt lagi`;
}

function PopupFooter({ children, href, linkText }: { children: ReactNode; href?: string; linkText?: string }) {
  return (
    <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
      <p className="t-meta text-[var(--text-muted)]">{children}</p>
      {href && linkText && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="t-meta mt-1.5 inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
        >
          {linkText}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

/**
 * The full explanation of the dashboard's own attention level: what the level means, where
 * it sits on the scale, which earthquakes put it there, when it lapses, and that it is not
 * BMKG's status.
 */
function AttentionExplanation({ assessment }: { assessment: AttentionAssessment }) {
  const now = useNow(30_000);
  const { level, raising, counts, expiresAtMs } = assessment;
  const remaining = expiresAtMs !== null && now !== null ? expiresAtMs - now : null;

  return (
    <>
      <p className="t-heading mt-2">{ATTENTION_MEANING[level]}</p>

      <div className="mt-3">
        <p className="t-micro">Skala</p>
        <ol className="mt-1.5 space-y-1">
          {ATTENTION_SCALE.map((step) => {
            const current = step.level === level;
            return (
              <li
                key={step.level}
                data-tone={step.level}
                aria-current={current ? 'true' : undefined}
                className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-1.5 ${
                  current ? 'border-[var(--tone-border)] bg-[var(--tone-bg)]' : 'border-transparent'
                }`}
              >
                <span
                  className={`t-status mt-px w-[6.5rem] shrink-0 ${current ? 'text-[var(--tone)]' : 'text-[var(--text-muted)]'}`}
                >
                  {TONE_LABEL[step.level]}
                </span>
                <span className={`t-meta ${current ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {step.criterion}
                  {current && <span className="sr-only"> (tingkat sekarang)</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {level === 'unknown' && (
          <p className="t-meta mt-1.5 text-[var(--text-muted)]">{assessment.headline}.</p>
        )}
      </div>

      {raising.length > 0 && (
        <div className="mt-3">
          <p className="t-micro">Penyebab</p>
          <ul className="mt-1.5 space-y-2">
            {raising.slice(0, 3).map(({ fact }) => (
              <li key={`${fact.timeMs}-${fact.magnitude}`} className="border-l-2 border-[var(--tone-border)] pl-2.5">
                <p className="t-data text-[var(--text-primary)]">
                  M{formatDecimal(fact.magnitude)}
                  {fact.depthKm !== null && (
                    <span className="text-[var(--text-secondary)]">
                      {' '}
                      · {ruleDepthLabel(fact.depthKm)}
                    </span>
                  )}
                  {fact.feltMmi !== null && fact.feltMmi >= 4 && (
                    <span className="text-[var(--text-secondary)]"> · dirasakan {MMI_NUMERALS[fact.feltMmi]} MMI</span>
                  )}
                </p>
                <p className="t-body">{shortRegion(fact.region, 80)}</p>
                <p className="t-meta text-[var(--text-muted)]">
                  {formatClockStamp(fact.timeMs, now)}
                  {now !== null ? ` · ${formatAge(fact.timeMs, now)}` : ''}
                </p>
              </li>
            ))}
          </ul>
          {raising.length > 3 && (
            <p className="t-meta mt-1 text-[var(--text-muted)]">dan {raising.length - 3} gempa lain dalam 24 jam</p>
          )}
        </div>
      )}

      {expiresAtMs !== null && (
        <p className="t-meta mt-3 rounded-lg bg-[var(--surface-subtle)] px-2.5 py-1.5">
          Turun ke <strong className="text-[var(--text-primary)]">RUTIN</strong>
          {remaining !== null && remaining > 0 ? ` ${roughWait(remaining)}` : ''} (sekitar {formatWibDateTime(expiresAtMs)}) bila
          tidak ada gempa baru.
        </p>
      )}

      {level !== 'unknown' && (
        <dl className="mt-3 grid grid-cols-3 gap-1.5">
          {[
            { label: '24 jam', value: String(counts.last24h) },
            { label: '7 hari', value: String(counts.last7d) },
            { label: 'Terbesar', value: counts.largest7d === null ? '—' : `M${formatDecimal(counts.largest7d)}` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-[var(--border-hairline)] px-2 py-1">
              <dt className="t-micro">{item.label}</dt>
              <dd className="t-data text-[var(--text-primary)]">{item.value}</dd>
            </div>
          ))}
          <p className="t-meta col-span-3 text-[var(--text-muted)]">Jumlah gempa M≥5 dari daftar BMKG.</p>
        </dl>
      )}

      <PopupFooter href={BMKG_QUAKE_URL} linkText="Buka info gempa BMKG">
        Skala buatan dasbor ini, dihitung otomatis dari data gempa BMKG — bukan status resmi dan bukan prakiraan.
        Peringatan gempa dan tsunami resmi hanya dari BMKG.
      </PopupFooter>
    </>
  );
}

function StatusChip({ status, isDrill }: { status: MastheadStatus; isDrill: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const Icon = TONE_ICON[status.tone];
  const solid = status.kind === 'tsunami' || status.tone === 'kritis';
  const iconOnly = status.kind === 'attention';

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

  const title =
    status.kind === 'tsunami'
      ? isDrill
        ? 'Skenario latihan · tsunami'
        : 'Pernyataan tsunami BMKG'
      : isDrill
        ? 'Skenario latihan'
        : 'Tingkat pantauan Sentinel';

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center">
      {iconOnly ? (
        // The attention level is a coloured icon with its own shape per level; its name and
        // meaning are in the tooltip, the accessible name and the popup.
        <button
          type="button"
          data-tone={status.tone}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`${status.label} — lihat penjelasan`}
          title={`${status.label} — klik untuk penjelasan`}
          onClick={() => setOpen((prev) => !prev)}
          className={`tone-chip h-9 w-9 shrink-0 cursor-pointer justify-center !p-0 ${solid ? 'tone-chip--solid' : ''} ${
            isDrill ? 'drill-frame' : ''
          }`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      ) : (
        // A tsunami statement keeps its words: it is the one status that must be read at a glance.
        <button
          type="button"
          data-tone={status.tone}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((prev) => !prev)}
          title="Lihat penjelasan status ini"
          // The chip may shrink, its label truncating, so it never runs under the controls beside it
          className={`tone-chip min-h-8 min-w-0 max-w-full cursor-pointer ${solid ? 'tone-chip--solid' : ''} ${
            isDrill ? 'drill-frame' : ''
          }`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden min-w-0 truncate sm:inline">{status.label}</span>
          <span className="min-w-0 truncate sm:hidden">{status.shortLabel ?? status.label}</span>
        </button>
      )}

      {/* Announced once per change: neither a ticking clock nor a relative age is part of it */}
      <span className="sr-only" role="status" aria-live="polite">
        {status.label}. {status.announcement ?? status.headline}
      </span>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          data-tone={status.tone}
          // Phone: as wide as the masthead (it starts 59px left of the chip there); wider screens: under the chip
          className="alert-surface absolute -left-[59px] top-[calc(100%+10px)] z-10 max-h-[min(72vh,620px)] w-[calc(100vw-24px)] overflow-y-auto rounded-2xl p-4 sm:left-0 sm:w-[min(420px,calc(100vw-272px))]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="t-micro">{title}</p>
            {!isDrill && status.kind === 'attention' && (
              <span className="t-meta rounded border border-dashed border-[var(--border-strong)] px-1.5 text-[var(--text-muted)]">
                tidak resmi
              </span>
            )}
          </div>
          <span data-tone={status.tone} className={`tone-chip mt-2 ${solid ? 'tone-chip--solid' : ''}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {status.kind === 'attention' && !isDrill ? TONE_LABEL[status.tone] : status.label}
          </span>

          {status.attention && !isDrill ? (
            <AttentionExplanation assessment={status.attention} />
          ) : (
            <>
              <p className="t-heading mt-2">{status.headline}</p>
              {status.kind === 'tsunami' && status.sinceMs ? (
                <p className="t-meta mt-1">
                  <EventElapsed since={status.sinceMs} className="t-data text-[var(--text-primary)]" /> sejak gempa
                </p>
              ) : null}
              <ul className="mt-3 space-y-1.5">
                {status.reasons.map((reason) => (
                  <li key={reason} className="t-body flex gap-2 text-[var(--text-secondary)]">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
              <PopupFooter
                href={status.kind === 'tsunami' && !isDrill ? BMKG_TSUNAMI_URL : undefined}
                linkText="Buka peringatan BMKG"
              >
                {isDrill
                  ? 'Seluruh nilai adalah nilai latihan, bukan hasil pemodelan BMKG.'
                  : 'Status per wilayah dan estimasi waktu tiba hanya ada di buletin BMKG.'}
              </PopupFooter>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Says nothing while the feeds are fine — the "Sumber data" panel has the full picture —
 * and names the feed when one is stale, on placeholder data, or failing.
 */
function DataHealth({ feeds, onOpen }: { feeds: FeedHealth[]; onOpen?: () => void }) {
  const degraded = feeds.filter((feed) => isDegraded(feed.state));
  const worst = degraded.find((feed) => feed.key === 'bmkg') ?? degraded[0];
  const others = worst ? degraded.length - 1 : 0;

  if (worst) {
    const critical = worst.key === 'bmkg';
    return (
      <button
        type="button"
        onClick={onOpen}
        data-tone={critical ? 'kritis' : 'meningkat'}
        title={`${worst.label}: ${feedStateWord(worst.state)} — buka panel Sumber Data`}
        className="tone-chip min-h-8 min-w-8 shrink-0 cursor-pointer justify-center"
      >
        <span className="status-dot" data-state={worst.state} aria-hidden="true" />
        {/* The words need room a phone's masthead does not have; there the dot stands for them */}
        <span className="sr-only normal-case tracking-normal sm:not-sr-only">
          {worst.label}: {feedStateWord(worst.state)}
          {others > 0 ? ` +${others}` : ''}
        </span>
      </button>
    );
  }

  return null;
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
  alertsEnabled = false,
  onOpenAlerts,
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

        {onOpenAlerts && (
          <button
            type="button"
            onClick={onOpenAlerts}
            aria-label={`Notifikasi lokasi: ${alertsEnabled ? 'aktif' : 'nonaktif'} — buka pengaturan`}
            title={alertsEnabled ? 'Notifikasi lokasi aktif — buka pengaturan' : 'Atur notifikasi lokasi'}
            // Below `lg` the dock on the map has this panel; the masthead keeps its width for the status
            className={`icon-btn hidden lg:inline-flex ${alertsEnabled ? 'text-[var(--accent)]' : ''}`}
          >
            {alertsEnabled ? (
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}

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
            className="icon-btn"
          >
            {theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}

        {/* Operation mode: icons only; the names stay as the accessible name and the tooltip */}
        <div
          className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-0.5"
          role="group"
          aria-label="Mode operasi"
        >
          <button
            type="button"
            aria-pressed={!isDrill}
            aria-label="Operasi Live"
            title="Operasi Live — umpan publik BMKG, USGS, IOC dan PVMBG"
            onClick={() => onModeChange('REAL')}
            className={`inline-flex min-h-7 min-w-9 items-center justify-center rounded-full px-2.5 transition-colors ${
              !isDrill
                ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={isDrill}
            aria-label="Simulasi"
            title="Mode simulasi — latihan skenario tsunami"
            onClick={() => onModeChange('SIMULASI')}
            className={`inline-flex min-h-7 min-w-9 items-center justify-center rounded-full px-2.5 transition-colors ${
              isDrill
                ? 'bg-[var(--drill-border)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
