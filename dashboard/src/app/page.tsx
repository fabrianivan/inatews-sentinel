'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
} from 'lucide-react';
import type {
  SystemStatus,
  AIAnalysis,
  TsunamiScenario,
  LiveEvent,
  ActivityIndex as ActivityIndexType,
  RealtimeEarthquakesData,
  VolcanoEruption,
  LifecyclePhase,
  BMKGGempaDetail,
} from '@/lib/types';
import ActivityGauge from '@/components/ActivityGauge';
import MetricCards from '@/components/MetricCards';
import EventStream from '@/components/EventStream';
import AIPanel from '@/components/AIPanel';
import TsunamiPanel from '@/components/TsunamiPanel';
import Seismograph from '@/components/Seismograph';
import TacticalRibbon from '@/components/TacticalRibbon';
import LatestQuakeCard from '@/components/LatestQuakeCard';
import StatusBar from '@/components/StatusBar';
import FlinkPanel from '@/components/FlinkPanel';
import OceanPanel from '@/components/OceanPanel';
import GovernanceView from '@/components/GovernanceView';
import SeismogramAnalysisModal from '@/components/SeismogramAnalysisModal';
import VolcanoSeismographHub from '@/components/VolcanoSeismographHub';
import DrillFloatingBar from '@/components/DrillFloatingBar';
import type { DrillScenarioMapData } from '@/components/Map';
import { toggleBackendMode, triggerSimulation } from '@/hooks/useSSE';
import { useAlertAudio } from '@/hooks/useAlertAudio';
import type { OceanFeedResponse } from '@/lib/telemetry';
import type { TelemetryPromptContext } from '@/lib/aiContext';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[380px] w-full items-center justify-center bg-[var(--surface-canvas)] text-xs font-medium text-[var(--text-muted)]">
      Memuat peta tektonik &amp; jaringan InaTEWS...
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

const INITIAL_QUAKES: RealtimeEarthquakesData = {
  latest_bmkg: {
    Tanggal: '09 Sep 2026',
    Jam: '13:21:30 WIB',
    DateTime: '2026-09-09T06:21:30+00:00',
    Coordinates: '-6.92,105.49',
    Lintang: '6.92 LS',
    Bujur: '105.49 BT',
    Magnitude: '3.8',
    Kedalaman: '25 km',
    Wilayah: 'Pusat gempa berada di laut 31 km selatan Sumur',
    Potensi: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    Dirasakan: 'II Sumur',
    Shakemap: '20260909132130.mmi.jpg',
  },
  recent_bmkg: [
    {
      type: 'SEISMIC',
      magnitude: 5.2,
      depth: 10,
      frequency: 3.6,
      count: 1,
      latitude: -8.08,
      longitude: 120.56,
      mmi: 7,
      pga: 0.66,
      fault_zone: '60 km TimurLaut RUTENG-MANGGARAI-NTT',
      timestamp: '2026-09-08T04:40:29Z',
    },
    {
      type: 'SEISMIC',
      magnitude: 5.4,
      depth: 10,
      frequency: 3.7,
      count: 1,
      latitude: -8.42,
      longitude: 109.02,
      mmi: 7,
      pga: 0.68,
      fault_zone: '77 km Tenggara CILACAP-JATENG',
      timestamp: '2026-09-04T05:04:59Z',
    },
    {
      type: 'SEISMIC',
      magnitude: 5.8,
      depth: 10,
      frequency: 3.9,
      count: 1,
      latitude: -7.72,
      longitude: 104.47,
      mmi: 8,
      pga: 0.74,
      fault_zone: '170 km BaratDaya SUMUR-BANTEN',
      timestamp: '2026-08-21T17:41:43Z',
    },
  ],
  recent_usgs: [
    {
      type: 'SEISMIC',
      magnitude: 5.0,
      depth: 10,
      frequency: 3.5,
      count: 1,
      latitude: 4.0172,
      longitude: 125.3233,
      mmi: 7,
      pga: 0.63,
      fault_zone: '154 km S of Sarangani, Philippines',
      timestamp: '2026-09-09T07:07:00Z',
    },
    {
      type: 'SEISMIC',
      magnitude: 4.5,
      depth: 39.5,
      frequency: 3.25,
      count: 1,
      latitude: -4.9167,
      longitude: 102.8454,
      mmi: 6,
      pga: 0.45,
      fault_zone: '108 km SSW of Pagar Alam, Indonesia',
      timestamp: '2026-09-09T00:23:00Z',
    },
  ],
  timestamp: new Date().toISOString(),
};

const INITIAL_AI_ANALYSIS: AIAnalysis = {
  status: 'ADVISORY',
  threat_summary: 'Monitoring Kluster Seismisitas Aktif Segmen Selat Sunda (M3.8 Sumur) & NTT (M5.2 Ruteng)',
  observations: [
    'BMKG TEWS mendeteksi gempa terkini M3.8 di kedalaman 25 km pesisir Sumur-Banten (Selat Sunda).',
    'Tercatat kluster seismik M5.0+ regional di Ruteng NTT (M5.2) dan Cilacap Jawa Tengah (M5.4).',
    'Telemetri 12 stasiun broadband BMKG & 34 sensor pasang surut IOC UNESCO terpantau stabil tanpa anomali muka laut destruktif.',
    'Algoritma Flink CEP mencatat indeks intensitas seismik nasional pada level 35.0% (Ambang batas waspada).',
  ],
  assessment:
    'Sistem InaTEWS Sentinel mengonfirmasi aktivitas tektonik regional berada dalam batas terkontrol. Tidak ada indikasi pembentukan gelombang tsunami pasca-event Sumur & Ruteng. Koordinasi antar-lembaga tetap disiagakan untuk memantau potensi gempa susulan.',
  recommendations: [
    'Pertahankan pemantauan real-time kontinyu 24/7 jaringan stasiun seismik broadband BMKG.',
    'Pastikan kanal diseminasi Warning Receiver System (WRS D-VBI) dan SMS blast darurat BNPB dalam status siaga.',
    'Masyarakat diimbau tetap tenang dan hanya merujuk kanal informasi resmi BMKG dan BNPB.',
  ],
  agency_actions: [
    {
      agency: 'BMKG',
      priority: 'URGENT',
      action: 'Monitoring kontinyu focal mechanism hiposenter dan update peta guncangan ShakeMap nasional 24/7.',
    },
    {
      agency: 'BNPB',
      priority: 'STANDBY',
      action: 'Koordinasi Posko Siaga Bencana dengan BPBD tingkat provinsi dan kabupaten terdekat dari episenter.',
    },
    {
      agency: 'BASARNAS',
      priority: 'STANDBY',
      action: 'Siaga regu Search & Rescue maritim di pelabuhan dan pangkalan terdekat.',
    },
  ],
  hazard_details: {
    fault_mechanism: 'Subduction Interplate Thrust & Splay Faulting',
    estimated_coseismic_slip: '<0.2 meter',
    aftershock_risk: 'LOW (Ambang batas normal)',
    tsunami_runup_estimate: 'Tidak berpotensi tsunami',
    evacuation_window_min: 120,
  },
  confidence: 0.89,
  latency_ms: 142,
  model_used: 'Google Gemini 2.5 Flash',
  disclaimer: 'Real-time decision support based on streaming sensor telemetry. Not an official BMKG earthquake prediction.',
  contributing_factors: [
    { indicator: 'Mainshock Magnitude', value: 'M3.8', change: 'BMKG TEWS Verified', significance: 0.94 },
    { indicator: 'Hypocenter Depth', value: '25 km', change: 'Crustal Interface', significance: 0.81 },
    { indicator: 'Sea Level Anomaly', value: 'Nominal (<0.05m)', change: 'IOC Gauge Stable', significance: 0.88 },
    { indicator: 'Flink Intensity Index', value: '35.0%', change: 'Normal Baseline', significance: 0.75 },
  ],
  timestamp: new Date().toISOString(),
};

