'use client';

import { FlaskConical, Pause, Play, ShieldAlert, Waves } from 'lucide-react';

export interface DrillScenarioOption {
  id: 'sunda-strait' | 'south-java' | 'mentawai' | 'palu-koro';
  name: string;
  shortLabel: string;
  faultZone: string;
  magnitude: number;
  depth: number;
  tsunamiHeight: number;
  evacuationWindowMin: number;
}

export interface DrillPhaseOption {
  phaseNumber: number;
  shortLabel: string;
  title: string;
  tsunamiActive: boolean;
}

interface DrillFloatingBarProps {
  scenarios: DrillScenarioOption[];
  phases: DrillPhaseOption[];
  activeScenario: DrillScenarioOption;
  activePhase: DrillPhaseOption;
  isPlaying: boolean;
  onSelectScenario: (id: DrillScenarioOption['id']) => void;
  onSelectPhase: (phaseNumber: number) => void;
  onTogglePlay: () => void;
}

export default function DrillFloatingBar({
  scenarios,
  phases,
  activeScenario,
  activePhase,
  isPlaying,
  onSelectScenario,
  onSelectPhase,
  onTogglePlay,
}: DrillFloatingBarProps) {
  return (
    <div
      role="region"
      aria-label="Kontrol Simulasi Megathrust"
      className="glass-hud flex flex-col gap-2 rounded-2xl border-l-4 border-l-[var(--sev-critical)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sev-critical-bg)] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--sev-critical)] uppercase">
            <FlaskConical className="h-3 w-3" />
            Simulasi
          </span>

          <div className="flex flex-wrap items-center gap-1">
            {scenarios.map((sc) => {
              const isSelected = sc.id === activeScenario.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelectScenario(sc.id)}
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {sc.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2.5 font-mono text-[10px] text-[var(--text-secondary)] xl:flex">
            <span className="inline-flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-[var(--sev-high)]" />
              Evakuasi {activeScenario.evacuationWindowMin}m
            </span>
            <span className="inline-flex items-center gap-1">
              <Waves className="h-3 w-3 text-[var(--accent)]" />
              Maks {activeScenario.tsunamiHeight.toFixed(1)}m
            </span>
          </div>

          <button
            type="button"
            onClick={onTogglePlay}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
              isPlaying
                ? 'bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]'
                : 'bg-[var(--accent)] text-slate-950'
            }`}
            title={isPlaying ? 'Jeda progres fase otomatis' : 'Putar progres fase otomatis (tiap 6 detik)'}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{isPlaying ? 'Jeda' : 'Auto Fase'}</span>
          </button>
        </div>
      </div>

      {/* 5-Phase Stepper */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {phases.map((ph) => {
          const isCurrent = ph.phaseNumber === activePhase.phaseNumber;
          return (
            <button
              key={ph.phaseNumber}
              type="button"
              onClick={() => onSelectPhase(ph.phaseNumber)}
              title={ph.title}
              className={`flex flex-col items-start rounded-xl px-2.5 py-1.5 text-left transition-all ${
                isCurrent
                  ? 'bg-[var(--accent)] text-slate-950 shadow-xs'
                  : 'bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
              }`}
            >
              <span
                className={`font-mono text-[9px] font-extrabold ${
                  isCurrent ? 'text-slate-900' : 'text-[var(--accent)]'
                }`}
              >
                {ph.shortLabel}
              </span>
              <span
                className={`w-full truncate text-[10px] font-medium ${
                  isCurrent ? 'text-slate-900/90' : 'text-[var(--text-secondary)]'
                }`}
              >
                {ph.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
