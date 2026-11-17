'use client';

import { useState, useEffect } from 'react';
import {
  FlaskConical,
  Moon,
  Radio,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface StatusBarProps {
  connected?: boolean;
  alertCount?: number;
  riskLevel?: string;
  dashboardMode: 'REAL' | 'SIMULASI';
  onModeChange: (mode: 'REAL' | 'SIMULASI') => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
}

export default function StatusBar({
  alertCount = 0,
  riskLevel = 'NORMAL',
  dashboardMode,
  onModeChange,
  theme = 'dark',
  onToggleTheme,
  isAudioMuted = true,
  onToggleAudio,
}: StatusBarProps) {
  const [timeStr, setTimeStr] = useState({ utc: '', wib: '' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr({
        utc: `${now.toISOString().substring(11, 19)} UTC`,
        wib: `${new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now)} WIB`,
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isCritical = riskLevel === 'CRITICAL' || dashboardMode === 'SIMULASI';

  return (
    <div className="glass-hud mx-auto flex h-[56px] max-w-[1600px] items-center justify-between gap-3 rounded-2xl px-3.5 sm:px-4">
      {/* Left: Brand Lockup */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative shrink-0">
          <BrandLogo size={34} />
          {isCritical && (
            <span
              aria-label="Siaga aktif"
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--sev-critical)] ring-2 ring-[var(--surface-canvas)]"
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display truncate text-sm font-bold tracking-tight text-[var(--text-primary)] sm:text-[15px]">
              INATEWS <span className="text-[var(--accent)]">SENTINEL</span>
            </span>
            {alertCount > 0 && (
              <span className="hidden items-center gap-1 rounded-full border border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--sev-critical)] sm:inline-flex">
                {alertCount} SIAGA
              </span>
            )}
          </div>
          <p className="hidden truncate text-[10px] font-medium text-[var(--text-muted)] md:block">
            BMKG TEWS · IOC UNESCO · PVMBG MAGMA · AI Sentinel
          </p>
        </div>
      </div>

      {/* Center: Atmospheric Clock */}
      <div className="hidden items-center gap-2.5 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 py-1 font-mono text-[11px] tabular-nums text-[var(--text-secondary)] lg:flex">
        <span className="live-dot-pulse shrink-0" />
        <span className="font-semibold text-[var(--text-primary)]">
          {timeStr.wib || '--:--:-- WIB'}
        </span>
        <span className="text-[var(--border-strong)]">/</span>
        <span>{timeStr.utc || '--:--:-- UTC'}</span>
      </div>

      {/* Right: Utility & Mode Controls */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {onToggleAudio && (
          <button
            type="button"
            onClick={onToggleAudio}
            title={
              isAudioMuted
                ? 'Aktifkan nada peringatan sirene Web Audio'
                : 'Bisukan nada peringatan sirene'
            }
            aria-label={isAudioMuted ? 'Aktifkan suara peringatan' : 'Bisukan suara peringatan'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              isAudioMuted
                ? 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                : 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]'
            }`}
          >
            {isAudioMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={
              theme === 'dark'
                ? 'Beralih ke Mode Peta Terang'
                : 'Beralih ke Mode Atmosferik Gelap'
            }
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Operation Mode Segmented Switch */}
        <div
          className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-0.5"
          role="group"
          aria-label="Mode operasi"
        >
          <button
            type="button"
            aria-pressed={dashboardMode === 'REAL'}
            aria-label="Operasi Live"
            title="Operasi Live — data sensor real-time"
            onClick={() => onModeChange('REAL')}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all sm:px-3 ${
              dashboardMode === 'REAL'
                ? 'bg-[var(--accent)] text-slate-950 shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Radio className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">LIVE</span>
          </button>
          <button
            type="button"
            aria-pressed={dashboardMode === 'SIMULASI'}
            aria-label="Simulasi"
            title="Mode Simulasi Megathrust"
            onClick={() => onModeChange('SIMULASI')}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all sm:px-3 ${
              dashboardMode === 'SIMULASI'
                ? 'bg-rose-600 text-white shadow-xs'
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
