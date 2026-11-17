'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Activity,
  Clock,
  Image as ImageIcon,
  MapPin,
  Microscope,
  Mountain,
  RotateCcw,
  ScrollText,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { VolcanoEruption } from '@/lib/types';
import {
  INDONESIAN_VOLCANOES,
  buildVolcanoInspectionReport,
  findVolcanoLocation,
  getVolcanoReports,
} from '@/lib/volcanoData';
import VolcanoChip from './VolcanoChip';

interface VolcanoSeismographHubProps {
  volcanoes: VolcanoEruption[];
  selectedVolcano?: string | null;
  onSelectVolcano?: (name: string) => void;
  onInspectSeismogram?: (volcano: VolcanoEruption) => void;
  theme?: 'dark' | 'light';
}

export default function VolcanoSeismographHub({
  volcanoes,
  selectedVolcano = 'Anak Krakatau',
  onSelectVolcano,
  onInspectSeismogram,
  theme = 'dark',
}: VolcanoSeismographHubProps) {
  const [activeVolcano, setActiveVolcano] = useState<string>(selectedVolcano || 'Anak Krakatau');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPreviewDragging, setIsPreviewDragging] = useState<boolean>(false);
  const [previewDragStart, setPreviewDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<number[]>([]);

  const openPreview = (imgUrl: string) => {
    setPreviewImage(imgUrl);
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (selectedVolcano) {
      setActiveVolcano(selectedVolcano);
    }
  }, [selectedVolcano]);

  const geo = useMemo(
    () => findVolcanoLocation(activeVolcano) || INDONESIAN_VOLCANOES[0],
    [activeVolcano]
  );

  const volcanoHistory = useMemo(() => getVolcanoReports(geo, volcanoes), [geo, volcanoes]);

  const latestReport = useMemo(
    () => buildVolcanoInspectionReport(geo, volcanoes),
    [geo, volcanoes]
  );

  const alertLevel = latestReport.alert_level || geo.defaultLevel;
  const isAwas = alertLevel.includes('AWAS');
  const isSiaga = alertLevel.includes('SIAGA');
  const isWaspada = alertLevel.includes('WASPADA');
  const ampNum = parseFloat(latestReport.amplitude.replace(/[^0-9.]/g, '')) || 20;

  const configRef = useRef({ ampNum, isAwas, isSiaga, isWaspada, theme });
  useEffect(() => {
    configRef.current = { ampNum, isAwas, isSiaga, isWaspada, theme };
  }, [ampNum, isAwas, isSiaga, isWaspada, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = 130);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 400;
    };
    window.addEventListener('resize', handleResize);

    const maxPoints = 280;
    if (pointsRef.current.length === 0) {
      pointsRef.current = new Array(maxPoints).fill(height / 2);
    }

    let tick = 0;

    const render = () => {
      tick++;
      const {
        ampNum: amp,
        isAwas: awas,
        isSiaga: siaga,
        isWaspada: waspada,
        theme: currentTheme,
      } = configRef.current;
      const midY = height / 2;

      const ampScale = Math.min(42, Math.max(8, amp * 0.75));
      const tremor = Math.sin(tick * 0.42) * (ampScale * 0.35);
      const fluidResonance = Math.sin(tick * 0.88) * (ampScale * 0.28);
      const lp = Math.sin(tick * 0.14) * (ampScale * 0.4);
      const burstProb = awas ? 0.22 : siaga ? 0.12 : 0.05;
      const burst = Math.random() < burstProb ? (Math.random() - 0.5) * ampScale * 1.6 : 0;

      const offset = Math.max(
        -height / 2 + 8,
        Math.min(height / 2 - 8, tremor + fluidResonance + lp + burst)
      );
      pointsRef.current.push(midY + offset);
      if (pointsRef.current.length > maxPoints) pointsRef.current.shift();

      const isLight = currentTheme === 'light';
      ctx.fillStyle = isLight ? '#f4f8fc' : '#050914';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.24)' : 'rgba(34, 211, 238, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const strokeColor = awas
        ? '#fb7185'
        : siaga
        ? '#fb923c'
        : waspada
        ? '#fbbf24'
        : isLight
        ? '#0284c7'
        : '#22d3ee';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();

      const dx = width / (pointsRef.current.length - 1);
      for (let i = 0; i < pointsRef.current.length; i++) {
        const x = i * dx;
        const y = pointsRef.current[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
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
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [geo]);

  const handleSelectVolcano = (name: string) => {
    setActiveVolcano(name);
    onSelectVolcano?.(name);
  };

  /** Opens the PVMBG analysis for one volcano and makes it the active one in the hub. */
  const handleAnalyzeVolcano = (name: string) => {
    const location = findVolcanoLocation(name);
    if (!location) return;
    handleSelectVolcano(location.name);
    onInspectSeismogram?.(buildVolcanoInspectionReport(location, volcanoes));
  };

  const levelBadgeClass = isAwas
    ? 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]'
    : isSiaga
    ? 'border-[var(--sev-high-border)] bg-[var(--sev-high-bg)] text-[var(--sev-high)]'
    : 'border-[var(--sev-elevated-border)] bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]';

  return (
    <div className="matte-card flex flex-col gap-5 p-5 sm:p-6">
      {/* Header + Volcano Filter Strip */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--sev-high-border)] bg-[var(--sev-high-bg)] text-[var(--sev-high)]">
              <Mountain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Pusat Seismograf &amp; Citra Vulkanik PVMBG
                </h2>
                <span className="rounded border border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--sev-normal)]">
                  MAGMA ESDM LIVE
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Pemantauan gelombang seismograf pos pengamatan gunung api aktif dan arsip laporan erupsi PVMBG.
              </p>
            </div>
          </div>
        </div>

        {/* Every volcano carries its own Analisis PVMBG action */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {INDONESIAN_VOLCANOES.map((v) => (
            <VolcanoChip
              key={v.name}
              name={v.name}
              selected={geo.name === v.name}
              reportCount={getVolcanoReports(v, volcanoes).length}
              onSelect={() => handleSelectVolcano(v.name)}
              onAnalyze={() => handleAnalyzeVolcano(v.name)}
            />
          ))}
        </div>
      </div>

      {/* Main Split: Live Waveform Drum + Latest PVMBG Seismogram */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: Waveform Drum */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[var(--accent)]">
              <Activity className="h-3.5 w-3.5" />
              REKAMAN SEISMOGRAF TERKINI
            </span>
            <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${levelBadgeClass}`}>
              {alertLevel}
            </span>
          </div>

          <div className="text-xs text-[var(--text-secondary)]">
            <div className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />
              {geo.pgaStation} · {geo.province}
            </div>
            <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
              {geo.pos[0].toFixed(3)}°S, {geo.pos[1].toFixed(3)}°E · Elevasi {geo.elevation} mdpl · {geo.sensorType}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <canvas ref={canvasRef} className="block h-[130px] w-full" />
            <div className="border-t border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1 font-mono text-[10px] text-[var(--text-muted)]">
              KOMPONEN Z · 100 Hz REAL-TIME · AMP: {latestReport.amplitude}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className="text-[10px] text-[var(--text-muted)]">Amplitudo Maks</div>
              <div className="font-mono text-sm font-bold text-[var(--sev-critical)]">
                {latestReport.amplitude}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className="text-[10px] text-[var(--text-muted)]">Durasi Gempa</div>
              <div className="font-mono text-sm font-bold text-[var(--sev-high)]">
                {latestReport.duration}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-2">
              <div className="text-[10px] text-[var(--text-muted)]">Waktu Terkini</div>
              <div className="truncate font-mono text-xs font-bold text-[var(--accent)]">
                {latestReport.time}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Image & Inspection */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[var(--sev-high)]">
              <ImageIcon className="h-3.5 w-3.5" />
              CITRA SEISMOGRAM PVMBG
            </span>
            <button
              type="button"
              onClick={() => onInspectSeismogram?.(latestReport)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-1)]"
            >
              <Microscope className="h-3.5 w-3.5" />
              <span>Analisis PVMBG</span>
            </button>
          </div>

          <div
            onClick={() => {
              if (latestReport.image_url) openPreview(latestReport.image_url);
              else onInspectSeismogram?.(latestReport);
            }}
            title="Klik untuk memperbesar gambar seismogram"
            className="relative flex h-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)]"
          >
            {latestReport.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={latestReport.image_url}
                alt={`Seismogram ${geo.name}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="p-4 text-center">
                <Activity className="mx-auto mb-2 h-6 w-6 text-[var(--accent)]" />
                <div className="text-xs font-bold text-[var(--text-primary)]">
                  Rekaman Sinyal Erupsi G. {geo.name}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">
                  Amplitudo {latestReport.amplitude} · Durasi {latestReport.duration}
                </div>
                <div className="mt-2 text-[11px] font-semibold text-[var(--accent)]">
                  Klik untuk membuka rekonstruksi &amp; analisis fisis
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-2.5 text-xs text-[var(--text-secondary)]">
            <div>
              <strong className="text-[var(--sev-high)]">Pengamatan Kawah:</strong>{' '}
              {latestReport.visual_ash}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              Petugas Pos: {latestReport.author} · {latestReport.date}
            </div>
          </div>
        </div>
      </div>

      {/* History Grid */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-xs font-bold text-[var(--text-primary)]">
              Riwayat Erupsi &amp; Seismogram: G. {geo.name}
            </h3>
            <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
              {volcanoHistory.length > 0
                ? `${volcanoHistory.length} Kejadian`
                : 'Monitoring Rutin'}
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            Sumber: MAGMA Indonesia PVMBG
          </span>
        </div>

        {volcanoHistory.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-hairline)] bg-[var(--surface-2)] p-6 text-center text-xs text-[var(--text-muted)]">
            Belum ada letusan besar baru tercatat hari ini untuk G. {geo.name}. Seismograf merekam micro-tremor latar belakang.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {volcanoHistory.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3"
              >
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent)]">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </span>
                  <span className="text-[var(--text-muted)]">{item.date}</span>
                </div>

                {item.image_url && (
                  <div
                    onClick={() => openPreview(item.image_url!)}
                    className="h-24 cursor-pointer overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--surface-1)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt={`Seismogram ${item.time}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2.5 py-1 font-mono text-[11px]">
                  <span>
                    Amp: <strong className="text-[var(--sev-critical)]">{item.amplitude}</strong>
                  </span>
                  <span>
                    Durasi: <strong className="text-[var(--sev-high)]">{item.duration}</strong>
                  </span>
                </div>

                <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>

                <button
                  type="button"
                  onClick={() => onInspectSeismogram?.(item)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-1)]"
                >
                  <Microscope className="h-3.5 w-3.5" />
                  <span>Analisis Sinyal &amp; Citra</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {previewImage && (
        <div className="volcano-lightbox" onClick={() => setPreviewImage(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-3 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3 py-1.5 shadow-md">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-primary)]"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              {[1, 1.5, 2, 2.5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setPreviewZoom(lvl);
                    if (lvl === 1) setPreviewPan({ x: 0, y: 0 });
                  }}
                  className={`rounded border px-2 py-1 font-mono text-[11px] font-bold ${
                    previewZoom === lvl
                      ? 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-secondary)]'
                  }`}
                >
                  {lvl}x
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-primary)]"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewZoom(1);
                  setPreviewPan({ x: 0, y: 0 });
                }}
                className="inline-flex items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="inline-flex items-center gap-1 rounded border border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--sev-critical)]"
              >
                <X className="h-3.5 w-3.5" />
                <span>Tutup</span>
              </button>
            </div>

            <div
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.2 : -0.2;
                setPreviewZoom((z) => Math.max(0.75, Math.min(3.5, Number((z + delta).toFixed(2)))));
              }}
              onMouseDown={(e) => {
                if (previewZoom <= 1) return;
                setIsPreviewDragging(true);
                setPreviewDragStart({
                  x: e.clientX - previewPan.x,
                  y: e.clientY - previewPan.y,
                });
              }}
              onMouseMove={(e) => {
                if (!isPreviewDragging || previewZoom <= 1) return;
                setPreviewPan({
                  x: e.clientX - previewDragStart.x,
                  y: e.clientY - previewDragStart.y,
                });
              }}
              onMouseUp={() => setIsPreviewDragging(false)}
              onMouseLeave={() => setIsPreviewDragging(false)}
              className="flex max-h-[78vh] w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]"
              style={{
                cursor: previewZoom > 1 ? (isPreviewDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Seismogram PVMBG"
                style={{
                  transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                  transition: isPreviewDragging ? 'none' : 'transform 0.15s ease',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                className="max-h-[76vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
