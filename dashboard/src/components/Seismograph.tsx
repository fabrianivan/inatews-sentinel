'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, Radio } from 'lucide-react';
import type { VolcanoEruption } from '@/lib/types';
import { parseVolcanoLevel } from '@/lib/severity';
import {
  INDONESIAN_VOLCANOES,
  VOLCANO_ORIGIN_LABEL,
  findVolcanoLocation,
  countEruptionReports,
  getVolcanoReports,
  isPlaceholderRecord,
  volcanoRecordOrigin,
} from '@/lib/volcanoData';
import VolcanoChip, { CatalogueLevelChip } from './VolcanoChip';

/** Every canvas trace in the dashboard is synthesized; each one carries this caption. */
export const WAVEFORM_CAPTION = 'Ilustrasi gelombang — bukan data sensor langsung';

export interface WaveformLoop {
  /** Re-renders the still frame after its inputs changed; a no-op while animating. */
  refresh: () => void;
  stop: () => void;
}

/**
 * Animates a synthesized trace only while its canvas is on screen and the tab
 * is visible. With prefers-reduced-motion it renders one still frame of
 * `stillSamples` samples instead of running a loop.
 */
export function startWaveformLoop(
  canvas: HTMLCanvasElement,
  frame: { advance: () => void; draw: () => void },
  stillSamples: number
): WaveformLoop {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId: number | null = null;
  let onScreen = false;

  const cancel = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };
  const tick = () => {
    frame.advance();
    frame.draw();
    rafId = requestAnimationFrame(tick);
  };
  const drawStill = () => {
    for (let i = 0; i < stillSamples; i++) frame.advance();
    frame.draw();
  };
  const resume = () => {
    cancel();
    if (!reducedMotion.matches && onScreen && !document.hidden) {
      rafId = requestAnimationFrame(tick);
    }
  };
  const handleMotionPreference = () => {
    if (reducedMotion.matches) {
      cancel();
      drawStill();
    } else {
      resume();
    }
  };

  const observer = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    resume();
  });
  observer.observe(canvas);
  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', handleMotionPreference);

  if (reducedMotion.matches) drawStill();
  else frame.draw();

  return {
    refresh: () => {
      if (reducedMotion.matches) drawStill();
    },
    stop: () => {
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      reducedMotion.removeEventListener('change', handleMotionPreference);
    },
  };
}

interface SeismographProps {
  /** Set on one instance only: the map scrolls to it. */
  id?: string;
  seismicEnergy?: number;
  activityLevel?: number;
  phaseName?: string;
  volcanoes?: VolcanoEruption[];
  selectedVolcano?: string | null;
  onSelectVolcano?: (name: string) => void;
  /** "Analisis PVMBG" on a volcano: the page opens that volcano's panel with its analysis. */
  onAnalyzeVolcano?: (name: string) => void;
  isSimulasi?: boolean;
  theme?: 'dark' | 'light';
  compactHud?: boolean;
}

const BMKG_STATION_ID = 'BMKG_REGIONAL';
const MAX_POINTS = 300;
const CANVAS_HEIGHT = 132;

