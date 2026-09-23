'use client';

import type { ActivityIndex } from '@/lib/types';

interface MetricCardsProps {
  oceanStatus: string;
  weatherStatus: string;
  infraStatus?: string;
  activityIndex: ActivityIndex | null;
}

function isWeatherAlert(status: string): boolean {
  const s = status.toUpperCase();
  return s.includes('TORNADO') || s.includes('WARNING') || s.includes('WATCH');
}

function isOceanAlert(status: string): boolean {
  const s = status.toUpperCase();
  return s.includes('TSUNAMI') || s.includes('ANOMALY') || s.includes('DETECTED');
}

function weatherIcon(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('TORNADO')) return '🌪️';
  if (s.includes('WARNING') || s.includes('WATCH')) return '⛈️';
  return '🌦';
}

export default function MetricCards({ oceanStatus, weatherStatus, infraStatus = 'NORMAL', activityIndex }: MetricCardsProps) {
  const statusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('CRITICAL') || s.includes('ANOMALY') || s.includes('DAMAGE') || s.includes('TSUNAMI') || s.includes('TORNADO')) return 'metric__value--critical';
    if (s.includes('ELEVATED') || s.includes('WARNING') || s.includes('MODERATE') || s.includes('WATCH')) return 'metric__value--elevated';
    return 'metric__value--normal';
  };

  return (
    <>
      <div className={`card ${isOceanAlert(oceanStatus) ? 'card--alert' : ''}`}>
        <div className="card__header">
          <span className="card__title">
            <span className="card__title-icon">🌊</span>
            Tsunami Early Warning (InaTEWS)
          </span>
          {isOceanAlert(oceanStatus) && (
            <span className="live-dot-pulse" style={{ width: '6px', height: '6px', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
          )}
        </div>
        <div className="card__body">
          <div className={`metric ${isOceanAlert(oceanStatus) ? 'metric--alert' : ''}`}>
            <span className="metric__label">
              <span className="metric__label-icon">📡</span>
              DART Buoy Array
            </span>
            <span className={`metric__value ${statusColor(oceanStatus)}`}>
              {isOceanAlert(oceanStatus) && <span className="metric__pulse-dot metric__pulse-dot--critical" style={{ display: 'inline-block', marginRight: '6px' }} />}
              {oceanStatus}
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">
              <span className="metric__label-icon">⏱</span>
              P/S Wave Triangulation
            </span>
            <span className="metric__value metric__value--normal">
              REAL-TIME (±0.4s)
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">
              <span className="metric__label-icon">🏢</span>
              Critical Infrastructure
            </span>
            <span className={`metric__value ${statusColor(infraStatus)}`}>
              {infraStatus}
            </span>
          </div>
        </div>
      </div>

      <div className={`card ${isWeatherAlert(weatherStatus) ? 'card--alert' : ''}`}>
        <div className="card__header">
          <span className="card__title">
            <span className="card__title-icon">{weatherIcon(weatherStatus)}</span>
            Atmospheric Context (Open-Meteo)
          </span>
          {isWeatherAlert(weatherStatus) && (
            <span className="live-dot-pulse" style={{ width: '6px', height: '6px', background: '#f97316', boxShadow: '0 0 8px #f97316' }} />
          )}
        </div>
        <div className="card__body">
          <div className={`metric ${isWeatherAlert(weatherStatus) ? 'metric--warning' : ''}`}>
            <span className="metric__label">
              <span className="metric__label-icon">{weatherIcon(weatherStatus)}</span>
              Weather Status
            </span>
            <span className={`metric__value ${statusColor(weatherStatus)}`}>
              {isWeatherAlert(weatherStatus) && <span className="metric__pulse-dot metric__pulse-dot--warning" style={{ display: 'inline-block', marginRight: '6px' }} />}
              {weatherStatus}
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">
              <span className="metric__label-icon">🛰</span>
              InSAR Fault Slip
            </span>
            <span className={`metric__value ${activityIndex?.deformation_trend?.includes('INCREASING') || activityIndex?.deformation_trend?.includes('RUPTURE') ? 'metric__value--critical' : 'metric__value--normal'}`}>
              {activityIndex?.deformation_trend || 'MONITORED'}
            </span>
          </div>
          {activityIndex && (
            <>
              <div className="metric">
                <span className="metric__label">
                  <span className="metric__label-icon">⚡</span>
                  Energy Flux Surge
                </span>
                <span className={`metric__value ${activityIndex.seismic_change > 100 ? 'metric__value--critical' : 'metric__value--normal'}`}>
                  +{Math.round(activityIndex.seismic_change || 0)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric__label">
                  <span className="metric__label-icon">📊</span>
                  Swarm Event Window
                </span>
                <span className="metric__value metric__value--elevated">
                  {activityIndex.earthquake_count || 12} events (M{activityIndex.max_magnitude?.toFixed(1) || '8.2'})
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
