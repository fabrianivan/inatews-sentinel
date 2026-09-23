'use client';

import { useState } from 'react';
import type { BMKGGempaDetail, RealtimeEarthquakesData, SeismicEvent } from '@/lib/types';

interface LatestQuakeCardProps {
  quake: BMKGGempaDetail | null;
  realQuakes?: RealtimeEarthquakesData | null;
  onFocusMap?: (lat: number, lon: number) => void;
}

export default function LatestQuakeCard({ quake, realQuakes, onFocusMap }: LatestQuakeCardProps) {
  const [activeTab, setActiveTab] = useState<'latest' | 'recent_bmkg' | 'recent_usgs'>('latest');
  const [showShakemap, setShowShakemap] = useState(false);

  const bmkgList: SeismicEvent[] = realQuakes?.recent_bmkg || [];
  const usgsList: SeismicEvent[] = realQuakes?.recent_usgs || [];

  if (!quake && bmkgList.length === 0) {
    return (
      <div className="card latest-quake-card">
        <div className="card__header">
          <span className="card__title">
            Gempa Terkini BMKG
          </span>
          <span className="card__badge card__badge--live">LIVE TEWS</span>
        </div>
        <div className="card__body" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
          Memuat data real BMKG TEWS...
        </div>
      </div>
    );
  }

  const mag = quake?.Magnitude ? parseFloat(quake.Magnitude) || 0 : 0;
  const isTsunami =
    (quake?.Potensi || '').toLowerCase().includes('berpotensi tsunami') &&
    !(quake?.Potensi || '').toLowerCase().includes('tidak');

  const hasDirasakan = Boolean(
    quake?.Dirasakan &&
    quake.Dirasakan.trim() !== '' &&
    quake.Dirasakan.trim() !== '-' &&
    !quake.Dirasakan.toLowerCase().includes('belum ada')
  );

  const shakemapUrl = quake?.Shakemap ? `https://data.bmkg.go.id/DataMKG/TEWS/${quake.Shakemap}` : null;

  // Extract lat/lon from Coordinates "-5.33,104.55"
  const coords = (quake?.Coordinates || '').split(',');
  const lat = coords.length === 2 ? parseFloat(coords[0]) : null;
  const lon = coords.length === 2 ? parseFloat(coords[1]) : null;

  return (
    <div className="card latest-quake-card">
      <div className="card__header" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <span className="card__title">
          Gempa Bumi Indonesia
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="card__badge card__badge--live">
            <span className="live-dot-pulse"></span>
            LIVE API
          </span>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div
        style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '4px 8px',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('latest')}
          style={{
            flex: 1,
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: activeTab === 'latest' ? 700 : 500,
            color: activeTab === 'latest' ? '#00f2ff' : 'var(--text-muted)',
            background: activeTab === 'latest' ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
            border: activeTab === 'latest' ? '1px solid rgba(0, 242, 255, 0.3)' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          ⚡ Terkini BMKG
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recent_bmkg')}
          style={{
            flex: 1,
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: activeTab === 'recent_bmkg' ? 700 : 500,
            color: activeTab === 'recent_bmkg' ? '#ff9100' : 'var(--text-muted)',
            background: activeTab === 'recent_bmkg' ? 'rgba(255, 145, 0, 0.1)' : 'transparent',
            border: activeTab === 'recent_bmkg' ? '1px solid rgba(255, 145, 0, 0.3)' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📋 M5.0+ BMKG ({bmkgList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recent_usgs')}
          style={{
            flex: 1,
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: activeTab === 'recent_usgs' ? 700 : 500,
            color: activeTab === 'recent_usgs' ? '#38bdf8' : 'var(--text-muted)',
            background: activeTab === 'recent_usgs' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            border: activeTab === 'recent_usgs' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🌐 USGS ({usgsList.length})
        </button>
      </div>

      <div className="card__body">
        {/* ================= VIEW 1: LATEST BMKG AUTOGEMPA ================= */}
        {activeTab === 'latest' && (
          <>
            {quake ? (
              <>
                {/* Main Magnitude & Epicenter Hero Banner */}
                <div className="latest-quake-hero">
                  <div className="latest-quake-hero__mag-box">
                    <span className={`latest-quake-hero__mag ${mag >= 5.0 ? 'latest-quake-hero__mag--danger' : ''}`}>
                      M{mag > 0 ? mag.toFixed(1) : '—'}
                    </span>
                    <span className="latest-quake-hero__mag-label">MAGNITUDO</span>
                  </div>

                  <div className="latest-quake-hero__details">
                    <div className="latest-quake-hero__wilayah" title={quake.Wilayah}>
                      📍 {quake.Wilayah}
                    </div>
                    <div className="latest-quake-hero__meta">
                      <span>Kedalaman {quake.Kedalaman}</span>
                      <span className="meta-sep">•</span>
                      <span>{quake.Jam}</span>
                    </div>
                    <div className="latest-quake-hero__date">
                      📅 {quake.Tanggal}
                    </div>
                  </div>
                </div>

                {/* Peringatan Dini Tsunami — Hanya jika ada peringatan */}
                {isTsunami && (
                  <div className="latest-quake-status latest-quake-status--danger">
                    <span className="latest-quake-status__icon">🚨</span>
                    <div className="latest-quake-status__text">
                      <strong>PERINGATAN DINI TSUNAMI (INATEWS)</strong>
                      <div>{quake.Potensi}</div>
                    </div>
                  </div>
                )}

                {/* Details Grid: Koordinat & Efek Gempa Dirasakan */}
                <div className="latest-quake-grid">
                  <div className="latest-quake-grid__item">
                    <span className="latest-quake-grid__label">Koordinat</span>
                    <span className="latest-quake-grid__value">{quake.Lintang}, {quake.Bujur}</span>
                  </div>
                  {hasDirasakan && (
                    <div className="latest-quake-grid__item">
                      <span className="latest-quake-grid__label">Efek Gempa Dirasakan</span>
                      <span className="latest-quake-grid__value" style={{ color: '#ff9100', fontWeight: 700 }}>
                        {quake.Dirasakan}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons: View on Map & Shakemap */}
                <div className="latest-quake-actions">
                  {lat !== null && lon !== null && onFocusMap && (
                    <button
                      type="button"
                      className="quake-action-btn"
                      onClick={() => onFocusMap(lat, lon)}
                      title="Fokuskan posisi episenter di peta"
                    >
                      🎯 Fokus di Peta
                    </button>
                  )}

                  {shakemapUrl && (
                    <button
                      type="button"
                      className="quake-action-btn quake-action-btn--secondary"
                      onClick={() => setShowShakemap(!showShakemap)}
                      title="Lihat peta guncangan BMKG"
                    >
                      🗺️ {showShakemap ? 'Tutup Shakemap' : 'Lihat Shakemap BMKG'}
                    </button>
                  )}
                </div>

                {/* Embedded Shakemap Preview */}
                {showShakemap && shakemapUrl && (
                  <div className="latest-quake-shakemap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shakemapUrl}
                      alt={`Shakemap BMKG ${quake.Wilayah}`}
                      className="latest-quake-shakemap__img"
                      loading="lazy"
                    />
                    <div className="latest-quake-shakemap__caption">
                      Peta Estimasi Tingkat Guncangan (BMKG ShakeMap)
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Belum ada data gempa terkini.
              </div>
            )}
          </>
        )}

        {/* ================= VIEW 2: RECENT BMKG M5.0+ LIST ================= */}
        {activeTab === 'recent_bmkg' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
            {bmkgList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Memuat daftar gempa M5.0+ BMKG...
              </div>
            ) : (
              bmkgList.map((q, idx) => {
                const qMag = q.magnitude || 5.0;
                const badgeBg = qMag >= 6.0 ? '#ef4444' : qMag >= 5.5 ? '#f97316' : '#eab308';
                return (
                  <div
                    key={`bmkg-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          background: badgeBg,
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '12px',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          minWidth: '42px',
                          textAlign: 'center',
                        }}
                      >
                        M{qMag.toFixed(1)}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#f1f5f9',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={q.fault_zone}
                        >
                          {q.fault_zone}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          Kedalaman {q.depth} km • {new Date(q.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(q.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </div>
                    </div>

                    {onFocusMap && q.latitude && q.longitude && (
                      <button
                        type="button"
                        onClick={() => onFocusMap(q.latitude, q.longitude)}
                        style={{
                          background: 'rgba(0, 242, 255, 0.1)',
                          border: '1px solid rgba(0, 242, 255, 0.3)',
                          color: '#00f2ff',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title="Fokuskan di peta"
                      >
                        🎯 Peta
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= VIEW 3: USGS REGIONAL LIST ================= */}
        {activeTab === 'recent_usgs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
            {usgsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Memuat data USGS regional...
              </div>
            ) : (
              usgsList.map((q, idx) => {
                const qMag = q.magnitude || 4.5;
                const badgeBg = qMag >= 6.0 ? '#ef4444' : qMag >= 5.0 ? '#0284c7' : '#0ea5e9';
                return (
                  <div
                    key={`usgs-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          background: badgeBg,
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '12px',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          minWidth: '42px',
                          textAlign: 'center',
                        }}
                      >
                        M{qMag.toFixed(1)}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#f1f5f9',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={q.fault_zone}
                        >
                          {q.fault_zone}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          Kedalaman {q.depth.toFixed(0)} km • {new Date(q.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(q.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {onFocusMap && q.latitude && q.longitude && (
                      <button
                        type="button"
                        onClick={() => onFocusMap(q.latitude, q.longitude)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title="Fokuskan di peta"
                      >
                        🎯 Peta
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

