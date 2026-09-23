'use client';

import React, { useState } from 'react';
import type { ReplayStatus } from '@/lib/types';

export interface ScenarioDefinition {
  id: string;
  name: string;
  shortName: string;
  magnitude: number;
  depth: number;
  region: string;
  mmi: string;
  tsunamiWave: number;
  seismicSlip: number;
  populationExposed: number;
  criticalInfrastructure: number;
  roadDisruptions: number;
  tag: string;
  icon: string;
  color: string;
  desc: string;
  epicenter: [number, number];
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'south-java-m78',
    name: 'Megathrust Selatan Jawa (M7.8)',
    shortName: 'Selatan Jawa M7.8',
    magnitude: 7.8,
    depth: 15,
    region: 'Java Trench (Cilacap - Pangandaran - Pacitan)',
    mmi: 'VII',
    tsunamiWave: 4.5,
    seismicSlip: 2.4,
    populationExposed: 1842000,
    criticalInfrastructure: 37,
    roadDisruptions: 12,
    tag: 'Tsunamigenic',
    icon: '🌊',
    color: '#00f2ff',
    desc: 'Java Trench subduction rupture with 4.5m coastal tsunami',
    epicenter: [-9.15, 109.52],
  },
  {
    id: 'sunda-strait-m82',
    name: 'Megathrust Selat Sunda (M8.2)',
    shortName: 'Selat Sunda M8.2',
    magnitude: 8.2,
    depth: 22,
    region: 'Selat Sunda (Banten & Lampung)',
    mmi: 'VIII',
    tsunamiWave: 8.2,
    seismicSlip: 3.8,
    populationExposed: 2450000,
    criticalInfrastructure: 54,
    roadDisruptions: 26,
    tag: 'Catastrophic',
    icon: '🌋',
    color: '#ef4444',
    desc: 'Catastrophic caldera collapse & 8.2m wave towards Banten/Lampung',
    epicenter: [-6.82, 105.25],
  },
  {
    id: 'palu-m75',
    name: 'Palu-Koro & Landslide (M7.5)',
    shortName: 'Palu-Koro M7.5',
    magnitude: 7.5,
    depth: 10,
    region: 'Palu Bay / Central Sulawesi',
    mmi: 'VIII',
    tsunamiWave: 6.0,
    seismicSlip: 4.5,
    populationExposed: 820000,
    criticalInfrastructure: 41,
    roadDisruptions: 31,
    tag: 'Liquefaction',
    icon: '⚡',
    color: '#f59e0b',
    desc: 'Strike-slip rupture, Petobo liquefaction, & bay tsunami',
    epicenter: [-0.89, 119.85],
  },
];

export const STAGES = [
  { step: 1, name: 'Quake', icon: '⚡' },
  { step: 2, name: 'Stations', icon: '📡' },
  { step: 3, name: 'MMI VII', icon: '📊' },
  { step: 4, name: 'InSAR', icon: '🛰️' },
  { step: 5, name: 'Tsunami', icon: '🌊' },
  { step: 6, name: 'Coastal', icon: '👥' },
  { step: 7, name: 'Infra', icon: '🌉' },
  { step: 8, name: 'Dispatched', icon: '🚨' },
];

interface IncidentReplayControlsProps {
  status: ReplayStatus | null;
  onStartReplay: (scenarioId: string, speed: number) => void;
  onPauseReplay: () => void;
  onResumeReplay: () => void;
  onResetReplay: () => void;
  onStepReplay: () => void;
  onSelectScenario?: (scenarioId: string) => void;
}

