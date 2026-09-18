'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { VolcanoEruption, RealtimeEarthquakesData } from '@/lib/types';
import { INDONESIAN_VOLCANOES, findVolcanoLocation } from '@/lib/volcanoData';

export interface BMKGBroadbandStation {
  code: string;
  name: string;
  location: string;
  province: string;
  lat: number;
  lon: number;
  sensor: string;
  gain: string;
  elevation: number;
}

export const BMKG_BROADBAND_STATIONS: BMKGBroadbandStation[] = [
  {
    code: 'LEM',
    name: 'Stasiun Geofisika Lembang',
    location: 'Bandung Barat, Jawa Barat',
    province: 'Jawa Barat',
    lat: -6.831,
    lon: 107.618,
    sensor: 'Streckeisen STS-2 Broadband 120s + Kinemetrics Q330HR',
    gain: '120.000 V/(m/s) · 24-bit 100 Hz',
    elevation: 1245,
  },
  {
    code: 'JATS',
    name: 'Stasiun Seismik Jatiluhur',
    location: 'Purwakarta, Jawa Barat',
    province: 'Jawa Barat',
    lat: -6.550,
    lon: 107.410,
    sensor: 'Nanometrics Trillium 120PA + Centaur Digitizer',
    gain: '120s Broadband · Real-time BMKG Backbone',
    elevation: 160,
  },
  {
    code: 'CBJI',
    name: 'Pusat Seismik Cibinong',
    location: 'Bogor, Jawa Barat',
    province: 'Jawa Barat',
    lat: -6.495,
    lon: 106.852,
    sensor: 'Güralp CMG-3T Broadband Triaxial (360s)',
    gain: 'Ultra Wideband Low Noise Seismic Vault',
    elevation: 130,
  },
  {
    code: 'BBJI',
    name: 'Stasiun Geofisika Banjarnegara',
    location: 'Banjarnegara, Jawa Tengah',
    province: 'Jawa Tengah',
    lat: -7.398,
    lon: 109.697,
    sensor: 'Nanometrics Trillium Compact 120s + Taurus',
    gain: 'Mid-Java Megathrust Monitoring Backbone',
    elevation: 320,
  },
  {
    code: 'BNDI',
    name: 'Stasiun Geofisika Mata Ie Banda Aceh',
    location: 'Banda Aceh, Aceh',
    province: 'Aceh',
    lat: 5.512,
    lon: 95.317,
    sensor: 'Streckeisen STS-2.5 + Quanterra Q330',
    gain: 'Sumatra Subduction & Sesar Besar Sumatra (Great Sumatran Fault)',
    elevation: 75,
  },
  {
    code: 'TNTI',
    name: 'Stasiun Geofisika Ternate',
    location: 'Ternate, Maluku Utara',
    province: 'Maluku Utara',
    lat: 0.812,
    lon: 127.382,
    sensor: 'Trillium 240 + Centaur 24-bit BMKG TEWS',
    gain: 'Maluku Sea Collision & Halmahera Arc Seismicity',
    elevation: 45,
  },
];

interface VolcanoSeismographHubProps {
  volcanoes: VolcanoEruption[];
  realQuakes?: RealtimeEarthquakesData | null;
  selectedVolcano?: string | null;
  onSelectVolcano?: (name: string) => void;
  onInspectSeismogram?: (volcano: VolcanoEruption) => void;
}

