'use client';

import { useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ExternalLink,
  OctagonAlert,
  type LucideIcon,
} from 'lucide-react';
import { EventElapsed, ScenarioClock, useScenarioSeconds } from './SentinelClocks';
import {
  PD1_LATENCY_MIN,
  formatApproxMinutes,
  nextArrival,
  warningLeadMin,
  zoneArrivals,
  type DrillPhase,
  type DrillScenario,
} from '@/lib/drillScenarios';
import {
  OFFICIAL_LEVEL_LABEL,
  TSUNAMI_LEVEL_ADVICE,
  officialTone,
  tsunamiLevelFromHeight,
  type Tone,
  type TsunamiWarningLevel,
} from '@/lib/severity';
import { isNoticeInForce, type TsunamiNotice } from '@/lib/tsunamiNotice';
import { formatDecimal, formatWibTime, toMillis } from '@/lib/time';
import type { TsunamiScenario } from '@/lib/types';

const BMKG_TSUNAMI_URL = 'https://www.bmkg.go.id/gempabumi/berpotensi-tsunami';

/** BMKG's standing guidance: at the coast, the shaking itself is the warning. */
const NATURAL_WARNING =
  'Guncangan kuat atau lama di pantai: segera evakuasi mandiri ke tempat tinggi, jangan menunggu peringatan.';

const LEVEL_ORDER: TsunamiWarningLevel[] = ['awas', 'siaga', 'waspada'];

// ---------------------------------------------------------------------------
// Shared frame
// ---------------------------------------------------------------------------

interface CardFrameProps {
  tone: Tone;
  /** Solid header: reserved for a statement that is in force. */
  solid: boolean;
  isDrill?: boolean;
  icon: LucideIcon;
  /** Static headline; announced once when the card appears. */
  title: string;
  /** Short running value shown beside the title when collapsed. */
  collapsedDetail?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: ReactNode;
}