export default function IncidentReplayControls({
  status,
  onStartReplay,
  onPauseReplay,
  onResumeReplay,
  onResetReplay,
  onStepReplay,
  onSelectScenario,
}: IncidentReplayControlsProps) {
  const [selectedScenario, setSelectedScenario] = useState('south-java-m78');
  const [speed, setSpeed] = useState(1);

  const isPlaying = status?.active && status?.stage_name !== 'PAUSED';
  const isPaused = status?.active && status?.stage_name === 'PAUSED';
  const currentStep = status?.current_step || 0;
  const progressPercent = Math.round(((status?.current_step || 0) / (status?.total_steps || 8)) * 100);

  const handleScenarioChange = (scenId: string) => {
    if (isPlaying) return;
    setSelectedScenario(scenId);
    if (onSelectScenario) {
      onSelectScenario(scenId);
    }
  };

  return (
    <div className="incident-replay-bar">
      {/* Top row: Brand + Scenario Pills */}
      <div className="replay-bar__top-row">
        <div className="replay-bar__badge">
          <span className="live-dot-pulse" style={{ background: '#ec4899' }} />
          <div>
            <div className="replay-bar__badge-title">DISASTER REPLAY SANDBOX</div>
            <div className="replay-bar__badge-sub">Cascading Consequence Simulator</div>
          </div>
        </div>

        {/* Interactive Scenario Cards */}
        <div className="replay-bar__scenarios">
          {SCENARIOS.map((scen) => {
            const isSelected = selectedScenario === scen.id;
            return (
              <button
                key={scen.id}
                type="button"
                onClick={() => handleScenarioChange(scen.id)}
                className={`replay-scen-card ${isSelected ? 'replay-scen-card--active' : ''}`}
                disabled={isPlaying}
                title={scen.desc}
              >
                <span className="replay-scen-card__icon">{scen.icon}</span>
                <div className="replay-scen-card__info">
                  <div className="replay-scen-card__name">{scen.shortName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      className="replay-scen-card__tag"
                      style={{
                        color: scen.color,
                        borderColor: `${scen.color}44`,
                        background: `${scen.color}15`,
                      }}
                    >
                      {scen.tag}
                    </span>
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>{scen.depth}km</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle row: Interactive Controls & Step Timeline Scrubber */}
      <div className="replay-bar__main-row">
        <div className="replay-bar__controls-left">
          {/* Main Action Button */}
          {!status?.active || status?.current_step === 0 ? (
            <button
              type="button"
              onClick={() => onStartReplay(selectedScenario, speed)}
              className="replay-bar__btn replay-bar__btn--primary"
            >
              <span className="btn-icon">▶</span>
              <span>MULAI REPLAY</span>
            </button>
          ) : isPaused ? (
            <button
              type="button"
              onClick={onResumeReplay}
              className="replay-bar__btn replay-bar__btn--resume"
            >
              <span className="btn-icon">▶</span>
              <span>LANJUTKAN</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPauseReplay}
              className="replay-bar__btn replay-bar__btn--pause"
            >
              <span className="btn-icon">⏸</span>
              <span>JEDA (PAUSE)</span>
            </button>
          )}

          {/* Step Button */}
          <button
            type="button"
            onClick={onStepReplay}
            className="replay-bar__btn replay-bar__btn--step"
            title="Lompati satu tahap propagasi bencana berikutnya (Next Stage)"
          >
            <span className="btn-icon">⏭</span>
            <span>STEP TAHAP</span>
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={onResetReplay}
            className="replay-bar__btn replay-bar__btn--reset"
            title="Kembalikan sistem ke tahap awal skenario"
          >
            <span className="btn-icon">↺</span>
            <span>RESET</span>
          </button>

          {/* Speed Selector */}
          <div className="replay-bar__speed-group">
            <span className="replay-speed-label">SPEED</span>
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`replay-speed-btn ${speed === s ? 'replay-speed-btn--active' : ''}`}
                title={`Kecepatan Replay: ${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Step Scrubber / Interactive Timeline Pills */}
        <div className="replay-bar__steps-scrubber">
          {STAGES.map((st) => {
            const isDone = currentStep >= st.step;
            const isCurrent = currentStep === st.step;
            return (
              <div
                key={st.step}
                className={`replay-step-pill ${isDone ? 'replay-step-pill--done' : ''} ${
                  isCurrent ? 'replay-step-pill--current' : ''
                }`}
                title={`Tahap ${st.step}: ${st.name}`}
              >
                <span className="replay-step-pill__num">{st.step}</span>
                <span className="replay-step-pill__icon">{st.icon}</span>
                <span className="replay-step-pill__label">{st.name}</span>
                {isCurrent && <span className="replay-step-pill__glow" />}
              </div>
            );
          })}
        </div>

        {/* Status & Progress meter */}
        <div className="replay-bar__progress-col">
          <div className="replay-progress-header">
            <span className="replay-stage-badge">
              {status?.active ? `STEP ${currentStep}/8: ${status.stage_name}` : 'SIAP DIUJI COBA'}
            </span>
            <span className="replay-pct-badge">{progressPercent}%</span>
          </div>
          <div className="replay-track">
            <div
              className="replay-bar-fill"
              style={{
                width: `${progressPercent}%`,
                background:
                  progressPercent >= 100
                    ? 'linear-gradient(90deg, #10b981, #00f2ff)'
                    : 'linear-gradient(90deg, #ec4899, #a855f7, #00f2ff)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