export default function Seismograph({
  id,
  seismicEnergy = 1.2,
  activityLevel = 22,
  phaseName = 'SEISMIC_BASELINE',
  volcanoes = [],
  selectedVolcano = 'Anak Krakatau',
  onSelectVolcano,
  onAnalyzeVolcano,
  isSimulasi = false,
  theme = 'dark',
  compactHud = false,
}: SeismographProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<WaveformLoop | null>(null);
  const pointsRef = useRef<number[]>([]);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [activeTarget, setActiveTarget] = useState<string>(selectedVolcano || 'Anak Krakatau');

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

  const latestReport = useMemo(
    () => (geo ? getVolcanoReports(geo, volcanoes)[0] ?? null : null),
    [geo, volcanoes]
  );

  const ampNum = latestReport ? parseFloat(latestReport.amplitude.replace(/[^0-9.]/g, '')) || 35 : 15;

  // The catalogue level only shapes how busy the illustration looks.
  const catalogueLevel = parseVolcanoLevel(geo?.defaultLevel)?.level;
  const burstProbability = catalogueLevel === 'awas' ? 0.22 : catalogueLevel === 'siaga' ? 0.12 : 0.05;

  const configRef = useRef({ isBMKGMode, ampNum, seismicEnergy, activityLevel, burstProbability, theme });

  useEffect(() => {
    configRef.current = { isBMKGMode, ampNum, seismicEnergy, activityLevel, burstProbability, theme };
    loopRef.current?.refresh();
  }, [isBMKGMode, ampNum, seismicEnergy, activityLevel, burstProbability, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = CANVAS_HEIGHT);
    const midY = height / 2;

    if (pointsRef.current.length === 0) {
      pointsRef.current = new Array(MAX_POINTS).fill(midY);
    }

    let tick = 0;

    const advance = () => {
      tick++;
      const config = configRef.current;
      let rawOffset = 0;

      if (config.isBMKGMode) {
        const energy = config.seismicEnergy;
        const normalizedAct = Math.max(0.1, config.activityLevel / 100);
        const pWave = Math.sin(tick * 0.45) * (energy * 1.2);
        const sWave = Math.sin(tick * 0.15) * (energy * 2.8 * normalizedAct);
        const burst =
          Math.random() < 0.05 + normalizedAct * 0.2
            ? (Math.random() - 0.5) * energy * 4.5
            : 0;
        rawOffset = pWave + sWave + burst;
      } else {
        const ampScale = Math.min(45, Math.max(8, config.ampNum * 0.75));
        const tremorBase = Math.sin(tick * 0.38) * (ampScale * 0.35);
        const harmonicFluid = Math.sin(tick * 0.85) * (ampScale * 0.25);
        const volcanicLP = Math.sin(tick * 0.12) * (ampScale * 0.45);
        const explosionBurst =
          Math.random() < config.burstProbability ? (Math.random() - 0.5) * ampScale * 1.5 : 0;
        rawOffset = tremorBase + harmonicFluid + volcanicLP + explosionBurst;
      }

      const clampedOffset = Math.max(-height / 2 + 10, Math.min(height / 2 - 10, rawOffset));
      pointsRef.current.push(midY + clampedOffset);
      if (pointsRef.current.length > MAX_POINTS) {
        pointsRef.current.shift();
      }
    };

    const draw = () => {
      const isLight = configRef.current.theme === 'light';
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

      // One neutral trace colour: an illustration must not look like a severity reading.
      const strokeColor = isLight ? '#0369a1' : '#22d3ee';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      const dx = width / (MAX_POINTS - 1);
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
    };

    // Resizing a canvas clears it, so repaint straight away (the loop may be paused).
    const updateSize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 400;
      draw();
    };

    window.addEventListener('resize', updateSize);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(canvas.parentElement);
    }

    const loop = startWaveformLoop(canvas, { advance, draw }, MAX_POINTS);
    loopRef.current = loop;

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver?.disconnect();
      loop.stop();
      loopRef.current = null;
    };
  }, []);

  // The BMKG trace is reported too: the page then holds no volcano as selected, so picking
  // the same volcano again afterwards is a change it can see.
  const handleSelect = (targetName: string) => {
    setActiveTarget(targetName);
    onSelectVolcano?.(targetName);
  };

  /** Opens the volcano's panel on the map at its analysis, and tunes the waveform to it. */
  const handleAnalyze = (volcanoName: string) => {
    const location = findVolcanoLocation(volcanoName);
    if (!location) return;
    setActiveTarget(location.name);
    onAnalyzeVolcano?.(location.name);
  };

  // In a drill the BMKG trace follows the scenario phase, so it is marked as drill content.
  const isScenarioTrace = isSimulasi && isBMKGMode;
  const reportIsPlaceholder = latestReport ? isPlaceholderRecord(latestReport) : false;

  return (
    <div
      id={id}
      className={`${
        compactHud ? 'hud-solid rounded-2xl p-3' : 'matte-card p-5 sm:p-6'
      } flex flex-col gap-2.5`}
    >
      {/* Station Selection Strip — every volcano carries its own Analisis PVMBG action */}
      <div
        className={`flex items-center gap-2 ${
          compactHud ? 'pb-1' : 'border-b border-[var(--border-hairline)] pb-2.5'
        }`}
      >
        <span className="t-micro shrink-0">Seismograf</span>
        <div
          ref={stripRef}
          className="no-scrollbar relative flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]"
        >
          <button
            type="button"
            aria-pressed={isBMKGMode}
            data-selected={isBMKGMode}
            onClick={() => handleSelect(BMKG_STATION_ID)}
            title="Jejak ilustrasi BMKG broadband — bukan aliran stasiun"
            className={`inline-flex shrink-0 items-center border font-semibold transition-colors ${
              compactHud
                ? 'min-h-6 gap-1 rounded-full px-2 text-[11px]'
                : 'min-h-8 gap-1.5 rounded-lg px-2.5 text-xs'
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
              reportCount={countEruptionReports(volcano, volcanoes)}
              catalogueLevel={volcano.defaultLevel}
              onSelect={() => handleSelect(volcano.name)}
              onAnalyze={() => handleAnalyze(volcano.name)}
            />
          ))}

          {/* Lets the last chip scroll clear of the fade mask */}
          <span className="w-5 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {/* Metadata strip */}
      {!compactHud && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <Activity className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                {isBMKGMode
                  ? 'BMKG Broadband — jejak ilustrasi'
                  : `Pos PGA: ${geo?.pgaStation || activeTarget}`}
              </span>
              {geo && <CatalogueLevelChip levelText={geo.defaultLevel} />}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              {isBMKGMode
                ? isSimulasi
                  ? 'Ilustrasi skenario: gelombang disintesis dari fase latihan, bukan aliran stasiun BMKG.'
                  : 'Gelombang disintesis dari indeks aktivitas dasbor, bukan aliran stasiun BMKG.'
                : geo
                ? `G. ${geo.name} (${geo.province}) · Elevasi ${geo.elevation} mdpl · ${geo.sensorType}`
                : activeTarget}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {isScenarioTrace && (
              <span className="drill-chip">Simulasi · {phaseName.replace(/_/g, ' ')}</span>
            )}
            {latestReport && (
              <>
                <span className="text-[var(--text-muted)]">
                  {VOLCANO_ORIGIN_LABEL[volcanoRecordOrigin(latestReport)]}
                </span>
                <span
                  className={`rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-secondary)] ${
                    reportIsPlaceholder ? 'border-dashed opacity-70' : ''
                  }`}
                >
                  Amp{reportIsPlaceholder ? ' (contoh)' : ''}{' '}
                  <strong className="font-mono tabular-nums text-[var(--text-primary)]">
                    {latestReport.amplitude}
                  </strong>
                </span>
                <span
                  className={`rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-secondary)] ${
                    reportIsPlaceholder ? 'border-dashed opacity-70' : ''
                  }`}
                >
                  Durasi{reportIsPlaceholder ? ' (contoh)' : ''}{' '}
                  <strong className="font-mono tabular-nums text-[var(--text-primary)]">
                    {latestReport.duration}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Oscilloscope canvas — synthesized, captioned as such */}
      <figure className="m-0">
        <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`block w-full ${compactHud ? 'h-[68px]' : 'h-[132px]'}`}
          />
        </div>
        <figcaption className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          {isScenarioTrace && compactHud && <span className="drill-chip">Simulasi</span>}
          {isScenarioTrace
            ? 'BMKG broadband: ilustrasi skenario — bukan data sensor langsung'
            : WAVEFORM_CAPTION}
        </figcaption>
      </figure>
    </div>
  );
}
