'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ForecastData } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

function riskColor(level: string): string {
  switch (level) {
    case 'CRITICAL': return '#ff2a5f';
    case 'HIGH': return '#ff9100';
    case 'ELEVATED': return '#f59e0b';
    default: return '#10b981';
  }
}

function trendIcon(dir: string): string {
  if (dir.includes('RAPIDLY_INCREASING') || dir.includes('RAPIDLY_RISING')) return '↗↗';
  if (dir.includes('INCREASING') || dir.includes('RISING')) return '↗';
  if (dir.includes('STABLE')) return '→';
  if (dir.includes('DECREASING') || dir.includes('RECEDING')) return '↘';
  if (dir.includes('RAPIDLY_DECREASING') || dir.includes('RAPIDLY_RECEDING')) return '↘↘';
  return '→';
}

function metricLabel(m: string): string {
  switch (m) {
    case 'seismic_intensity': return 'Intensitas Seismik';
    case 'wave_height': return 'Tinggi Gelombang (m)';
    default: return m;
  }
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 32;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ opacity: 0.8 }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export default function ForecastPanel() {
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [history, setHistory] = useState<Record<string, number[]>>({});

  const fetchForecast = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/forecast` : '/api/forecast';
    fetch(targetUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ForecastData[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          setForecasts(data);
          setHistory((prev) => {
            const next = { ...prev };
            for (const f of data) {
              const key = f.target_metric;
              if (!next[key]) next[key] = [];
              next[key] = [...next[key], f.current_value].slice(-20);
            }
            return next;
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 15000);
    return () => clearInterval(interval);
  }, [fetchForecast]);

  if (forecasts.length === 0) {
    return (
      <div className="card">
        <div className="card__header">
          <span className="card__title"><span>🔮</span> AI/ML Forecast Pipeline</span>
          <span className="card__badge" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid #a855f7', color: '#a855f7' }}>CONFLUENT ML</span>
        </div>
        <div className="card__body" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          <div style={{ marginBottom: '8px', fontSize: '24px' }}>⏳</div>
          Menunggu data forecast dari Flink SQL pipeline...
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            gempa.forecast • TrendExtrapolation + TsunamiPropagation models
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <span style={{ fontSize: '20px' }}>🔮</span>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#e2e8f0' }}>AI/ML Forecast Pipeline</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Confluent Cloud Flink SQL • TrendExtrapolation + TsunamiPropagation • gempa.forecast
          </div>
        </div>
        <span style={{
          marginLeft: 'auto',
          background: 'rgba(168,85,247,0.15)',
          border: '1px solid #a855f7',
          color: '#a855f7',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          {forecasts.length} ACTIVE MODELS
        </span>
      </div>

      {forecasts.map((f) => {
        const color = riskColor(f.risk_level);
        const sparkData = history[f.target_metric] || [];
        return (
          <div key={f.forecast_id} style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: `1px solid ${color}33`,
            borderRadius: '10px',
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: color, boxShadow: `0 0 8px ${color}`,
              }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                {metricLabel(f.target_metric)}
              </span>
              <span style={{
                marginLeft: 'auto',
                fontSize: '11px', fontWeight: 700,
                color, background: `${color}18`,
                border: `1px solid ${color}44`,
                padding: '2px 8px', borderRadius: '4px',
              }}>
                {f.risk_level}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {trendIcon(f.trend_direction)} {f.trend_direction.replace(/_/g, ' ')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>SEKARANG</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#e2e8f0' }}>{f.current_value.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>+5 MIN</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: riskColor(f.predicted_5min > f.current_value * 1.2 ? 'HIGH' : 'NORMAL') }}>
                  {f.predicted_5min.toFixed(1)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>+15 MIN</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: riskColor(f.predicted_15min > f.current_value * 1.3 ? 'ELEVATED' : 'NORMAL') }}>
                  {f.predicted_15min.toFixed(1)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>+30 MIN</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: riskColor(f.predicted_30min > f.current_value * 1.4 ? 'ELEVATED' : 'NORMAL') }}>
                  {f.predicted_30min.toFixed(1)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>TREND SPARKLINE</span>
                <Sparkline values={sparkData} color={color} />
              </div>
              <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto', fontSize: '11px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Anomaly: </span>
                  <span style={{ color: f.anomaly_score > 2.0 ? '#ff2a5f' : f.anomaly_score > 1.0 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                    {f.anomaly_score.toFixed(2)}σ
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Confidence: </span>
                  <span style={{ color: '#a855f7', fontWeight: 700 }}>{(f.confidence * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Model: </span>
                  <span style={{ color: '#94a3b8' }}>{f.model}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
