'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { VolcanoEruption } from '@/lib/types';
import {
  INDONESIAN_VOLCANOES,
  findVolcanoLocation,
  getVolcanicAshTrajectory,
  type VolcanicAshTrajectory,
} from '@/lib/volcanoData';

interface SeismographProps {
  seismicEnergy?: number; // mm/s
  activityLevel?: number; // 0 - 100%
  phaseName?: string;
  volcanoes?: VolcanoEruption[];
  selectedVolcano?: string | null;
  onSelectVolcano?: (name: string) => void;
  onInspectSeismogram?: (volcano: VolcanoEruption) => void;
  isSimulasi?: boolean;
}

// Exactly the 7 station filter options requested
export const SEISMOGRAPH_STATIONS = [
  { id: 'BMKG_REGIONAL', label: '📡 BMKG Broadband (LEM / JATS)', isBMKG: true },
  { id: 'Anak Krakatau', label: '🌋 Anak Krakatau', isBMKG: false },
  { id: 'Ibu', label: '🌋 Ibu', isBMKG: false },
  { id: 'Lewotobi Laki-laki', label: '🌋 Lewotobi Laki-laki', isBMKG: false },
  { id: 'Ili Lewotolok', label: '🌋 Ili Lewotolok', isBMKG: false },
  { id: 'Semeru', label: '🌋 Semeru', isBMKG: false },
  { id: 'Merapi', label: '🌋 Merapi', isBMKG: false },
];