function CardFrame({
  tone,
  solid,
  isDrill = false,
  icon: Icon,
  title,
  collapsedDetail,
  collapsed,
  onToggleCollapsed,
  children,
}: CardFrameProps) {
  return (
    <section
      data-tone={tone}
      aria-label={title}
      className={`alert-surface overflow-hidden rounded-2xl ${isDrill ? 'drill-frame' : ''}`}
    >
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 ${
          solid ? 'bg-[var(--tone-solid)] text-[var(--tone-ink)]' : 'text-[var(--tone)]'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {/* Only the static headline is an alert; clocks beside it must not be re-announced */}
        <p role="alert" className="t-status min-w-0 flex-1 truncate">
          {title}
        </p>
        {collapsed && collapsedDetail ? (
          <span className="t-data shrink-0 opacity-95">{collapsedDetail}</span>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Buka rincian peringatan' : 'Ringkas kartu peringatan'}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/40 hover:bg-black/10"
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {!collapsed && <div className="space-y-3 px-3.5 pb-3.5 pt-3">{children}</div>}
    </section>
  );
}

function NaturalWarning() {
  return (
    <p className="t-body rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3 py-2 font-semibold">
      {NATURAL_WARNING}
    </p>
  );
}

/** The three official levels with BMKG's advice for each — a legend, never a status. */
function OfficialLevelLegend({ caption }: { caption: string }) {
  return (
    <div>
      <p className="t-micro mb-1.5">{caption}</p>
      <ul className="space-y-1">
        {LEVEL_ORDER.map((level) => (
          <li key={level} className="flex items-center gap-2">
            <span data-tone={officialTone(level)} className="tone-chip tone-chip--outline min-w-[5.5rem] justify-center">
              {OFFICIAL_LEVEL_LABEL[level]}
            </span>
            <span className="t-meta">{TSUNAMI_LEVEL_ADVICE[level]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live view: BMKG's statement, quoted — nothing estimated
// ---------------------------------------------------------------------------

interface BmkgCardProps {
  notice: TsunamiNotice;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Operator records that BMKG has ended the warning. */
  onAcknowledge: () => void;
}

const NOTICE_TITLE: Record<TsunamiNotice['status'], string> = {
  active: 'BMKG: berpotensi tsunami',
  unconfirmed: 'BMKG: berpotensi tsunami',
  ended: 'BMKG menyatakan peringatan berakhir',
  acknowledged: 'Ditandai berakhir oleh operator',
  expired: 'Pernyataan tsunami lebih dari 6 jam lalu',
};

function noticeSubline(notice: TsunamiNotice): string | null {
  switch (notice.status) {
    case 'unconfirmed':
      return `Pernyataan terakhir terlihat ${formatWibTime(notice.lastSeenMs, { seconds: false })}. Umpan publik sudah berganti ke gempa lain — status terkini hanya ada di BMKG.`;
    case 'ended':
      return 'Teks penghentian peringatan terlihat pada umpan BMKG. Verifikasi di laman BMKG.';
    case 'acknowledged':
      return 'Operator mencatat bahwa BMKG mengakhiri peringatan. Verifikasi di laman BMKG.';
    case 'expired':
      return 'Tidak ada kabar penghentian pada umpan publik. Periksa status terkini di BMKG.';
    default:
      return null;
  }
}

export function BmkgTsunamiCard({ notice, collapsed, onToggleCollapsed, onAcknowledge }: BmkgCardProps) {
  const [confirming, setConfirming] = useState(false);
  const inForce = isNoticeInForce(notice);
  const { quake } = notice;
  const magnitude = parseFloat(quake.Magnitude);
  const subline = noticeSubline(notice);
  const origin = toMillis(quake.DateTime);

  return (
    <CardFrame
      tone={inForce ? 'kritis' : 'unknown'}
      solid={inForce}
      icon={inForce ? OctagonAlert : CircleHelp}
      title={NOTICE_TITLE[notice.status]}
      collapsedDetail={inForce && origin !== null ? <EventElapsed since={origin} /> : undefined}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      {subline && <p className="t-body text-[var(--text-secondary)]">{subline}</p>}

      {origin !== null && (
        <div>
          <EventElapsed since={origin} className="t-hero block text-[2rem] text-[var(--text-primary)]" />
          <p className="t-meta mt-1">sejak gempa</p>
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="t-micro">Magnitudo</dt>
        <dd className="t-data">{Number.isFinite(magnitude) ? `M${formatDecimal(magnitude)}` : '—'}</dd>
        <dt className="t-micro">Waktu</dt>
        <dd className="t-data">
          {quake.Tanggal} · {origin !== null ? formatWibTime(origin) : quake.Jam}
        </dd>
        <dt className="t-micro">Lokasi</dt>
        <dd className="t-body">
          <span className="t-data">
            {quake.Lintang}, {quake.Bujur}
          </span>
          <br />
          {quake.Wilayah}
        </dd>
        <dt className="t-micro">Kedalaman</dt>
        <dd className="t-data">{quake.Kedalaman}</dd>
      </dl>

      <figure>
        <figcaption className="t-micro mb-1">Keterangan BMKG</figcaption>
        <blockquote className="t-body border-l-2 border-[var(--tone-border)] pl-3 font-semibold">
          {notice.statement}
        </blockquote>
      </figure>

      <NaturalWarning />

      <p className="t-meta">
        Status per wilayah dan estimasi waktu tiba tidak ada di umpan publik. Dasbor ini tidak
        memperkirakannya.
      </p>

      <a
        href={BMKG_TSUNAMI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-3 text-[13px] font-bold text-[var(--surface-1)] hover:opacity-90"
      >
        Buka peringatan BMKG
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>

      <OfficialLevelLegend caption="Status per wilayah ditetapkan BMKG" />

      {inForce && (
        <div className="border-t border-[var(--border-hairline)] pt-3">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-meta flex-1">Catat bahwa BMKG telah mengakhiri peringatan ini?</span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onAcknowledge();
                }}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 text-[12px] font-semibold text-[var(--text-primary)]"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Ya, berakhir
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="inline-flex min-h-8 items-center rounded-lg px-2.5 text-[12px] font-semibold text-[var(--text-secondary)]"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="t-meta font-semibold text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
            >
              Tandai: BMKG menyatakan berakhir
            </button>
          )}
        </div>
      )}
    </CardFrame>
  );
}

// ---------------------------------------------------------------------------
// Drill: scenario estimates, marked as training values everywhere
// ---------------------------------------------------------------------------

interface DrillCardProps {
  scenario: DrillScenario;
  phase: DrillPhase;
  phaseEnteredAtMs: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function DrillTsunamiCard({ scenario, phase, phaseEnteredAtMs, collapsed, onToggleCollapsed }: DrillCardProps) {
  const scenarioSec = useScenarioSeconds(phase, phaseEnteredAtMs);
  const arrivals = zoneArrivals(scenario.zones, scenarioSec);
  const upcoming = nextArrival(arrivals);
  const topLevel = tsunamiLevelFromHeight(scenario.tsunamiHeight) ?? 'waspada';
  const lead = warningLeadMin(scenario);

  return (
    <CardFrame
      tone={officialTone(topLevel)}
      solid
      isDrill
      icon={OctagonAlert}
      title={`Simulasi · tsunami — tingkat ${OFFICIAL_LEVEL_LABEL[topLevel]} (latihan)`}
      collapsedDetail={upcoming ? formatApproxMinutes(upcoming.remainingMs) : 'terlampaui'}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <p className="t-meta">
        {phase.bulletin
          ? `Buletin skenario: ${phase.bulletin}.`
          : `Peringatan resmi belum terbit — PD-1 biasanya terbit kurang dari ${PD1_LATENCY_MIN} menit setelah gempa.`}{' '}
        {lead > 0
          ? `Jeda PD-1 ke gelombang pertama pada skenario ini: ±${lead} menit.`
          : 'Pada skenario ini peringatan resmi tidak sempat mendahului gelombang pertama.'}
      </p>

      {upcoming ? (
        <div className="flex items-end gap-3">
          <span className="t-hero text-[var(--text-primary)]">{formatApproxMinutes(upcoming.remainingMs)}</span>
          <span className="min-w-0 pb-1">
            <span className="t-heading block truncate">{upcoming.zone.name}</span>
            <span className="t-meta block">estimasi gelombang pertama</span>
          </span>
        </div>
      ) : (
        <p className="t-heading">
          Seluruh estimasi tiba terlampaui. Gelombang susulan dapat lebih tinggi — ancaman berlanjut
          sampai PD-4.
        </p>
      )}

      <NaturalWarning />

      <p className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Jam skenario</span>
        <ScenarioClock phase={phase} phaseEnteredAtMs={phaseEnteredAtMs} className="t-data text-[var(--drill)]" />
        <span aria-hidden="true">·</span>
        <span>tinggi maks. estimasi {formatDecimal(scenario.tsunamiHeight)} m</span>
      </p>

      <div className="max-h-[176px] overflow-y-auto rounded-xl border border-[var(--border-hairline)]">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Estimasi per zona pesisir (nilai latihan)</caption>
          <thead>
            <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
              <th scope="col" className="t-micro px-2.5 py-1.5">Zona</th>
              <th scope="col" className="t-micro px-2 py-1.5">Tiba</th>
              <th scope="col" className="t-micro px-2 py-1.5">Tinggi</th>
              <th scope="col" className="t-micro px-2.5 py-1.5">Tingkat</th>
            </tr>
          </thead>
          <tbody>
            {arrivals.map(({ zone, remainingMs, passed }) => {
              const level = tsunamiLevelFromHeight(zone.heightM);
              return (
                <tr
                  key={zone.name}
                  className={`border-b border-[var(--border-hairline)] last:border-b-0 ${passed ? 'opacity-60' : ''}`}
                >
                  <th scope="row" className="t-body px-2.5 py-1.5 font-medium">
                    {zone.name}
                  </th>
                  <td className="t-data whitespace-nowrap px-2 py-1.5">{formatApproxMinutes(remainingMs)}</td>
                  <td className="t-data whitespace-nowrap px-2 py-1.5">{formatDecimal(zone.heightM)} m</td>
                  <td className="px-2.5 py-1.5">
                    {level && (
                      <span
                        data-tone={officialTone(level)}
                        title={`Saran BMKG untuk tingkat ${OFFICIAL_LEVEL_LABEL[level]}: ${TSUNAMI_LEVEL_ADVICE[level]}`}
                        className="tone-chip tone-chip--outline"
                      >
                        {OFFICIAL_LEVEL_LABEL[level]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OfficialLevelLegend caption="Tingkat ancaman skenario (ambang InaTEWS) dan saran BMKG" />

      <p className="t-meta text-[var(--text-muted)]">
        Nilai latihan — bukan hasil pemodelan BMKG. Estimasi tiba yang terlampaui tidak berarti
        ancaman berakhir.
      </p>
    </CardFrame>
  );
}

// ---------------------------------------------------------------------------
// Backend path: a scenario reported by the Go backend, shown as reported
// ---------------------------------------------------------------------------

interface BackendCardProps {
  scenario: TsunamiScenario;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function BackendTsunamiCard({ scenario, collapsed, onToggleCollapsed }: BackendCardProps) {
  const detected = toMillis(scenario.detection_time);
  return (
    <CardFrame
      tone="tinggi"
      solid={false}
      icon={OctagonAlert}
      title="Backend melaporkan skenario tsunami"
      collapsedDetail={detected !== null ? formatWibTime(detected, { seconds: false }) : undefined}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <p className="t-body text-[var(--text-secondary)]">
        Dilaporkan oleh backend Sentinel, bukan buletin BMKG. Periksa status resmi di BMKG.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="t-micro">Sumber</dt>
        <dd className="t-body">{scenario.sensor_id || 'tidak dilaporkan'}</dd>
        <dt className="t-micro">Terdeteksi</dt>
        <dd className="t-data">{detected !== null ? formatWibTime(detected) : '—'}</dd>
        <dt className="t-micro">Zona</dt>
        <dd className="t-body">{scenario.affected_zones?.join(' · ') || 'tidak dilaporkan'}</dd>
      </dl>
      <NaturalWarning />
      <a
        href={BMKG_TSUNAMI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="t-meta inline-flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
      >
        Buka peringatan BMKG
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </CardFrame>
  );
}
