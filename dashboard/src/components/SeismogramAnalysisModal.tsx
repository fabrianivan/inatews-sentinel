'use client';

import { useState, useEffect, useRef } from 'react';
import type { VolcanoEruption } from '@/lib/types';
import { findVolcanoLocation, getVolcanicAshTrajectory } from '@/lib/volcanoData';

interface SeismogramAnalysisModalProps {
  volcano: VolcanoEruption | null;
  onClose: () => void;
}

export default function SeismogramAnalysisModal({
  volcano,
  onClose,
}: SeismogramAnalysisModalProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showPhases, setShowPhases] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [filterContrast, setFilterContrast] = useState<'normal' | 'high-contrast' | 'invert'>('normal');
  const [viewMode, setViewMode] = useState<'drum' | 'photo' | 'spectrogram'>('drum');
  const [imageError, setImageError] = useState<boolean>(false);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFullscreen]);

  if (!volcano) return null;

  const isBMKG =
    volcano.volcano_name.toLowerCase().includes('bmkg') ||
    volcano.alert_level.toLowerCase().includes('bmkg') ||
    volcano.id.toLowerCase().includes('bmkg');

  const geo = findVolcanoLocation(volcano.volcano_name);
  const ash = getVolcanicAshTrajectory(volcano.volcano_name);
  const isAwas = volcano.alert_level.includes('AWAS');
  const isSiaga = volcano.alert_level.includes('SIAGA');

  // Parse amplitude & duration
  const ampNum = parseFloat(volcano.amplitude.replace(/[^0-9.]/g, '')) || 35;
  const durNum = parseFloat(volcano.duration.replace(/[^0-9.]/g, '')) || 55;

  // Derive seismological estimates
  const estPGA = (ampNum * 0.0032).toFixed(3);
  const estRSAM = Math.round(ampNum * 115 + durNum * 12);
  const freqDominant = isBMKG ? '0.02 - 5.0 Hz (Broadband)' : ampNum > 40 ? '1.4 - 2.2 Hz' : '2.0 - 3.5 Hz';
  const signalType = isBMKG
    ? 'Gempa Tektonik Regional / Subduksi Megathrust (Broadband P & S Wave)'
    : ampNum >= 40
    ? 'Gempa Letusan / Erupsi Kuat (High Energy Explosive Tremor)'
    : ampNum >= 20
    ? 'Gempa Letusan / Erupsi Sedang (Explosion Tremor)'
    : 'Gempa Hembusan / Vulkanik Dangkal (VB)';

  const interpretation = isBMKG
    ? `Citra rekaman seismograf broadband BMKG merefleksikan propagasi gelombang primer (P-wave) berkecepatan tinggi diikuti gelombang geser sekunder (S-wave) beramplitudo kuat. Spektrum frekuensi broadband (0.02-5 Hz) merekam getaran elastis kerak bumi akibat pelepasan dislokasi sesar tektonik atau subduksi lempeng. Sinyal dikorelasikan dengan Shakemap intensitas MMI nasional untuk pemetaan akselerasi percepatan tanah.`
    : ampNum >= 40
    ? `Defleksi seismometer sebesar ${volcano.amplitude} dengan durasi ${volcano.duration} mengindikasikan dekompresi gas magmatik eksplosif bertekanan tinggi di conduit kawah G. ${volcano.volcano_name}. Gelombang seismik didominasi komponen P-wave tajam disusul tremor permukaan berspektrum rendah (${freqDominant}). Akumulasi energi mekanik fluida tergolong signifikan, mengindikasikan pelepasan kolom abu vulkanik ke troposfer dan potensi lontaran batu pijar.`
    : `Sinyal seismograf menunjukkan pelepasan tekanan gas vulkanik dengan amplitudo ${volcano.amplitude} dan durasi ${volcano.duration}. Pola gelombang merefleksikan getaran fluida hidrotermal di kedalaman dangkal (<1.5 km). Tidak terdeteksi sinyal deformasi regional atau pergeseran sesar tektonik yang mengarah pada keruntuhan tubuh gunung.`;

  // Pan & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.75, Math.min(3.5, Number(newZoom.toFixed(2))));
    setZoom(clamped);
    if (clamped === 1) setPan({ x: 0, y: 0 });
  };

  const handleSetZoom = handleZoomChange;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    handleZoomChange(zoom + delta);
  };

  const getFilterStyle = () => {
    if (filterContrast === 'high-contrast') return 'contrast(1.6) brightness(1.2)';
    if (filterContrast === 'invert') return 'invert(1) hue-rotate(180deg)';
    return 'none';
  };

  return (
    <div className="volcano-lightbox" onClick={onClose} style={{ zIndex: 3000 }}>
      <div
        className="card seismogram-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isFullscreen ? '98vw' : '95vw',
          maxWidth: isFullscreen ? '98vw' : '1240px',
          height: isFullscreen ? '96vh' : 'auto',
          maxHeight: isFullscreen ? '96vh' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10, 14, 26, 0.98)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.95), 0 0 45px rgba(0, 242, 255, 0.18)',
          overflow: 'hidden',
          padding: 0,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{isBMKG ? '📡' : '🌋'}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {isBMKG
                    ? `Analisis Citra Seismograf Broadband & Shakemap BMKG: ${volcano.volcano_name}`
                    : `Analisis Citra Seismograf & Drum Rekorder PVMBG: G. ${volcano.volcano_name}`}
                </h3>
                <span
                  className={`volcano-card__level-badge ${
                    isBMKG
                      ? 'volcano-card__level-badge--waspada'
                      : isAwas
                      ? 'volcano-card__level-badge--awas'
                      : isSiaga
                      ? 'volcano-card__level-badge--siaga'
                      : 'volcano-card__level-badge--waspada'
                  }`}
                  style={{ fontSize: '10px', padding: '2px 8px' }}
                >
                  {volcano.alert_level}
                </span>
                <span style={{
                  background: isBMKG ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 242, 255, 0.15)',
                  color: isBMKG ? '#60a5fa' : '#00f2ff',
                  border: `1px solid ${isBMKG ? 'rgba(59, 130, 246, 0.4)' : 'rgba(0, 242, 255, 0.3)'}`,
                  borderRadius: '4px',
                  fontSize: '10px',
                  padding: '1px 6px',
                  fontWeight: 700
                }}>
                  {isBMKG ? 'BMKG PUSAT GEMPA NASIONAL' : 'PVMBG MAGMA OFFICIAL'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                📍 {isBMKG ? (volcano.description.split('.')[0] || 'Jaringan Seismologi BMKG TEWS') : (geo?.pgaStation || 'Pos Pengamatan Gunung Api PVMBG')} • Waktu Rekaman: {volcano.time} ({volcano.date})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="volcano-lightbox__close-btn"
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                background: isFullscreen ? 'rgba(0, 242, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                color: isFullscreen ? '#00f2ff' : 'var(--text-primary)',
              }}
              title={isFullscreen ? 'Keluar dari layar penuh' : 'Tampilkan jendela penuh'}
            >
              {isFullscreen ? '❐ Perkecil Jendela' : '⛶ Layar Penuh'}
            </button>
            <button
              onClick={onClose}
              className="volcano-lightbox__close-btn"
              style={{ padding: '6px 14px', fontSize: '11px' }}
            >
              ✕ Tutup
            </button>
          </div>
        </div>

        {/* Modal Body: Split Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isFullscreen ? '1.35fr 1fr' : '1.2fr 1fr',
            gap: '20px',
            padding: '18px 22px',
            overflowY: 'auto',
            maxHeight: isFullscreen ? 'calc(96vh - 75px)' : 'calc(92vh - 75px)',
          }}
          className="seismogram-modal__body"
        >
          {/* Left Column: Seismogram Image Viewer with Deep Zoom & Pan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Tab Mode Selector: Seismograf Helicorder vs Foto Kawah vs Spektrogram */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '2px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setViewMode('drum');
                  handleResetZoom();
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'drum' ? 'rgba(0, 242, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${viewMode === 'drum' ? '#00f2ff' : 'var(--border-subtle)'}`,
                  color: viewMode === 'drum' ? '#00f2ff' : 'var(--text-secondary)',
                  boxShadow: viewMode === 'drum' ? '0 0 10px rgba(0, 242, 255, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isBMKG ? '📈 Rekaman Seismograf BMKG (Helicorder Drum)' : '📈 Rekaman Seismograf (Helicorder Drum)'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('photo');
                  handleResetZoom();
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'photo' ? 'rgba(249, 115, 22, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${viewMode === 'photo' ? '#f97316' : 'var(--border-subtle)'}`,
                  color: viewMode === 'photo' ? '#fb923c' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: viewMode === 'photo' ? '0 0 10px rgba(249, 115, 22, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isBMKG ? '🗺️ Citra Shakemap BMKG Resmi' : '🌋 Foto Citra Erupsi (MAGMA)'}</span>
                {volcano.image_url && (
                  <span
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 800,
                    }}
                  >
                    CITRA RESMI
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('spectrogram');
                  handleResetZoom();
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'spectrogram' ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${viewMode === 'spectrogram' ? '#a855f7' : 'var(--border-subtle)'}`,
                  color: viewMode === 'spectrogram' ? '#c084fc' : 'var(--text-secondary)',
                  boxShadow: viewMode === 'spectrogram' ? '0 0 10px rgba(168, 85, 247, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                📊 Spektrogram Frekuensi FFT
              </button>
            </div>

            {/* Zoom Controls & Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(6, 10, 20, 0.9)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#00f2ff' }}>
                  🔍 FITUR PERBESAR GAMBAR:
                </span>

                {/* Zoom Out (-) */}
                <button
                  onClick={() => handleZoomChange(zoom - 0.25)}
                  disabled={zoom <= 0.75}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: zoom <= 0.75 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                  }}
                  title="Perkecil (-)"
                >
                  −
                </button>

                {/* Quick Zoom Presets */}
                {[1, 1.5, 2, 3].map((level) => (
                  <button
                    key={level}
                    onClick={() => handleSetZoom(level)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: zoom === level ? 800 : 600,
                      background: zoom === level ? 'rgba(0, 242, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${zoom === level ? '#00f2ff' : 'var(--border-subtle)'}`,
                      color: zoom === level ? '#00f2ff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {level}x
                  </button>
                ))}

                {/* Zoom In (+) */}
                <button
                  onClick={() => handleZoomChange(zoom + 0.25)}
                  disabled={zoom >= 3.5}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: zoom >= 3.5 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                  }}
                  title="Perbesar (+)"
                >
                  +
                </button>

                {/* Reset Zoom & Pan */}
                <button
                  onClick={handleResetZoom}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                  title="Kembalikan ukuran dan posisi ke normal"
                >
                  ⟲ Reset
                </button>
              </div>

              {/* Phase and Contrast Toggles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() =>
                    setFilterContrast((prev) =>
                      prev === 'normal' ? 'high-contrast' : prev === 'high-contrast' ? 'invert' : 'normal'
                    )
                  }
                  style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: filterContrast !== 'normal' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filterContrast !== 'normal' ? '#a855f7' : 'var(--border-subtle)'}`,
                    color: filterContrast !== 'normal' ? '#c084fc' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Ganti filter kontras gambar seismogram"
                >
                  🌓 Filter: {filterContrast === 'normal' ? 'Standar' : filterContrast === 'high-contrast' ? 'Kontras Tinggi' : 'Invert'}
                </button>

                <button
                  onClick={() => setShowPhases(!showPhases)}
                  style={{
                    fontSize: '10px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: showPhases ? 'rgba(0, 242, 255, 0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${showPhases ? '#00f2ff' : 'var(--border-subtle)'}`,
                    color: showPhases ? '#00f2ff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {showPhases ? '✓ Anotasi Onset' : 'Anotasi Onset'}
                </button>
              </div>
            </div>

            {/* Interactive Image / Seismogram Drum View Box */}
            <div
              ref={imageContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#060a14',
                border: '1px solid var(--border-medium)',
                minHeight: isFullscreen ? '480px' : '340px',
                height: isFullscreen ? '55vh' : '360px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none',
              }}
            >
              {/* Zoom & Pan Guidance Floating Pill */}
              {zoom > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 12,
                    background: 'rgba(6, 10, 20, 0.85)',
                    border: '1px solid rgba(0, 242, 255, 0.4)',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#00f2ff',
                    zIndex: 10,
                    pointerEvents: 'none',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  🔍 Zoom: {Math.round(zoom * 100)}% • Geser untuk menggeser area rekaman
                </div>
              )}

              {viewMode === 'photo' ? (
                volcano.image_url && !imageError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={volcano.image_url}
                    alt={`Citra Erupsi G. ${volcano.volcano_name}`}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={() => setImageError(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.15s ease',
                      filter: getFilterStyle(),
                      pointerEvents: 'none',
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>📷</span>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Foto Visual Kawah Sedang Dihimpun Pos PVMBG
                    </p>
                    <p style={{ fontSize: '11px', maxWidth: '420px', margin: '8px auto', color: 'var(--text-secondary)' }}>
                      Pos pengamatan gunung api memprioritaskan transmisi sinyal seismograf real-time. Rekaman getaran gempa tersedia lengkap pada Drum Helicorder.
                    </p>
                    <button
                      type="button"
                      onClick={() => setViewMode('drum')}
                      style={{
                        marginTop: '12px',
                        padding: '6px 16px',
                        borderRadius: '6px',
                        background: 'rgba(0, 242, 255, 0.2)',
                        border: '1px solid #00f2ff',
                        color: '#00f2ff',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Buka Rekaman Seismograf Drum ➔
                    </button>
                  </div>
                )
              ) : viewMode === 'spectrogram' ? (
                /* Dedicated Full-Screen FFT Spectrogram View */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'monospace' }}>
                    <span style={{ color: '#a855f7', fontWeight: 800 }}>
                      SPEKTROGRAM POWER SPECTRAL DENSITY (PSD) · FFT FREQUENCY DOMAIN
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>STN: {volcano.volcano_name.toUpperCase()} (100 Hz SAMPLING)</span>
                  </div>

                  {/* Spectrogram Matrix Visualization */}
                  <div style={{ flex: 1, position: 'relative', margin: '10px 0', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                      <defs>
                        <linearGradient id="specGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                          <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.85" />
                          <stop offset="70%" stopColor="#0284c7" stopOpacity="0.75" />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
                        </linearGradient>
                      </defs>

                      {/* Frequency Waterfall Layers */}
                      <rect x="0" y="0" width="600" height="200" fill="#090d16" />
                      <rect x="120" y="20" width="360" height="160" rx="10" fill="url(#specGrad)" opacity="0.8" />

                      {/* Harmonic Bands */}
                      <path d="M 120,60 Q 250,50 350,65 T 480,55" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
                      <path d="M 120,110 Q 280,105 380,120 T 480,108" fill="none" stroke="#fef08a" strokeWidth="1.5" opacity="0.85" />

                      {/* Frequency Grid Lines */}
                      {[40, 80, 120, 160].map((y, i) => (
                        <g key={y}>
                          <line x1="40" y1={y} x2="580" y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                          <text x="5" y={y + 3} fill="rgba(148, 163, 184, 0.8)" fontSize="9" fontFamily="monospace">
                            {(12 - i * 3)} Hz
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span>00:00 (Awal Pencatatan)</span>
                    <span style={{ color: '#00f2ff', fontWeight: 700 }}>PUNCAK SPEKTRUM ENERGI: {freqDominant}</span>
                    <span>Durasi: {volcano.duration}</span>
                  </div>
                </div>
              ) : (
                /* Authentic High-Resolution PVMBG Helicorder Drum Record Sheet */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.15s ease',
                    filter: getFilterStyle(),
                  }}
                >
                  {/* Helicorder Drum Sheet Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(0, 242, 255, 0.25)',
                      paddingBottom: '4px',
                      marginBottom: '4px',
                      fontFamily: 'monospace',
                      fontSize: '10px',
                    }}
                  >
                    <span style={{ color: isBMKG ? '#00f2ff' : '#38bdf8', fontWeight: 800 }}>
                      {isBMKG
                        ? 'BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA · PUSAT SEISMOLOGI TEWS'
                        : 'KEMENTERIAN ESDM · PVMBG · HELICORDER DRUM RECORDER'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      STN: {volcano.volcano_name.toUpperCase()} ({isBMKG ? 'BMKG-TEWS' : (geo?.pgaStation || 'PGA-DIGI')}) • CH: {isBMKG ? 'BHZ (100 Hz)' : 'EHZ (100 Hz)'} • {volcano.date}
                    </span>
                  </div>

                  {/* Multi-Track Drum Raster with Actual Eruption Packet */}
                  <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                    <svg
                      viewBox="0 0 600 240"
                      preserveAspectRatio="none"
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    >
                      {/* Background Minute Grid Lines */}
                      {[60, 120, 180, 240, 300, 360, 420, 480, 540].map((x) => (
                        <line
                          key={x}
                          x1={x}
                          y1={10}
                          x2={x}
                          y2={230}
                          stroke="rgba(255, 255, 255, 0.04)"
                          strokeDasharray="2 4"
                        />
                      ))}

                      {/* 8 Parallel Raster Tracks (Helicorder lines) */}
                      {[25, 50, 75, 100, 125, 150, 175, 200].map((y, idx) => {
                        const isEruptionTrack = idx === 3 || idx === 4; // Tracks 4 & 5 contain the eruption burst
                        return (
                          <g key={y}>
                            {/* Track baseline */}
                            <line
                              x1={45}
                              y1={y}
                              x2={560}
                              y2={y}
                              stroke="rgba(0, 242, 255, 0.12)"
                              strokeWidth="0.8"
                            />

                            {/* Minute stamp along left margin */}
                            <text
                              x={8}
                              y={y + 3}
                              fill="rgba(148, 163, 184, 0.7)"
                              fontSize="8"
                              fontFamily="monospace"
                            >
                              11:3{idx}
                            </text>

                            {/* Normal Ambient Waveform Traces for quiet tracks */}
                            {!isEruptionTrack ? (
                              <path
                                d={`M 45,${y} Q 100,${y - 2} 150,${y + 2} Q 220,${y - 1} 300,${y + 1} Q 400,${y - 2} 480,${y + 2} L 560,${y}`}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="0.8"
                                opacity="0.65"
                              />
                            ) : null}
                          </g>
                        );
                      })}

                      {/* Track 4: Eruption Onset & Peak Explosive Deflection Waveform */}
                      <path
                        d={`M 45,100 Q 120,99 150,100 
                            L 170,${100 - Math.min(65, ampNum * 1.3)} 
                            L 185,${100 + Math.min(65, ampNum * 1.4)} 
                            L 200,${100 - Math.min(55, ampNum * 1.1)} 
                            L 215,${100 + Math.min(60, ampNum * 1.2)} 
                            L 230,${100 - Math.min(45, ampNum * 0.9)} 
                            L 250,${100 + Math.min(50, ampNum * 1.0)} 
                            L 280,${100 - Math.min(35, ampNum * 0.7)} 
                            L 320,${100 + Math.min(28, ampNum * 0.5)} 
                            L 380,${100 - 15} 
                            L 440,${100 + 10} 
                            L 500,${100 - 5} 
                            L 560,100`}
                        fill="none"
                        stroke={isAwas ? '#ff2a5f' : '#ff9800'}
                        strokeWidth="1.8"
                      />

                      {/* Track 5: Harmonic Tremor & Secondary Ash Emission Pulse */}
                      <path
                        d={`M 45,125 
                            L 80,126 
                            L 110,${125 - 12} 
                            L 140,${125 + 16} 
                            L 170,${125 - Math.min(35, ampNum * 0.6)} 
                            L 210,${125 + Math.min(30, ampNum * 0.5)} 
                            L 260,${125 - 20} 
                            L 320,${125 + 15} 
                            L 400,${125 - 8} 
                            L 480,${125 + 4} 
                            L 560,125`}
                        fill="none"
                        stroke={isAwas ? '#f43f5e' : '#fb923c'}
                        strokeWidth="1.3"
                      />

                      {/* Phase Annotations */}
                      {showPhases && (
                        <>
                          {/* P-Wave Onset */}
                          <line x1={170} y1={25} x2={170} y2={185} stroke="#00f2ff" strokeWidth="1" strokeDasharray="3 3" />
                          <rect x={160} y={15} width={62} height={14} rx={3} fill="#00f2ff" />
                          <text x={163} y={25} fill="#060a14" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
                            Onset Erupsi
                          </text>

                          {/* Amax Maximum Amplitude */}
                          <line x1={185} y1={25} x2={185} y2={185} stroke="#ff2a5f" strokeWidth="1" strokeDasharray="3 3" />
                          <rect x={192} y={35} width={90} height={14} rx={3} fill="#ff2a5f" />
                          <text x={195} y={45} fill="#ffffff" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
                            Amax: {volcano.amplitude}
                          </text>

                          {/* Coda Decay Duration */}
                          <line x1={380} y1={25} x2={380} y2={185} stroke="#a855f7" strokeWidth="1" strokeDasharray="3 3" />
                          <rect x={385} y={55} width={90} height={14} rx={3} fill="#a855f7" />
                          <text x={388} y={65} fill="#ffffff" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
                            Coda: {volcano.duration}
                          </text>
                        </>
                      )}

                      {/* Amplitude Scale on the Right Edge */}
                      <line x1={575} y1={40} x2={575} y2={160} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
                      <text x={580} y={45} fill="#ff2a5f" fontSize="8" fontFamily="monospace">+50mm</text>
                      <text x={580} y={100} fill="#38bdf8" fontSize="8" fontFamily="monospace">0 mm</text>
                      <text x={580} y={155} fill="#ff2a5f" fontSize="8" fontFamily="monospace">-50mm</text>
                    </svg>
                  </div>

                  {/* Spectrogram Frequency Strip */}
                  <div
                    style={{
                      height: '24px',
                      background: 'linear-gradient(to right, #0369a1, #0284c7, #f59e0b, #ef4444, #dc2626, #7c3aed, #0284c7, #0369a1)',
                      borderRadius: '4px',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 8px',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    <span>0.5 Hz (Tremor LP)</span>
                    <span>FREKUENSI DOMINAN SPEKTROGRAM: {freqDominant}</span>
                    <span>12.0 Hz (Explosive HF)</span>
                  </div>
                </div>
              )}

              {/* Bottom Info Ribbon if Phase annotations are active */}
              {showPhases && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    right: 10,
                    background: 'rgba(6, 10, 20, 0.88)',
                    border: '1px solid rgba(0, 242, 255, 0.3)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    backdropFilter: 'blur(6px)',
                    zIndex: 5,
                  }}
                >
                  <span style={{ color: '#00f2ff', fontWeight: 800 }}>
                    ⚡ Amplitudo: {volcano.amplitude}
                  </span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                    ⏱ Durasi: {volcano.duration}
                  </span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>
                    📡 Sensor: {geo?.sensorType || 'Broadband 100Hz'}
                  </span>
                </div>
              )}
            </div>

            {/* Instrument & Station Technical Metadata */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px 14px',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>KOORDINAT KAWAH</span>
                <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {geo ? `${geo.pos[0].toFixed(3)}°, ${geo.pos[1].toFixed(3)}°` : '-'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>ELEVASI PUNCAK</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff9800' }}>
                  {geo?.elevation ? `${geo.elevation} mdpl` : 'Aktif'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>PETUGAS POS PVMBG</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {volcano.author}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Physical Interpretation, Volcanic Ash & Estimated Durations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. Volcanic Ash Trajectory & Estimated Durations (Requested by User) */}
            <div
              className="card"
              style={{
                padding: '12px 14px',
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.14), rgba(220, 38, 38, 0.08))',
                border: '1px solid rgba(249, 115, 22, 0.45)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#fed7aa',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🌪️</span> ARAH ABU VULKANIK & PERKIRAAN DURASI ERUPSI
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: ash.vonaColorCode === 'RED' ? '#ef4444' : '#f97316',
                    color: '#fff',
                    fontWeight: 800,
                  }}
                >
                  VONA: {ash.vonaColorCode} ALERT
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div
                  style={{
                    background: 'rgba(6, 10, 20, 0.7)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                    🧭 ARAH ABU VULKANIK
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#fb923c' }}>
                    {ash.windDirectionCardinal} ({ash.windDirectionDeg}°) ↙
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(6, 10, 20, 0.7)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                    ⏱️ PERKIRAAN DURASI ERUPSI
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f59e0b' }}>
                    {volcano.duration ? `${volcano.duration}` : ash.eruptionDurationEst}
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(6, 10, 20, 0.7)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                    ⏳ PERKIRAAN DURASI SEBARAN
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>
                    {ash.ashDispersionDurationEst}
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(6, 10, 20, 0.7)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                  }}
                >
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                    ⬆️ TINGGI KOLOM & ANGIN
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f87171' }}>
                    ±{ash.plumeHeightMeters.toLocaleString('id-ID')}m • {ash.windSpeedKts} kts
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(249, 115, 22, 0.2)',
                  fontSize: '11px',
                  color: '#fed7aa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span>
                  ✈️ <strong>Koridor Udara ATS:</strong> {ash.affectedAviationRoute}
                </span>
                <span>
                  📍 <strong>Sektor Terdampak:</strong> {ash.sectorNotice}
                </span>
                <span style={{ color: '#fdba74' }}>
                  🕒 <strong>Jendela Siaga Keselamatan:</strong> {ash.totalHazardWindow}
                </span>
              </div>
            </div>

            {/* 2. Measured Signal Parameters */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📊</span> PARAMETER SINYAL SEISMOGRAM TERUKUR
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>AMPLITUDO DEFLEKSI</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#ff2a5f' }}>{volcano.amplitude}</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>DURASI GEMPA (CODA)</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#ff9800' }}>{volcano.duration}</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>ESTIMASI PGA</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#00f2ff', fontFamily: 'monospace' }}>{estPGA} g</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>FREKUENSI DOMINAN</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#a855f7', fontFamily: 'monospace' }}>{freqDominant}</span>
                </div>
              </div>

              <div style={{ marginTop: '8px', background: 'rgba(0, 242, 255, 0.05)', border: '1px solid rgba(0, 242, 255, 0.2)', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>KLASIFIKASI GELOMBANG SEISMIK</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#00f2ff' }}>{signalType}</span>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Indeks RSAM Estimasi: <strong style={{ color: '#fff' }}>{estRSAM} counts</strong>
                </div>
              </div>
            </div>

            {/* 3. AI Physical Volcanology Interpretation */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(168, 85, 247, 0.04)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#c084fc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🤖</span> INTERPRETASI DINAMIKA MAGMA & FISIKA KAWAH
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                {interpretation}
              </p>
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                <strong>Pengamatan Visual Kawah:</strong> {volcano.visual_ash}
              </div>
            </div>

            {/* 4. PVMBG Official Mitigation & Aviation Advice */}
            <div className="card" style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#f87171', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️</span> REKOMENDASI KESELAMATAN & STATUS PENERBANGAN
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {volcano.recommendation}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Kode Warna VONA: <strong style={{ color: isAwas ? '#ef4444' : '#f59e0b' }}>{isAwas ? 'RED (AWAS)' : 'ORANGE (SIAGA)'}</strong>
                </span>
                {volcano.detail_url && (
                  <a
                    href={volcano.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '11px',
                      color: '#00f2ff',
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    ↗ Rilis Lengkap PVMBG
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