export default function Seismograph({
  seismicEnergy = 1.2,
  activityLevel = 22,
  phaseName = 'SEISMIC_BASELINE',
  volcanoes = [],
  selectedVolcano = 'Anak Krakatau',
  onSelectVolcano,
  onInspectSeismogram,
  isSimulasi = false,
}: SeismographProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<number[]>([]);
  const [activeTarget, setActiveTarget] = useState<string>(selectedVolcano || 'Anak Krakatau');

  // Keep internal activeTarget synced with parent selectedVolcano
  useEffect(() => {
    if (selectedVolcano) {
      setActiveTarget(selectedVolcano);
    }
  }, [selectedVolcano]);

  // Find geo metadata for currently active volcano/station
  const isBMKGMode = activeTarget === 'BMKG_REGIONAL';
  const geo = useMemo(() => {
    return isBMKGMode ? null : findVolcanoLocation(activeTarget);
  }, [activeTarget, isBMKGMode]);

  // Find matching PVMBG live report for this volcano
  const liveReport = useMemo(() => {
    if (!geo) return null;
    return volcanoes.find((e) => {
      const cleanErup = e.volcano_name.toLowerCase().trim().replace(/^g\.\s*/, '');
      return geo.name.toLowerCase().includes(cleanErup) || cleanErup.includes(geo.name.toLowerCase());
    }) || null;
  }, [geo, volcanoes]);

  // Volcanic Ash Trajectory for active volcano (or simulated default)
  const ashTrajectory: VolcanicAshTrajectory = useMemo(() => {
    const targetName = isBMKGMode ? 'Anak Krakatau' : activeTarget;
    return getVolcanicAshTrajectory(targetName);
  }, [isBMKGMode, activeTarget]);


  // Parse amplitude & duration
  const ampNum = useMemo(() => {
    if (liveReport?.amplitude) {
      return parseFloat(liveReport.amplitude.replace(/[^0-9.]/g, '')) || 35;
    }
    return 15;
  }, [liveReport]);

  const alertLevel = liveReport?.alert_level || geo?.defaultLevel || 'LEVEL II (WASPADA)';
  const isAwas = alertLevel.includes('AWAS');
  const isSiaga = alertLevel.includes('SIAGA');

  // References for animation loop
  const configRef = useRef({
    isBMKGMode,
    ampNum,
    seismicEnergy,
    activityLevel,
    isAwas,
    isSiaga,
  });

  useEffect(() => {
    configRef.current = {
      isBMKGMode,
      ampNum,
      seismicEnergy,
      activityLevel,
      isAwas,
      isSiaga,
    };
  }, [isBMKGMode, ampNum, seismicEnergy, activityLevel, isAwas, isSiaga]);

  // Canvas waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = 140);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
    };
    window.addEventListener('resize', handleResize);

    const maxPoints = 300;
    if (pointsRef.current.length === 0) {
      pointsRef.current = new Array(maxPoints).fill(height / 2);
    }

    let tick = 0;

    const render = () => {
      tick++;
      const {
        isBMKGMode: isBMKG,
        ampNum: amp,
        seismicEnergy: energy,
        activityLevel: act,
        isAwas: awas,
        isSiaga: siaga,
      } = configRef.current;

      const midY = height / 2;
      let rawOffset = 0;

      if (isBMKG) {
        // Tectonic P/S Waveform
        const normalizedAct = Math.max(0.1, act / 100);
        const pWave = Math.sin(tick * 0.45) * (energy * 1.2);
        const sWave = Math.sin(tick * 0.15) * (energy * 2.8 * normalizedAct);
        const burst = Math.random() < 0.05 + normalizedAct * 0.2 ? (Math.random() - 0.5) * energy * 4.5 : 0;
        rawOffset = pWave + sWave + burst;
      } else {
        // Volcanic Tremor / Explosion Pulse Waveform
        const ampScale = Math.min(45, Math.max(8, amp * 0.75));
        const tremorBase = Math.sin(tick * 0.38) * (ampScale * 0.35);
        const harmonicFluid = Math.sin(tick * 0.85) * (ampScale * 0.25);
        const volcanicLP = Math.sin(tick * 0.12) * (ampScale * 0.45);
        // Random explosion / ash emission shock bursts
        const burstProb = awas ? 0.22 : siaga ? 0.12 : 0.05;
        const explosionBurst = Math.random() < burstProb ? (Math.random() - 0.5) * ampScale * 1.5 : 0;
        rawOffset = tremorBase + harmonicFluid + volcanicLP + explosionBurst;
      }

      const clampedOffset = Math.max(-height / 2 + 10, Math.min(height / 2 - 10, rawOffset));
      const nextY = midY + clampedOffset;

      pointsRef.current.push(nextY);
      if (pointsRef.current.length > maxPoints) {
        pointsRef.current.shift();
      }

      // Dark background
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, width, height);

      // Grid division lines
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.06)';
      ctx.lineWidth = 1;
      const gridStep = 40;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep / 2) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Baseline center reference line
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stroke & Glow Colors based on target mode and alert level
      let strokeColor = '#00f2ff';
      let glowColor = 'rgba(0, 242, 255, 0.4)';

      if (!isBMKG) {
        if (awas) {
          strokeColor = '#ff2a5f';
          glowColor = 'rgba(255, 42, 95, 0.7)';
        } else if (siaga) {
          strokeColor = '#ff5722';
          glowColor = 'rgba(255, 87, 34, 0.6)';
        } else {
          strokeColor = '#ff9800';
          glowColor = 'rgba(255, 152, 0, 0.5)';
        }
      } else {
        if (act > 80) {
          strokeColor = '#ff2a5f';
          glowColor = 'rgba(255, 42, 95, 0.6)';
        } else if (act > 50) {
          strokeColor = '#ff9100';
          glowColor = 'rgba(255, 145, 0, 0.5)';
        }
      }

      // Draw continuous waveform trace
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();

      const dx = width / (pointsRef.current.length - 1);
      for (let i = 0; i < pointsRef.current.length; i++) {
        const x = i * dx;
        const y = pointsRef.current[i];
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Stylus recording point
      const lastIdx = pointsRef.current.length - 1;
      const lastX = lastIdx * dx;
      const lastY = pointsRef.current[lastIdx];

      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleSelect = (targetName: string) => {
    setActiveTarget(targetName);
    if (targetName !== 'BMKG_REGIONAL') {
      onSelectVolcano?.(targetName);
    }
  };

  // Helper to build robust official report for modal inspection
  const buildReportForTarget = useCallback((targetName: string): VolcanoEruption => {
    const effectiveName = (targetName === 'BMKG_REGIONAL' || !targetName) ? 'Anak Krakatau' : targetName;
    
    // 1. Match from live volcanoes list
    const matched = volcanoes.find((e) => {
      const cleanErup = e.volcano_name.toLowerCase().trim().replace(/^g\.\s*/, '');
      const cleanTarget = effectiveName.toLowerCase().trim().replace(/^g\.\s*/, '');
      return cleanTarget.includes(cleanErup) || cleanErup.includes(cleanTarget);
    });

    if (matched) return matched;

    // 2. Derive authentic metadata from volcano database
    const targetGeo = findVolcanoLocation(effectiveName) || INDONESIAN_VOLCANOES[0];
    const targetAsh = getVolcanicAshTrajectory(targetGeo.name);

    return {
      id: `erup-${targetGeo.name.toLowerCase().replace(/\s+/g, '-')}-live`,
      volcano_name: targetGeo.name,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      description: `Rekaman getaran seismograf pos pengamatan ${targetGeo.pgaStation} merekam aktivitas tremor vulkanik menerus dengan amplitudo dominan ${ampNum} mm.`,
      amplitude: `${ampNum} mm`,
      duration: '60 detik',
      visual_ash: `Kolom abu vulkanik condong ke arah ${targetAsh.windDirectionCardinal}`,
      author: targetGeo.pgaStation.includes('Pos') ? targetGeo.pgaStation : `Pos PGA ${targetGeo.name}`,
      alert_level: targetGeo.defaultLevel,
      recommendation: `Masyarakat dan wisatawan diimbau tidak beraktivitas di dalam radius bahaya ${targetAsh.hazardRadiusKm} km dari kawah aktif G. ${targetGeo.name}.`,
      timestamp: new Date().toISOString(),
      image_url: 'https://magma.vsi.esdm.go.id/img/crs/VEN_LEW20260911121823.png',
    };
  }, [volcanoes, ampNum]);

  // Prepare fallback eruption if opening inspection
  const effectiveInspectionReport: VolcanoEruption = useMemo(() => {
    const target = isBMKGMode ? 'Anak Krakatau' : activeTarget;
    return buildReportForTarget(target);
  }, [isBMKGMode, activeTarget, buildReportForTarget]);

  return (
    <div id="seismograph-container" className="seismograph-container card" style={{ padding: '14px 18px', gap: '10px' }}>
      {/* Target Selector Toolbar (BMKG vs Volcanoes) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            LOKASI SEISMOGRAF:
          </span>

          {/* 7 Requested Filter Options */}
          {SEISMOGRAPH_STATIONS.map((station) => {
            const isSelected = activeTarget === station.id;
            const hasReport =
              !station.isBMKG &&
              volcanoes.some(
                (e) =>
                  e.volcano_name.toLowerCase().includes(station.id.toLowerCase()) ||
                  station.id.toLowerCase().includes(e.volcano_name.toLowerCase())
              );

            return (
              <button
                key={station.id}
                onClick={() => handleSelect(station.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: isSelected ? 800 : 600,
                  cursor: 'pointer',
                  background: isSelected
                    ? station.isBMKG
                      ? 'rgba(0, 242, 255, 0.18)'
                      : 'rgba(255, 87, 34, 0.22)'
                    : hasReport
                    ? 'rgba(255, 87, 34, 0.08)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${
                    isSelected
                      ? station.isBMKG
                        ? '#00f2ff'
                        : '#ff5722'
                      : hasReport
                      ? 'rgba(255, 87, 34, 0.4)'
                      : 'var(--border-subtle)'
                  }`,
                  color: isSelected
                    ? station.isBMKG
                      ? '#00f2ff'
                      : '#ff9800'
                    : hasReport
                    ? '#ff7043'
                    : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: isSelected
                    ? station.isBMKG
                      ? '0 0 10px rgba(0, 242, 255, 0.3)'
                      : '0 0 10px rgba(255, 87, 34, 0.3)'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{station.label}</span>
                {hasReport && (
                  <span
                    style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff2a5f' }}
                  ></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Button: Analisis Citra Seismograf PVMBG vs BMKG */}
        <button
          id="btn-analisis-citra-seismograf"
          type="button"
          onClick={() => {
            if (isBMKGMode) {
              const bmkgReport: VolcanoEruption = {
                id: 'bmkg-lem-broadband',
                volcano_name: 'BMKG LEM (Stasiun Geofisika Lembang)',
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
                date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                description: 'Rekaman getaran seismograf broadband Streckeisen STS-2 pada Stasiun Geofisika Lembang (Bandung Barat). Komponen BHZ 100 Hz real-time backbone BMKG TEWS.',
                amplitude: '42 mm (Broadband)',
                duration: '65 detik',
                visual_ash: 'Broadband BMKG TEWS • Sensor: Streckeisen STS-2 120s',
                author: 'Pusat Seismologi BMKG Kemayoran',
                alert_level: 'BMKG BROADBAND TEWS',
                recommendation: 'Monitoring jaringan seismik broadband nasional BMKG InaTEWS.',
                timestamp: new Date().toISOString(),
              };
              onInspectSeismogram?.(bmkgReport);
            } else {
              const reportToInspect = buildReportForTarget(activeTarget);
              onInspectSeismogram?.(reportToInspect);
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 800,
            background: isBMKGMode
              ? 'linear-gradient(135deg, rgba(0, 242, 255, 0.28), rgba(59, 130, 246, 0.28))'
              : 'linear-gradient(135deg, rgba(168, 85, 247, 0.32), rgba(0, 242, 255, 0.22))',
            border: isBMKGMode ? '1px solid #00f2ff' : '1px solid rgba(168, 85, 247, 0.7)',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: isBMKGMode
              ? '0 0 16px rgba(0, 242, 255, 0.35)'
              : '0 0 16px rgba(168, 85, 247, 0.35), inset 0 0 10px rgba(0, 242, 255, 0.1)',
            transition: 'all 0.2s ease',
          }}
          title={isBMKGMode ? 'Buka citra seismogram broadband BMKG' : `Buka analisis citra rekaman seismograf PVMBG untuk G. ${activeTarget}`}
        >
          <span style={{ fontSize: '13px' }}>{isBMKGMode ? '📡' : '🔬'}</span>
          <span>{isBMKGMode ? 'TAMPILKAN CITRA BMKG SEISMOGRAF' : 'ANALISIS CITRA SEISMOGRAF PVMBG'}</span>
          <span
            style={{
              background: isBMKGMode ? 'rgba(0, 242, 255, 0.2)' : 'rgba(0, 242, 255, 0.18)',
              border: '1px solid rgba(0, 242, 255, 0.4)',
              color: '#00f2ff',
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700,
            }}
          >
            {isBMKGMode ? 'BMKG BROADBAND' : `G. ${activeTarget.toUpperCase()}`}
          </span>
          {liveReport?.image_url && !isBMKGMode && (
            <span
              style={{
                background: '#10b981',
                color: '#fff',
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              FOTO LIVE
            </span>
          )}
        </button>
      </div>

      {/* Volcanic Ash Dispersion & Trajectory Card when Eruption occurs or in Simulation */}
      {(!isBMKGMode || isSimulasi || liveReport || isAwas || isSiaga) && (
        <div
          className="ash-trajectory-hud"
          style={{
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.16), rgba(185, 28, 28, 0.10))',
            border: '1px solid rgba(249, 115, 22, 0.45)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 0 18px rgba(249, 115, 22, 0.15)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>💨</span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '12px',
                  color: '#ffedd5',
                  letterSpacing: '0.04em',
                }}
              >
                {isSimulasi
                  ? 'SIMULASI SEBARAN & ARAH ABU VULKANIK (VONA ADVISORY)'
                  : 'PROYEKSI SEBARAN & ARAH ABU VULKANIK (VONA ADVISORY)'}
              </span>
              <span style={{ fontSize: '11px', color: '#fed7aa', fontWeight: 600 }}>
                • Pos Pemantauan G. {ashTrajectory.volcanoName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  background: ashTrajectory.vonaColorCode === 'RED' ? '#ef4444' : '#f97316',
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                  letterSpacing: '0.04em',
                }}
              >
                VONA: {ashTrajectory.vonaColorCode} ALERT
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {isSimulasi ? 'SIMULASI' : 'MONITORING PVMBG'}
              </span>
            </div>
          </div>

          {/* 6 Telemetry Metrics including Eruption Duration & Ash Dispersion Duration */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '8px',
            }}
          >
            {/* 1. Arah Abu Vulkanik */}
            <div
              style={{
                background: 'rgba(6, 10, 20, 0.65)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                🧭 ARAH ABU VULKANIK:
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#fb923c',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{ashTrajectory.windDirectionCardinal}</span>
                <span style={{ color: '#fed7aa', fontSize: '11px' }}>
                  ({ashTrajectory.windDirectionDeg}°)
                </span>
                <span style={{ fontSize: '14px' }}>↙</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Arah pergerakan angin dominan
              </div>
            </div>

            {/* 2. Perkiraan Durasi Erupsi */}
            <div
              style={{
                background: 'rgba(6, 10, 20, 0.65)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                ⏱️ PERKIRAAN DURASI ERUPSI:
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                {liveReport?.duration ? `${liveReport.duration} (Fase Semburan)` : ashTrajectory.eruptionDurationEst}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Durasi getaran tremor letusan
              </div>
            </div>

            {/* 3. Perkiraan Durasi Sebaran Abu */}
            <div
              style={{
                background: 'rgba(6, 10, 20, 0.65)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                ⏳ PERKIRAAN DURASI SEBARAN:
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                {ashTrajectory.ashDispersionDurationEst}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {ashTrajectory.totalHazardWindow}
              </div>
            </div>

            {/* 4. Kecepatan Angin */}
            <div
              style={{
                background: 'rgba(6, 10, 20, 0.65)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                💨 KECEPATAN ANGIN TROPOSFER:
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#fcd34d', marginTop: '2px' }}>
                {ashTrajectory.windSpeedKts} knot{' '}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  (~{Math.round(ashTrajectory.windSpeedKts * 1.852)} km/j)
                </span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Lapisan FL100 - FL180
              </div>
            </div>

            {/* 5. Tinggi Kolom Erupsi */}
            <div
              style={{
                background: 'rgba(6, 10, 20, 0.65)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                ⬆️ TINGGI KOLOM ERUPSI:
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>
                ±{ashTrajectory.plumeHeightMeters.toLocaleString('id-ID')} m dpl
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {ashTrajectory.plumeColor}
              </div>
            </div>

            {/* 6. Radius Sebaran & Sektor Bahaya */}
            <div
              style={{
                background: 'rgba(6, 10, 20, 0.65)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                ⚠️ RADIUS SEBARAN BAHAYA:
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f43f5e', marginTop: '2px' }}>
                Radius {ashTrajectory.hazardRadiusKm} km
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Sektor {ashTrajectory.windDirectionCardinal}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '6px',
              fontSize: '11px',
              color: '#fed7aa',
              borderTop: '1px solid rgba(249, 115, 22, 0.2)',
              paddingTop: '8px',
            }}
          >
            <span>
              ✈️ <strong>Koridor ATS Penerbangan:</strong> {ashTrajectory.affectedAviationRoute}
            </span>
            <span style={{ color: '#fdba74' }}>
              📍 <strong>Sektor Terdampak:</strong> {ashTrajectory.sectorNotice}
            </span>
          </div>
        </div>
      )}


      {/* Seismograph Header & Metadata Bar */}
      <div className="seismograph__header" style={{ padding: '4px 0' }}>
        <div className="seismograph__title">
          <span className="seismograph__pulse-indicator" style={{ background: isBMKGMode ? '#00f2ff' : '#ff5722' }}></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px' }}>
                {isBMKGMode ? 'BMKG REGIONAL BROADBAND SEISMIC ARRAY' : `POS SEISMOGRAF: ${geo?.pgaStation.toUpperCase()}`}
              </span>
              {!isBMKGMode && (
                <span
                  className={`volcano-card__level-badge ${
                    isAwas
                      ? 'volcano-card__level-badge--awas'
                      : isSiaga
                      ? 'volcano-card__level-badge--siaga'
                      : 'volcano-card__level-badge--waspada'
                  }`}
                  style={{ fontSize: '9px', padding: '2px 6px' }}
                >
                  {alertLevel}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {isBMKGMode
                ? 'Stasiun LEM (Lembang, Jabar) & JATS (Jatiluhur) • Komponen Z-Vertical • 100 Hz Streaming'
                : `Gunung ${geo?.name} (${geo?.province}) • ${geo?.pos[0].toFixed(3)}°S, ${geo?.pos[1].toFixed(3)}°E • Elevasi ${geo?.elevation} mdpl`}
            </span>
          </div>
        </div>

        {/* Telemetry Numbers */}
        <div className="seismograph__telemetry">
          {!isBMKGMode && liveReport ? (
            <>
              <span className="seismograph__stat">
                AMP MAKS: <strong style={{ color: '#ff2a5f' }}>{liveReport.amplitude}</strong>
              </span>
              <span className="seismograph__stat">
                DURASI: <strong style={{ color: '#ff9800' }}>{liveReport.duration}</strong>
              </span>
              <span className="seismograph__badge" style={{ background: 'rgba(255,87,34,0.15)', color: '#ff7043', border: '1px solid rgba(255,87,34,0.4)' }}>
                TREMOR ERUPSI
              </span>
            </>
          ) : (
            <>
              <span className="seismograph__stat">
                VEL: <strong>{seismicEnergy.toFixed(1)} mm/s</strong>
              </span>
              <span className="seismograph__stat">
                PGA: <strong>{((activityLevel / 100) * 0.45).toFixed(3)} g</strong>
              </span>
              <span className={`seismograph__badge seismograph__badge--${phaseName.toLowerCase()}`}>
                {activityLevel > 80 ? 'SATURATED / CLIPPED' : activityLevel > 45 ? 'SURFACE WAVE' : 'AMBIENT NOISE'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Canvas Waveform Drum */}
      <div className="seismograph__canvas-wrap" style={{ minHeight: '140px' }}>
        <canvas ref={canvasRef} className="seismograph__canvas" style={{ height: '140px' }} />
      </div>

      {/* Contextual Volcanic Signal Caption */}
      {!isBMKGMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
            padding: '6px 10px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ff9800' }}>📡 Sensor:</span>
            <span>{geo?.sensorType || 'Broadband Güralp CMG-40T'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Status Kawah: <strong>{liveReport?.visual_ash || 'Aktivitas Normal Terpantau'}</strong></span>
            <span
              onClick={() => {
                const target = isBMKGMode ? 'Anak Krakatau' : activeTarget;
                const reportToInspect = buildReportForTarget(target);
                onInspectSeismogram?.(reportToInspect);
              }}
              style={{ color: '#00f2ff', cursor: 'pointer', fontWeight: 700 }}
            >
              Lihat Analisis Lengkap ↗
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
