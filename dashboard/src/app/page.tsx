'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  SystemStatus,
  TsunamiScenario,
  LiveEvent,
  ActivityIndex as ActivityIndexType,
  RealtimeEarthquakesData,
  BMKGGempaDetail,
  VolcanoEruption,
  InfrastructureEvent,
  IncidentEvent,
  IncidentResponseEvent,
  IncidentTimelineItem,
  ReplayStatus,
} from '@/lib/types';
import ActivityGauge from '@/components/ActivityGauge';
import MetricCards from '@/components/MetricCards';
import EventStream from '@/components/EventStream';
import TsunamiPanel from '@/components/TsunamiPanel';
import Seismograph from '@/components/Seismograph';
import TacticalRibbon from '@/components/TacticalRibbon';
import LatestQuakeCard from '@/components/LatestQuakeCard';
import FlinkPanel from '@/components/FlinkPanel';
import ForecastPanel from '@/components/ForecastPanel';
import OceanPanel from '@/components/OceanPanel';
import GovernanceView from '@/components/GovernanceView';
import SeismogramAnalysisModal from '@/components/SeismogramAnalysisModal';
import VolcanoSeismographHub from '@/components/VolcanoSeismographHub';
import WorkspaceNav, { WorkspaceTab } from '@/components/WorkspaceNav';
import ConnectorsPanel from '@/components/ConnectorsPanel';
import InfrastructureImpactPanel from '@/components/InfrastructureImpactPanel';
import IncidentCockpit from '@/components/IncidentCockpit';
import CascadingHazardsFlow from '@/components/CascadingHazardsFlow';
import IncidentEvolutionTimeline from '@/components/IncidentEvolutionTimeline';
import IncidentReplayControls, { SCENARIOS } from '@/components/IncidentReplayControls';
import { deriveRealTsunamiAndDamage } from '@/lib/tsunamiInference';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
        minHeight: '440px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6, 10, 20, 0.8)',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}
    >
      Memuat peta subduksi & jaringan InaTEWS...
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

