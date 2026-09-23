'use client';

import { useState } from 'react';
import type { VolcanoEruption } from '@/lib/types';

interface VolcanoPanelProps {
  erupts: VolcanoEruption[];
  onSelectVolcano?: (name: string) => void;
  onInspectSeismogram?: (volcano: VolcanoEruption) => void;
}

export default function VolcanoPanel({
  erupts,
  onSelectVolcano,
  onInspectSeismogram,
}: VolcanoPanelProps) {
  const [selectedVolcano, setSelectedVolcano] = useState<string>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const openPreview = (imgUrl: string) => {
    setPreviewImage(imgUrl);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Extract unique volcano names for filter
  const volcanoNames = Array.from(new Set(erupts.map((e) => e.volcano_name)));

  const filteredErupts =
    selectedVolcano === 'all'
      ? erupts
      : erupts.filter((e) => e.volcano_name === selectedVolcano);

  return (
    <div className="volcano-panel">
      {/* Header Info Banner */}
      <div className="card volcano-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="volcano-header-card__icon-wrap">
            <span style={{ fontSize: '28px' }}>🌋</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Pusat Pemantauan Erupsi Gunung Api Indonesia
              </h2>
              <span className="card__badge card__badge--live">MAGMA PVMBG LIVE FEED</span>
              <span className="card__badge card__badge--neutral">KEMENTERIAN ESDM</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Informasi letusan dan aktivitas vulkanik real-time dari Pusat Vulkanologi dan Mitigasi Bencana Geologi (PVMBG - Badan Geologi).
            </p>
          </div>
        </div>

        <div className="volcano-stats-grid">
          <div className="volcano-stat-box">
            <span className="volcano-stat-box__label">TOTAL ERUPSI HARI INI</span>
            <span className="volcano-stat-box__val" style={{ color: '#ff2a5f' }}>
              {erupts.length} Letusan
            </span>
          </div>
          <div className="volcano-stat-box">
            <span className="volcano-stat-box__label">STATUS TERTINGGI</span>
            <span className="volcano-stat-box__val" style={{ color: '#ff9800' }}>
              LEVEL IV (AWAS)
            </span>
          </div>
          <div className="volcano-stat-box">
            <span className="volcano-stat-box__label">SUMBER DATA RESMI</span>
            <span className="volcano-stat-box__val" style={{ color: '#00f2ff' }}>
              MAGMA INDONESIA
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '6px' }}>
            FILTER GUNUNG:
          </span>
          <button
            className={`volcano-filter-chip ${selectedVolcano === 'all' ? 'volcano-filter-chip--active' : ''}`}
            onClick={() => setSelectedVolcano('all')}
          >
            Semua ({erupts.length})
          </button>
          {volcanoNames.map((name) => (
            <button
              key={name}
              className={`volcano-filter-chip ${selectedVolcano === name ? 'volcano-filter-chip--active' : ''}`}
              onClick={() => setSelectedVolcano(name)}
            >
              G. {name} ({erupts.filter((e) => e.volcano_name === name).length})
            </button>
          ))}
        </div>
      </div>

      {/* Eruptions Cards Grid */}
      <div className="volcano-grid">
        {filteredErupts.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tidak ada data letusan untuk filter yang dipilih.
          </div>
        ) : (
          filteredErupts.map((e) => {
            const isAwas = e.alert_level.includes('AWAS');
            const isSiaga = e.alert_level.includes('SIAGA');

            return (
              <div key={e.id} className="card volcano-card">
                <div className="volcano-card__header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="volcano-card__icon">🌋</span>
                    <div>
                      <h3 className="volcano-card__name">Gunung {e.volcano_name}</h3>
                      <span className="volcano-card__time">⏱ {e.time} ({e.date})</span>
                    </div>
                  </div>

                  <span
                    className={`volcano-card__level-badge ${
                      isAwas
                        ? 'volcano-card__level-badge--awas'
                        : isSiaga
                        ? 'volcano-card__level-badge--siaga'
                        : 'volcano-card__level-badge--waspada'
                    }`}
                  >
                    {e.alert_level}
                  </span>
                </div>

                <div className="volcano-card__body">
                  <p className="volcano-card__desc">{e.description}</p>

                  {/* Telemetry Metrics Row */}
                  <div className="volcano-card__metrics">
                    <div className="volcano-metric-item">
                      <span className="volcano-metric-item__label">AMPLITUDO MAKS</span>
                      <span className="volcano-metric-item__val">{e.amplitude}</span>
                    </div>
                    <div className="volcano-metric-item">
                      <span className="volcano-metric-item__label">DURASI GEMPA</span>
                      <span className="volcano-metric-item__val">{e.duration}</span>
                    </div>
                    <div className="volcano-metric-item">
                      <span className="volcano-metric-item__label">KOLOM ABU</span>
                      <span className="volcano-metric-item__val" style={{ fontSize: '11px' }}>
                        {e.visual_ash}
                      </span>
                    </div>
                  </div>

                  {/* Photo / Seismogram from MAGMA ESDM */}
                  {e.image_url && (
                    <div
                      className="volcano-card__img-wrap"
                      onClick={() => openPreview(e.image_url || '')}
                      title="Klik untuk memperbesar gambar"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.image_url}
                        alt={`Erupsi G. ${e.volcano_name}`}
                        className="volcano-card__img"
                        loading="lazy"
                      />
                      <div className="volcano-card__img-overlay">
                        🔍 Perbesar Foto Erupsi / Seismogram PVMBG
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="volcano-card__rec">
                    <strong>🛡️ Rekomendasi Mitigasi PVMBG:</strong>
                    <div>{e.recommendation}</div>
                  </div>

                  {/* Actions: View in Seismograph & Inspect Seismogram */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0 6px' }}>
                    <button
                      onClick={() => {
                        onSelectVolcano?.(e.volcano_name);
                        const el = document.getElementById('seismograph-container') || document.getElementById('section-operasional');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: 'rgba(0, 242, 255, 0.08)',
                        border: '1px solid rgba(0, 242, 255, 0.3)',
                        color: '#00f2ff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      📊 Ke Seismograf
                    </button>
                    <button
                      onClick={() => onInspectSeismogram?.(e)}
                      style={{
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(0, 242, 255, 0.1))',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#c084fc',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      🔬 Analisis Sinyal
                    </button>
                  </div>

                  {/* Footer & Detail Button */}
                  <div className="volcano-card__footer">
                    <span className="volcano-card__author">✍️ {e.author}</span>
                    {e.detail_url && (
                      <a
                        href={e.detail_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="volcano-card__link-btn"
                      >
                        ↗ Laporan Lengkap PVMBG
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div className="volcano-lightbox" onClick={() => setPreviewImage(null)}>
          <div
            className="volcano-lightbox__content"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: '92vw',
              maxHeight: '92vh',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Zoom Controls Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(6, 10, 20, 0.9)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '10px',
                zIndex: 10,
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f2ff' }}>🔍 Zoom:</span>
              <button
                onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                −
              </button>
              {[1, 1.5, 2].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    setZoom(lvl);
                    if (lvl === 1) setPan({ x: 0, y: 0 });
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: zoom === lvl ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: zoom === lvl ? '#00f2ff' : 'var(--text-secondary)',
                    border: `1px solid ${zoom === lvl ? '#00f2ff' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {lvl}x
                </button>
              ))}
              <button
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                ⟲ Reset
              </button>
            </div>

            {/* Draggable Pan Image Container */}
            <div
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.2 : -0.2;
                setZoom((z) => Math.max(0.75, Math.min(3.5, Number((z + delta).toFixed(2)))));
              }}
              onMouseDown={(e) => {
                if (zoom <= 1) return;
                setIsDragging(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }}
              onMouseMove={(e) => {
                if (!isDragging || zoom <= 1) return;
                setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              style={{
                width: '100%',
                maxHeight: '78vh',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Foto Erupsi PVMBG"
                className="volcano-lightbox__img"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <button
              className="volcano-lightbox__close-btn"
              onClick={() => setPreviewImage(null)}
            >
              ✕ Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