const INITIAL_STATUS: SystemStatus = {
  seismic_intensity: 35.0,
  ocean_status: 'IOC UNESCO LIVE',
  weather_status: 'OPEN-METEO ONLINE',
  infra_status: 'OPERATIONAL',
  active_alerts: 0,
  risk_level: 'NORMAL',
  trend_direction: 'LIVE STREAM ACTIVE',
  last_update: new Date().toISOString(),
};

const INITIAL_EVENTS: LiveEvent[] = [
  {
    id: 'init-1',
    type: 'SEISMIC',
    description: 'BMKG TEWS: Pemantauan kontinyu jaringan seismik broadband nasional aktif',
    severity: 'LOW',
    timestamp: '2026-09-08T08:00:00.000Z',
  },
  {
    id: 'init-2',
    type: 'STATION',
    description: 'Stasiun LEM (Lembang, Jawa Barat): Kualitas sinyal 99.8%, PGA 0.0018g [ONLINE]',
    severity: 'LOW',
    timestamp: '2026-09-08T08:01:00.000Z',
  },
  {
    id: 'init-3',
    type: 'OCEAN',
    description: 'InaTEWS Buoy & Tide Gauge IOC: Selat Sunda & Pesisir Selatan Jawa nominal',
    severity: 'LOW',
    timestamp: '2026-09-08T08:02:00.000Z',
  },
  {
    id: 'init-4',
    type: 'VOLCANO',
    description: 'MAGMA PVMBG: Monitoring kontinyu aktivitas vulkanik kawah aktif Nusantara',
    severity: 'LOW',
    timestamp: '2026-09-08T08:03:00.000Z',
  },
  {
    id: 'init-5',
    type: 'INFRASTRUCTURE',
    description: 'Fasilitas Kritis BNPB / BPBD: Jalur telemetri darurat operasional 100%',
    severity: 'LOW',
    timestamp: '2026-09-08T08:04:00.000Z',
  },
];

function parseLiveEvent(data: Record<string, unknown>, id: string): LiveEvent {
  const rawType = String(data.type || 'UNKNOWN');
  const type = rawType.toUpperCase();
  let description = data.description ? String(data.description) : '';
  let severity = (data.severity ? String(data.severity) : 'LOW') as
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  if (!description) {
    switch (type) {
      case 'SEISMIC': {
        const mag = typeof data.magnitude === 'number' ? data.magnitude.toFixed(1) : '?';
        const depth = typeof data.depth === 'number' ? data.depth.toFixed(0) : '?';
        const fault = String(data.fault_zone || 'Wilayah Indonesia');
        description = `Gempa Bumi M${mag} — Kedalaman ${depth}km (${fault})`;
        severity =
          typeof data.magnitude === 'number' && data.magnitude >= 7.0
            ? 'CRITICAL'
            : typeof data.magnitude === 'number' && data.magnitude >= 5.5
            ? 'HIGH'
            : typeof data.magnitude === 'number' && data.magnitude >= 4.0
            ? 'MEDIUM'
            : 'LOW';
        break;
      }
      case 'STATION': {
        const st = String(data.station_id || 'Station');
        const pga = typeof data.pga_recorded === 'number' ? data.pga_recorded.toFixed(4) : '?';
        const status = String(data.status || 'ONLINE');
        description = `Stasiun ${st}: PGA ${pga}g [${status}]`;
        severity = status === 'CLIPPED' ? 'CRITICAL' : 'LOW';
        break;
      }
      case 'OCEAN': {
        const sensor = String(data.sensor_id || 'Tide-Gauge');
        const wh = typeof data.wave_height === 'number' ? data.wave_height.toFixed(2) : '?';
        description = `${sensor}: Fluktuasi muka laut ${wh}m`;
        severity =
          typeof data.wave_height === 'number' && data.wave_height > 2.0
            ? 'CRITICAL'
            : typeof data.wave_height === 'number' && data.wave_height > 0.8
            ? 'HIGH'
            : 'LOW';
        break;
      }
      case 'WEATHER': {
        const ws = typeof data.wind_speed === 'number' ? data.wind_speed.toFixed(0) : '?';
        const wd = String(data.wind_direction || 'N');
        description = `Cuaca: Kecepatan angin ${ws} km/h arah ${wd}`;
        severity = 'LOW';
        break;
      }
      default:
        description = `${type} telemetri diterima`;
        severity = 'LOW';
    }
  }

  return {
    id,
    type,
    description,
    severity,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    data,
  };
}

interface DrillScenarioPreset {
  id: 'sunda-strait' | 'south-java' | 'mentawai' | 'palu-koro';
  name: string;
  shortLabel: string;
  faultZone: string;
  magnitude: number;
  depth: number;
  lat: number;
  lon: number;
  tsunamiHeight: number;
  sensorId: string;
  affectedZones: string[];
  faultMechanism: string;
  coseismicSlip: string;
  evacuationWindowMin: number;
  oceanSensorLabel: string;
}