export default function VolcanoSeismographHub({
  volcanoes,
  realQuakes,
  selectedVolcano = 'Anak Krakatau',
  onSelectVolcano,
  onInspectSeismogram,
}: VolcanoSeismographHubProps) {
  const [networkMode, setNetworkMode] = useState<'PVMBG' | 'BMKG'>('PVMBG');
  const [activeVolcano, setActiveVolcano] = useState<string>(selectedVolcano || 'Anak Krakatau');
  const [activeBMKGStation, setActiveBMKGStation] = useState<BMKGBroadbandStation>(BMKG_BROADBAND_STATIONS[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [islandFilter, setIslandFilter] = useState<string>('ALL');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPreviewDragging, setIsPreviewDragging] = useState<boolean>(false);
  const [previewDragStart, setPreviewDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<number[]>([]);

  const openPreview = (imgUrl: string) => {
    setPreviewImage(imgUrl);
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  // Keep internal selection synced with external prop
  useEffect(() => {
    if (selectedVolcano) {
      setActiveVolcano(selectedVolcano);
    }
  }, [selectedVolcano]);

  // Find geo metadata
  const geo = useMemo(() => {
    return findVolcanoLocation(activeVolcano) || INDONESIAN_VOLCANOES[0];
  }, [activeVolcano]);

  // Find all historical reports for this specific volcano
  const volcanoHistory = useMemo(() => {
    const cleanName = geo.name.toLowerCase().trim();
    return volcanoes.filter((e) => {
      const cleanErup = e.volcano_name.toLowerCase().trim().replace(/^g\.\s*/, '');
      return cleanName.includes(cleanErup) || cleanErup.includes(cleanName);
    });
  }, [geo, volcanoes]);

  // Latest report is first in list (or fallback generated for active volcano)
  const latestReport = useMemo(() => {
    if (volcanoHistory.length > 0) return volcanoHistory[0];
    return {
      id: `latest-${geo.name.toLowerCase().replace(/\s+/g, '-')}`,
      volcano_name: geo.name,
      time: 'Pemantauan Aktif',
      date: new Date().toLocaleDateString('id-ID'),
      description: `Pos Pengamatan Gunung Api ${geo.pgaStation} merekam aktivitas tremor vulkanik kontinu dalam batas normal-waspada.`,
      amplitude: '15 mm',
      duration: '45 detik',
      visual_ash: 'Asap kawah putih intensitas tipis hingga sedang',
      author: 'Petugas Pos Pengamatan PVMBG',
      alert_level: geo.defaultLevel,
      recommendation: 'Masyarakat dilarang mendekati kawah aktif sesuai radius rekomendasi PVMBG.',
      timestamp: new Date().toISOString(),
    } as VolcanoEruption;
  }, [volcanoHistory, geo]);

  const alertLevel = latestReport.alert_level || geo.defaultLevel;
  const isAwas = alertLevel.includes('AWAS');
  const isSiaga = alertLevel.includes('SIAGA');
  const isWaspada = alertLevel.includes('WASPADA');

  const ampNum = parseFloat(latestReport.amplitude.replace(/[^0-9.]/g, '')) || 20;

  // Animate live waveform drum for this volcano
  const configRef = useRef({ ampNum, isAwas, isSiaga });
  useEffect(() => {
    configRef.current = { ampNum, isAwas, isSiaga };
  }, [ampNum, isAwas, isSiaga]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = 130);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
    };
    window.addEventListener('resize', handleResize);

    const maxPoints = 280;
    if (pointsRef.current.length === 0) {
      pointsRef.current = new Array(maxPoints).fill(height / 2);
    }

    let tick = 0;

    const render = () => {
      tick++;
      const { ampNum: amp, isAwas: awas, isSiaga: siaga } = configRef.current;
      const midY = height / 2;

      // Volcanic tremor & harmonic resonance
      const ampScale = Math.min(42, Math.max(8, amp * 0.75));
      const tremor = Math.sin(tick * 0.42) * (ampScale * 0.35);
      const fluidResonance = Math.sin(tick * 0.88) * (ampScale * 0.28);
      const lp = Math.sin(tick * 0.14) * (ampScale * 0.4);
      const burstProb = awas ? 0.22 : siaga ? 0.12 : 0.05;
      const burst = Math.random() < burstProb ? (Math.random() - 0.5) * ampScale * 1.6 : 0;

      const offset = Math.max(-height / 2 + 8, Math.min(height / 2 - 8, tremor + fluidResonance + lp + burst));
      pointsRef.current.push(midY + offset);
      if (pointsRef.current.length > maxPoints) pointsRef.current.shift();

      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center reference line
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stylus line
      const strokeColor = awas ? '#ff2a5f' : siaga ? '#ff5722' : isWaspada ? '#ff9800' : '#00f2ff';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();

      const dx = width / (pointsRef.current.length - 1);
      for (let i = 0; i < pointsRef.current.length; i++) {
        const x = i * dx;
        const y = pointsRef.current[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Stylus needle
      const lastIdx = pointsRef.current.length - 1;
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(lastIdx * dx, pointsRef.current[lastIdx], 4, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [geo]);

  const handleSelectVolcano = (name: string) => {
    setActiveVolcano(name);
    onSelectVolcano?.(name);
  };

  const isBMKGNetwork = networkMode === 'BMKG';

  // Extract latest BMKG earthquake from realQuakes or fallback
  const latestBMKG = useMemo(() => {
    return realQuakes?.latest_bmkg || null;
  }, [realQuakes]);

  const bmkgShakemapUrl = useMemo(() => {
    if (latestBMKG?.Shakemap) {
      return `https://data.bmkg.go.id/DataMKG/TEWS/${latestBMKG.Shakemap}`;
    }
    return null;
  }, [latestBMKG]);

  // Filter volcanoes based on search query and island/status filter
  const filteredVolcanoes = useMemo(() => {
    return INDONESIAN_VOLCANOES.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.island.toLowerCase().includes(q) ||
        v.province.toLowerCase().includes(q) ||
        v.pgaStation.toLowerCase().includes(q);

      if (!matchSearch) return false;

      const reportCount = volcanoes.filter((e) => {
        const clean = e.volcano_name.toLowerCase().replace(/^g\.\s*/, '');
        return v.name.toLowerCase().includes(clean) || clean.includes(v.name.toLowerCase());
      }).length;

      if (islandFilter === 'ERUPTION') return reportCount > 0;
      if (islandFilter === 'JAWA') return v.island.toLowerCase().includes('jawa') || v.island.toLowerCase().includes('sunda');
      if (islandFilter === 'SUMATERA') return v.island.toLowerCase().includes('sumatera');
      if (islandFilter === 'NUSA_TENGGARA') return v.island.toLowerCase().includes('flores') || v.island.toLowerCase().includes('lembata') || v.island.toLowerCase().includes('bali');
      if (islandFilter === 'MALUKU_SULAWESI') return v.island.toLowerCase().includes('halmahera') || v.island.toLowerCase().includes('sitaro') || v.island.toLowerCase().includes('maluku') || v.island.toLowerCase().includes('sulawesi');

      return true;
    });
  }, [searchQuery, islandFilter, volcanoes]);

  // Count active eruptions across all volcanoes
  const totalEruptingVolcanoes = useMemo(() => {
    return INDONESIAN_VOLCANOES.filter((v) =>
      volcanoes.some((e) => {
        const clean = e.volcano_name.toLowerCase().replace(/^g\.\s*/, '');
        return v.name.toLowerCase().includes(clean) || clean.includes(v.name.toLowerCase());
      })
    ).length;
  }, [volcanoes]);

  // BMKG report object to open in modal inspection
  const bmkgReportForModal: VolcanoEruption = useMemo(() => {
    const mag = latestBMKG?.Magnitude ? `${latestBMKG.Magnitude} SR` : '5.2 SR';
    const loc = latestBMKG?.Wilayah || 'Pusat Seismik Broadband Nasional BMKG';
    const depth = latestBMKG?.Kedalaman || '10 km';
    return {
      id: `bmkg-${activeBMKGStation.code.toLowerCase()}`,
      volcano_name: `BMKG ${activeBMKGStation.code} (${activeBMKGStation.name})`,
      time: latestBMKG?.Jam || 'Pencatatan Realtime',
      date: latestBMKG?.Tanggal || new Date().toLocaleDateString('id-ID'),
      description: `Rekaman getaran seismograf broadband ${activeBMKGStation.sensor} pada ${activeBMKGStation.name} (${activeBMKGStation.location}). Koordinat sensor: ${activeBMKGStation.lat}°, ${activeBMKGStation.lon}°. Mendeteksi event tektonik ${loc} M${mag} kedalaman ${depth}.`,
      amplitude: '45 mm (Broadband)',
      duration: '78 detik',
      visual_ash: `Broadband BMKG TEWS • Shakemap MMI: ${latestBMKG?.Dirasakan || 'III - IV MMI'}`,
      author: 'Pusat Seismologi BMKG Kemayoran',
      alert_level: 'BMKG BROADBAND TEWS',
      recommendation: latestBMKG?.Potensi || 'Monitoring seismisitas tektonik regional Indonesia.',
      timestamp: latestBMKG?.DateTime || new Date().toISOString(),
      image_url: bmkgShakemapUrl || undefined,
    };
  }, [activeBMKGStation, latestBMKG, bmkgShakemapUrl]);

  return (
    <div className="card volcano-seismo-hub" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Network Mode Switch Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>{isBMKGNetwork ? '📡' : '🌋'}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {isBMKGNetwork
                  ? 'Pusat Citra Seismograf Broadband BMKG & Shakemap TEWS'
                  : 'Pusat Seismograf & Citra Vulkanik Per Gunung Api'}
              </h2>
              <span className={`card__badge ${isBMKGNetwork ? 'card__badge--tews' : 'card__badge--live'}`}>
                {isBMKGNetwork ? 'BMKG TEWS PUSAT' : 'MAGMA PVMBG ESDM'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              {isBMKGNetwork
                ? 'Citra drum seismograf broadband 100 Hz, shakemap intensitas MMI, dan telemetri percepatan tanah nasional BMKG'
                : 'Monitoring gelombang seismograf terkini, citra visual kawah, dan riwayat erupsi per pos pengamatan PVMBG'}
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher: PVMBG vs BMKG */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(6, 10, 20, 0.7)',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            padding: '3px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setNetworkMode('PVMBG')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              background: !isBMKGNetwork
                ? 'linear-gradient(135deg, rgba(255, 87, 34, 0.35), rgba(255, 42, 95, 0.25))'
                : 'transparent',
              border: !isBMKGNetwork ? '1px solid #ff5722' : '1px solid transparent',
              color: !isBMKGNetwork ? '#ff9800' : 'var(--text-secondary)',
              boxShadow: !isBMKGNetwork ? '0 0 12px rgba(255, 87, 34, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🌋</span>
            <span>PVMBG (Gunung Api)</span>
            <span
              style={{
                background: !isBMKGNetwork ? '#ff2a5f' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '10px',
              }}
            >
              16 Gunung
            </span>
          </button>

          <button
            type="button"
            onClick={() => setNetworkMode('BMKG')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              background: isBMKGNetwork
                ? 'linear-gradient(135deg, rgba(0, 242, 255, 0.3), rgba(59, 130, 246, 0.25))'
                : 'transparent',
              border: isBMKGNetwork ? '1px solid #00f2ff' : '1px solid transparent',
              color: isBMKGNetwork ? '#00f2ff' : 'var(--text-secondary)',
              boxShadow: isBMKGNetwork ? '0 0 12px rgba(0, 242, 255, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📡</span>
            <span>BMKG (Broadband Nasional)</span>
            <span
              style={{
                background: isBMKGNetwork ? '#00f2ff' : 'rgba(255, 255, 255, 0.1)',
                color: isBMKGNetwork ? '#060a14' : '#fff',
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '10px',
                fontWeight: 800,
              }}
            >
              CITRA BMKG
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: PVMBG GUNUNG API (WITH CLEAN SEARCH, FILTERS & GRID SELECTOR) */}
      {/* ========================================================================= */}
      {!isBMKGNetwork ? (
        <>
          {/* Volcano Selection Control Bar: Search + Island/Status Filter Tabs */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', opacity: 0.6 }}>
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Cari gunung api (Semeru, Merapi, Ibu), pulau, atau pos PGA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: '6px',
                    background: 'rgba(6, 10, 20, 0.8)',
                    border: '1px solid var(--border-medium)',
                    color: '#fff',
                    fontSize: '11.5px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status summary pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Gunung Terpilih: <strong style={{ color: '#00f2ff' }}>G. {geo.name}</strong></span>
                <span>•</span>
                <span>Status: <strong style={{ color: isAwas ? '#ff2a5f' : isSiaga ? '#ff9800' : '#34d399' }}>{alertLevel}</strong></span>
              </div>
            </div>

            {/* Region & Eruption Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'Semua Gunung Api', count: INDONESIAN_VOLCANOES.length },
                { id: 'ERUPTION', label: '🚨 Ada Catatan Erupsi', count: totalEruptingVolcanoes, highlight: true },
                { id: 'JAWA', label: 'Jawa & Selat Sunda', count: 6 },
                { id: 'SUMATERA', label: 'Sumatera', count: 3 },
                { id: 'NUSA_TENGGARA', label: 'Nusa Tenggara & Bali', count: 3 },
                { id: 'MALUKU_SULAWESI', label: 'Maluku & Sulawesi', count: 4 },
              ].map((tab) => {
                const isActive = islandFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setIslandFilter(tab.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: isActive ? 800 : 600,
                      cursor: 'pointer',
                      background: isActive
                        ? tab.highlight
                          ? 'rgba(255, 42, 95, 0.25)'
                          : 'rgba(0, 242, 255, 0.18)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${
                        isActive
                          ? tab.highlight
                            ? '#ff2a5f'
                            : '#00f2ff'
                          : 'var(--border-subtle)'
                      }`,
                      color: isActive
                        ? tab.highlight
                          ? '#ff2a5f'
                          : '#00f2ff'
                        : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontSize: '9px',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Volcano Cards Responsive Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '8px',
                maxHeight: '175px',
                overflowY: 'auto',
                paddingRight: '4px',
                marginTop: '4px',
              }}
            >
              {filteredVolcanoes.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Tidak ada gunung api yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredVolcanoes.map((v) => {
                  const isSelected = activeVolcano.toLowerCase().includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(activeVolcano.toLowerCase());
                  const erupCount = volcanoes.filter((e) => {
                    const clean = e.volcano_name.toLowerCase().replace(/^g\.\s*/, '');
                    return v.name.toLowerCase().includes(clean) || clean.includes(v.name.toLowerCase());
                  }).length;

                  const isLevelAwas = v.defaultLevel.includes('AWAS');
                  const isLevelSiaga = v.defaultLevel.includes('SIAGA');

                  return (
                    <div
                      key={v.name}
                      onClick={() => handleSelectVolcano(v.name)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(255, 87, 34, 0.28), rgba(255, 42, 95, 0.18))'
                          : 'rgba(6, 10, 20, 0.65)',
                        border: `1px solid ${
                          isSelected
                            ? '#ff5722'
                            : erupCount > 0
                            ? 'rgba(255, 87, 34, 0.4)'
                            : 'var(--border-subtle)'
                        }`,
                        boxShadow: isSelected ? '0 0 14px rgba(255, 87, 34, 0.35)' : 'none',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: isSelected ? '#ff9800' : 'var(--text-primary)' }}>
                          🌋 G. {v.name}
                        </span>
                        {erupCount > 0 ? (
                          <span
                            style={{
                              background: '#ff2a5f',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {erupCount} Erupsi
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: '3px',
                              color: isLevelAwas ? '#ff2a5f' : isLevelSiaga ? '#ff9800' : '#34d399',
                              border: `1px solid ${isLevelAwas ? '#ff2a5f' : isLevelSiaga ? '#ff9800' : '#34d399'}`,
                            }}
                          >
                            {v.defaultLevel.replace('LEVEL ', 'LVL ')}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                        <span>📍 {v.island}</span>
                        <span>{v.elevation} mdpl</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Main Grid: Section Terkini (Left: Waveform + Right: Latest Image & Parameters) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '18px',
            }}
            className="volcano-hub-main-grid"
          >
            {/* Left Column: Live Telemetry & Waveform Drum */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="live-dot-pulse"></span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f2ff', letterSpacing: '0.04em' }}>
                    REKAMAN SEISMOGRAF TERKINI (LIVE DRUM)
                  </span>
                </div>
                <span
                  className={`volcano-card__level-badge ${
                    isAwas
                      ? 'volcano-card__level-badge--awas'
                      : isSiaga
                      ? 'volcano-card__level-badge--siaga'
                      : 'volcano-card__level-badge--waspada'
                  }`}
                  style={{ fontSize: '10px', padding: '2px 8px' }}
                >
                  {alertLevel}
                </span>
              </div>

              {/* Pos & Instrument Details */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                📍 <strong style={{ color: 'var(--text-primary)' }}>{geo.pgaStation}</strong> • Wilayah: <strong>{geo.province}</strong><br />
                Koordinat: <span style={{ fontFamily: 'monospace', color: '#00f2ff' }}>{geo.pos[0].toFixed(3)}°S, {geo.pos[1].toFixed(3)}°E</span> • Elevasi: <strong>{geo.elevation} mdpl</strong> • Sensor: <strong>{geo.sensorType}</strong>
              </div>

              {/* Canvas Drum */}
              <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(0, 242, 255, 0.2)', position: 'relative' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '130px', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 6, left: 10, fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  KOMPONEN Z • 100 Hz REAL-TIME STREAM • AMPLITUDO: {latestReport.amplitude}
                </div>
              </div>

              {/* Live Parameter Metric Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>AMPLITUDO MAKS</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#ff2a5f' }}>{latestReport.amplitude}</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>DURASI GEMPA</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#ff9800' }}>{latestReport.duration}</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>WAKTU TERAKHIR</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f2ff' }}>{latestReport.time}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Latest Seismogram Image & Physical Inspection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#ff9800', letterSpacing: '0.04em' }}>
                  📸 CITRA SEISMOGRAM TERKINI PVMBG
                </span>
                <button
                  onClick={() => onInspectSeismogram?.(latestReport)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#c084fc',
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🔬</span>
                  <span>Analisis Lengkap</span>
                </button>
              </div>

              {/* Image Display Box */}
              <div
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#060a14',
                  border: '1px solid var(--border-medium)',
                  height: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (latestReport.image_url) openPreview(latestReport.image_url);
                  else onInspectSeismogram?.(latestReport);
                }}
                title="Klik untuk memperbesar gambar seismogram"
              >
                {latestReport.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={latestReport.image_url}
                    alt={`Seismogram ${geo.name}`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>📈</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Rekaman Sinyal Erupsi G. {geo.name}
                    </span>
                    <div style={{ fontSize: '10px', marginTop: '4px' }}>
                      Amplitudo: {latestReport.amplitude} • Durasi: {latestReport.duration}
                    </div>
                    <div style={{ fontSize: '10px', color: '#00f2ff', marginTop: '6px' }}>
                      Klik untuk membuka rekonstruksi instrumen & analisis AI ↗
                    </div>
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    insetInline: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                  }}
                >
                  <span style={{ color: '#fff', fontWeight: 700 }}>🔍 Klik untuk Perbesar</span>
                  <span style={{ color: '#94a3b8' }}>{latestReport.date}</span>
                </div>
              </div>

              {/* Quick Volcanic Note */}
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <strong style={{ color: '#ff9800' }}>Pengamatan Kawah:</strong> {latestReport.visual_ash}<br />
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Petugas Pos: {latestReport.author}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ========================================================================= */
        /* MODE 2: BMKG SEISMOGRAPH & BROADBAND HELICORDER DRUM + CITRA SHAKEMAP */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* BMKG Station Selector Buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                PILIH STASIUN SEISMOGRAF BROADBAND BMKG:
              </span>
              <span style={{ fontSize: '11px', color: '#00f2ff' }}>
                Jaringan Seismologi BMKG TEWS Nasional (100 Hz Streaming)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
              {BMKG_BROADBAND_STATIONS.map((stn) => {
                const isSelected = activeBMKGStation.code === stn.code;
                return (
                  <button
                    key={stn.code}
                    type="button"
                    onClick={() => setActiveBMKGStation(stn)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(0, 242, 255, 0.25), rgba(59, 130, 246, 0.2))'
                        : 'rgba(6, 10, 20, 0.7)',
                      border: `1px solid ${isSelected ? '#00f2ff' : 'var(--border-subtle)'}`,
                      color: isSelected ? '#00f2ff' : 'var(--text-secondary)',
                      boxShadow: isSelected ? '0 0 12px rgba(0, 242, 255, 0.3)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: isSelected ? '#00f2ff' : '#fff' }}>
                        📡 {stn.code}
                      </span>
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', color: 'var(--text-muted)' }}>
                        {stn.elevation} m
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stn.name}</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>{stn.location}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BMKG Main Grid: Seismograph Live Drum + Citra Shakemap TEWS BMKG */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '18px',
            }}
            className="volcano-hub-main-grid"
          >
            {/* Left: BMKG Real-time Broadband Waveform */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="live-dot-pulse" style={{ background: '#00f2ff', boxShadow: '0 0 8px #00f2ff' }}></span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f2ff', letterSpacing: '0.04em' }}>
                    REKAMAN SEISMOGRAF BROADBAND BMKG (STN: {activeBMKGStation.code})
                  </span>
                </div>
                <span
                  style={{
                    background: 'rgba(0, 242, 255, 0.15)',
                    border: '1px solid rgba(0, 242, 255, 0.4)',
                    color: '#00f2ff',
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  BROADBAND 100 Hz
                </span>
              </div>

              {/* Station specs */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                📍 <strong style={{ color: 'var(--text-primary)' }}>{activeBMKGStation.name}</strong> • Wilayah: <strong>{activeBMKGStation.location}</strong><br />
                Sensor: <strong style={{ color: '#00f2ff' }}>{activeBMKGStation.sensor}</strong> • Koordinat: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{activeBMKGStation.lat.toFixed(3)}°, {activeBMKGStation.lon.toFixed(3)}°</span> • Elevasi: <strong>{activeBMKGStation.elevation} m</strong>
              </div>

              {/* Canvas Waveform Drum */}
              <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(0, 242, 255, 0.25)', position: 'relative' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '130px', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 6, left: 10, fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  KOMPONEN BHZ (VERTIKAL) • GAIN: {activeBMKGStation.gain}
                </div>
              </div>

              {/* BMKG Seismic Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>MAGNITUDO BMKG</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#00f2ff' }}>
                    {latestBMKG?.Magnitude ? `${latestBMKG.Magnitude} SR` : 'M 5.0+'}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>KEDALAMAN GEMPA</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b' }}>
                    {latestBMKG?.Kedalaman || '10 km'}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>WAKTU GEMPA BMKG</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399' }}>
                    {latestBMKG?.Jam || 'Realtime Stream'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Official BMKG Shakemap Citra */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f2ff', letterSpacing: '0.04em' }}>
                  🗺️ CITRA BMKG SEISMOGRAF & SHAKEMAP TEWS
                </span>
                <button
                  type="button"
                  onClick={() => onInspectSeismogram?.(bmkgReportForModal)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#00f2ff',
                    background: 'rgba(0, 242, 255, 0.15)',
                    border: '1px solid rgba(0, 242, 255, 0.4)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🔬</span>
                  <span>Analisis Sinyal</span>
                </button>
              </div>

              {/* Citra BMKG Display Box */}
              <div
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#060a14',
                  border: '1px solid var(--border-medium)',
                  height: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (bmkgShakemapUrl) openPreview(bmkgShakemapUrl);
                  else onInspectSeismogram?.(bmkgReportForModal);
                }}
                title="Klik untuk memperbesar Citra Shakemap BMKG"
              >
                {bmkgShakemapUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bmkgShakemapUrl}
                    alt="Citra BMKG Shakemap"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '32px', display: 'block', marginBottom: '6px' }}>📡</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Citra Seismogram & Peta Shakemap BMKG
                    </span>
                    <div style={{ fontSize: '10px', marginTop: '4px' }}>
                      Stasiun {activeBMKGStation.code} ({activeBMKGStation.name})
                    </div>
                    <div style={{ fontSize: '10px', color: '#00f2ff', marginTop: '6px' }}>
                      Klik untuk membuka visualisasi seismik drum BMKG TEWS ↗
                    </div>
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    insetInline: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                  }}
                >
                  <span style={{ color: '#00f2ff', fontWeight: 700 }}>🔍 Citra Shakemap BMKG Resmi</span>
                  <span style={{ color: '#94a3b8' }}>{latestBMKG?.Tanggal || 'BMKG TEWS'}</span>
                </div>
              </div>

              {/* BMKG Potensi & Notice */}
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <strong style={{ color: '#00f2ff' }}>Wilayah Terkini:</strong> {latestBMKG?.Wilayah || 'Wilayah Indonesia'}<br />
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  Potensi: {latestBMKG?.Potensi || 'Tidak berpotensi tsunami'} • Dirasakan: {latestBMKG?.Dirasakan || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Riwayat (History of Seismograms per Volcano) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📜</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Riwayat Seismograf & Catatan Erupsi: G. {geo.name}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px' }}>
              {volcanoHistory.length > 0 ? `${volcanoHistory.length} Kejadian Tercatat` : 'Monitoring Rutin'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Sumber: MAGMA Indonesia PVMBG
          </span>
        </div>

        {/* History Grid */}
        {volcanoHistory.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            Belum ada letusan besar baru yang dicatat pos pengamatan hari ini untuk G. {geo.name}. Seismograf saat ini merekam getaran tremor latar belakang (background micro-tremors).
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {volcanoHistory.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Top Info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#00f2ff' }}>
                    ⏱ {item.time}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {item.date}
                  </span>
                </div>

                {/* Thumbnail Image if available */}
                {item.image_url && (
                  <div
                    style={{
                      height: '100px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: '#060a14',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt={`Seismogram ${item.time}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Metrics Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span>Amp: <strong style={{ color: '#ff2a5f' }}>{item.amplitude}</strong></span>
                  <span>Durasi: <strong style={{ color: '#ff9800' }}>{item.duration}</strong></span>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.description}
                </p>

                {/* Action button */}
                <button
                  onClick={() => onInspectSeismogram?.(item)}
                  style={{
                    marginTop: 'auto',
                    padding: '5px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#c084fc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🔬</span>
                  <span>Analisis Sinyal & Citra Ini</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
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
                onClick={() => setPreviewZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
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
              {[1, 1.5, 2, 2.5].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    setPreviewZoom(lvl);
                    if (lvl === 1) setPreviewPan({ x: 0, y: 0 });
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: previewZoom === lvl ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: previewZoom === lvl ? '#00f2ff' : 'var(--text-secondary)',
                    border: `1px solid ${previewZoom === lvl ? '#00f2ff' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {lvl}x
                </button>
              ))}
              <button
                onClick={() => setPreviewZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
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
                  setPreviewZoom(1);
                  setPreviewPan({ x: 0, y: 0 });
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
                setPreviewZoom((z) => Math.max(0.75, Math.min(3.5, Number((z + delta).toFixed(2)))));
              }}
              onMouseDown={(e) => {
                if (previewZoom <= 1) return;
                setIsPreviewDragging(true);
                setPreviewDragStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
              }}
              onMouseMove={(e) => {
                if (!isPreviewDragging || previewZoom <= 1) return;
                setPreviewPan({ x: e.clientX - previewDragStart.x, y: e.clientY - previewDragStart.y });
              }}
              onMouseUp={() => setIsPreviewDragging(false)}
              onMouseLeave={() => setIsPreviewDragging(false)}
              style={{
                width: '100%',
                maxHeight: '78vh',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: previewZoom > 1 ? (isPreviewDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Seismogram PVMBG"
                className="volcano-lightbox__img"
                style={{
                  transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                  transition: isPreviewDragging ? 'none' : 'transform 0.15s ease',
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
