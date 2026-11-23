'use client';

import { FlaskConical, LogOut, Pause, Play } from 'lucide-react';
import { ScenarioClock } from './SentinelClocks';
import type { DrillPhase, DrillScenario, DrillScenarioId } from '@/lib/drillScenarios';
import { formatScenarioClock } from '@/lib/time';

interface DrillStripProps {
  scenarios: DrillScenario[];
  phases: DrillPhase[];
  activeScenario: DrillScenario;
  activePhase: DrillPhase;
  /** When the current phase came on screen (epoch ms). */
  phaseEnteredAtMs: number;
  isPlaying: boolean;
  /** Seconds each phase stays up during autoplay. */
  autoplaySeconds: number;
  onSelectScenario: (id: DrillScenarioId) => void;
  onSelectPhase: (phaseNumber: number) => void;
  onTogglePlay: () => void;
  onExit: () => void;
}

/**
 * The drill's own row under the masthead: it says, permanently, that this is a
 * simulation, and holds every drill control so none of them covers the map.
 */
export default function DrillStrip({
  scenarios,
  phases,
  activeScenario,
  activePhase,
  phaseEnteredAtMs,
  isPlaying,
  autoplaySeconds,
  onSelectScenario,
  onSelectPhase,
  onTogglePlay,
  onExit,
}: DrillStripProps) {
  return (
    <div
      role="region"
      aria-label="Kontrol simulasi"
      className="hud-solid mx-auto flex max-w-[1600px] items-stretch overflow-hidden rounded-xl border-[var(--drill-border)]"
    >
      <span className="drill-band" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5">
        <span className="drill-chip shrink-0">
          <FlaskConical className="h-3 w-3" aria-hidden="true" />
          Simulasi — latihan, bukan kejadian nyata
        </span>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Skenario</span>
          <select
            value={activeScenario.id}
            onChange={(event) => onSelectScenario(event.target.value as DrillScenarioId)}
            className="t-meta min-h-7 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 font-semibold text-[var(--text-primary)]"
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.shortLabel}
              </option>
            ))}
          </select>
        </label>

        {/* Phase track: the official sequence, each step labelled with its scenario time */}
        <ol
          aria-label="Fase skenario"
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {phases.map((phase) => {
            const current = phase.phaseNumber === activePhase.phaseNumber;
            const done = phase.phaseNumber < activePhase.phaseNumber;
            return (
              <li key={phase.phaseNumber} className="shrink-0">
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  title={`${phase.title} (${formatScenarioClock(phase.tPlusMin * 60)})`}
                  onClick={() => onSelectPhase(phase.phaseNumber)}
                  className={`inline-flex min-h-7 items-baseline gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                    current
                      ? 'border-[var(--drill-border)] bg-[var(--drill-bg)] text-[var(--drill)]'
                      : done
                        ? 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{phase.shortLabel}</span>
                  <span className="font-mono text-[11px] font-medium tabular-nums opacity-80">
                    {formatScenarioClock(phase.tPlusMin * 60)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex shrink-0 items-center gap-2">
          <span className="t-meta hidden text-[var(--text-muted)] md:inline">Jam skenario</span>
          <ScenarioClock
            phase={activePhase}
            phaseEnteredAtMs={phaseEnteredAtMs}
            className="t-data-lg min-w-[5.5ch] text-[var(--drill)]"
          />
          <span className="sr-only">
            Fase {activePhase.shortLabel}, mulai pada {formatScenarioClock(activePhase.tPlusMin * 60)}
          </span>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-pressed={isPlaying}
            title={
              isPlaying
                ? 'Jeda pergantian fase otomatis'
                : `Ganti fase otomatis tiap ${autoplaySeconds} detik — jam skenario melompat di tiap fase`
            }
            className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--drill-border)]"
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Play className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{isPlaying ? 'Jeda' : 'Putar fase'}</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            title="Keluar dari simulasi dan kembali ke data langsung"
            className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
          >
            <LogOut className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