const DRILL_SCENARIOS: DrillScenarioPreset[] = [
  {
    id: 'sunda-strait',
    name: 'Sunda Strait Megathrust M8.2',
    shortLabel: 'Selat Sunda (M8.2)',
    faultZone: 'Megathrust Selat Sunda-Banten',
    magnitude: 8.2,
    depth: 25,
    lat: -6.8,
    lon: 105.2,
    tsunamiHeight: 12.0,
    sensorId: 'BUOY-INA-01 (Selat Sunda)',
    affectedZones: [
      'Pesisir Pandeglang / Ujung Kulon',
      'Anyer & Carita',
      'Lampung Selatan / Kalianda',
      'Pelabuhan Ratu',
      'Krui Pesisir Barat',
    ],
    faultMechanism: 'Subduksi Oblique Thrust (Indo-Australia vs Eurasia)',
    coseismicSlip: '7.5 - 11.2 m pada kedalaman dangkal 25 km',
    evacuationWindowMin: 18,
    oceanSensorLabel: 'BUOY-INA-01 & PASUT CIWANDAN',
  },
  {
    id: 'south-java',
    name: 'South Java Megathrust M8.8',
    shortLabel: 'Selatan Jawa (M8.8)',
    faultZone: 'Zona Subduksi Selatan Jawa-Cilacap',
    magnitude: 8.8,
    depth: 15,
    lat: -9.1,
    lon: 109.5,
    tsunamiHeight: 20.0,
    sensorId: 'BUOY-INA-03 (Selatan Jawa)',
    affectedZones: [
      'Cilacap Pesisir',
      'Pangandaran & Kebumen',
      'Yogyakarta Selatan / Parangtritis',
      'Prigi Trenggalek',
      'Pelabuhan Ratu',
    ],
    faultMechanism: 'Full-Segment Megathrust Locking Release (Java Trench)',
    coseismicSlip: '11.0 - 16.5 m pada zona seismogenik 15 km',
    evacuationWindowMin: 22,
    oceanSensorLabel: 'BUOY-INA-03 & PASUT CILACAP',
  },
  {
    id: 'mentawai',
    name: 'Mentawai-Siberut Megathrust M9.0',
    shortLabel: 'Mentawai-Siberut (M9.0)',
    faultZone: 'Segmen Mentawai-Siberut Sumatra Trench',
    magnitude: 9.0,
    depth: 12,
    lat: -2.5,
    lon: 99.8,
    tsunamiHeight: 25.0,
    sensorId: 'BUOY-INA-05 (Mentawai Siberut)',
    affectedZones: [
      'Padang / Teluk Bayur',
      'Kepulauan Mentawai & Siberut',
      'Sibolga Sumatra Utara',
      'Bengkulu Pesisir',
      'Pesisir Barat Sumatra Barat',
    ],
    faultMechanism: 'Mega-Rupture Interplate Thrust (>350 km panjang patahan)',
    coseismicSlip: '14.0 - 21.0 m uplift dasar samudera',
    evacuationWindowMin: 15,
    oceanSensorLabel: 'BUOY-INA-05 & PASUT TELUK BAYUR',
  },
  {
    id: 'palu-koro',
    name: 'Palu-Koro Strike-Slip M7.5',
    shortLabel: 'Palu-Koro (M7.5)',
    faultZone: 'Sesar Aktif Palu-Koro & Teluk Palu',
    magnitude: 7.5,
    depth: 10,
    lat: -0.18,
    lon: 119.85,
    tsunamiHeight: 11.0,
    sensorId: 'BUOY-INA-07 (Selat Makassar - Toli-Toli)',
    affectedZones: [
      'Teluk Palu & Donggala',
      'Toli-Toli Sulteng',
      'Mamuju & Majene',
      'Balikpapan Selat Makassar',
    ],
    faultMechanism: 'Supershear Left-Lateral Strike-Slip + Submarine Landslide',
    coseismicSlip: '4.8 - 6.9 m sesar mendatar dangkal',
    evacuationWindowMin: 6,
    oceanSensorLabel: 'BUOY-INA-07 & PASUT TOLI-TOLI',
  },
];

interface DrillPhasePreset {
  phaseNumber: number;
  phaseName: string;
  shortLabel: string;
  title: string;
  activityLevel: number;
  seismicEnergy: number;
  tsunamiActive: boolean;
  tsunamiFactor: number;
  riskLevel: string;
  trendDirection: string;
  activeAlerts: number;
  earthquakeCount: number;
  mmi: number;
  weatherStatus: string;
  infraStatus: string;
}

const DRILL_PHASES: DrillPhasePreset[] = [
  {
    phaseNumber: 1,
    phaseName: 'SEISMIC_BASELINE',
    shortLabel: '1. Baseline',
    title: 'Pemantauan Pre-Event & Kalibrasi Sensor',
    activityLevel: 18.0,
    seismicEnergy: 1.8,
    tsunamiActive: false,
    tsunamiFactor: 0.0,
    riskLevel: 'NORMAL',
    trendDirection: 'STABLE',
    activeAlerts: 0,
    earthquakeCount: 4,
    mmi: 2.5,
    weatherStatus: 'CUACA PESISIR TERPANTAU',
    infraStatus: '100% OPERASIONAL',
  },
  {
    phaseNumber: 2,
    phaseName: 'PRECURSOR_SWARM',
    shortLabel: '2. Precursor Swarm',
    title: 'Swarm Gempa Pembuka & Anomali Deformasi',
    activityLevel: 52.0,
    seismicEnergy: 4.6,
    tsunamiActive: false,
    tsunamiFactor: 0.0,
    riskLevel: 'WASPADA',
    trendDirection: 'RISING',
    activeAlerts: 2,
    earthquakeCount: 19,
    mmi: 4.8,
    weatherStatus: 'SIAGA TELEMETRI GPS/InSAR',
    infraStatus: 'STANDBY DARURAT',
  },
  {
    phaseNumber: 3,
    phaseName: 'MAINSHOCK_RUPTURE',
    shortLabel: '3. Mainshock Rupture',
    title: 'Rupture Utama & Aktivasi Sirene InaTEWS',
    activityLevel: 94.0,
    seismicEnergy: 9.2,
    tsunamiActive: true,
    tsunamiFactor: 0.65,
    riskLevel: 'CRITICAL',
    trendDirection: 'SPIKE',
    activeAlerts: 5,
    earthquakeCount: 38,
    mmi: 8.6,
    weatherStatus: 'SIRENE PESISIR AKTIF',
    infraStatus: 'CLIPPING & OVERLOAD SEKTOR PESISIR',
  },
  {
    phaseNumber: 4,
    phaseName: 'TSUNAMI_PROPAGATION',
    shortLabel: '4. Tsunami Wavefront',
    title: 'Penjalaran Gelombang & Konfirmasi DART Buoy',
    activityLevel: 98.0,
    seismicEnergy: 8.7,
    tsunamiActive: true,
    tsunamiFactor: 1.0,
    riskLevel: 'CRITICAL',
    trendDirection: 'CRITICAL',
    activeAlerts: 8,
    earthquakeCount: 47,
    mmi: 8.9,
    weatherStatus: 'GELOMBANG TSUNAMI AKTIF',
    infraStatus: 'EVAKUASI DARURAT NASIONAL',
  },
  {
    phaseNumber: 5,
    phaseName: 'AFTERSHOCK_SAR',
    shortLabel: '5. Aftershock & SAR',
    title: 'Gempa Susulan & Koordinasi Operasi SAR',
    activityLevel: 68.0,
    seismicEnergy: 5.9,
    tsunamiActive: true,
    tsunamiFactor: 0.42,
    riskLevel: 'HIGH',
    trendDirection: 'FALLING',
    activeAlerts: 4,
    earthquakeCount: 63,
    mmi: 6.2,
    weatherStatus: 'PENANGANAN BANJIR ROB & SURUT',
    infraStatus: 'KORIDOR SAR & LOGISTIK AKTIF',
  },
];