const INITIAL_INCIDENT: IncidentEvent = {
  incident_id: 'INC-20260915-001',
  hazard: 'EARTHQUAKE_TSUNAMI_CASCADE',
  magnitude: 7.8,
  region: 'South Java Megathrust (Cilacap - Pangandaran)',
  risk_score: 86,
  seismic_intensity: 'VII',
  tsunami_risk: 'HIGH',
  population_exposed: 1842000,
  critical_infrastructure: 37,
  road_disruptions: 12,
  confidence: 0.95,
  confidence_score: 95,
  confidence_breakdown: {
    seismic_stations: 35,
    cross_agency_agreement: 20,
    satellite_insar: 15,
    tsunami_buoy: 20,
    infrastructure_signal: 5,
  },
  status: 'ESCALATING',
  cascading_stage: 'TSUNAMI_PROPAGATION',
  timeline: [],
  updated_at: new Date().toISOString(),
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

const DUMMY_DRILL_QUAKE: BMKGGempaDetail = {
  Tanggal: '11 Sep 2026',
  Jam: '13:20:00 WIB',
  DateTime: new Date().toISOString(),
  Coordinates: '-6.85, 105.20',
  Lintang: '6.85 LS',
  Bujur: '105.20 BT',
  Magnitude: '8.4',
  Kedalaman: '15 km',
  Wilayah: 'Zona Megathrust Selat Sunda (WARNING NOT REAL)',
  Potensi: 'Berpotensi Tsunami (WARNING NOT REAL)',
  Dirasakan: 'VI-VII Banten, V-VI Lampung, IV-V Jakarta, IV Bandung',
  Shakemap: '',
};

const DUMMY_DRILL_ACTIVITY: ActivityIndexType = {
  overall_percentage: 84.5,
  seismic_change: 280.0,
  tremor_change: 195.0,
  deformation_trend: 'RAPID UPLIFT',
  thermal_trend: 'INCREASING',
  trend_direction: 'MEGATHRUST RUPTURE DETECTED',
  earthquake_count: 42,
  avg_magnitude: 6.2,
  max_magnitude: 8.4,
  timestamp: new Date().toISOString(),
};

const DUMMY_DRILL_STATUS: SystemStatus = {
  seismic_intensity: 84.5,
  ocean_status: 'TSUNAMI DETECTED (GELOMBANG 3.85m)',
  weather_status: 'ANGIN PESISIR 28 KNOT',
  infra_status: 'WASPADA DAMPAK INFRASTRUKTUR',
  active_alerts: 3,
  risk_level: 'CRITICAL',
  trend_direction: 'ESKALASI SIMULASI AKTIF',
  last_update: new Date().toISOString(),
};

const DUMMY_DRILL_EVENTS: LiveEvent[] = [
  {
    id: 'drill-evt-1',
    type: 'OCEAN',
    description: '[SIMULASI] Anomali gelombang tsunami +3.85m terdeteksi di Pelampung Selat Sunda',
    severity: 'CRITICAL',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'drill-evt-2',
    type: 'SEISMIC',
    description: '[SIMULASI] Gempa Megathrust M8.4 kedalaman 15 km di Selat Sunda',
    severity: 'CRITICAL',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'drill-evt-3',
    type: 'ALERT',
    description: '[SIMULASI] Peringatan Dini Tsunami (PDT-1) diterbitkan: Status AWAS & SIAGA pesisir',
    severity: 'CRITICAL',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'drill-evt-4',
    type: 'SYSTEM',
    description: '[SIMULASI] Skenario simulasi aktif (Isolasi lokal • Confluent Cloud dihentikan)',
    severity: 'INFO',
    timestamp: new Date().toISOString(),
  },
];

export default function Home() {
  const [status, setStatus] = useState<SystemStatus | null>(INITIAL_STATUS);
  const [activityIndex, setActivityIndex] = useState<ActivityIndexType | null>(null);
  const [tsunami, setTsunami] = useState<TsunamiScenario | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>(INITIAL_EVENTS);
  const [realQuakes, setRealQuakes] = useState<RealtimeEarthquakesData | null>(INITIAL_QUAKES);
  const [volcanoes, setVolcanoes] = useState<VolcanoEruption[]>([]);
  const [infrastructureEvents, setInfrastructureEvents] = useState<InfrastructureEvent[]>([]);
  const [selectedVolcano, setSelectedVolcano] = useState<string | null>('BMKG_REGIONAL');
  const [inspectingSeismogram, setInspectingSeismogram] = useState<VolcanoEruption | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'REAL' | 'SIMULASI'>('REAL');
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('cockpit');
  const [incident, setIncident] = useState<IncidentEvent | null>(INITIAL_INCIDENT);
  const [incidentResponse, setIncidentResponse] = useState<IncidentResponseEvent | null>(null);
  const [incidentTimeline, setIncidentTimeline] = useState<IncidentTimelineItem[]>([]);
  const [replayStatus, setReplayStatus] = useState<ReplayStatus | null>(null);
  const [liveClock, setLiveClock] = useState({ wib: '', utc: '' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveClock({
        wib:
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(now) + ' WIB',
        utc: now.toISOString().substring(11, 19) + ' UTC',
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);
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

  const fetchStatus = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/status` : '/api/status';
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Status fetch failed');
        return res.json();
      })
      .then((data: SystemStatus) => {
        if (data) {
          setStatus(data);
          if (data.tsunami_scenario?.active) setTsunami(data.tsunami_scenario);
        }
      })
      .catch((err) => {
        console.warn('Primary status fetch failed, falling back to local route:', err);
        if (API_BASE) {
          fetch('/api/status')
            .then((r) => (r.ok ? r.json() : null))
            .then((localData: SystemStatus | null) => {
              if (localData) {
                setStatus(localData);
                if (localData.tsunami_scenario?.active) setTsunami(localData.tsunami_scenario);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  const fetchIncident = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/incidents/active` : '/api/incidents/active';
    fetch(targetUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: IncidentEvent | null) => {
        if (data && data.incident_id) {
          setIncident(data);
          if (data.timeline && data.timeline.length > 0) {
            setIncidentTimeline(data.timeline);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchReplayStatus = useCallback(() => {
    const targetUrl = API_BASE ? `${API_BASE}/api/replay/status` : '/api/replay/status';
    fetch(targetUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReplayStatus | null) => {
        if (data) {
          setReplayStatus(data);
        }
      })
      .catch(() => {});
  }, []);

  // Replay State & Actions (Dual Mode: Live API + Client Simulator)
  const currentScenarioIdRef = useRef<string>('south-java-m78');
  const replaySpeedRef = useRef<number>(1);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const executeScenarioStep = useCallback((stepNum: number, scenId?: string) => {
    const activeScenId = scenId || currentScenarioIdRef.current;
    const scen = SCENARIOS.find((s) => s.id === activeScenId) || SCENARIOS[0];
    const stageNames = [
      'STANDBY',
      'SEISMIC_DETECTION',
      'STATION_TELEMETRY',
      'MMI_SHAKING_MAP',
      'INSAR_COSEISMIC_SLIP',
      'TSUNAMI_PROPAGATION',
      'COASTAL_IMPACT',
      'INFRASTRUCTURE_ALERT',
      'TACTICAL_DISPATCH',
    ];
    const stageName = stageNames[stepNum] || 'TACTICAL_DISPATCH';

    setReplayStatus({
      active: true,
      scenario_id: scen.id,
      scenario_name: scen.name,
      speed: replaySpeedRef.current,
      current_step: stepNum,
      total_steps: 8,
      elapsed_sec: stepNum * 4,
      duration_sec: 32,
      stage_name: stageName,
      last_event_time: new Date().toLocaleTimeString('id-ID'),
      timestamp: new Date().toISOString(),
    });

    const cascadingStages = [
      'INITIAL_MONITORING',
      'INITIAL_DETECTION',
      'MULTI_STATION_CONFIRMATION',
      'INTENSITY_MAPPING',
      'INSAR_COSEISMIC_ANALYSIS',
      'TSUNAMI_PROPAGATION',
      'POPULATION_EXPOSURE',
      'INFRASTRUCTURE_ASSESSMENT',
      'AGENCY_RESPONSE_DISPATCHED',
    ];

    setIncident({
      incident_id: `INC-${scen.id.toUpperCase()}-2026`,
      hazard: 'EARTHQUAKE_TSUNAMI_CASCADE',
      magnitude: scen.magnitude,
      region: scen.region,
      risk_score: Math.min(98, 45 + stepNum * 6),
      seismic_intensity: scen.mmi,
      tsunami_risk: stepNum >= 5 ? 'HIGH' : 'EVALUATING',
      population_exposed: Math.round(scen.populationExposed * Math.min(1, Math.max(0.1, stepNum / 6))),
      critical_infrastructure: Math.round(scen.criticalInfrastructure * Math.min(1, Math.max(0.1, stepNum / 7))),
      road_disruptions: Math.round(scen.roadDisruptions * Math.min(1, Math.max(0.1, stepNum / 7))),
      confidence: Math.min(0.99, 0.65 + stepNum * 0.04),
      confidence_score: Math.min(99, 65 + stepNum * 4),
      confidence_breakdown: {
        seismic_stations: Math.min(35, stepNum * 5),
        cross_agency_agreement: Math.min(20, stepNum * 3),
        satellite_insar: stepNum >= 4 ? 15 : 0,
        tsunami_buoy: stepNum >= 5 ? 20 : 0,
        infrastructure_signal: stepNum >= 7 ? 10 : 0,
      },
      status: stepNum >= 5 ? 'CRITICAL' : stepNum >= 3 ? 'ESCALATING' : 'CONFIRMING',
      cascading_stage: cascadingStages[stepNum] || 'TSUNAMI_PROPAGATION',
      timeline: [],
      updated_at: new Date().toISOString(),
    });

    setFocusCoords({ lat: scen.epicenter[0], lon: scen.epicenter[1] });
  }, []);

  const handleStartReplay = useCallback((scenarioId: string, speed: number) => {
    currentScenarioIdRef.current = scenarioId;
    replaySpeedRef.current = speed;

    if (replayTimerRef.current) clearInterval(replayTimerRef.current);

    executeScenarioStep(1, scenarioId);

    const stepDurationMs = Math.max(1200, 3500 / speed);
    let current = 1;
    replayTimerRef.current = setInterval(() => {
      current += 1;
      if (current > 8) {
        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        return;
      }
      executeScenarioStep(current, scenarioId);
    }, stepDurationMs);

    fetch(`${API_BASE}/api/replay/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId, speed }),
    }).catch(console.error);
  }, [executeScenarioStep]);

  const handlePauseReplay = useCallback(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayStatus((prev) => (prev ? { ...prev, stage_name: 'PAUSED' } : null));
    fetch(`${API_BASE}/api/replay/pause`, { method: 'POST' }).catch(console.error);
  }, []);

  const handleResumeReplay = useCallback(() => {
    const currentStep = replayStatus?.current_step || 1;
    const scenId = currentScenarioIdRef.current;
    const speed = replaySpeedRef.current;

    if (replayTimerRef.current) clearInterval(replayTimerRef.current);

    const stepDurationMs = Math.max(1200, 3500 / speed);
    let step = currentStep;
    replayTimerRef.current = setInterval(() => {
      step += 1;
      if (step > 8) {
        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        return;
      }
      executeScenarioStep(step, scenId);
    }, stepDurationMs);

    fetch(`${API_BASE}/api/replay/resume`, { method: 'POST' }).catch(console.error);
  }, [replayStatus, executeScenarioStep]);

  const handleResetReplay = useCallback(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayStatus({
      active: false,
      scenario_id: currentScenarioIdRef.current,
      scenario_name: 'STANDBY',
      speed: 1,
      current_step: 0,
      total_steps: 8,
      elapsed_sec: 0,
      duration_sec: 30,
      stage_name: 'STANDBY',
      last_event_time: 'RESET',
      timestamp: new Date().toISOString(),
    });
    setIncident(INITIAL_INCIDENT);
    fetch(`${API_BASE}/api/replay/reset`, { method: 'POST' }).catch(console.error);
  }, []);

  const handleExitSimulation = useCallback(() => {
    setDashboardMode('REAL');
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayStatus({
      active: false,
      scenario_id: currentScenarioIdRef.current,
      scenario_name: 'STANDBY',
      speed: 1,
      current_step: 0,
      total_steps: 8,
      elapsed_sec: 0,
      duration_sec: 30,
      stage_name: 'STANDBY',
      last_event_time: 'LIVE_RESET',
      timestamp: new Date().toISOString(),
    });
    setIncident(null);
    fetch(`${API_BASE}/api/replay/reset`, { method: 'POST' }).catch(console.error);

    if (realQuakes?.latest_bmkg?.Coordinates) {
      const parts = realQuakes.latest_bmkg.Coordinates.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lon = parseFloat(parts[1].trim());
        if (!isNaN(lat) && !isNaN(lon)) {
          setFocusCoords({ lat, lon });
          return;
        }
      }
    }
    setFocusCoords({ lat: -2.5, lon: 118.0 });
  }, [realQuakes]);

  const handleStepReplay = useCallback(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    const nextStep = Math.min(8, (replayStatus?.current_step || 0) + 1);
    executeScenarioStep(nextStep, currentScenarioIdRef.current);
    fetch(`${API_BASE}/api/replay/step`, { method: 'POST' }).catch(console.error);
  }, [replayStatus, executeScenarioStep]);

  useEffect(() => {
    fetchRealQuakes();
    fetchVolcanoes();
    fetchStatus();
    fetchIncident();
    fetchReplayStatus();

    const interval = setInterval(() => {
      fetchRealQuakes();
      fetchVolcanoes();
      fetchStatus();
      fetchIncident();
      fetchReplayStatus();
    }, 25000);

    return () => clearInterval(interval);
  }, [fetchRealQuakes, fetchVolcanoes, fetchStatus, fetchIncident, fetchReplayStatus]);

  // SSE Stream Listener
  const connectSSE = useCallback(() => {
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
          case 'tsunami':
            setTsunami(data as TsunamiScenario);
            break;
          case 'incident_update':
            setIncident(data as IncidentEvent);
            break;
          case 'incident_response':
            setIncidentResponse(data as IncidentResponseEvent);
            break;
          case 'incident_timeline':
            setIncidentTimeline((prev) => [data as IncidentTimelineItem, ...prev].slice(0, 50));
            break;
          case 'replay_status':
            setReplayStatus(data as ReplayStatus);
            break;
          case 'event': {
            const liveEvent = parseLiveEvent(
              data as Record<string, unknown>,
              `evt-${++eventCounter.current}`
            );
            setEvents((prev) => [liveEvent, ...prev].slice(0, 50));

            if (liveEvent.type === 'INFRASTRUCTURE' && liveEvent.data) {
              const rawInfrastructure = liveEvent.data.data && typeof liveEvent.data.data === 'object'
                ? liveEvent.data.data as Record<string, unknown>
                : liveEvent.data;
              const infrastructure = rawInfrastructure as unknown as InfrastructureEvent;
              setInfrastructureEvents((prev) => [
                infrastructure,
                ...prev.filter((item) => item.facility_id !== infrastructure.facility_id),
              ].slice(0, 12));
            }

            if (liveEvent.type === 'SEISMIC') {
              fetchRealQuakes();
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
      setTimeout(connectSSE, 2500);
    };
  }, [fetchRealQuakes]);

  useEffect(() => {
    connectSSE();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connectSSE]);

  const isDrill = dashboardMode === 'SIMULASI';
  const effectiveQuake = isDrill ? DUMMY_DRILL_QUAKE : (realQuakes?.latest_bmkg ?? null);
  const effectiveQuakesData: RealtimeEarthquakesData | null = isDrill
    ? {
        latest_bmkg: DUMMY_DRILL_QUAKE,
        recent_bmkg: realQuakes?.recent_bmkg ?? [],
        recent_usgs: realQuakes?.recent_usgs ?? [],
        timestamp: new Date().toISOString(),
      }
    : realQuakes;
  const effectiveActivity = isDrill ? DUMMY_DRILL_ACTIVITY : activityIndex;
  const effectiveStatus = isDrill ? DUMMY_DRILL_STATUS : status;
  const effectiveEvents = isDrill ? [...DUMMY_DRILL_EVENTS, ...events] : events;

  const activity = isDrill
    ? 84.5
    : (activityIndex?.overall_percentage ?? status?.seismic_intensity ?? 15.0);

  const trend = isDrill
    ? 'MEGATHRUST RUPTURE DETECTED'
    : (activityIndex?.trend_direction ?? status?.trend_direction ?? 'STABLE');
  const riskLevel = isDrill ? 'CRITICAL' : (status?.risk_level ?? 'NORMAL');
  const drillScenario: TsunamiScenario = tsunami?.active
    ? tsunami
    : {
        active: true,
        detection_time: '11:42:00 WIB',
        sensor_id: 'BUOY-INA-01 (Selat Sunda)',
        wave_anomaly: 3.85,
        affected_zones: [
          'Pesisir Pandeglang / Ujung Kulon',
          'Lampung Selatan / Kalianda',
          'Anyer & Carita',
          'Cilacap Pesisir',
          'Tanggamus / Teluk Semangka',
          'Pesisir Lebak Selatan',
        ],
        affected_zone_details: [
          {
            zone: 'Pandeglang & Semenanjung Ujung Kulon',
            province: 'Banten',
            estimated_eta: '18 Menit Pasca Gempa',
            estimated_wave_height: '4.2 - 5.5 Meter',
            status: 'AWAS',
            inundation_depth: 'Hingga 600m ke daratan',
            population_at_risk: '48.200 Jiwa',
            safe_elevation: '> 25 Meter dpl',
            coords: [-6.85, 105.45],
            polygon: [
              [-6.72, 105.20],
              [-6.65, 105.45],
              [-6.85, 105.65],
              [-7.00, 105.50],
              [-6.90, 105.15],
            ],
          },
          {
            zone: 'Kalianda & Pesisir Lampung Selatan',
            province: 'Lampung',
            estimated_eta: '22 Menit Pasca Gempa',
            estimated_wave_height: '3.5 - 4.8 Meter',
            status: 'AWAS',
            inundation_depth: 'Hingga 450m ke daratan',
            population_at_risk: '64.500 Jiwa',
            safe_elevation: '> 20 Meter dpl',
            coords: [-5.75, 105.58],
            polygon: [
              [-5.60, 105.50],
              [-5.75, 105.70],
              [-5.90, 105.65],
              [-5.80, 105.40],
            ],
          },
          {
            zone: 'Kawasan Wisata Anyer & Carita',
            province: 'Banten',
            estimated_eta: '27 Menit Pasca Gempa',
            estimated_wave_height: '2.8 - 3.6 Meter',
            status: 'SIAGA',
            inundation_depth: 'Hingga 300m ke daratan',
            population_at_risk: '32.100 Jiwa',
            safe_elevation: '> 18 Meter dpl',
            coords: [-6.20, 105.82],
            polygon: [
              [-6.05, 105.80],
              [-6.15, 105.95],
              [-6.35, 105.85],
              [-6.25, 105.75],
            ],
          },
          {
            zone: 'Pesisir Tanggamus & Teluk Semangka',
            province: 'Lampung',
            estimated_eta: '31 Menit Pasca Gempa',
            estimated_wave_height: '2.2 - 3.1 Meter',
            status: 'SIAGA',
            inundation_depth: 'Hingga 250m ke daratan',
            population_at_risk: '28.900 Jiwa',
            safe_elevation: '> 15 Meter dpl',
            coords: [-5.55, 104.70],
            polygon: [
              [-5.45, 104.55],
              [-5.55, 104.90],
              [-5.70, 104.75],
              [-5.60, 104.45],
            ],
          },
          {
            zone: 'Pesisir Cilacap & Teluk Penyu',
            province: 'Jawa Tengah',
            estimated_eta: '46 Menit Pasca Gempa',
            estimated_wave_height: '1.2 - 2.0 Meter',
            status: 'WASPADA',
            inundation_depth: 'Hingga 120m ke daratan',
            population_at_risk: '76.000 Jiwa',
            safe_elevation: '> 10 Meter dpl',
            coords: [-7.74, 109.02],
            polygon: [
              [-7.68, 108.95],
              [-7.70, 109.15],
              [-7.82, 109.12],
              [-7.80, 108.92],
            ],
          },
        ],
        infrastructure_impacts: [
          {
            facility: 'Pelabuhan Penyeberangan Bakauheni - Merak',
            type: 'Transportasi Laut Utama',
            location: 'Selat Sunda (Lampung & Banten)',
            damage_level: 'HEAVY',
            loss_estimate: 'Dermaga & fender kapal terendam limpasan gelombang',
            operational_status: 'DIHENTIKAN TOTAL (STOP OPERASI)',
            critical_action: 'Evakuasi kapal feri ke laut lepas (deep water) >200m kedalaman.',
            coords: [-5.93, 105.99],
            icon: '🚢',
          },
          {
            facility: 'PLTU Suralaya & Labuan',
            type: 'Kelistrikan Energi Nasional',
            location: 'Cilegon & Pandeglang, Banten',
            damage_level: 'MODERATE',
            loss_estimate: 'Intake pendingin air laut tersumbat puing sedimentasi',
            operational_status: 'ISOLASI DARURAT (SAFE SHUTDOWN)',
            critical_action: 'Pengalihan beban listrik ke sistem interkoneksi Jawa-Bali.',
            coords: [-5.89, 106.03],
            icon: '⚡',
          },
          {
            facility: 'Jalan Raya Lintas Pesisir Anyer - Labuan',
            type: 'Jalur Logistik & Evakuasi',
            location: 'Anyer, Carita, Panimbang (Banten)',
            damage_level: 'HEAVY',
            loss_estimate: 'Tergenang tsunami 1.5 - 2.5m, puing kayu & batu menghalangi jalan',
            operational_status: 'TERPUTUS / TIDAK DAPAT DILALUI',
            critical_action: 'Arahkan jalur evakuasi via rute pedalaman Mandalawangi & Menes.',
            coords: [-6.15, 105.86],
            icon: '🛣️',
          },
          {
            facility: 'Jaringan BTS Telekomunikasi & Kabel Laut Pesisir',
            type: 'Infrastruktur Komunikasi',
            location: 'Banten Barat & Lampung Selatan',
            damage_level: 'MODERATE',
            loss_estimate: '34 BTS pesisir padam daya baterai cadangan',
            operational_status: 'SEBAGIAN GANGGUAN (DEGRADASI 45%)',
            critical_action: 'Aktivasi transmisi radio satelit BNPB & VHF darurat maritim.',
            coords: [-5.73, 105.59],
            icon: '📡',
          },
        ],
        response_actions: [
          'Evakuasi segera ke ketinggian >20 m atau Gedung Evakuasi Sementara (TES)',
          'Aktivasi sirine pesisir InaTEWS & siaran darurat TV/Radio komersial',
          'Dispatch tim SAR BNPB, BASARNAS, dan TNI/POLRI ke titik kumpul aman',
          'Sterilisasi pelabuhan penyeberangan Selat Sunda dan pelayaran komersial',
        ],
        severity: 'CRITICAL',
        timestamp: new Date().toISOString(),
      };

  const realIncident: IncidentEvent = {
    incident_id: realQuakes?.latest_bmkg
      ? `BMKG-${(realQuakes.latest_bmkg.DateTime || '').replace(/[^0-9]/g, '').slice(0, 14)}`
      : 'INC-BMKG-LIVE',
    hazard: 'EARTHQUAKE_MONITORING',
    magnitude: realQuakes?.latest_bmkg ? parseFloat(realQuakes.latest_bmkg.Magnitude) || 3.8 : 3.8,
    depth: realQuakes?.latest_bmkg ? parseFloat(realQuakes.latest_bmkg.Kedalaman.replace(/[^0-9.]/g, '')) || 25 : 25,
    region: realQuakes?.latest_bmkg?.Wilayah || 'Pusat gempa berada di laut 31 km selatan Sumur',
    latitude: realQuakes?.latest_bmkg?.Coordinates ? parseFloat(realQuakes.latest_bmkg.Coordinates.split(',')[0]) : -6.92,
    longitude: realQuakes?.latest_bmkg?.Coordinates ? parseFloat(realQuakes.latest_bmkg.Coordinates.split(',')[1]) : 105.49,
    risk_score: 22,
    seismic_intensity: realQuakes?.latest_bmkg?.Dirasakan ? realQuakes.latest_bmkg.Dirasakan.split(' ')[0] : 'II',
    tsunami_risk: 'LOW',
    population_exposed: 0,
    critical_infrastructure: 0,
    road_disruptions: 0,
    confidence: 0.94,
    confidence_score: 94,
    confidence_breakdown: {
      seismic_stations: 35,
      cross_agency_agreement: 20,
      satellite_insar: 0,
      tsunami_buoy: 0,
      infrastructure_signal: 0,
    },
    status: 'MONITORING',
    cascading_stage: 'INITIAL_MONITORING',
    timeline: [],
    updated_at: new Date().toISOString(),
  };

  const effectiveIncident = isDrill ? (incident || INITIAL_INCIDENT) : realIncident;
  const realTsunami = deriveRealTsunamiAndDamage(realQuakes?.latest_bmkg ?? null, null);
  const effectiveTsunami = isDrill ? drillScenario : realTsunami;
  const alertCount = isDrill ? 3 : ((effectiveTsunami?.active ? 1 : 0) + (status?.active_alerts ?? 0));

  return (
    <div className="dash-root">
      {/* =========================================================================
          TOP COMMAND HEADER: REAL-TIME DISASTER INTELLIGENCE & MISSION CONTROL
          ========================================================================= */}
      <header className="sentinel-header">
        <div className="sentinel-header__brand-col">
          <div className="sentinel-header__emblem">
            <span className="sentinel-header__emblem-icon">🌋</span>
            <span className={`sentinel-header__emblem-pulse ${isDrill ? 'sentinel-header__emblem-pulse--drill' : ''}`} />
          </div>
          <div className="sentinel-header__titles">
            <div className="sentinel-header__title-row">
              <h1 className="sentinel-header__main-title">INATEWS SENTINEL</h1>
              <span className={`sentinel-mode-tag ${isDrill ? 'sentinel-mode-tag--drill' : 'sentinel-mode-tag--live'}`}>
                {isDrill ? 'SIMULASI SANDBOX' : 'BMKG TEWS'}
              </span>
            </div>
          </div>
        </div>

        {/* INTEGRATED SEGMENTED MODE SWITCHER: PISAHKAN LIVE & SIMULASI */}
        <div className="sentinel-header__mode-switcher">
          <div className="mode-toggle-segmented" role="tablist" aria-label="Mode Monitoring">
            <button
              type="button"
              role="tab"
              aria-selected={!isDrill}
              onClick={handleExitSimulation}
              className={`mode-toggle-item ${!isDrill ? 'mode-toggle-item--active-live' : ''}`}
              title="Operasi Real-time: Telemetri riil gempa bumi BMKG, USGS, dan sensor muka laut IOC UNESCO"
            >
              <span className="mode-toggle-dot mode-toggle-dot--live" />
              <div className="mode-toggle-text">
                <span className="mode-toggle-label">OPERASI LIVE</span>
                <span className="mode-toggle-hint">BMKG TEWS RIIL</span>
              </div>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={isDrill}
              onClick={() => {
                setDashboardMode('SIMULASI');
                setFocusCoords({ lat: -9.15, lon: 109.52 });
              }}
              className={`mode-toggle-item ${isDrill ? 'mode-toggle-item--active-drill' : ''}`}
              title="Simulasi Megathrust: Skenario latihan drill kesiapsiagaan bencana nasional terisolasi"
            >
              <span className="mode-toggle-dot mode-toggle-dot--drill" />
              <div className="mode-toggle-text">
                <span className="mode-toggle-label">SIMULASI BENCANA</span>
                <span className="mode-toggle-hint">REPLAY LAB DRILL</span>
              </div>
            </button>
          </div>
        </div>

        {/* RIGHT: CLOCKS & TELEMETRY INDICATOR */}
        <div className="sentinel-header__clock-col">
          <div className="sentinel-clock-pill">
            <span className={`clock-pulse-dot ${isDrill ? 'clock-pulse-dot--drill' : 'clock-pulse-dot--live'}`} />
            <span className="clock-time-wib">{liveClock.wib || '11:00:45 WIB'}</span>
            <span className="clock-divider">|</span>
            <span className="clock-time-utc">{liveClock.utc || '04:00:45 UTC'}</span>
          </div>

          <div className="sentinel-telemetry-badge">
            <span className={`telemetry-dot ${isDrill ? 'telemetry-dot--drill' : 'telemetry-dot--live'}`} />
            <span className="telemetry-label">
              {isDrill ? 'SANDBOX LATIHAN TERISOLASI' : 'STREAM TELEMETRI LIVE'}
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MODE-SPECIFIC STATUS RIBBON & CONTROLS
          ========================================================================= */}
      {!isDrill ? (
        /* 1. OPERASI LIVE BANNER & REAL KPI BAR */
        <div className="live-status-ribbon">
          <div className="live-status-ribbon__meta">
            <div className="live-pill-status">
              <span className="live-indicator-ring" />
              <span className="live-pill-title">PEMASTIAN TELEMETRI AKTIF</span>
            </div>
            <span className="live-status-desc">
              Data bersumber dari stasiun broadband BMKG, USGS Global Network, dan 34 stasiun pasang surut IOC UNESCO.
            </span>
          </div>

          <div className="live-status-ribbon__kpis">
            <div className="live-kpi-block">
              <span className="live-kpi-label">GEMPA TERKINI</span>
              <span className="live-kpi-value live-kpi-value--cyan">
                {realQuakes?.latest_bmkg ? `M${realQuakes.latest_bmkg.Magnitude} (${realQuakes.latest_bmkg.Kedalaman})` : 'M3.8 (25 km)'}
              </span>
            </div>

            <div className="live-kpi-block">
              <span className="live-kpi-label">STATUS TSUNAMI</span>
              <span className="live-kpi-value live-kpi-value--emerald">
                {effectiveTsunami?.active ? 'AWAS / SIAGA' : 'NOMINAL (AMAN)'}
              </span>
            </div>

            <div className="live-kpi-block">
              <span className="live-kpi-label">INTENSITAS FLINK</span>
              <span className="live-kpi-value live-kpi-value--purple">
                {activity.toFixed(1)}% (NORMAL)
              </span>
            </div>

            <div className="live-kpi-block">
              <span className="live-kpi-label">SEISMIC INTENSITY</span>
              <span className="live-kpi-value live-kpi-value--amber">
                {status?.risk_level || 'NORMAL'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDashboardMode('SIMULASI');
              setFocusCoords({ lat: -9.15, lon: 109.52 });
            }}
            className="live-to-drill-btn"
            title="Beralih ke Lab Simulasi Bencana untuk menguji skenario Megathrust"
          >
            <span>🧪 Uji Skenario Megathrust</span>
            <span className="btn-arrow">➔</span>
          </button>
        </div>
      ) : (
        /* 2. SIMULASI BENCANA & REPLAY COCKPIT */
        <div className="drill-simulation-wrapper">
          <div className="drill-banner">
            <div className="drill-banner__text-wrap">
              <div className="drill-banner__badge">
                <span className="drill-badge-icon">⚠️</span>
                <span>LATIHAN KESIAPSIAGAAN BENCANA (SIMULASI TERKONTROL)</span>
              </div>
              <p className="drill-banner__desc">
                Skenario gempa megathrust sintetis untuk pengujian respon berantai multi-lembaga (BMKG, BNPB, BASARNAS, TNI, POLRI). Sistem terisolasi dari transmisi publik.
              </p>
            </div>

            <div className="drill-banner__stats">
              <div className="drill-stat-box">
                <span className="drill-stat-label">SKENARIO</span>
                <span className="drill-stat-value drill-stat-value--alert">
                  {incident?.magnitude ? `M${incident.magnitude}` : 'M7.8'}
                </span>
              </div>
              <div className="drill-stat-box">
                <span className="drill-stat-label">MAX SHAKING</span>
                <span className="drill-stat-value drill-stat-value--alert">
                  {incident?.seismic_intensity || 'VII'}
                </span>
              </div>
              <div className="drill-stat-box">
                <span className="drill-stat-label">POPULASI TERDAMPAK</span>
                <span className="drill-stat-value drill-stat-value--purple">
                  {incident?.population_exposed ? `${(incident.population_exposed / 1000000).toFixed(2)}M` : '1.84M'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExitSimulation}
              className="drill-exit-btn"
              title="Kembali ke Mode Operasi Live BMKG"
            >
              <span>✕ Keluar ke Operasi Live</span>
            </button>
          </div>

          <IncidentReplayControls
            status={replayStatus}
            onStartReplay={handleStartReplay}
            onPauseReplay={handlePauseReplay}
            onResumeReplay={handleResumeReplay}
            onResetReplay={handleResetReplay}
            onStepReplay={handleStepReplay}
            onSelectScenario={(scenId) => {
              if (scenId === 'south-java-m78') setFocusCoords({ lat: -9.15, lon: 109.52 });
              if (scenId === 'sunda-strait-m82') setFocusCoords({ lat: -6.82, lon: 105.25 });
              if (scenId === 'palu-m75') setFocusCoords({ lat: -0.89, lon: 119.85 });
            }}
          />
        </div>
      )}

      <WorkspaceNav
        activeTab={activeWorkspaceTab}
        onTabChange={setActiveWorkspaceTab}
        isDrill={isDrill}
      />

      <main className="dashboard">
        {/* ==================== FLAGSHIP TAB: INCIDENT COCKPIT ==================== */}
        {activeWorkspaceTab === 'cockpit' && (
          <>
            <div className="dashboard__main-grid">
              <div className="dashboard__left-col">
                <MapComponent
                  realQuakes={effectiveQuakesData}
                  focusCoords={focusCoords}
                  activityLevel={activity}
                  events={effectiveEvents}
                  volcanoes={volcanoes}
                  selectedVolcano={selectedVolcano}
                  onSelectVolcano={(name) => setSelectedVolcano(name)}
                  onInspectVolcanoSeismogram={(v) => setInspectingSeismogram(v)}
                  tsunamiActive={isDrill || Boolean(effectiveTsunami?.active)}
                  tsunamiScenario={effectiveTsunami}
                  isSimulasi={isDrill}
                  activeIncident={effectiveIncident}
                />

                <CascadingHazardsFlow
                  incident={effectiveIncident}
                  activeStage={effectiveIncident?.cascading_stage}
                />

                <IncidentEvolutionTimeline
                  timeline={isDrill ? incidentTimeline : []}
                  incidentStatus={effectiveIncident?.status}
                />
              </div>

              <div className="sidebar">
                <IncidentCockpit
                  incident={effectiveIncident}
                  response={isDrill ? incidentResponse : null}
                  onFocusRegion={(r) => console.log('Focus', r)}
                />

                <LatestQuakeCard
                  quake={effectiveQuake}
                  realQuakes={effectiveQuakesData}
                  onFocusMap={(lat, lon) => setFocusCoords({ lat, lon })}
                />

                <InfrastructureImpactPanel events={infrastructureEvents} />
              </div>
            </div>

            <div className="dashboard__split" style={{ marginTop: '8px' }}>
              <EventStream events={effectiveEvents} />
            </div>
          </>
        )}

        {/* ==================== TAB 1: OVERVIEW & PETA SITUASI ==================== */}
        {activeWorkspaceTab === 'overview' && (
          <>
            <TacticalRibbon
              latestQuake={effectiveQuake}
              activityIndex={effectiveActivity}
              status={effectiveStatus}
              stationCount={12}
              tideCount={34}
              usgsQuakes={effectiveQuakesData?.recent_usgs}
              onFocusMap={(lat, lon) => setFocusCoords({ lat, lon })}
            />

            {isDrill && (
              <div className="drill-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.5)' }}>
                <strong style={{ color: '#f87171' }}>⚠️ MODE SIMULASI</strong>
                <span>
                  Skenario simulasi aktif untuk pengujian kesiapsiagaan darurat dan mitigasi bencana nasional (DATA SIMULASI - BUKAN KEJADIAN RIIL).
                </span>
              </div>
            )}

            {status?.weather_status?.includes('TORNADO') && !isDrill && (
              <div className="weather-anomaly-banner" role="alert">
                <div className="weather-anomaly-banner__glow" />
                <span className="weather-anomaly-banner__icon">🌪️</span>
                <div className="weather-anomaly-banner__content">
                  <strong className="weather-anomaly-banner__title">{status.weather_status}</strong>
                  <span className="weather-anomaly-banner__desc">
                    Deteksi anomali cuaca ekstrem berbasis pola angin & tekanan atmosfer. Verifikasi radar BMKG diperlukan.
                  </span>
                </div>
                <span className="weather-anomaly-banner__live">
                  <span className="live-dot-pulse" style={{ background: '#f97316', boxShadow: '0 0 8px #f97316' }} />
                  LIVE
                </span>
              </div>
            )}

            {effectiveTsunami?.active && (
              <TsunamiPanel scenario={effectiveTsunami} isReal={!isDrill} />
            )}

            <div className="dashboard__main-grid">
              <div className="dashboard__left-col">
                <MapComponent
                  realQuakes={effectiveQuakesData}
                  focusCoords={focusCoords}
                  activityLevel={activity}
                  events={effectiveEvents}
                  volcanoes={volcanoes}
                  selectedVolcano={selectedVolcano}
                  onSelectVolcano={(name) => setSelectedVolcano(name)}
                  onInspectVolcanoSeismogram={(v) => setInspectingSeismogram(v)}
                  tsunamiActive={isDrill || Boolean(effectiveTsunami?.active)}
                  tsunamiScenario={effectiveTsunami}
                  isSimulasi={isDrill}
                  activeIncident={effectiveIncident}
                />

                <Seismograph
                  seismicEnergy={isDrill ? 8.4 : 1.2}
                  activityLevel={activity}
                  phaseName={isDrill ? 'MEGATHRUST_SIMULASI' : 'SEISMIC_BASELINE'}
                  volcanoes={volcanoes}
                  selectedVolcano={selectedVolcano}
                  onSelectVolcano={(name) => setSelectedVolcano(name)}
                  onInspectSeismogram={(v) => setInspectingSeismogram(v)}
                  isSimulasi={isDrill}
                />
              </div>

              <div className="sidebar">
                <LatestQuakeCard
                  quake={effectiveQuake}
                  realQuakes={effectiveQuakesData}
                  onFocusMap={(lat, lon) => setFocusCoords({ lat, lon })}
                />

                <div className="card">
                  <div className="card__header">
                    <span className="card__title">Indeks Intensitas Seismik (MMI)</span>
                    <span className="card__badge card__badge--flink">FLINK SQL</span>
                  </div>
                  <ActivityGauge percentage={activity} trend={trend} />
                </div>

                <MetricCards
                  oceanStatus={
                    dashboardMode === 'SIMULASI' || tsunami?.active
                      ? 'TSUNAMI WAVE FRONT'
                      : status?.ocean_status?.includes('TSUNAMI')
                      ? 'TSUNAMI DETECTED'
                      : 'NOMINAL (8 BUOYS ONLINE)'
                  }
                  weatherStatus={status?.weather_status ?? 'OPEN-METEO'}
                  infraStatus={status?.infra_status ?? 'OPERASIONAL'}
                  activityIndex={effectiveActivity}
                />
                <InfrastructureImpactPanel events={infrastructureEvents} />
              </div>
            </div>
          </>
        )}

        {/* ==================== TAB 3: TSUNAMI & LAUT IOC ==================== */}
        {activeWorkspaceTab === 'ocean' && (
          <>
            <TacticalRibbon
              latestQuake={effectiveQuake}
              activityIndex={effectiveActivity}
              status={effectiveStatus}
              stationCount={12}
              tideCount={34}
              usgsQuakes={effectiveQuakesData?.recent_usgs}
              onFocusMap={(lat, lon) => setFocusCoords({ lat, lon })}
            />

            {effectiveTsunami?.active && (
              <TsunamiPanel scenario={effectiveTsunami} isReal={!isDrill} />
            )}
            <OceanPanel tsunami={effectiveTsunami} isReal={!isDrill} />
          </>
        )}

        {/* ==================== TAB 4: CONFLUENT & FLINK CEP ==================== */}
        {activeWorkspaceTab === 'stream' && (
          <section className="platform-row">
            <div className="platform-row__intro">
              <h2>Spine Streaming (Confluent Cloud & Apache Flink)</h2>
              <p>
                Confluent Cloud mengorelasikan stasiun BMKG, buoy InaTEWS, dan feed laut lewat Flink
                SQL. Schema Registry menjaga kontrak event untuk decision-support darurat nasional.
              </p>
            </div>
            <FlinkPanel activityIndex={effectiveActivity} status={effectiveStatus} />
            <ForecastPanel />
            <GovernanceView />
          </section>
        )}

        {/* ==================== TAB 5: CONFLUENT CONNECTORS & PIPELINE HUB ==================== */}
        {activeWorkspaceTab === 'connectors' && (
          <ConnectorsPanel />
        )}

        {/* ==================== TAB 6: VOLCANO HUB ==================== */}
        {activeWorkspaceTab === 'volcano' && (
          <VolcanoSeismographHub
            volcanoes={volcanoes}
            realQuakes={effectiveQuakesData}
            selectedVolcano={selectedVolcano === 'BMKG_REGIONAL' ? 'Anak Krakatau' : selectedVolcano}
            onSelectVolcano={(name) => setSelectedVolcano(name)}
            onInspectSeismogram={(v) => setInspectingSeismogram(v)}
          />
        )}

      </main>

      {/* Seismogram Image & Physical Waveform Analysis Modal */}
      {inspectingSeismogram && (
        <SeismogramAnalysisModal
          volcano={inspectingSeismogram}
          onClose={() => setInspectingSeismogram(null)}
        />
      )}
    </div>
  );
}
