'use client';

import { Activity, Bot, Gauge, Waves } from 'lucide-react';
import type {
  ActivityIndex,
  AIAnalysis,
  BMKGGempaDetail,
  SystemStatus,
} from '@/lib/types';

interface TacticalRibbonProps {
  latestQuake: BMKGGempaDetail | null;
  activityIndex: ActivityIndex | null;
  status: SystemStatus | null;
  aiAnalysis: AIAnalysis | null;
  stationCount?: number;
  tideCount?: number;
  variant?: 'hud' | 'grid';
}

export default function TacticalRibbon({
  latestQuake,
  activityIndex,
  status,
  aiAnalysis,
  tideCount = 20,
  variant = 'hud',
}: TacticalRibbonProps) {
  const intensity = activityIndex?.overall_percentage ?? status?.seismic_intensity ?? 15.0;
  const mag = latestQuake?.Magnitude ? parseFloat(latestQuake.Magnitude) : 0;
  const depth = latestQuake?.Kedalaman || '10 km';
  const wilayah = latestQuake?.Wilayah || 'Wilayah Perairan Indonesia';
  const tsunamiPotensi = latestQuake?.Potensi || 'Tidak berpotensi tsunami';
  const isTsunamiThreat =
    tsunamiPotensi.toLowerCase().includes('berpotensi tsunami') &&
    !tsunamiPotensi.toLowerCase().includes('tidak');

  const isBedrock =
    aiAnalysis?.model_used?.toLowerCase().includes('claude') ||
    aiAnalysis?.model_used?.toLowerCase().includes('bedrock') ||
    false;

  const isCriticalIntensity = intensity >= 70 || isTsunamiThreat;
  const riskLabel = status?.risk_level || 'NORMAL';

  if (variant === 'hud') {
    return (
      <div className="pointer-events-none flex flex-wrap items-center gap-2">
        {/* Pill 1: Gempa Terkini */}
        <div
          className={`glass-hud pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 ${
            mag >= 6.5 || isTsunamiThreat ? 'border-[var(--sev-critical-border)]' : ''
          }`}
        >
          <Activity
            className={`h-3.5 w-3.5 shrink-0 ${
              mag >= 6.5 || isTsunamiThreat
                ? 'text-[var(--sev-critical)]'
                : mag >= 5.0
                  ? 'text-[var(--sev-high)]'
                  : 'text-[var(--accent)]'
            }`}
          />
          <div className="flex items-baseline gap-1.5 text-[11px]">
            <span className="font-mono font-extrabold tabular-nums text-[var(--text-primary)]">
              {mag > 0 ? `M${mag.toFixed(1)}` : '—'}
            </span>
            <span className="max-w-[140px] truncate text-[var(--text-secondary)]" title={wilayah}>
              {wilayah}
            </span>
            <span className="hidden font-mono text-[10px] text-[var(--text-muted)] xl:inline">
              · {depth}
            </span>
          </div>
        </div>

        {/* Pill 2: Indeks MMI */}
        <div className="glass-hud pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5">
          <Gauge
            className={`h-3.5 w-3.5 shrink-0 ${
              isCriticalIntensity ? 'text-[var(--sev-critical)]' : 'text-[var(--sev-normal)]'
            }`}
          />
          <div className="flex items-baseline gap-1.5 text-[11px]">
            <span className="text-[var(--text-muted)]">MMI</span>
            <span
              className={`font-mono font-bold tabular-nums ${
                isCriticalIntensity ? 'text-[var(--sev-critical)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {intensity.toFixed(0)}%
            </span>
            <span className="font-mono text-[9px] font-bold text-[var(--accent)]">{riskLabel}</span>
          </div>
        </div>

        {/* Pill 3: Laut IOC */}
        <div className="glass-hud pointer-events-auto hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex">
          <Waves className="h-3.5 w-3.5 shrink-0 text-[var(--ocean-cyan)]" />
          <div className="flex items-baseline gap-1.5 text-[11px]">
            <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
              {tideCount} Pasut IOC
            </span>
          </div>
        </div>

        {/* Pill 4: AI Engine */}
        <div className="glass-hud pointer-events-auto hidden items-center gap-2 rounded-full px-3 py-1.5 xl:flex">
          <Bot className="h-3.5 w-3.5 shrink-0 text-[var(--satellite-purple)]" />
          <div className="flex items-baseline gap-1.5 text-[11px]">
            <span className="font-semibold text-[var(--text-primary)]">
              {isBedrock ? 'Bedrock Claude' : 'Gemini 2.5'}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
              {Math.round((aiAnalysis?.confidence || 0.9) * 100)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="matte-card grid grid-cols-2 divide-x divide-y divide-[var(--border-hairline)] sm:grid-cols-4 sm:divide-y-0">
      <div className="p-4">
        <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Gempa Terkini
        </div>
        <div className="font-display mt-1 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
          {mag > 0 ? `M${mag.toFixed(1)}` : '—'}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{wilayah}</div>
      </div>
      <div className="p-4">
        <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Intensitas MMI
        </div>
        <div className="font-display mt-1 text-2xl font-bold text-[var(--accent)] tabular-nums">
          {intensity.toFixed(1)}%
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-[var(--text-secondary)]">{riskLabel}</div>
      </div>
      <div className="p-4">
        <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Stasiun IOC
        </div>
        <div className="font-display mt-1 text-2xl font-bold text-[var(--text-primary)] tabular-nums">
          {tideCount} Pasut
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
          {status?.ocean_status || 'IOC UNESCO LIVE'}
        </div>
      </div>
      <div className="p-4">
        <div className="text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          AI Decision Support
        </div>
        <div className="font-display mt-1 truncate text-xl font-bold text-[var(--text-primary)]">
          {isBedrock ? 'Bedrock Claude' : 'Gemini 2.5'}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-[var(--accent)]">
          {aiAnalysis?.status || 'ADVISORY'}
        </div>
      </div>
    </div>
  );
}
