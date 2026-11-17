'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  Compass,
  Plane,
  Radio,
  Wind,
} from 'lucide-react';
import type { VolcanoEruption } from '@/lib/types';
import {
  INDONESIAN_VOLCANOES,
  buildVolcanoInspectionReport,
  findVolcanoLocation,
  getVolcanoReports,
  getVolcanicAshTrajectory,
  type VolcanicAshTrajectory,
} from '@/lib/volcanoData';
import VolcanoChip from './VolcanoChip';

interface SeismographProps {
  seismicEnergy?: number;
  activityLevel?: number;
  phaseName?: string;
  volcanoes?: VolcanoEruption[];
  selectedVolcano?: string | null;
  onSelectVolcano?: (name: string) => void;
  onInspectSeismogram?: (volcano: VolcanoEruption) => void;
  isSimulasi?: boolean;
  theme?: 'dark' | 'light';
  compactHud?: boolean;
}

const BMKG_STATION_ID = 'BMKG_REGIONAL';

export default function Seismograph({
  seismicEnergy = 1.2,
  activityLevel = 22,
  phaseName = 'SEISMIC_BASELINE',
  volcanoes = [],
  selectedVolcano = 'Anak Krakatau',
  onSelectVolcano,
  onInspectSeismogram,
  isSimulasi = false,
  theme = 'dark',
  compactHud = false,
}: SeismographProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<number[]>([]);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [activeTarget, setActiveTarget] = useState<string>(selectedVolcano || 'Anak Krakatau');
  const [showAshDetails, setShowAshDetails] = useState(false);

  useEffect(() => {
    if (selectedVolcano) {
      setActiveTarget(selectedVolcano);
    }
  }, [selectedVolcano]);

  // Keep the selected station visible when the selection comes from the map or the volcano hub.
  // Scrolls the strip only (never the page), so picking a volcano elsewhere does not move the viewport.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!strip || !chip) return;
    const centered = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, centered), behavior: 'smooth' });
  }, [activeTarget]);

  const isBMKGMode = activeTarget === BMKG_STATION_ID;
  const geo = useMemo(
    () => (isBMKGMode ? null : findVolcanoLocation(activeTarget)),
    [activeTarget, isBMKGMode]
  );

  const liveReport = useMemo(
    () => (geo ? getVolcanoReports(geo, volcanoes)[0] ?? null : null),
    [geo, volcanoes]
  );

  const ashTrajectory: VolcanicAshTrajectory = useMemo(() => {
    const targetName = isBMKGMode ? 'Anak Krakatau' : activeTarget;
    return getVolcanicAshTrajectory(targetName);
  }, [isBMKGMode, activeTarget]);

  const ampNum = useMemo(() => {
    if (liveReport?.amplitude) {
      return parseFloat(liveReport.amplitude.replace(/[^0-9.]/g, '')) || 35;
    }
    return 15;
  }, [liveReport]);

  const alertLevel = liveReport?.alert_level || geo?.defaultLevel || 'LEVEL II (WASPADA)';
  const isAwas = alertLevel.includes('AWAS');
  const isSiaga = alertLevel.includes('SIAGA');

  const configRef = useRef({
    isBMKGMode,
    ampNum,
    seismicEnergy,
    activityLevel,
    isAwas,
    isSiaga,
    theme,
  });

  useEffect(() => {
    configRef.current = {
      isBMKGMode,
      ampNum,
      seismicEnergy,
      activityLevel,
      isAwas,
      isSiaga,
      theme,
    };
  }, [isBMKGMode, ampNum, seismicEnergy, activityLevel, isAwas, isSiaga, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = 132);

    const updateSize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 400;
    };

    window.addEventListener('resize', updateSize);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(canvas.parentElement);
    }

    const maxPoints = 300;
    if (pointsRef.current.length === 0) {
      pointsRef.current = new Array(maxPoints).fill(height / 2);
    }

    let tick = 0;

    const render = () => {
      tick++;
      const {
        isBMKGMode: isBMKG,
        ampNum: amp,
        seismicEnergy: energy,
        activityLevel: act,
        isAwas: awas,
        isSiaga: siaga,
        theme: currentTheme,
      } = configRef.current;

      const midY = height / 2;
      let rawOffset = 0;

      if (isBMKG) {
        const normalizedAct = Math.max(0.1, act / 100);
        const pWave = Math.sin(tick * 0.45) * (energy * 1.2);
        const sWave = Math.sin(tick * 0.15) * (energy * 2.8 * normalizedAct);
        const burst =
          Math.random() < 0.05 + normalizedAct * 0.2
            ? (Math.random() - 0.5) * energy * 4.5
            : 0;
        rawOffset = pWave + sWave + burst;
      } else {
        const ampScale = Math.min(45, Math.max(8, amp * 0.75));
        const tremorBase = Math.sin(tick * 0.38) * (ampScale * 0.35);
        const harmonicFluid = Math.sin(tick * 0.85) * (ampScale * 0.25);
        const volcanicLP = Math.sin(tick * 0.12) * (ampScale * 0.45);
        const burstProb = awas ? 0.22 : siaga ? 0.12 : 0.05;
        const explosionBurst =
          Math.random() < burstProb ? (Math.random() - 0.5) * ampScale * 1.5 : 0;
        rawOffset = tremorBase + harmonicFluid + volcanicLP + explosionBurst;
      }

      const clampedOffset = Math.max(-height / 2 + 10, Math.min(height / 2 - 10, rawOffset));
      pointsRef.current.push(midY + clampedOffset);
      if (pointsRef.current.length > maxPoints) {
        pointsRef.current.shift();
      }

      const isLight = currentTheme === 'light';
      ctx.fillStyle = isLight ? '#f4f8fc' : '#050914';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      const gridStep = 40;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep / 2) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.24)' : 'rgba(34, 211, 238, 0.22)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      let strokeColor = isLight ? '#0284c7' : '#22d3ee';
      if (!isBMKG) {
        strokeColor = awas ? '#fb7185' : siaga ? '#fb923c' : '#fbbf24';
      } else if (act > 80) {
        strokeColor = '#fb7185';
      } else if (act > 50) {
        strokeColor = '#fb923c';
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      const dx = width / (maxPoints - 1);
      for (let i = 0; i < pointsRef.current.length; i++) {
        const px = i * dx;
        const py = pointsRef.current[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const lastIdx = pointsRef.current.length - 1;
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(lastIdx * dx, pointsRef.current[lastIdx], 3.5, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver?.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleSelect = (targetName: string) => {
    setActiveTarget(targetName);
    if (targetName !== BMKG_STATION_ID) {
      onSelectVolcano?.(targetName);
    }
  };

  /** Opens the PVMBG analysis for one volcano and tunes the waveform to it. */
  const handleAnalyze = (volcanoName: string) => {
    const location = findVolcanoLocation(volcanoName);
    if (!location) return;
    handleSelect(location.name);
    onInspectSeismogram?.(buildVolcanoInspectionReport(location, volcanoes));
  };

  return (
    <div
      id="seismograph-container"
      className={`${
        compactHud ? 'glass-hud rounded-2xl p-3' : 'matte-card p-5 sm:p-6'
      } flex flex-col gap-2.5`}
    >
      {/* Station Selection Strip — every volcano carries its own Analisis PVMBG action */}
      <div
        className={`flex items-center gap-2 ${
          compactHud ? 'pb-1' : 'border-b border-[var(--border-hairline)] pb-2.5'
        }`}
      >
        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
          SEISMOGRAF:
        </span>
        <div
          ref={stripRef}
          className="no-scrollbar relative flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]"
        >
          <button
            type="button"
            aria-pressed={isBMKGMode}
            data-selected={isBMKGMode}
            onClick={() => handleSelect(BMKG_STATION_ID)}
            title="Jaringan broadband nasional BMKG (LEM / JATS)"
            className={`inline-flex shrink-0 items-center border font-semibold transition-colors ${
              compactHud
                ? 'min-h-6 gap-1 rounded-full px-2 text-[10px]'
                : 'gap-1.5 rounded-lg px-2.5 py-1.5 text-xs'
            } ${
              isBMKGMode
                ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Radio className={compactHud ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
            <span>{compactHud ? 'BMKG' : 'BMKG Broadband'}</span>
          </button>

          {INDONESIAN_VOLCANOES.map((volcano) => (
            <VolcanoChip
              key={volcano.name}
              name={volcano.name}
              size={compactHud ? 'sm' : 'md'}
              selected={geo?.name === volcano.name}
              reportCount={getVolcanoReports(volcano, volcanoes).length}
              onSelect={() => handleSelect(volcano.name)}
              onAnalyze={() => handleAnalyze(volcano.name)}
            />
          ))}

          {/* Lets the last chip scroll clear of the fade mask */}
          <span className="w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {/* Metadata + Telemetry Strip */}
      {!compactHud && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
                {isBMKGMode
                  ? 'Jaringan Broadband Nasional BMKG'
                  : `Pos PGA: ${geo?.pgaStation || activeTarget}`}
              </span>
              {!isBMKGMode && (
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                    isAwas
                      ? 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]'
                      : isSiaga
                      ? 'border-[var(--sev-high-border)] bg-[var(--sev-high-bg)] text-[var(--sev-high)]'
                      : 'border-[var(--sev-elevated-border)] bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]'
                  }`}
                >
                  {alertLevel}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {isBMKGMode
                ? 'Stasiun LEM (Lembang) & JATS (Jatiluhur) · Komponen Z · 100 Hz Streaming'
                : `G. ${geo?.name} (${geo?.province}) · Elevasi ${geo?.elevation} mdpl · ${geo?.sensorType}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
            {!isBMKGMode && liveReport ? (
              <>
                <span className="rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-secondary)]">
                  Amp <strong className="text-[var(--sev-critical)]">{liveReport.amplitude}</strong>
                </span>
                <span className="rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-secondary)]">
                  Durasi <strong className="text-[var(--sev-high)]">{liveReport.duration}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-secondary)]">
                  VEL <strong className="text-[var(--text-primary)]">{seismicEnergy.toFixed(1)} mm/s</strong>
                </span>
                <span className="rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-secondary)]">
                  PGA <strong className="text-[var(--text-primary)]">{((activityLevel / 100) * 0.45).toFixed(3)} g</strong>
                </span>
                <span className="rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  {phaseName}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Oscilloscope Canvas */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <canvas ref={canvasRef} className={`block w-full ${compactHud ? 'h-[68px]' : 'h-[132px]'}`} />
      </div>

      {/* Compact VONA Volcanic Ash Summary */}
      {!compactHud && (!isBMKGMode || isSimulasi || liveReport || isAwas || isSiaga) && (
        <div className="rounded-lg border border-[var(--sev-high-border)] bg-[var(--sev-high-bg)] p-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wind className="h-3.5 w-3.5 text-[var(--sev-high)]" />
              <span className="font-bold text-[var(--text-primary)]">
                Sebaran Abu VONA — G. {ashTrajectory.volcanoName}
              </span>
              <span className="rounded bg-[var(--sev-high)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                {ashTrajectory.vonaColorCode}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <Compass className="h-3 w-3 text-[var(--sev-high)]" />
                {ashTrajectory.windDirectionCardinal} ({ashTrajectory.windSpeedKts} kt)
              </span>
              <button
                type="button"
                onClick={() => setShowAshDetails((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded border border-[var(--sev-high-border)] bg-[var(--surface-1)] px-2 py-0.5 font-sans text-[10px] font-semibold text-[var(--text-primary)]"
              >
                {showAshDetails ? 'Tutup VONA' : 'Detail VONA'}
              </button>
              {!isBMKGMode && (
                <button
                  type="button"
                  onClick={() => handleAnalyze(activeTarget)}
                  className="inline-flex items-center gap-1 font-sans text-[10px] font-semibold text-[var(--accent)] hover:underline"
                >
                  <span>Analisis PVMBG</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {showAshDetails && (
            <div className="mt-2 grid grid-cols-1 gap-2 border-t border-[var(--sev-high-border)] pt-2 sm:grid-cols-3">
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1.5">
                <div className="text-[10px] text-[var(--text-muted)]">Tinggi Kolom Erupsi</div>
                <div className="font-mono text-xs font-bold text-[var(--sev-critical)]">
                  ±{ashTrajectory.plumeHeightMeters.toLocaleString('id-ID')} m dpl
                </div>
              </div>
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1.5">
                <div className="text-[10px] text-[var(--text-muted)]">Radius &amp; Durasi Sebaran</div>
                <div className="font-mono text-xs font-bold text-[var(--text-primary)]">
                  {ashTrajectory.hazardRadiusKm} km · {ashTrajectory.ashDispersionDurationEst}
                </div>
              </div>
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1.5">
                <div className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <Plane className="h-3 w-3" /> Koridor Penerbangan
                </div>
                <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {ashTrajectory.affectedAviationRoute}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
