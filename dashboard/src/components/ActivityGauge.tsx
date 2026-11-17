'use client';

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Zap } from 'lucide-react';

interface ActivityGaugeProps {
  percentage: number;
  trend: string;
  /** Ukuran lebih kecil untuk panel HUD peta. */
  compact?: boolean;
}

export default function ActivityGauge({ percentage, trend, compact = false }: ActivityGaugeProps) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  const mmiInfo = useMemo(() => {
    if (clamped >= 85) {
      return {
        roman: 'IX–X',
        desc: 'DESTRUKTIF / SANGAT KERAS',
        color: 'var(--sev-critical)',
      };
    }
    if (clamped >= 70) {
      return {
        roman: 'VII–VIII',
        desc: 'GUNCANGAN BERAT',
        color: 'var(--sev-high)',
      };
    }
    if (clamped >= 50) {
      return {
        roman: 'V–VI',
        desc: 'GUNCANGAN KUAT',
        color: 'var(--sev-elevated)',
      };
    }
    if (clamped >= 30) {
      return {
        roman: 'III–IV',
        desc: 'GUNCANGAN SEDANG',
        color: 'var(--accent)',
      };
    }
    return {
      roman: 'I–II',
      desc: 'MIKROSEISMIK / LEMAH',
      color: 'var(--sev-normal)',
    };
  }, [clamped]);

  const upperTrend = trend.toUpperCase();
  const isRising =
    upperTrend.includes('RISING') ||
    upperTrend.includes('SPIKE') ||
    upperTrend.includes('CRITICAL') ||
    upperTrend.includes('ALERT') ||
    upperTrend.includes('ELEVATED');
  const isFalling = upperTrend.includes('FALLING') || upperTrend.includes('DECREASING');

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className={`relative ${compact ? 'h-32 w-32' : 'h-40 w-40'}`}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--border-hairline)"
            strokeWidth="10"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={mmiInfo.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
            style={{ filter: `drop-shadow(0 0 8px ${mmiInfo.color})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={`font-mono ${compact ? 'text-lg' : 'text-2xl'} font-extrabold tracking-tight`}
            style={{ color: mmiInfo.color }}
          >
            {mmiInfo.roman}
          </span>
          <span className="mt-0.5 max-w-[100px] text-[9px] font-bold leading-tight tracking-wider text-[var(--text-secondary)] uppercase">
            {mmiInfo.desc}
          </span>
          <span className="mt-1 font-mono text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
            Indeks {Math.round(clamped)}%
          </span>
        </div>
      </div>

      <div
        className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase ${
          isRising
            ? 'border-[var(--sev-critical-border)] bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]'
            : isFalling
            ? 'border-[var(--sev-elevated-border)] bg-[var(--sev-elevated-bg)] text-[var(--sev-elevated)]'
            : 'border-[var(--sev-normal-border)] bg-[var(--sev-normal-bg)] text-[var(--sev-normal)]'
        }`}
      >
        {upperTrend.includes('SPIKE') ? (
          <Zap className="h-3 w-3" />
        ) : isRising ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : isFalling ? (
          <ArrowDownRight className="h-3 w-3" />
        ) : (
          <Minus className="h-3 w-3" />
        )}
        <span>{trend}</span>
      </div>
    </div>
  );
}
