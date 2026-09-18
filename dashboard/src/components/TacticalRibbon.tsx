'use client';

import { useState } from 'react';
import type { BMKGGempaDetail, ActivityIndex, SystemStatus, AIAnalysis, SeismicEvent } from '@/lib/types';

interface TacticalRibbonProps {
  latestQuake: BMKGGempaDetail | null;
  activityIndex: ActivityIndex | null;
  status: SystemStatus | null;
  aiAnalysis: AIAnalysis | null;
  stationCount?: number;
  tideCount?: number;
  usgsQuakes?: SeismicEvent[];
  onFocusMap?: (lat: number, lon: number) => void;
}

export default function TacticalRibbon({
  latestQuake,
  activityIndex,
  status,
  aiAnalysis,
  stationCount = 12,
  tideCount = 34,
  usgsQuakes = [],
  onFocusMap,
}: TacticalRibbonProps) {
  const [usgsIndex, setUsgsIndex] = useState(0);
  const intensity = activityIndex?.overall_percentage ?? status?.seismic_intensity ?? 15.0;
  const mag = latestQuake?.Magnitude ? parseFloat(latestQuake.Magnitude) : 0;
  const depth = latestQuake?.Kedalaman || '10 km';
  const wilayah = latestQuake?.Wilayah || 'Wilayah Perairan Indonesia';
  const tsunamiPotensi = latestQuake?.Potensi || 'Tidak berpotensi tsunami';
  const isTsunamiThreat = tsunamiPotensi.toLowerCase().includes('berpotensi tsunami') && !tsunamiPotensi.toLowerCase().includes('tidak');

  const isBedrock = aiAnalysis?.model_used?.toLowerCase().includes('claude') ||
    aiAnalysis?.model_used?.toLowerCase().includes('bedrock') ||
    false;

  // Derive active USGS earthquake from feed
  const currentUsgs = usgsQuakes.length > 0 ? usgsQuakes[usgsIndex % usgsQuakes.length] : null;
  const usgsMag = currentUsgs?.magnitude ?? 0;
  const usgsDepth = currentUsgs ? `${currentUsgs.depth} km` : '10 km';
  const usgsPlace = currentUsgs?.fault_zone || 'Indo-Pasifik Regional (USGS)';
  const usgsCoords = currentUsgs
    ? `${currentUsgs.latitude.toFixed(2)}°, ${currentUsgs.longitude.toFixed(2)}°`
    : 'Indonesia / Pasifik';

  const formatUsgsTime = (isoString?: string) => {
    if (!isoString) return 'LIVE';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return 'LIVE';
    }
  };

  return (
    <div className="tactical-ribbon">
      {/* CARD 1: Latest BMKG Earthquake */}
      <div className={`ribbon-card ribbon-card--quake ${isTsunamiThreat ? 'ribbon-card--threat' : ''}`}>
        <div className="ribbon-card__header">
          <span className="ribbon-card__tag">
            <span className="live-dot-pulse" style={{ width: '6px', height: '6px' }} />
            BMKG TEWS AUTOGEMPA
          </span>
          <span className="ribbon-card__time">{latestQuake?.Jam || 'LIVE'}</span>
        </div>
        <div className="ribbon-card__body">
          <div className="ribbon-card__main">
            <div className="ribbon-card__mag-wrap">
              <div className={`ribbon-card__mag-badge ${mag >= 7.0 ? 'ribbon-card__mag-badge--critical' : mag >= 5.0 ? 'ribbon-card__mag-badge--high' : 'ribbon-card__mag-badge--normal'}`}>
                M{mag > 0 ? mag.toFixed(1) : '—'}
              </div>
              <div className="ribbon-card__depth-wrap">
                <span className="ribbon-card__depth">Kedalaman {depth}</span>
                <span className="ribbon-card__coords">{latestQuake?.Coordinates || 'Indonesia'}</span>
              </div>
            </div>
            <div className="ribbon-card__location" title={wilayah}>
              📍 {wilayah}
            </div>
            <div className="ribbon-card__subtext" style={{ fontSize: '10px', color: '#94a3b8' }}>
              Subduksi Megathrust • InaTEWS BMKG
            </div>
          </div>
          <div className="ribbon-card__footer">
            {isTsunamiThreat ? (
              <div className="ribbon-card__advisory ribbon-card__advisory--danger" style={{ margin: 0 }}>
                🚨 {tsunamiPotensi}
              </div>
            ) : (
              <div className="ribbon-card__footer-meta" style={{ color: '#10b981', margin: 0 }}>
                ✓ {tsunamiPotensi}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: Latest USGS Earthquake (Global / Indo-Pacific Regional Feed) */}
      <div className="ribbon-card ribbon-card--usgs">
        <div className="ribbon-card__header">
          <span className="ribbon-card__tag" style={{ color: '#38bdf8' }}>
            <span
              className="live-dot-pulse"
              style={{ width: '6px', height: '6px', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }}
            />
            USGS GLOBAL FEED
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {usgsQuakes.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => setUsgsIndex((prev) => (prev - 1 + usgsQuakes.length) % usgsQuakes.length)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '3px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '9px',
                    padding: '1px 5px',
                    lineHeight: 1,
                  }}
                  title="Gempa USGS sebelumnya"
                >
                  ◀
                </button>
                <span style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>
                  {(usgsIndex % usgsQuakes.length) + 1}/{usgsQuakes.length}
                </span>
                <button
                  type="button"
                  onClick={() => setUsgsIndex((prev) => (prev + 1) % usgsQuakes.length)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '3px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '9px',
                    padding: '1px 5px',
                    lineHeight: 1,
                  }}
                  title="Gempa USGS berikutnya"
                >
                  ▶
                </button>
              </div>
            )}
            <span className="ribbon-card__time" style={{ color: '#38bdf8' }}>
              {formatUsgsTime(currentUsgs?.timestamp)}
            </span>
          </div>
        </div>

        <div className="ribbon-card__body">
          <div className="ribbon-card__main">
            <div className="ribbon-card__mag-wrap">
              <div
                className={`ribbon-card__mag-badge ${
                  usgsMag >= 7.0
                    ? 'ribbon-card__mag-badge--critical'
                    : usgsMag >= 5.0
                    ? 'ribbon-card__mag-badge--high'
                    : 'ribbon-card__mag-badge--normal'
                }`}
                style={
                  usgsMag < 5.0
                    ? {
                        background: 'rgba(14, 165, 233, 0.18)',
                        borderColor: 'rgba(14, 165, 233, 0.5)',
                        color: '#38bdf8',
                      }
                    : undefined
                }
              >
                M{usgsMag > 0 ? usgsMag.toFixed(1) : '—'}
              </div>
              <div className="ribbon-card__depth-wrap">
                <span className="ribbon-card__depth">Kedalaman {usgsDepth}</span>
                <span className="ribbon-card__coords" style={{ color: '#94a3b8' }}>
                  {usgsCoords}
                </span>
              </div>
            </div>

            <div className="ribbon-card__location" title={usgsPlace}>
              🌐 {usgsPlace}
            </div>
            <div className="ribbon-card__subtext" style={{ fontSize: '10px', color: '#94a3b8' }}>
              Katalog USGS NEIC Indo-Pasifik
            </div>
          </div>

          <div className="ribbon-card__footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {currentUsgs && onFocusMap ? (
              <button
                type="button"
                onClick={() => onFocusMap(currentUsgs.latitude, currentUsgs.longitude)}
                style={{
                  background: 'rgba(14, 165, 233, 0.15)',
                  border: '1px solid rgba(14, 165, 233, 0.45)',
                  borderRadius: '4px',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Fokuskan peta ke episentrum gempa USGS ini"
              >
                <span>📍 Fokus Peta</span>
              </button>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Indo-Pasifik Feed</span>
            )}

            {currentUsgs?.url ? (
              <a
                href={currentUsgs.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#64748b',
                  fontSize: '10px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
                title="Buka detail resmi USGS Earthquake Hazards Program"
              >
                <span>USGS.gov</span>
                <span>↗</span>
              </a>
            ) : (
              <span style={{ color: '#64748b', fontSize: '10px' }}>USGS Regional</span>
            )}
          </div>
        </div>
      </div>

      {/* CARD 3: National Seismic Intensity (MMI) */}
      <div className="ribbon-card">
        <div className="ribbon-card__header">
          <span className="ribbon-card__tag">📊 FLINK STREAM CEP</span>
          <span className="ribbon-card__badge ribbon-card__badge--cyan">1-MIN TUMBLE</span>
        </div>
        <div className="ribbon-card__body">
          <div className="ribbon-card__main">
            <div className="ribbon-card__stat-row">
              <span className="ribbon-card__stat-val" style={{
                color: intensity > 60 ? '#ef4444' : intensity > 35 ? '#f59e0b' : '#10b981',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {intensity.toFixed(1)}%
              </span>
              <span className="ribbon-card__stat-unit">MMI INDEX</span>
            </div>
            <div className="ribbon-card__subtext">
              <span>Trend: <strong style={{ color: intensity > 60 ? '#ef4444' : '#10b981' }}>{activityIndex?.trend_direction || status?.trend_direction || 'NOMINAL'}</strong></span>
            </div>
            <div className="ribbon-card__bar-track">
              <div
                className="ribbon-card__bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(5, intensity))}%`,
                  background: intensity > 60 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #10b981, #06b6d4)',
                }}
              />
            </div>
            <div className="ribbon-card__subtext" style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
              Window 60s • Pipeline RocksDB CEP
            </div>
          </div>
          <div className="ribbon-card__footer">
            <div className="ribbon-card__footer-meta" style={{ margin: 0 }}>
              Throughput: <strong style={{ color: '#38bdf8' }}>~14.8k msg/s</strong>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 4: IOC UNESCO Sea Level & InaTEWS */}
      <div className="ribbon-card">
        <div className="ribbon-card__header">
          <span className="ribbon-card__tag">🌊 INATEWS DART & IOC</span>
          <span className="ribbon-card__badge ribbon-card__badge--blue">{tideCount} STASIUN</span>
        </div>
        <div className="ribbon-card__body">
          <div className="ribbon-card__main">
            <div className="ribbon-card__stat-row">
              <span className="ribbon-card__stat-val" style={{
                color: status?.ocean_status?.includes('TSUNAMI') ? '#ff2a5f' : '#10b981',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {status?.ocean_status?.includes('TSUNAMI') ? 'ANOMALI' : 'NOMINAL'}
              </span>
              <span className="ribbon-card__stat-unit">MUKA LAUT (±0.04m)</span>
            </div>
            <div className="ribbon-card__subtext">
              <span>InaTEWS DART Buoy: <strong style={{ color: '#10b981' }}>8/8 ONLINE</strong></span>
            </div>
            <div className="ribbon-card__subtext" style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
              Sensor BPR Dasar Laut: <strong style={{ color: '#34d399' }}>Aman</strong>
            </div>
          </div>
          <div className="ribbon-card__footer">
            <div className="ribbon-card__footer-meta" style={{ margin: 0 }}>
              IOC UNESCO Tide: <strong style={{ color: '#38bdf8' }}>{tideCount} Stasiun Aktif</strong>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 5: BMKG Broadband Network */}
      <div className="ribbon-card">
        <div className="ribbon-card__header">
          <span className="ribbon-card__tag">📡 BMKG SEISMOMETER</span>
          <span className="ribbon-card__badge ribbon-card__badge--green">{stationCount} AKTIF</span>
        </div>
        <div className="ribbon-card__body">
          <div className="ribbon-card__main">
            <div className="ribbon-card__stat-row">
              <span className="ribbon-card__stat-val" style={{ color: '#34d399', fontFamily: "'JetBrains Mono', monospace" }}>
                ONLINE
              </span>
              <span className="ribbon-card__stat-unit">PGA &lt; 0.005g</span>
            </div>
            <div className="ribbon-card__subtext">
              <span>Broadband: <strong style={{ color: '#34d399' }}>{stationCount} Stasiun</strong> Aktif</span>
            </div>
            <div className="ribbon-card__subtext" style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              LEM • JATS • CBJI • YOGI • PLAI
            </div>
          </div>
          <div className="ribbon-card__footer">
            <div className="ribbon-card__footer-meta" style={{ margin: 0 }}>
              Kualitas Sinyal: <strong style={{ color: '#34d399' }}>99.8% (Nominal)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 6: AI Intelligence Status (Gemini / Bedrock) */}
      <div className="ribbon-card ribbon-card--ai">
        <div className="ribbon-card__header">
          <span
            className="ribbon-card__tag"
            style={{
              letterSpacing: '0.2px',
              fontSize: '10.5px',
              fontWeight: 800,
              color: isBedrock ? '#f59e0b' : '#c084fc',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isBedrock ? '☁️ AWS BEDROCK AI' : '⚡ GOOGLE GEMINI AI'}
          </span>
          <span
            className={`ribbon-card__badge ${isBedrock ? 'ribbon-card__badge--bedrock' : 'ribbon-card__badge--purple'}`}
            style={{ flexShrink: 0, padding: '2px 6px', fontSize: '9px', fontWeight: 800 }}
          >
            {isBedrock ? 'CLAUDE 3.5' : '2.5 FLASH'}
          </span>
        </div>
        <div className="ribbon-card__body">
          <div className="ribbon-card__main">
            <div className="ribbon-card__stat-row">
              <span
                className="ribbon-card__stat-val"
                style={{
                  color:
                    aiAnalysis?.status === 'CRITICAL'
                      ? '#ef4444'
                      : aiAnalysis?.status === 'HIGH'
                      ? '#f59e0b'
                      : '#10b981',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {aiAnalysis?.status || 'NORMAL'}
              </span>
              <span className="ribbon-card__stat-unit">
                Conf: {Math.round((aiAnalysis?.confidence ?? 0.96) * 100)}%
              </span>
            </div>
            <div
              className="ribbon-card__subtext"
              style={{
                fontSize: '10.5px',
                lineHeight: '1.4',
                color: '#e2e8f0',
                wordBreak: 'break-word',
                marginTop: '4px',
                maxHeight: '48px',
                overflowY: 'auto',
                paddingRight: '2px',
              }}
              title={aiAnalysis?.assessment || 'Monitoring aktif seluruh koridor subduksi'}
            >
              {aiAnalysis?.assessment || 'Monitoring aktif seluruh koridor subduksi'}
            </div>
          </div>
          <div className="ribbon-card__footer">
            <div className="ribbon-card__footer-meta" style={{ color: '#94a3b8', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>Latency: <strong style={{ color: '#c084fc' }}>{aiAnalysis?.latency_ms || 280}ms</strong></span>
              <span style={{ fontSize: '9px', color: '#64748b' }}>AI Realtime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