export default function Home() {
  const [status, setStatus] = useState<SystemStatus | null>(INITIAL_STATUS);
  const [activityIndex, setActivityIndex] = useState<ActivityIndexType | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(INITIAL_AI_ANALYSIS);
  const [tsunami, setTsunami] = useState<TsunamiScenario | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>(INITIAL_EVENTS);
  const [realQuakes, setRealQuakes] = useState<RealtimeEarthquakesData | null>(INITIAL_QUAKES);
  const [volcanoes, setVolcanoes] = useState<VolcanoEruption[]>([]);
  const [oceanFeed, setOceanFeed] = useState<OceanFeedResponse | null>(null);
  const [selectedVolcano, setSelectedVolcano] = useState<string | null>('BMKG_REGIONAL');
  const [inspectingSeismogram, setInspectingSeismogram] = useState<VolcanoEruption | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'REAL' | 'SIMULASI'>('REAL');
  const [selectedScenarioId, setSelectedScenarioId] = useState<DrillScenarioPreset['id']>('sunda-strait');
  const [drillPhaseNumber, setDrillPhaseNumber] = useState<number>(4);
  const [drillActivatedAt, setDrillActivatedAt] = useState<string>('');
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [connected, setConnected] = useState(false);

  // Atmospheric Obsidian Glass UI State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [isDrillPlaying, setIsDrillPlaying] = useState<boolean>(false);
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false);
  const [showHudInspector, setShowHudInspector] = useState<boolean>(true);
  const [showInfraArchitecture, setShowInfraArchitecture] = useState<boolean>(false);

  const { playChime } = useAlertAudio(isAudioMuted);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('inatews-theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem('inatews-theme', next);
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);
  const sseRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventCounter = useRef(100);

  // Fetch real BMKG earthquakes & system status
  const fetchRealQuakes = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/realtime/earthquakes` : '/api/realtime/earthquakes';
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch real quakes: ${res.status}`);
        return res.json();
      })
      .then((data: RealtimeEarthquakesData) => {
        if (data && (data.latest_bmkg || (data.recent_bmkg && data.recent_bmkg.length > 0))) {
          setRealQuakes(data);
        }
      })
      .catch((err) => {
        console.warn('Primary earthquake fetch failed, falling back to local /api/realtime/earthquakes:', err);
        if (API_BASE) {
          fetch('/api/realtime/earthquakes')
            .then((r) => (r.ok ? r.json() : null))
            .then((localData: RealtimeEarthquakesData | null) => {
              if (localData && (localData.latest_bmkg || (localData.recent_bmkg && localData.recent_bmkg.length > 0))) {
                setRealQuakes(localData);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  const fetchVolcanoes = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/realtime/volcanoes` : '/api/realtime/volcanoes';
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch volcanoes');
        return res.json();
      })
      .then((data: VolcanoEruption[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setVolcanoes(data);
        }
      })
      .catch((err) => {
        console.warn('Primary volcano fetch failed, falling back to local route:', err);
        if (API_BASE) {
          fetch('/api/realtime/volcanoes')
            .then((r) => (r.ok ? r.json() : null))
            .then((localData: VolcanoEruption[] | null) => {
              if (Array.isArray(localData) && localData.length > 0) {
                setVolcanoes(localData);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  const fetchAI = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/ai/latest` : '/api/ai/latest';
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error('AI fetch failed');
        return res.json();
      })
      .then((data: AIAnalysis) => {
        if (data && data.status) {
          setAiAnalysis(data);
        }
      })
      .catch((err) => {
        console.warn('Primary AI fetch failed, falling back to local /api/ai/latest:', err);
        if (API_BASE) {
          fetch('/api/ai/latest')
            .then((r) => (r.ok ? r.json() : null))
            .then((localData: AIAnalysis | null) => {
              if (localData && localData.status) {
                setAiAnalysis(localData);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  const fetchOceanFeed = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/realtime/ocean` : '/api/realtime/ocean';
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Ocean fetch failed');
        return res.json();
      })
      .then((data: OceanFeedResponse) => {
        if (data && Array.isArray(data.stations) && data.stations.length > 0) {
          setOceanFeed(data);
        }
      })
      .catch(() => {
        if (API_BASE) {
          fetch('/api/realtime/ocean')
            .then((r) => (r.ok ? r.json() : null))
            .then((localData: OceanFeedResponse | null) => {
              if (localData && Array.isArray(localData.stations) && localData.stations.length > 0) {
                setOceanFeed(localData);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  const fetchStatus = useCallback(() => {
    const applyStatusPayload = (data: SystemStatus & { activity_index?: ActivityIndexType }) => {
      setStatus(data);
      if (data.activity_index) setActivityIndex(data.activity_index);
      if (data.latest_ai) setAiAnalysis(data.latest_ai);
      if (data.tsunami_scenario?.active) setTsunami(data.tsunami_scenario);
    };

    const targetUrl = API_BASE ? `${API_BASE}/api/status` : '/api/status';
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Status fetch failed');
        return res.json();
      })
      .then((data: SystemStatus & { activity_index?: ActivityIndexType }) => {
        if (data) applyStatusPayload(data);
      })
      .catch((err) => {
        console.warn('Primary status fetch failed, falling back to local route:', err);
        if (API_BASE) {
          fetch('/api/status')
            .then((r) => (r.ok ? r.json() : null))
            .then((localData: (SystemStatus & { activity_index?: ActivityIndexType }) | null) => {
              if (localData) applyStatusPayload(localData);
            })
            .catch(() => {});
        }
      });
  }, []);

  useEffect(() => {
    fetchRealQuakes();
    fetchVolcanoes();
    fetchOceanFeed();
    fetchStatus();
    fetchAI();

    const interval = setInterval(() => {
      fetchRealQuakes();
      fetchVolcanoes();
      fetchOceanFeed();
      fetchStatus();
      fetchAI();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchRealQuakes, fetchVolcanoes, fetchOceanFeed, fetchStatus, fetchAI]);

  // SSE Stream Listener
  const connectSSE = useCallback(() => {
    if (sseRetryTimerRef.current) {
      clearTimeout(sseRetryTimerRef.current);
      sseRetryTimerRef.current = null;
    }

    const es = new EventSource(`${API_BASE}/api/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener('all', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        const { event: eventType, data } = msg;

        switch (eventType) {
          case 'metrics':
            setStatus(data as SystemStatus);
            break;
          case 'activity_index':
            setActivityIndex(data as ActivityIndexType);
            break;
          case 'ai_analysis':
            setAiAnalysis(data as AIAnalysis);
            break;
          case 'tsunami':
            setTsunami(data as TsunamiScenario);
            break;
          case 'event': {
            const liveEvent = parseLiveEvent(
              data as Record<string, unknown>,
              `evt-${++eventCounter.current}`
            );
            setEvents((prev) => [liveEvent, ...prev].slice(0, 50));

            if (liveEvent.type === 'SEISMIC') {
              fetchRealQuakes();
              fetchAI();
            }
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      // When standalone without external backend URL, wait 15s between bounded SSE reconnects
      const retryDelayMs = API_BASE ? 2500 : 15000;
      sseRetryTimerRef.current = setTimeout(connectSSE, retryDelayMs);
    };
  }, [fetchRealQuakes, fetchAI]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (sseRetryTimerRef.current) {
        clearTimeout(sseRetryTimerRef.current);
        sseRetryTimerRef.current = null;
      }
      eventSourceRef.current?.close();
    };
  }, [connectSSE]);

  const activeScenario = useMemo(
    () => DRILL_SCENARIOS.find((s) => s.id === selectedScenarioId) ?? DRILL_SCENARIOS[0],
    [selectedScenarioId]
  );

  const activePhase = useMemo(
    () => DRILL_PHASES.find((p) => p.phaseNumber === drillPhaseNumber) ?? DRILL_PHASES[3],
    [drillPhaseNumber]
  );

  const emitDrillEvents = useCallback(
    (scenario: DrillScenarioPreset, phase: DrillPhasePreset, ts: string) => {
      const nextEvents: LiveEvent[] = [
        {
          id: `drill-evt-${++eventCounter.current}`,
          type: 'SEISMIC',
          description: `[DRILL ${phase.shortLabel}] ${scenario.name} — ${scenario.faultZone} (MMI ${phase.mmi.toFixed(1)}, Intensitas ${phase.activityLevel.toFixed(0)}%)`,
          severity: phase.phaseNumber >= 3 ? 'CRITICAL' : phase.phaseNumber === 2 ? 'HIGH' : 'LOW',
          timestamp: ts,
        },
        {
          id: `drill-evt-${++eventCounter.current}`,
          type: 'STATION',
          description: `[DRILL] Telemetri broadband ${scenario.faultZone} — Energi seismik ${phase.seismicEnergy.toFixed(1)}x baseline`,
          severity: phase.phaseNumber >= 3 ? 'HIGH' : 'MEDIUM',
          timestamp: ts,
        },
      ];

      if (phase.tsunamiActive) {
        nextEvents.unshift({
          id: `drill-evt-${++eventCounter.current}`,
          type: 'OCEAN',
          description: `[DRILL TSUNAMI] ${scenario.oceanSensorLabel} mendeteksi anomali muka air laut +${(scenario.tsunamiHeight * phase.tsunamiFactor).toFixed(2)}m (${scenario.affectedZones[0]})`,
          severity: 'CRITICAL',
          timestamp: ts,
        });
      }

      setEvents((prev) => [...nextEvents, ...prev].slice(0, 60));
    },
    []
  );

  const handleModeChange = useCallback(
    (nextMode: 'REAL' | 'SIMULASI') => {
      setDashboardMode(nextMode);
      setAlertDismissed(false);
      if (nextMode === 'SIMULASI') {
        const nowIso = new Date().toISOString();
        setDrillActivatedAt(nowIso);
        emitDrillEvents(activeScenario, activePhase, nowIso);
        toggleBackendMode('drill')
          .then(() => triggerSimulation(`scenario/${activeScenario.id}`))
          .catch(() => {});
      } else {
        setIsDrillPlaying(false);
        setTsunami(null);
        toggleBackendMode('real')
          .then(() => triggerSimulation('reset'))
          .catch(() => {});
        fetchStatus();
        fetchAI();
        fetchRealQuakes();
      }
    },
    [activeScenario, activePhase, emitDrillEvents, fetchStatus, fetchAI, fetchRealQuakes]
  );

  const handleSelectScenario = useCallback(
    (scenarioId: DrillScenarioPreset['id']) => {
      setSelectedScenarioId(scenarioId);
      setAlertDismissed(false);
      const scenario = DRILL_SCENARIOS.find((s) => s.id === scenarioId) ?? DRILL_SCENARIOS[0];
      const nowIso = new Date().toISOString();
      setDrillActivatedAt(nowIso);
      emitDrillEvents(scenario, activePhase, nowIso);
      triggerSimulation(`scenario/${scenario.id}`).catch(() => {});
    },
    [activePhase, emitDrillEvents]
  );

  const handleSelectPhase = useCallback(
    (phaseNumber: number) => {
      setDrillPhaseNumber(phaseNumber);
      setAlertDismissed(false);
      const phase = DRILL_PHASES.find((p) => p.phaseNumber === phaseNumber) ?? DRILL_PHASES[3];
      const nowIso = new Date().toISOString();
      setDrillActivatedAt(nowIso);
      emitDrillEvents(activeScenario, phase, nowIso);
    },
    [activeScenario, emitDrillEvents]
  );

  // Auto-advance Megathrust Drill phases every 6 seconds when Play is active
  useEffect(() => {
    if (dashboardMode !== 'SIMULASI' || !isDrillPlaying) return;
    const timer = setInterval(() => {
      const nextPhase = drillPhaseNumber >= 5 ? 1 : drillPhaseNumber + 1;
      handleSelectPhase(nextPhase);
    }, 6000);
    return () => clearInterval(timer);
  }, [dashboardMode, isDrillPlaying, drillPhaseNumber, handleSelectPhase]);

  const handleFocusMap = useCallback((lat: number, lon: number) => {
    setFocusCoords({ lat, lon });
    document.getElementById('tactical-map-section')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, []);

  const drillTimestamp = drillActivatedAt || '2026-11-15T12:00:00.000Z';

  const drillMapData: DrillScenarioMapData | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') return null;
    return {
      id: activeScenario.id,
      name: activeScenario.name,
      faultZone: activeScenario.faultZone,
      magnitude: activePhase.phaseNumber >= 3 ? activeScenario.magnitude : Number((activeScenario.magnitude - 2.1).toFixed(1)),
      depth: activeScenario.depth,
      lat: activeScenario.lat,
      lon: activeScenario.lon,
      tsunamiHeight: Number((activeScenario.tsunamiHeight * Math.max(0.25, activePhase.tsunamiFactor)).toFixed(1)),
    };
  }, [dashboardMode, activeScenario, activePhase]);

  const drillPhaseObj: LifecyclePhase | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') return null;
    return {
      phase_number: activePhase.phaseNumber,
      phase_name: activePhase.phaseName,
      phase_title: activePhase.title,
      activity_level: activePhase.activityLevel,
      duration_sec: 120,
      elapsed_sec: activePhase.phaseNumber * 24,
      seismic_energy: activePhase.seismicEnergy,
      status: activePhase.riskLevel,
      scenario_name: activeScenario.name,
      magnitude: activeScenario.magnitude,
      depth: activeScenario.depth,
      fault_zone: activeScenario.faultZone,
      mmi: activePhase.mmi,
      latitude: activeScenario.lat,
      longitude: activeScenario.lon,
      timestamp: drillTimestamp,
    };
  }, [dashboardMode, activeScenario, activePhase, drillTimestamp]);

  const effectiveTsunami: TsunamiScenario | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') {
      return tsunami;
    }
    const waveHeight = Number((activeScenario.tsunamiHeight * activePhase.tsunamiFactor).toFixed(2));
    return {
      active: activePhase.tsunamiActive,
      detection_time: drillTimestamp,
      sensor_id: activeScenario.sensorId,
      wave_anomaly: waveHeight > 0 ? waveHeight : 0.15,
      affected_zones: activeScenario.affectedZones,
      response_actions: [
        `Aktivasi sirine tsunami pesisir ${activeScenario.affectedZones[0]} & ${activeScenario.affectedZones[1]}`,
        `Evakuasi vertikal/menjauhi pantai >20 m (jendela evakuasi ${activeScenario.evacuationWindowMin} menit)`,
        `Koordinasi operasi SAR terpadu BMKG, BNPB, BASARNAS, dan TNI/Polri`,
      ],
      severity: activePhase.phaseNumber >= 3 ? 'CRITICAL' : 'HIGH',
      timestamp: drillTimestamp,
    };
  }, [dashboardMode, tsunami, activeScenario, activePhase, drillTimestamp]);

  const effectiveActivityIndex: ActivityIndexType | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') {
      return activityIndex;
    }
    const effectiveMag =
      activePhase.phaseNumber >= 3
        ? activeScenario.magnitude
        : activePhase.phaseNumber === 2
        ? Number((activeScenario.magnitude - 2.3).toFixed(1))
        : 4.1;
    return {
      overall_percentage: activePhase.activityLevel,
      seismic_change: Number((activePhase.seismicEnergy * 24).toFixed(1)),
      tremor_change: Number((activePhase.seismicEnergy * 18.5).toFixed(1)),
      deformation_trend: activePhase.phaseNumber >= 3 ? `COSEISMIC SLIP ${activeScenario.coseismicSlip}` : 'INCREASING GPS STRAIN',
      thermal_trend: activePhase.phaseNumber >= 3 ? 'HIGH ENERGY RELEASE' : 'STABLE',
      trend_direction: activePhase.trendDirection,
      earthquake_count: activePhase.earthquakeCount,
      avg_magnitude: Number((effectiveMag - 1.4).toFixed(1)),
      max_magnitude: effectiveMag,
      timestamp: drillTimestamp,
    };
  }, [dashboardMode, activityIndex, activeScenario, activePhase, drillTimestamp]);

  const effectiveStatus: SystemStatus | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') {
      return status;
    }
    return {
      seismic_intensity: activePhase.activityLevel,
      ocean_status: activePhase.tsunamiActive
        ? `TSUNAMI SURGE +${(activeScenario.tsunamiHeight * activePhase.tsunamiFactor).toFixed(1)}m`
        : 'IOC BUOY MONITORING',
      weather_status: activePhase.weatherStatus,
      infra_status: activePhase.infraStatus,
      active_alerts: activePhase.activeAlerts,
      risk_level: activePhase.riskLevel,
      trend_direction: activePhase.trendDirection,
      last_update: drillTimestamp,
      tsunami_scenario: effectiveTsunami ?? undefined,
    };
  }, [dashboardMode, status, activeScenario, activePhase, drillTimestamp, effectiveTsunami]);

  const effectiveAiAnalysis: AIAnalysis | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') {
      return aiAnalysis;
    }
    const simulatedWave = (activeScenario.tsunamiHeight * activePhase.tsunamiFactor).toFixed(1);
    return {
      status: activePhase.riskLevel === 'CRITICAL' ? 'CRITICAL' : activePhase.riskLevel === 'HIGH' ? 'HIGH' : 'ADVISORY',
      threat_summary: `[SIMULASI ${activePhase.shortLabel}] ${activeScenario.name} — ${activePhase.title}. Estimasi anomali gelombang ${activePhase.tsunamiActive ? `+${simulatedWave} m` : 'dalam pemantauan precursor'} menuju ${activeScenario.affectedZones.slice(0, 3).join(', ')}.`,
      observations: [
        `Pemicu skenario: ${activeScenario.name} di ${activeScenario.faultZone} (${activeScenario.lat.toFixed(2)}, ${activeScenario.lon.toFixed(2)}) kedalaman ${activeScenario.depth} km.`,
        `Fase siklus hidup bencana: ${activePhase.title} (MMI ${activePhase.mmi.toFixed(1)}, aktivitas Flink CEP ${activePhase.activityLevel.toFixed(0)}%).`,
        activePhase.tsunamiActive
          ? `${activeScenario.oceanSensorLabel} mengonfirmasi anomali muka air laut hingga +${simulatedWave} m pada zona berdampak.`
          : `Stasiun GPS/InSAR dan seismometer broadband mengamati akumulasi regangan pra-gempa pada segmen subduksi.`,
      ],
      assessment: `Analisis streaming Flink CEP + OODA Sentinel pada skenario ${activeScenario.name} (${activePhase.shortLabel}) menunjukkan potensi pelepasan energi skala besar melalui mekanisme ${activeScenario.faultMechanism}. Zona prioritas dampak meliputi ${activeScenario.affectedZones.join(', ')}.`,
      recommendations: [
        `Kirim peringatan dini PD-1/PD-2/PD-3 InaTEWS ke Pemda dan BPBD pada sektor ${activeScenario.affectedZones.slice(0, 3).join(', ')}.`,
        `Arahkan warga pesisir menuju zona elevasi aman (>20 m) dalam jendela emas ${activeScenario.evacuationWindowMin} menit.`,
        `Verifikasi berkelanjutan pembacaan stasiun pasut IOC UNESCO dan DART Buoy ${activeScenario.sensorId}.`,
      ],
      agency_actions: [
        {
          agency: 'BMKG InaTEWS',
          priority: activePhase.phaseNumber >= 3 ? 'CRITICAL' : 'HIGH',
          action: `Diseminasi parameter ${activeScenario.name} & pemutakhiran peringatan tsunami ke seluruh portal WRS.`,
        },
        {
          agency: 'BNPB / BPBD',
          priority: activePhase.phaseNumber >= 3 ? 'CRITICAL' : 'MEDIUM',
          action: `Aktivasi posko komando darurat dan jalur evakuasi ${activeScenario.affectedZones[0]} - ${activeScenario.affectedZones[1]}.`,
        },
        {
          agency: 'BASARNAS',
          priority: activePhase.phaseNumber >= 4 ? 'CRITICAL' : 'HIGH',
          action: `Mobilisasi USAR, helikopter, dan kapal SAR menuju sektor pesisir terdekat episenter.`,
        },
      ],
      hazard_details: {
        fault_mechanism: activeScenario.faultMechanism,
        estimated_coseismic_slip: activeScenario.coseismicSlip,
        aftershock_risk: activePhase.phaseNumber >= 3 ? 'Sangat Tinggi (berpotensi M6.5+ hingga 72 jam)' : 'Meningkat (Swarm Awal)',
        tsunami_runup_estimate: activePhase.tsunamiActive ? `Hingga ${activeScenario.tsunamiHeight.toFixed(1)} m di pesisir dekat sumber` : 'Belum terpicu (Fase Pra-Rupture)',
        evacuation_window_min: activeScenario.evacuationWindowMin,
      },
      confidence: activePhase.phaseNumber >= 3 ? 0.96 : 0.88,
      latency_ms: 420,
      model_used: aiAnalysis?.model_used || 'InaTEWS Drill AI Engine',
      disclaimer: 'Mode SIMULASI LATIHAN MEGATHRUST aktif — seluruh data bersifat skenario uji kesiapsiagaan.',
      contributing_factors: [
        {
          indicator: 'Magnitudo & Kedalaman',
          value: `M${activeScenario.magnitude.toFixed(1)} / ${activeScenario.depth} km`,
          change: activePhase.shortLabel,
          significance: activePhase.phaseNumber >= 3 ? 0.98 : 0.65,
        },
        {
          indicator: 'Elevasi Anomali Buoy/IOC',
          value: activePhase.tsunamiActive ? `+${simulatedWave} m` : '0.05 m',
          change: activePhase.tsunamiActive ? 'TSUNAMI SURGE' : 'NOMINAL',
          significance: activePhase.tsunamiActive ? 0.95 : 0.25,
        },
        {
          indicator: 'Indeks Flink CEP MMI',
          value: `${activePhase.activityLevel.toFixed(0)}% (MMI ${activePhase.mmi.toFixed(1)})`,
          change: activePhase.trendDirection,
          significance: Number((activePhase.activityLevel / 100).toFixed(2)),
        },
      ],
      timestamp: drillTimestamp,
    };
  }, [dashboardMode, aiAnalysis, activeScenario, activePhase, drillTimestamp]);

  const effectiveLatestQuake: BMKGGempaDetail | null = useMemo(() => {
    if (dashboardMode !== 'SIMULASI') {
      return realQuakes?.latest_bmkg ?? null;
    }
    const simMag = activePhase.phaseNumber >= 3 ? activeScenario.magnitude : Number((activeScenario.magnitude - 2.3).toFixed(1));
    return {
      Tanggal: 'SIMULASI DRILL',
      Jam: activePhase.shortLabel,
      DateTime: drillTimestamp,
      Coordinates: `${activeScenario.lat.toFixed(2)},${activeScenario.lon.toFixed(2)}`,
      Lintang: `${Math.abs(activeScenario.lat).toFixed(2)} ${activeScenario.lat < 0 ? 'LS' : 'LU'}`,
      Bujur: `${activeScenario.lon.toFixed(2)} BT`,
      Magnitude: simMag.toFixed(1),
      Kedalaman: `${activeScenario.depth} km`,
      Wilayah: `${activeScenario.name} — ${activeScenario.faultZone}`,
      Potensi: activePhase.tsunamiActive
        ? `Berpotensi TSUNAMI (Maks ${activeScenario.tsunamiHeight.toFixed(1)}m) — Skenario Drill InaTEWS`
        : 'Pemantauan deformasi & precursor swarm (belum memicu tsunami)',
      Dirasakan: `VIII-IX MMI (${activeScenario.affectedZones[0]})`,
      Shakemap: realQuakes?.latest_bmkg?.Shakemap,
    };
  }, [dashboardMode, realQuakes, activeScenario, activePhase, drillTimestamp]);

  const effectiveActivityLevel =
    effectiveActivityIndex?.overall_percentage ??
    effectiveStatus?.seismic_intensity ??
    15.0;

  const effectiveTrend = effectiveActivityIndex?.trend_direction ?? effectiveStatus?.trend_direction ?? 'STABLE';
  const effectiveRiskLevel = effectiveStatus?.risk_level ?? 'NORMAL';
  const effectiveAlertCount = (effectiveTsunami?.active ? 1 : 0) + (effectiveStatus?.active_alerts ?? 0);
  const effectiveSeismicEnergy = dashboardMode === 'SIMULASI' ? activePhase.seismicEnergy : 1.2;

  const telemetryContext: TelemetryPromptContext = useMemo(
    () => ({
      mode: dashboardMode,
      scenario:
        dashboardMode === 'SIMULASI'
          ? {
              id: activeScenario.id,
              name: activeScenario.name,
              faultZone: activeScenario.faultZone,
              magnitude: activeScenario.magnitude,
              depth: activeScenario.depth,
              tsunamiHeight: activeScenario.tsunamiHeight,
              affectedZones: activeScenario.affectedZones,
              evacuationWindowMin: activeScenario.evacuationWindowMin,
            }
          : null,
      phase:
        dashboardMode === 'SIMULASI'
          ? {
              phaseNumber: activePhase.phaseNumber,
              phaseName: activePhase.phaseName,
              shortLabel: activePhase.shortLabel,
              title: activePhase.title,
              mmi: activePhase.mmi,
              activityLevel: activePhase.activityLevel,
              tsunamiActive: activePhase.tsunamiActive,
            }
          : null,
      latestQuake: effectiveLatestQuake,
      oceanSummary: effectiveStatus?.ocean_status || (oceanFeed?.live_count ? `${oceanFeed.live_count} IOC Live` : undefined),
    }),
    [dashboardMode, activeScenario, activePhase, effectiveLatestQuake, effectiveStatus, oceanFeed]
  );

  useEffect(() => {
    if (effectiveTsunami?.active || effectiveRiskLevel === 'CRITICAL') {
      playChime('critical');
    } else if (effectiveRiskLevel === 'HIGH') {
      playChime('high');
    }
  }, [
    effectiveTsunami?.active,
    effectiveRiskLevel,
    selectedScenarioId,
    drillPhaseNumber,
    dashboardMode,
    playChime,
  ]);

  const showTsunamiAlert = Boolean(effectiveTsunami?.active && !alertDismissed);
  const tideCount = oceanFeed?.count ?? 20;

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      {/* Floating Atmospheric Frosted Glass Masthead */}
      <header className="fixed inset-x-3 top-3 z-[1000] sm:inset-x-5">
        <StatusBar
          connected={connected}
          alertCount={effectiveAlertCount}
          riskLevel={effectiveRiskLevel}
          dashboardMode={dashboardMode}
          onModeChange={handleModeChange}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => setIsAudioMuted((prev) => !prev)}
        />
      </header>

      {/* STAGE 1: FULL-BLEED 100VH ATMOSPHERIC MAP CANVAS + FLOATING FROSTED GLASS HUD */}
      <section
        id="tactical-map-section"
        className="relative h-[68dvh] min-h-[460px] w-full overflow-hidden lg:h-[100dvh]"
      >
        <MapComponent
          realQuakes={realQuakes}
          focusCoords={focusCoords}
          activityLevel={effectiveActivityLevel}
          events={events}
          volcanoes={volcanoes}
          selectedVolcano={selectedVolcano}
          onSelectVolcano={(name) => setSelectedVolcano(name)}
          onInspectVolcanoSeismogram={(v) => setInspectingSeismogram(v)}
          tsunamiActive={Boolean(effectiveTsunami?.active)}
          isSimulasi={dashboardMode === 'SIMULASI'}
          phase={drillPhaseObj}
          drillScenarioData={drillMapData}
          theme={theme}
          floatingHud={true}
        />

        {/* Floating Top-Left Telemetry Pills + Alerts (Clear of Leaflet TopLeft & Floating Masthead) */}
        <div
          className={`pointer-events-none absolute left-[64px] right-3 top-[84px] z-[880] flex flex-col gap-2.5 ${
            showHudInspector ? 'lg:right-[410px]' : 'lg:right-4'
          }`}
        >
          <TacticalRibbon
            latestQuake={effectiveLatestQuake}
            activityIndex={effectiveActivityIndex}
            status={effectiveStatus}
            aiAnalysis={effectiveAiAnalysis}
            stationCount={12}
            tideCount={tideCount}
            variant="hud"
          />

          {dashboardMode === 'SIMULASI' && (
            <div className="pointer-events-auto max-w-3xl">
              <DrillFloatingBar
                scenarios={DRILL_SCENARIOS}
                phases={DRILL_PHASES}
                activeScenario={activeScenario}
                activePhase={activePhase}
                isPlaying={isDrillPlaying}
                onSelectScenario={handleSelectScenario}
                onSelectPhase={handleSelectPhase}
                onTogglePlay={() => setIsDrillPlaying((prev) => !prev)}
              />
            </div>
          )}

          {showTsunamiAlert && effectiveTsunami && (
            <div className="pointer-events-auto max-w-3xl">
              <TsunamiPanel
                scenario={effectiveTsunami}
                isSimulasi={dashboardMode === 'SIMULASI'}
                onDismiss={() => setAlertDismissed(true)}
              />
            </div>
          )}
        </div>

        {/* Desktop Floating Re-Open Button when Right Inspector is Hidden */}
        {!showHudInspector && (
          <button
            type="button"
            onClick={() => setShowHudInspector(true)}
            className="glass-hud absolute right-4 top-[132px] z-[890] hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] lg:inline-flex"
          >
            <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Tampilkan Laporan Gempa</span>
          </button>
        )}

        {/* Floating Right Frosted Glass Hero Inspector Card (Desktop Overlay) */}
        {showHudInspector && (
          <aside
            aria-label="Inspektor Gempa Terkini"
            className="no-scrollbar hidden lg:flex lg:flex-col lg:gap-2 lg:absolute lg:bottom-4 lg:right-4 lg:top-[84px] lg:z-[890] lg:w-[372px] lg:overflow-y-auto"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHudInspector(false)}
                className="glass-hud inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <EyeOff className="h-3 w-3" />
                <span>Sembunyikan Panel</span>
              </button>
            </div>
            <LatestQuakeCard
              quake={effectiveLatestQuake}
              realQuakes={realQuakes}
              onFocusMap={handleFocusMap}
              activityPercentage={effectiveActivityLevel}
              deepDiveTargetId="deep-analytics-section"
            />
          </aside>
        )}

        {/* Floating Bottom-Left Live Seismograph HUD Strip (Desktop Overlay) */}
        <div
          className={`hidden lg:block lg:absolute lg:bottom-4 lg:left-4 lg:z-[880] ${
            showHudInspector
              ? 'lg:w-[540px] lg:max-w-[calc(100%-412px)]'
              : 'lg:w-[580px] lg:max-w-[calc(100%-32px)]'
          }`}
        >
          <Seismograph
            seismicEnergy={effectiveSeismicEnergy}
            activityLevel={effectiveActivityLevel}
            phaseName={
              dashboardMode === 'SIMULASI'
                ? activePhase.phaseName
                : 'SEISMIC_BASELINE'
            }
            volcanoes={volcanoes}
            selectedVolcano={selectedVolcano}
            onSelectVolcano={(name) => setSelectedVolcano(name)}
            onInspectSeismogram={(v) => setInspectingSeismogram(v)}
            isSimulasi={dashboardMode === 'SIMULASI'}
            theme={theme}
            compactHud={true}
          />
        </div>
      </section>

      {/* STAGE 2: ATMOSPHERIC BELOW-FOLD DEEP ANALYTICS & TELEMETRY */}
      <main
        id="deep-analytics-section"
        className="relative border-t border-[var(--border-hairline)] bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.06),transparent_65%)]"
      >
        <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Mobile & Tablet Stacked Quake Card + Full Seismograph */}
        <div className="grid grid-cols-1 gap-6 lg:hidden">
          <LatestQuakeCard
            quake={effectiveLatestQuake}
            realQuakes={realQuakes}
            onFocusMap={handleFocusMap}
            activityPercentage={effectiveActivityLevel}
          />
          <Seismograph
            seismicEnergy={effectiveSeismicEnergy}
            activityLevel={effectiveActivityLevel}
            phaseName={
              dashboardMode === 'SIMULASI'
                ? activePhase.phaseName
                : 'SEISMIC_BASELINE'
            }
            volcanoes={volcanoes}
            selectedVolcano={selectedVolcano}
            onSelectVolcano={(name) => setSelectedVolcano(name)}
            onInspectSeismogram={(v) => setInspectingSeismogram(v)}
            isSimulasi={dashboardMode === 'SIMULASI'}
            theme={theme}
          />
        </div>

        {/* Summary & Telemetry Triad: MMI Gauge + Cross-Sensor + Live Event Stream */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-[var(--border-hairline)] pb-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl">
              Telemetri Intensitas, Sensor &amp; Aliran Kejadian
            </h2>
            <span className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
              Streaming Real-Time
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="matte-card p-5 lg:col-span-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
                  Skala Intensitas (MMI)
                </span>
                <span className="font-mono text-[10px] font-bold text-[var(--accent)]">
                  FLINK CEP
                </span>
              </div>
              <ActivityGauge percentage={effectiveActivityLevel} trend={effectiveTrend} />
            </div>

            <div className="lg:col-span-4">
              <MetricCards
                oceanStatus={
                  effectiveTsunami?.active
                    ? 'TSUNAMI WAVE FRONT'
                    : effectiveStatus?.ocean_status ?? 'IOC UNESCO LIVE'
                }
                weatherStatus={effectiveStatus?.weather_status ?? 'OPEN-METEO'}
                infraStatus={effectiveStatus?.infra_status ?? 'OPERASIONAL'}
                activityIndex={effectiveActivityIndex}
              />
            </div>

            <div className="lg:col-span-4">
              <EventStream events={events} maxHeightClass="max-h-[290px]" />
            </div>
          </div>
        </section>

        {/* Full-Width Atmospheric AI Sentinel & Kopilot */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-[var(--border-hairline)] pb-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl">
              AI Sentinel &amp; Kopilot Keputusan
            </h2>
            <span className="font-mono text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
              Gemini 2.5 · AWS Bedrock
            </span>
          </div>

          {effectiveAiAnalysis ? (
            <AIPanel analysis={effectiveAiAnalysis} telemetryContext={telemetryContext} />
          ) : (
            <div className="matte-card p-8 text-center text-xs text-[var(--text-muted)]">
              Memuat modul AI Decision Support InaTEWS...
            </div>
          )}
        </section>

        {/* Pemantauan Pasut IOC & Gunung Api PVMBG */}
        <section className="space-y-6">
          <div className="flex items-baseline justify-between border-b border-[var(--border-hairline)] pb-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl">
              Jaringan Pasang Surut &amp; Gunung Api
            </h2>
            <span className="font-mono text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
              IOC UNESCO · PVMBG MAGMA
            </span>
          </div>

          <OceanPanel
            tsunami={effectiveTsunami}
            stations={oceanFeed?.stations}
            oceanSource={oceanFeed?.source}
            onFocusMap={handleFocusMap}
          />

          <VolcanoSeismographHub
            volcanoes={volcanoes}
            selectedVolcano={
              selectedVolcano === 'BMKG_REGIONAL' ? 'Anak Krakatau' : selectedVolcano
            }
            onSelectVolcano={(name) => setSelectedVolcano(name)}
            onInspectSeismogram={(v) => setInspectingSeismogram(v)}
            theme={theme}
          />
        </section>

        {/* Ringkasan Infrastruktur Streaming (Ringkas & Dapat Dibuka) */}
        <section className="pb-8">
          <div className="matte-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
                  <Cpu className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Infrastruktur Stream Confluent Kafka, Apache Flink CEP &amp; Schema Registry
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                    cpool-gempa-prod · 1,480 msg/s · Watermark &lt; 140 ms · 10 Topik Avro/JSON
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInfraArchitecture((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-3)]"
              >
                {showInfraArchitecture ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <span>
                  {showInfraArchitecture
                    ? 'Tutup Arsitektur Teknis'
                    : 'Lihat Arsitektur Flink & Katalog Schema'}
                </span>
              </button>
            </div>

            {showInfraArchitecture && (
              <div className="mt-5 space-y-5 border-t border-[var(--border-hairline)] pt-5">
                <FlinkPanel activityIndex={effectiveActivityIndex} status={effectiveStatus} />
                <GovernanceView />
              </div>
            )}
          </div>
        </section>
        </div>
      </main>

      {/* Modal Inspeksi Seismogram PVMBG */}
      {inspectingSeismogram && (
        <SeismogramAnalysisModal
          volcano={inspectingSeismogram}
          onClose={() => setInspectingSeismogram(null)}
        />
      )}
    </div>
  );
}
