'use client';

import { useState, useEffect } from 'react';

interface StatusBarProps {
  connected?: boolean;
  alertCount?: number;
  riskLevel?: string;
  dashboardMode: 'REAL' | 'SIMULASI';
  onModeChange: (mode: 'REAL' | 'SIMULASI') => void;
}

export default function StatusBar({
  dashboardMode,
  onModeChange,
}: StatusBarProps) {
  const [timeStr, setTimeStr] = useState({ utc: '', wib: '', wita: '', wit: '' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr({
        utc: now.toISOString().substring(11, 19) + ' UTC',
        wib:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WIB',
        wita:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Makassar',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WITA',
        wit:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jayapura',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WIT',
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="status-bar">
      <div className="status-bar__brand">
        <div className="status-bar__icon-wrapper" aria-hidden>
          <span className="status-bar__icon-mark">🇮🇩</span>
          <span className="status-bar__icon-beacon" />
        </div>
        <div>
          <div className="status-bar__title">
            <span>INATEWS SENTINEL</span>
            <span className="status-bar__version">MISSION CONTROL</span>
          </div>
          <div className="status-bar__subtitle">
            Pusat Intelijen Bencana & Megathrust Nasional · BMKG TEWS · Confluent Cloud · Apache Flink · Bedrock & Gemini AI
          </div>
        </div>
      </div>

      <div className="status-bar__center">
        <div className="status-bar__clock">
          <span className="status-bar__clock-val">{timeStr.wib || '--:--:-- WIB'}</span>
          <span className="status-bar__clock-sep">•</span>
          <span className="status-bar__clock-sub">{timeStr.wita}</span>
          <span className="status-bar__clock-sep">•</span>
          <span className="status-bar__clock-sub">{timeStr.wit}</span>
          <span className="status-bar__clock-sep">|</span>
          <span className="status-bar__clock-utc">{timeStr.utc || '--:--:-- UTC'}</span>
        </div>
      </div>

      <div className="status-bar__right">
        {/* Operation Mode Toggle */}
        <div className="status-bar__mode-switch" role="tablist" aria-label="Mode operasi">
          <button
            type="button"
            role="tab"
            aria-selected={dashboardMode === 'REAL'}
            className={`status-bar__mode-btn ${
              dashboardMode === 'REAL' ? 'status-bar__mode-btn--active-live' : ''
            }`}
            onClick={() => onModeChange('REAL')}
          >
            <span className="live-dot-pulse" style={{ width: '6px', height: '6px' }} />
            OPERASI LIVE
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dashboardMode === 'SIMULASI'}
            className={`status-bar__mode-btn ${
              dashboardMode === 'SIMULASI' ? 'status-bar__mode-btn--active-drill' : ''
            }`}
            onClick={() => onModeChange('SIMULASI')}
          >
            SIMULASI
          </button>
        </div>

        {/* Confluent Cloud Status Badge */}
        <div
          className="status-bar__cluster-badge"
          style={
            dashboardMode === 'SIMULASI'
              ? {
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  color: '#f87171',
                }
              : {
                  background: 'rgba(100, 116, 139, 0.15)',
                  borderColor: 'rgba(100, 116, 139, 0.35)',
                  color: '#94a3b8',
                }
          }
        >
          <span>{dashboardMode === 'SIMULASI' ? '⚠️' : '⏸️'}</span>
          <span>
            {dashboardMode === 'SIMULASI'
              ? 'SIMULASI (DUMMY DRILL)'
              : 'Confluent Cloud — Disabled'}
          </span>
        </div>
      </div>
    </header>
  );
}
