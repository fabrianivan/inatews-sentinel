'use client';

import { useMemo } from 'react';

interface ActivityGaugeProps {
  percentage: number;
  trend: string;
}

export default function ActivityGauge({ percentage, trend }: ActivityGaugeProps) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const mmiInfo = useMemo(() => {
    if (percentage >= 85) return { roman: 'IX–X', desc: 'DESTRUCTIVE / DISASTROUS', color: '#ff2a5f' };
    if (percentage >= 70) return { roman: 'VII–VIII', desc: 'SEVERE / VERY STRONG', color: '#ff5722' };
    if (percentage >= 50) return { roman: 'V–VI', desc: 'STRONG SHAKING', color: '#ff9100' };
    if (percentage >= 30) return { roman: 'III–IV', desc: 'MODERATE SHAKING', color: '#ffd600' };
    return { roman: 'I–II', desc: 'MICROSEISMIC / WEAK', color: '#00e676' };
  }, [percentage]);

  const trendClass = useMemo(() => {
    if (trend.includes('RAPIDLY') || trend.includes('SURGING') || trend.includes('COLLAPSE')) return 'gauge__trend--rapid';
    if (trend.includes('INCREASING') || trend === 'HIGH' || trend.includes('WARNING')) return 'gauge__trend--increasing';
    return 'gauge__trend--stable';
  }, [trend]);

  const trendIcon = useMemo(() => {
    if (trend.includes('RAPIDLY') || trend.includes('SURGING')) return '↑↑';
    if (trend.includes('INCREASING') || trend.includes('WARNING')) return '↑';
    if (trend.includes('DECREASING')) return '↓';
    return '→';
  }, [trend]);

  return (
    <div className="gauge">
      <div className="gauge__circle">
        <svg className="gauge__svg" viewBox="0 0 160 160">
          <circle className="gauge__bg" cx="80" cy="80" r={radius} />
          <circle
            className="gauge__fill"
            cx="80"
            cy="80"
            r={radius}
            stroke={mmiInfo.color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 10px ${mmiInfo.color}60)` }}
          />
        </svg>
        <div className="gauge__value">
          <div className="gauge__percent" style={{ color: mmiInfo.color }}>
            {mmiInfo.roman}
          </div>
          <div className="gauge__label">{mmiInfo.desc}</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
            Index: {Math.round(percentage)}%
          </div>
        </div>
      </div>
      <div className={`gauge__trend ${trendClass}`}>
        <span>{trendIcon}</span>
        <span>{trend}</span>
      </div>
    </div>
  );
}
