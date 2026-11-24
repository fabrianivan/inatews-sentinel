'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  BellRing,
  Bot,
  ChevronDown,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Mountain,
  Radio,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  ActivityIndex,
  AIAnalysis,
  BMKGGempaDetail,
  FeedState,
  LifecyclePhase,
  LiveEvent,
  RealtimeEarthquakesData,
  SeismicEvent,
  SystemStatus,
  TsunamiScenario,
  VolcanoEruption,
} from '@/lib/types';
import type { LocalAlert, NotificationTarget } from '@/lib/localAlerts';
import ActivityStrip from '@/components/ActivityStrip';
import AIPanel from '@/components/AIPanel';
import DrillStrip from '@/components/DrillStrip';
import EventStream from '@/components/EventStream';
import FlinkPanel from '@/components/FlinkPanel';
import GovernanceView from '@/components/GovernanceView';
import LatestQuakeCard from '@/components/LatestQuakeCard';
import LocalAlertsPanel from '@/components/LocalAlertsPanel';
import type { DrillScenarioMapData, MapViewInsets } from '@/components/Map';
import MetricCards from '@/components/MetricCards';
import OceanPanel from '@/components/OceanPanel';
import QuakePills from '@/components/QuakePills';
import Seismograph from '@/components/Seismograph';
import SourcePanel from '@/components/SourcePanel';
import StatusBar, { type DashboardMode, type MastheadStatus } from '@/components/StatusBar';
import { BackendTsunamiCard, BmkgTsunamiCard, DrillTsunamiCard } from '@/components/TsunamiCard';
import VolcanoDetailCard from '@/components/VolcanoDetailCard';
import { useAlertAudio } from '@/hooks/useAlertAudio';
import { useLocalAlerts } from '@/hooks/useLocalAlerts';
import { toggleBackendMode, triggerSimulation } from '@/hooks/useSSE';
import { buildDrillAIAnalysis, type TelemetryPromptContext } from '@/lib/aiContext';
import { advanceTone, TONE_SILENT, type ToneSituation } from '@/lib/alertTone';
import { assessAttention, shortRegion, summarizeDays, type QuakeFeedHealth } from '@/lib/attention';
import {
  DEFAULT_DRILL_PHASE_NUMBER,
  DEFAULT_DRILL_SCENARIO_ID,
  DRILL_PHASES,
  DRILL_SCENARIOS,
  findDrillPhase,
  findDrillScenario,
  nextDrillPhaseNumber,
  scenarioOriginMs,
  warningLeadMin,
  type DrillPhase,
  type DrillScenario,
  type DrillScenarioId,
} from '@/lib/drillScenarios';
import {
  EMPTY_FEED_RECORD,
  FEED_INFO,
  FEED_ORDER,
  feedHealthState,
  reportedState,
  type FeedHealth,
  type FeedKey,
  type FeedRecord,
} from '@/lib/feeds';
import { TONE_LABEL, type Tone } from '@/lib/severity';
import type { OceanFeedResponse } from '@/lib/telemetry';
import { formatDecimal, formatWibTime } from '@/lib/time';
import {
  acknowledgeNotice,
  isNoticeInForce,
  updateTsunamiNotice,
  type TsunamiNotice,
} from '@/lib/tsunamiNotice';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="t-meta flex h-full min-h-[380px] w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-muted)]">
      Memuat peta…
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';
const POLL_INTERVAL_MS = 20_000;
/** Seconds each drill phase stays up during autoplay. */
const AUTOPLAY_SECONDS = 15;
const BASE_TITLE = 'INATEWS SENTINEL — dasbor pemantauan tidak resmi';

type StatusPayload = SystemStatus & { activity_index?: ActivityIndex };

/** One stable empty list, so "no data yet" does not look like new data on every render. */
const NO_EVENTS: SeismicEvent[] = [];

/** Fetches a route from the configured backend, falling back to the local Next route. */
async function fetchJson<T>(path: string): Promise<T> {
  const attempt = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} -> ${response.status}`);
    return (await response.json()) as T;
  };
  if (!API_BASE) return attempt(path);
  try {
    return await attempt(`${API_BASE}${path}`);
  } catch {
    return attempt(path);
  }
}

function eventSeverityFromMagnitude(magnitude: unknown): LiveEvent['severity'] {
  if (typeof magnitude !== 'number') return 'LOW';
  if (magnitude >= 7.0) return 'CRITICAL';
  if (magnitude >= 6.0) return 'HIGH';
  if (magnitude >= 5.0) return 'MEDIUM';
  return 'LOW';
}

/** Turns a raw stream frame into a list row; frames that already carry a description pass through. */
function parseLiveEvent(data: Record<string, unknown>, id: string): LiveEvent {
  const type = String(data.type || 'UNKNOWN').toUpperCase();
  let description = data.description ? String(data.description) : '';
  let severity = data.severity ? String(data.severity) : 'LOW';

  if (!description) {
    switch (type) {
      case 'SEISMIC': {
        const magnitude = typeof data.magnitude === 'number' ? `M${formatDecimal(data.magnitude)}` : 'magnitudo tidak tersedia';
        const depth = typeof data.depth === 'number' ? ` · ${Math.round(data.depth)} km` : '';
        // The row names its source when the frame does; a backend frame that does not is left unattributed.
        const source = typeof data.source === 'string' && data.source ? `${data.source} · ` : '';
        description = `${source}Gempa ${magnitude}${depth} · ${String(data.fault_zone || 'lokasi tidak tersedia')}`;
        severity = eventSeverityFromMagnitude(data.magnitude);
        break;
      }
      case 'STATION':
        description = `Stasiun ${String(data.station_id || data.station_name || 'tanpa nama')}`;
        break;
      case 'OCEAN':
        description = `Stasiun pasut ${String(data.sensor_id || 'tanpa nama')}`;
        break;
      case 'WEATHER':
        description =
          typeof data.wind_speed === 'number'
            ? `Cuaca: angin ${Math.round(data.wind_speed)} km/jam ${String(data.wind_direction || '')}`.trim()
            : 'Cuaca: pembaruan diterima';
        break;
      default:
        description = `${type}: pembaruan diterima`;
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

const MAX_EVENT_ROWS = 50;
const MAX_SYNTHETIC_ROWS = 6;

/**
 * Trims the event list, newest first. Rows the stream composes itself (heartbeats, the
 * station-list line) have their own small budget, so they can never push a reported
 * earthquake out of the list.
 */
function capEvents(rows: LiveEvent[]): LiveEvent[] {
  const kept: LiveEvent[] = [];
  let synthetic = 0;
  for (const row of rows) {
    if (row.data?.synthetic === true) {
      if (synthetic >= MAX_SYNTHETIC_ROWS) continue;
      synthetic += 1;
    }
    kept.push(row);
    if (kept.length >= MAX_EVENT_ROWS) break;
  }
  return kept;
}

const ATTENTION_EVENT_SEVERITY: Record<DrillPhase['attention'], LiveEvent['severity']> = {
  rutin: 'LOW',
  meningkat: 'MEDIUM',
  tinggi: 'HIGH',
};

/** Rows a drill adds to the event list; `data.simulation` keeps them marked as drill content. */
function buildDrillEvents(scenario: DrillScenario, phase: DrillPhase, atIso: string, nextId: () => string): LiveEvent[] {
  const rows: LiveEvent[] = [
    {
      id: nextId(),
      type: 'SEISMIC',
      description: `[DRILL ${phase.shortLabel}] ${scenario.name} — ${phase.title}`,
      severity: ATTENTION_EVENT_SEVERITY[phase.attention],
      timestamp: atIso,
      data: { simulation: true },
    },
  ];
  if (phase.tsunamiActive) {
    rows.unshift({
      id: nextId(),
      type: 'OCEAN',
      description: `[DRILL] Sensor skenario: lonjakan muka laut +${formatDecimal(scenario.tsunamiHeight * phase.tsunamiFactor)} m di ${scenario.affectedZones[0]} — nilai latihan`,
      severity: 'CRITICAL',
      timestamp: atIso,
      data: { simulation: true },
    });
  }
  return rows;
}

/** True from `minWidthPx` up (a Tailwind breakpoint); null until mounted. */
function useMinWidth(minWidthPx: number): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [minWidthPx]);
  return matches;
}

/**
 * Everything the dashboard shows besides the map lives in one panel on the map, one topic at
 * a time: the inspector column on a desktop, a sheet (phone) or side panel (tablet) opened
 * from the icon dock below that. Nothing sits below the map.
 */
type PanelId = 'gempa' | 'telemetri' | 'gunung' | 'analisis' | 'pasut' | 'notifikasi' | 'sumber';

const PANELS: { id: PanelId; label: string; Icon: LucideIcon }[] = [
  { id: 'gempa', label: 'Gempa terkini', Icon: Radio },
  { id: 'telemetri', label: 'Telemetri', Icon: Activity },
  { id: 'gunung', label: 'Gunung api', Icon: Mountain },
  { id: 'analisis', label: 'Pendukung keputusan', Icon: Bot },
  { id: 'pasut', label: 'Stasiun pasut', Icon: Waves },
  { id: 'notifikasi', label: 'Notifikasi lokasi', Icon: Bell },
  { id: 'sumber', label: 'Sumber data dan arsitektur', Icon: Database },
];

/** Below `lg` the icon dock runs along the map's bottom edge; what sits above it keeps this clear (px). */
const DOCK_CLEARANCE = 72;

const INITIAL_FEED_RECORDS: Record<FeedKey, FeedRecord> = {
  bmkg: EMPTY_FEED_RECORD,
  usgs: EMPTY_FEED_RECORD,
  ioc: EMPTY_FEED_RECORD,
  pvmbg: EMPTY_FEED_RECORD,
  weather: EMPTY_FEED_RECORD,
  ai: EMPTY_FEED_RECORD,
};

export default function Home() {
  // ---- Live data ----------------------------------------------------------
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [activityIndex, setActivityIndex] = useState<ActivityIndex | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [realQuakes, setRealQuakes] = useState<RealtimeEarthquakesData | null>(null);
  /** When `realQuakes` was received (epoch ms): what "seen on the feed" means between polls. */
  const [realQuakesAt, setRealQuakesAt] = useState<number | null>(null);
  const [volcanoes, setVolcanoes] = useState<VolcanoEruption[]>([]);
  const [oceanFeed, setOceanFeed] = useState<OceanFeedResponse | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [feedRecords, setFeedRecords] = useState<Record<FeedKey, FeedRecord>>(INITIAL_FEED_RECORDS);
  /** Coarse page clock, advanced once per poll; null until mounted. Second-level clocks live in leaf components. */
  const [clock, setClock] = useState<number | null>(null);
  /** BMKG's tsunami-potential statement, latched so a later quake cannot erase it. */
  const [notice, setNotice] = useState<TsunamiNotice | null>(null);
  /** Tsunami scenario reported by the Go backend (never set on the standalone path). */
  const [backendTsunami, setBackendTsunami] = useState<TsunamiScenario | null>(null);

  // ---- Drill --------------------------------------------------------------
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('REAL');
  const [selectedScenarioId, setSelectedScenarioId] = useState<DrillScenarioId>(DEFAULT_DRILL_SCENARIO_ID);
  const [drillPhaseNumber, setDrillPhaseNumber] = useState<number>(DEFAULT_DRILL_PHASE_NUMBER);
  const [phaseEnteredAt, setPhaseEnteredAt] = useState<number>(0);
  const [isDrillPlaying, setIsDrillPlaying] = useState(false);

  // ---- View ---------------------------------------------------------------
  const [selectedVolcano, setSelectedVolcano] = useState<string | null>('BMKG_REGIONAL');
  /** The volcano the panel shows; it stays on the last one picked while the BMKG trace is selected. */
  const [hubVolcano, setHubVolcano] = useState('Anak Krakatau');
  /** Below `lg` the panel is a sheet (phone) or side panel (tablet) over the map; this is whether it is up. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** The last "Analisis PVMBG" request: which volcano, and a number that changes with each request. */
  const [analysisFor, setAnalysisFor] = useState<{ name: string; nonce: number } | null>(null);
  /** Never reset, so asking for the same volcano's analysis twice is still a new request. */
  const analysisNonceRef = useRef(0);
  /** Height of the sheet on a phone, measured, so the map keeps its target above it. */
  const [sheetHeight, setSheetHeight] = useState(0);
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [showHudInspector, setShowHudInspector] = useState(true);
  /** The panel's topic, shared by the desktop inspector and the sheet below `lg`. */
  const [inspectorTab, setInspectorTab] = useState<PanelId>('gempa');
  const [showInfraArchitecture, setShowInfraArchitecture] = useState(false);
  /** Key of the warning the operator collapsed; a different warning opens expanded again. */
  const [collapsedAlertKey, setCollapsedAlertKey] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [hudTop, setHudTop] = useState<number | null>(null);

  const isDrill = dashboardMode === 'SIMULASI';
  /** `lg`: the inspector column sits beside the map. */
  const isDesktop = useMinWidth(1024);
  /** `sm`: below it the panel is a bottom sheet, above it a side panel. */
  const isWide = useMinWidth(640);
  const { playChime } = useAlertAudio(isAudioMuted);

  const headerRef = useRef<HTMLElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventIdRef = useRef<string>('');
  const eventCounter = useRef(0);
  /** Standalone payloads carry provenance; Go-backend payloads do not. */
  const standaloneRef = useRef(true);
  /** Backend tsunami frames are ignored while a drill runs here and briefly after it ends. */
  const isDrillRef = useRef(false);
  const ignoreBackendTsunamiUntilRef = useRef(0);
  /** What the alert tone last sounded for, so it sounds once per escalation. */
  // Live and drill tones are remembered apart: ending a drill must not replay the tone for a
  // live earthquake that already sounded, and a new drill starts from silence.
  const liveToneRef = useRef(TONE_SILENT);
  const drillToneRef = useRef(TONE_SILENT);

  const nextEventId = useCallback(() => `evt-${++eventCounter.current}`, []);

  // ---- Theme --------------------------------------------------------------
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem('inatews-theme');
    } catch {
      // storage may be unavailable; the default theme stays
    }
    const initial = saved === 'light' ? 'light' : 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
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

  // The floating header changes height (drill strip, wrapping on narrow screens);
  // everything over the map starts below it.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHudTop(Math.round(header.getBoundingClientRect().height) + 28);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    isDrillRef.current = isDrill;
  }, [isDrill]);

  // ---- Polling ------------------------------------------------------------
  const markFeed = useCallback((key: FeedKey, ok: boolean, reported?: FeedState) => {
    setFeedRecords((prev) => ({
      ...prev,
      [key]: ok ? { lastOutcome: 'ok', lastOkAt: Date.now(), reported } : { ...prev[key], lastOutcome: 'failed' },
    }));
  }, []);

  const fetchRealQuakes = useCallback(() => {
    fetchJson<RealtimeEarthquakesData>('/api/realtime/earthquakes')
      .then((raw) => {
        if (!raw || typeof raw !== 'object') throw new Error('unexpected earthquake payload');
        // The Go backend serialises a list it has not fetched yet as null.
        const data: RealtimeEarthquakesData = {
          ...raw,
          recent_bmkg: Array.isArray(raw.recent_bmkg) ? raw.recent_bmkg : [],
          recent_usgs: Array.isArray(raw.recent_usgs) ? raw.recent_usgs : [],
        };
        if (!data.latest_bmkg && data.recent_bmkg.length === 0 && data.recent_usgs.length === 0) {
          throw new Error('empty earthquake payload');
        }
        standaloneRef.current = data.provenance !== undefined;
        setRealQuakes(data);
        setRealQuakesAt(Date.now());
        markFeed('bmkg', true, reportedState(data.provenance, 'bmkg_latest', 'bmkg_recent'));
        markFeed('usgs', true, reportedState(data.provenance, 'usgs'));
      })
      .catch(() => {
        markFeed('bmkg', false);
        markFeed('usgs', false);
      });
  }, [markFeed]);

  const fetchVolcanoes = useCallback(() => {
    fetchJson<VolcanoEruption[]>('/api/realtime/volcanoes')
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('unexpected volcano payload');
        setVolcanoes(data);
        const sources = data.map((item) => item.source).filter(Boolean);
        const reported: FeedState | undefined =
          sources.length === 0 ? undefined : sources.includes('PVMBG_LIVE') ? 'live' : 'seed';
        markFeed('pvmbg', true, reported);
      })
      .catch(() => markFeed('pvmbg', false));
  }, [markFeed]);

  const fetchOceanFeed = useCallback(() => {
    fetchJson<OceanFeedResponse>('/api/realtime/ocean')
      .then((data) => {
        if (!data || !Array.isArray(data.stations)) throw new Error('unexpected ocean payload');
        setOceanFeed(data);
        markFeed('ioc', true, data.source === 'IOC_LIVE' ? 'live' : 'seed');
      })
      .catch(() => markFeed('ioc', false));
  }, [markFeed]);

  /** A drill's own scenario, echoed by a shared backend, must not surface as a live warning. */
  const acceptsBackendTsunami = useCallback(
    () => !isDrillRef.current && Date.now() >= ignoreBackendTsunamiUntilRef.current,
    []
  );

  const fetchStatus = useCallback(() => {
    fetchJson<StatusPayload>('/api/status')
      .then((data) => {
        if (!data) throw new Error('empty status payload');
        setStatus(data);
        if (data.activity_index) setActivityIndex(data.activity_index);
        if (data.latest_ai) setAiAnalysis(data.latest_ai);
        // The Go backend omits an inactive scenario, so absence there is not a clear.
        // On the standalone path the tsunami statement is latched from BMKG's own text instead.
        if (data.provenance) setBackendTsunami(null);
        else if (data.tsunami_scenario?.active && acceptsBackendTsunami()) setBackendTsunami(data.tsunami_scenario);
        markFeed('weather', true, reportedState(data.provenance, 'open_meteo'));
      })
      .catch(() => markFeed('weather', false));
  }, [markFeed, acceptsBackendTsunami]);

  const fetchAI = useCallback(() => {
    fetchJson<AIAnalysis>('/api/ai/latest')
      .then((data) => {
        if (!data || !data.status) throw new Error('unexpected AI payload');
        setAiAnalysis(data);
        markFeed('ai', true, 'live');
      })
      .catch(() => markFeed('ai', false));
  }, [markFeed]);

  useEffect(() => {
    const poll = () => {
      setClock(Date.now());
      fetchRealQuakes();
      fetchVolcanoes();
      fetchOceanFeed();
      fetchStatus();
      fetchAI();
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchRealQuakes, fetchVolcanoes, fetchOceanFeed, fetchStatus, fetchAI]);

  // ---- Event stream -------------------------------------------------------
  const connectSSE = useCallback(() => {
    if (sseRetryTimerRef.current) {
      clearTimeout(sseRetryTimerRef.current);
      sseRetryTimerRef.current = null;
    }

    // Sending the last id back lets the server skip the quake it already delivered.
    const resume = lastEventIdRef.current
      ? `?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`
      : '';
    const source = new EventSource(`${API_BASE}/api/stream${resume}`);
    eventSourceRef.current = source;

    source.addEventListener('all', (message: MessageEvent) => {
      if (message.lastEventId) lastEventIdRef.current = message.lastEventId;
      try {
        const { event: eventType, data } = JSON.parse(message.data);
        switch (eventType) {
          case 'metrics':
            setStatus(data as SystemStatus);
            break;
          case 'activity_index':
            setActivityIndex(data as ActivityIndex);
            break;
          case 'ai_analysis':
            // Only the Go backend's stream carries its own analysis; on the standalone path
            // the panel is fed by the /api/ai/latest poll, which may hold a model's text.
            if (!standaloneRef.current) setAiAnalysis(data as AIAnalysis);
            break;
          case 'tsunami':
            if (!standaloneRef.current) {
              const scenario = data as TsunamiScenario;
              if (!scenario?.active) setBackendTsunami(null);
              else if (acceptsBackendTsunami()) setBackendTsunami(scenario);
            }
            break;
          case 'event': {
            const liveEvent = parseLiveEvent(data as Record<string, unknown>, nextEventId());
            setEvents((prev) => capEvents([liveEvent, ...prev]));
            if (liveEvent.type === 'SEISMIC') {
              fetchRealQuakes();
              fetchAI();
            }
            break;
          }
        }
      } catch {
        // a malformed frame is skipped; the next poll still refreshes everything
      }
    });

    source.onerror = () => {
      source.close();
      // The standalone stream closes itself by design; reconnect slowly there.
      sseRetryTimerRef.current = setTimeout(connectSSE, API_BASE ? 2500 : 15000);
    };
  }, [fetchRealQuakes, fetchAI, nextEventId, acceptsBackendTsunami]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (sseRetryTimerRef.current) clearTimeout(sseRetryTimerRef.current);
      eventSourceRef.current?.close();
    };
  }, [connectSSE]);

  // ---- BMKG tsunami statement (latched) -----------------------------------
  // Re-run on every tick so the hold and retire periods apply between polls; what the feed
  // was seen to carry is stamped with the time the payload arrived, not with the tick.
  useEffect(() => {
    if (!realQuakes || realQuakesAt === null) return;
    setNotice((prev) =>
      updateTsunamiNotice(prev, realQuakes.latest_bmkg, realQuakes.recent_bmkg, Date.now(), realQuakesAt)
    );
  }, [realQuakes, realQuakesAt, clock]);

  const noticeInForce = isNoticeInForce(notice);

  // ---- Feed health and attention ------------------------------------------
  const feeds: FeedHealth[] = useMemo(
    () =>
      FEED_ORDER.map((key) => ({
        key,
        ...FEED_INFO[key],
        state: clock === null ? 'loading' : feedHealthState(feedRecords[key], clock),
        lastOkAt: feedRecords[key].lastOkAt,
        note: key === 'ai' ? aiAnalysis?.model_used : undefined,
      })),
    [feedRecords, clock, aiAnalysis?.model_used]
  );

  const bmkgHealth: QuakeFeedHealth = feeds[0].state;

  const liveAttention = useMemo(
    () =>
      assessAttention({
        latest: realQuakes?.latest_bmkg ?? null,
        recent: realQuakes?.recent_bmkg ?? [],
        felt: realQuakes?.felt_bmkg ?? [],
        feed: bmkgHealth,
        now: clock ?? 0,
      }),
    [realQuakes, bmkgHealth, clock]
  );

  const weekDays = useMemo(
    () => summarizeDays(realQuakes?.latest_bmkg ?? null, realQuakes?.recent_bmkg ?? [], clock ?? 0, realQuakes?.felt_bmkg ?? []),
    [realQuakes, clock]
  );

  // ---- Drill model --------------------------------------------------------
  const activeScenario = useMemo(() => findDrillScenario(selectedScenarioId), [selectedScenarioId]);
  const activePhase = useMemo(() => findDrillPhase(drillPhaseNumber), [drillPhaseNumber]);
  /** Wall-clock instant of the scenario's mainshock; the drill's "origin time". */
  const drillOriginIso = useMemo(
    () => new Date(scenarioOriginMs(activePhase, phaseEnteredAt)).toISOString(),
    [activePhase, phaseEnteredAt]
  );

  const enterPhase = useCallback(
    (scenario: DrillScenario, phase: DrillPhase) => {
      const now = Date.now();
      setPhaseEnteredAt(now);
      const rows = buildDrillEvents(scenario, phase, new Date(now).toISOString(), nextEventId);
      setEvents((prev) => capEvents([...rows, ...prev]));
    },
    [nextEventId]
  );

  /** Ends the drill on a connected backend and drops whatever scenario it echoed back. */
  const leaveBackendDrill = useCallback(() => {
    // The backend takes a moment to stop broadcasting the drill's scenario.
    ignoreBackendTsunamiUntilRef.current = Date.now() + 15_000;
    setBackendTsunami(null);
    toggleBackendMode('real')
      .then(() => triggerSimulation('reset'))
      .catch(() => {});
  }, []);

  const handleModeChange = useCallback(
    (nextMode: DashboardMode) => {
      if (nextMode === dashboardMode) return;
      if (nextMode === 'SIMULASI') {
        if (noticeInForce) {
          // A drill must never run over a real warning.
          setSystemMessage('Simulasi tidak dapat dimulai selama pernyataan tsunami BMKG berlaku.');
          setCollapsedAlertKey(null);
          return;
        }
        setDashboardMode('SIMULASI');
        drillToneRef.current = TONE_SILENT;
        enterPhase(activeScenario, activePhase);
        toggleBackendMode('drill')
          .then(() => triggerSimulation(`scenario/${activeScenario.id}`))
          .catch(() => {});
        return;
      }
      setDashboardMode('REAL');
      setIsDrillPlaying(false);
      leaveBackendDrill();
      fetchStatus();
      fetchAI();
      fetchRealQuakes();
    },
    [
      dashboardMode,
      noticeInForce,
      activeScenario,
      activePhase,
      enterPhase,
      leaveBackendDrill,
      fetchStatus,
      fetchAI,
      fetchRealQuakes,
    ]
  );

  const handleSelectScenario = useCallback(
    (scenarioId: DrillScenarioId) => {
      setSelectedScenarioId(scenarioId);
      const scenario = findDrillScenario(scenarioId);
      enterPhase(scenario, activePhase);
      triggerSimulation(`scenario/${scenario.id}`).catch(() => {});
    },
    [activePhase, enterPhase]
  );

  const handleSelectPhase = useCallback(
    (phaseNumber: number) => {
      setDrillPhaseNumber(phaseNumber);
      enterPhase(activeScenario, findDrillPhase(phaseNumber));
    },
    [activeScenario, enterPhase]
  );

  useEffect(() => {
    if (!isDrill || !isDrillPlaying) return;
    const timer = setInterval(
      () => handleSelectPhase(nextDrillPhaseNumber(drillPhaseNumber)),
      AUTOPLAY_SECONDS * 1000
    );
    return () => clearInterval(timer);
  }, [isDrill, isDrillPlaying, drillPhaseNumber, handleSelectPhase]);

  // A real statement arriving mid-drill ends the drill.
  useEffect(() => {
    if (!isDrill || !noticeInForce) return;
    setDashboardMode('REAL');
    setIsDrillPlaying(false);
    setCollapsedAlertKey(null);
    setSystemMessage('Simulasi dihentikan: BMKG menyatakan potensi tsunami untuk gempa nyata.');
    leaveBackendDrill();
  }, [isDrill, noticeInForce, leaveBackendDrill]);

  useEffect(() => {
    if (!systemMessage) return;
    const timer = setTimeout(() => setSystemMessage(null), 9000);
    return () => clearTimeout(timer);
  }, [systemMessage]);

  useEffect(() => {
    document.title = isDrill ? `[SIMULASI] ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [isDrill]);

  /** The scenario earthquake, once the mainshock has happened. */
  const drillQuake: BMKGGempaDetail | null = useMemo(() => {
    if (!isDrill || !activePhase.mainshockOccurred) return null;
    return {
      Tanggal: 'Skenario latihan',
      Jam: activePhase.shortLabel,
      DateTime: drillOriginIso,
      Coordinates: `${activeScenario.lat.toFixed(2)},${activeScenario.lon.toFixed(2)}`,
      Lintang: `${Math.abs(activeScenario.lat).toFixed(2)} ${activeScenario.lat < 0 ? 'LS' : 'LU'}`,
      Bujur: `${activeScenario.lon.toFixed(2)} BT`,
      Magnitude: activeScenario.magnitude.toFixed(1),
      Kedalaman: `${activeScenario.depth} km`,
      Wilayah: `${activeScenario.name} — ${activeScenario.faultZone}`,
      Potensi: '',
    };
  }, [isDrill, activePhase, activeScenario, drillOriginIso]);

  /** Scenario tsunami: drives the map overlay and the ocean panel's drill surges. */
  const drillTsunami: TsunamiScenario | null = useMemo(() => {
    if (!isDrill || !activePhase.tsunamiActive) return null;
    return {
      active: true,
      detection_time: drillOriginIso,
      sensor_id: `Sensor skenario — ${activeScenario.oceanSensorLabel}`,
      wave_anomaly: Number((activeScenario.tsunamiHeight * activePhase.tsunamiFactor).toFixed(2)),
      affected_zones: activeScenario.affectedZones,
      response_actions: [],
      severity: 'CRITICAL',
      timestamp: drillOriginIso,
    };
  }, [isDrill, activePhase, activeScenario, drillOriginIso]);

  const drillStatus: SystemStatus | null = useMemo(() => {
    if (!isDrill) return null;
    return {
      seismic_intensity: activePhase.activityLevel,
      ocean_status: drillTsunami
        ? `Lonjakan skenario +${formatDecimal(drillTsunami.wave_anomaly)} m`
        : 'Tanpa lonjakan pada fase ini',
      weather_status: activePhase.weatherStatus,
      infra_status: activePhase.infraStatus,
      active_alerts: activePhase.activeAlerts,
      risk_level: activePhase.riskLevel,
      trend_direction: activePhase.trendDirection,
      last_update: drillOriginIso,
    };
  }, [isDrill, activePhase, drillTsunami, drillOriginIso]);

  const drillActivityIndex: ActivityIndex | null = useMemo(() => {
    if (!isDrill) return null;
    return {
      overall_percentage: activePhase.activityLevel,
      seismic_change: 0,
      tremor_change: 0,
      deformation_trend: activePhase.mainshockOccurred
        ? `Slip koseismik ${activeScenario.coseismicSlip}`
        : 'Tidak ada perubahan',
      thermal_trend: 'tidak tersedia',
      trend_direction: activePhase.trendDirection,
      earthquake_count: activePhase.earthquakeCount,
      avg_magnitude: 0,
      max_magnitude: activePhase.mainshockOccurred ? activeScenario.magnitude : 0,
      timestamp: drillOriginIso,
    };
  }, [isDrill, activePhase, activeScenario, drillOriginIso]);

  const drillMapData: DrillScenarioMapData | null = useMemo(() => {
    if (!isDrill) return null;
    return {
      id: activeScenario.id,
      name: activeScenario.name,
      faultZone: activeScenario.faultZone,
      magnitude: activeScenario.magnitude,
      depth: activeScenario.depth,
      lat: activeScenario.lat,
      lon: activeScenario.lon,
      tsunamiHeight: activeScenario.tsunamiHeight,
      waveHeight: Number((activeScenario.tsunamiHeight * Math.max(0.25, activePhase.tsunamiFactor)).toFixed(1)),
    };
  }, [isDrill, activeScenario, activePhase]);

  const drillPhaseForMap: LifecyclePhase | null = useMemo(() => {
    if (!isDrill) return null;
    return {
      phase_number: activePhase.phaseNumber,
      phase_name: activePhase.phaseName,
      phase_title: activePhase.title,
      activity_level: activePhase.activityLevel,
      duration_sec: 0,
      elapsed_sec: 0,
      seismic_energy: activePhase.seismicEnergy,
      status: activePhase.riskLevel,
      scenario_name: activeScenario.name,
      magnitude: activeScenario.magnitude,
      depth: activeScenario.depth,
      fault_zone: activeScenario.faultZone,
      mmi: activePhase.mmi,
      latitude: activeScenario.lat,
      longitude: activeScenario.lon,
      timestamp: drillOriginIso,
    };
  }, [isDrill, activePhase, activeScenario, drillOriginIso]);

  // ---- What each surface shows --------------------------------------------
  const shownQuake = isDrill ? drillQuake : (realQuakes?.latest_bmkg ?? null);
  const shownStatus = isDrill ? drillStatus : status;
  const shownActivityIndex = isDrill ? drillActivityIndex : activityIndex;

  const telemetryContext: TelemetryPromptContext = useMemo(
    () => ({
      mode: dashboardMode,
      scenario: isDrill
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
      phase: isDrill
        ? {
            phaseNumber: activePhase.phaseNumber,
            phaseName: activePhase.phaseName,
            shortLabel: activePhase.shortLabel,
            title: activePhase.title,
            mmi: activePhase.mmi,
            activityLevel: activePhase.activityLevel,
            tsunamiActive: activePhase.tsunamiActive,
            tsunamiFactor: activePhase.tsunamiFactor,
            bulletin: activePhase.bulletin,
          }
        : null,
      latestQuake: shownQuake,
    }),
    [dashboardMode, isDrill, activeScenario, activePhase, shownQuake]
  );

  const shownAiAnalysis = useMemo(
    () => (isDrill ? (buildDrillAIAnalysis({ context: telemetryContext }) ?? aiAnalysis) : aiAnalysis),
    [isDrill, telemetryContext, aiAnalysis]
  );

  const mastheadStatus: MastheadStatus = useMemo(() => {
    if (isDrill) {
      const headline = `${activeScenario.shortLabel} · fase ${activePhase.shortLabel}`;
      if (activePhase.tsunamiActive) {
        const lead = warningLeadMin(activeScenario);
        return {
          kind: 'tsunami',
          tone: 'kritis',
          label: 'Simulasi · tsunami (latihan)',
          shortLabel: 'Simulasi',
          headline,
          reasons: [
            activePhase.title,
            lead > 0
              ? `Jeda PD-1 ke gelombang pertama pada skenario ini: ±${lead} menit.`
              : 'Pada skenario ini peringatan resmi tidak sempat mendahului gelombang pertama.',
          ],
        };
      }
      const tone: Tone = activePhase.attention;
      return {
        kind: 'attention',
        tone,
        label: `Simulasi · ${TONE_LABEL[tone]}`,
        shortLabel: 'Simulasi',
        headline,
        reasons: [activePhase.title],
      };
    }

    if (notice && noticeInForce) {
      const magnitude = parseFloat(notice.quake.Magnitude);
      return {
        kind: 'tsunami',
        tone: 'kritis',
        label: 'BMKG: berpotensi tsunami',
        shortLabel: 'Tsunami · BMKG',
        headline: `${Number.isFinite(magnitude) ? `M${formatDecimal(magnitude)} · ` : ''}${shortRegion(notice.quake.Wilayah, 30)}`,
        reasons: [
          `Keterangan BMKG: “${notice.statement}”`,
          notice.status === 'unconfirmed'
            ? 'Umpan publik sudah berganti ke gempa lain; status terkini hanya ada di BMKG.'
            : `Terakhir terlihat pada umpan BMKG pukul ${formatWibTime(notice.lastSeenMs, { seconds: false })}.`,
        ],
        sinceMs: notice.originMs,
      };
    }

    const { driver } = liveAttention;
    return {
      kind: 'attention',
      tone: liveAttention.level,
      label: `Pantauan · ${TONE_LABEL[liveAttention.level]}`,
      shortLabel: TONE_LABEL[liveAttention.level],
      headline: liveAttention.headline,
      // The headline ends with the event's age; announcing that would repeat every minute.
      announcement: driver
        ? `M${formatDecimal(driver.magnitude)} · ${shortRegion(driver.region, 30)}`
        : liveAttention.headline,
      reasons: liveAttention.reasons,
      expiresAtMs: liveAttention.expiresAtMs,
      attention: liveAttention,
    };
  }, [isDrill, activeScenario, activePhase, notice, noticeInForce, liveAttention]);

  // ---- Warning card -------------------------------------------------------
  const alertKey = isDrill
    ? activePhase.tsunamiActive
      ? `drill:${activeScenario.id}`
      : null
    : notice
      ? `bmkg:${notice.key}`
      : backendTsunami?.active
        ? `backend:${backendTsunami.detection_time}`
        : null;
  const alertCollapsed = alertKey !== null && collapsedAlertKey === alertKey;
  const toggleAlertCollapsed = useCallback(
    () => setCollapsedAlertKey((prev) => (prev === alertKey ? null : alertKey)),
    [alertKey]
  );

  // On a phone the expanded card would cover the map, so a new warning starts as its
  // one-line header (level and time) and opens on tap.
  useEffect(() => {
    if (isDesktop === false && alertKey) setCollapsedAlertKey(alertKey);
  }, [isDesktop, alertKey]);

  const warningCard = isDrill ? (
    activePhase.tsunamiActive ? (
      <DrillTsunamiCard
        scenario={activeScenario}
        phase={activePhase}
        phaseEnteredAtMs={phaseEnteredAt}
        collapsed={alertCollapsed}
        onToggleCollapsed={toggleAlertCollapsed}
      />
    ) : null
  ) : notice ? (
    <BmkgTsunamiCard
      notice={notice}
      feedState={bmkgHealth}
      collapsed={alertCollapsed}
      onToggleCollapsed={toggleAlertCollapsed}
      onAcknowledge={() => {
        setNotice((prev) => (prev ? acknowledgeNotice(prev) : prev));
        setCollapsedAlertKey(alertKey);
      }}
    />
  ) : backendTsunami?.active ? (
    <BackendTsunamiCard
      scenario={backendTsunami}
      collapsed={alertCollapsed}
      onToggleCollapsed={toggleAlertCollapsed}
    />
  ) : null;

  // One tone per escalation, never per poll or per tick (see lib/alertTone).
  const tone: ToneSituation = isDrill
    ? {
        known: true,
        rank: activePhase.tsunamiActive ? 2 : activePhase.attention === 'tinggi' ? 1 : 0,
        identity: `drill:${activeScenario.id}:${activePhase.phaseNumber}`,
        eventMs: 0,
      }
    : notice && noticeInForce
      ? { known: true, rank: 2, identity: `notice:${notice.key}`, eventMs: 0 }
      : {
          known: liveAttention.level !== 'unknown',
          rank: liveAttention.level === 'tinggi' ? 1 : 0,
          identity: 'attention',
          eventMs: liveAttention.newestDriverMs ?? 0,
        };
  const { known: toneKnown, rank: toneRank, identity: toneIdentity, eventMs: toneEventMs } = tone;
  useEffect(() => {
    const memoryRef = toneIdentity.startsWith('drill:') ? drillToneRef : liveToneRef;
    const { play, memory } = advanceTone(memoryRef.current, {
      known: toneKnown,
      rank: toneRank,
      identity: toneIdentity,
      eventMs: toneEventMs,
    });
    memoryRef.current = memory;
    if (play) playChime(toneRank >= 2 ? 'critical' : 'high');
  }, [toneKnown, toneRank, toneIdentity, toneEventMs, playChime]);

  // ---- Handlers passed down (stable, so the map does not rebuild markers) --
  const handleFocusMap = useCallback((lat: number, lon: number) => {
    setFocusCoords({ lat, lon });
  }, []);
  /** Brings up one topic in the panel on the map — the inspector on a desktop, the sheet below `lg`. */
  const openPanel = useCallback((id: PanelId) => {
    setInspectorTab(id);
    setShowHudInspector(true);
    setSheetOpen(true);
  }, []);
  // Picking a volcano anywhere — a map marker, a chip — brings up one panel on the map with
  // its picture, eruption report, live seismogram and analysis.
  const handleSelectVolcano = useCallback(
    (name: string) => {
      setSelectedVolcano(name);
      setAnalysisFor(null);
      if (name === 'BMKG_REGIONAL') return;
      setHubVolcano(name);
      openPanel('gunung');
    },
    [openPanel]
  );
  // "Analisis PVMBG" on a chip: the same panel, opened at its analysis section.
  const handleAnalyzeVolcano = useCallback(
    (name: string) => {
      handleSelectVolcano(name);
      analysisNonceRef.current += 1;
      setAnalysisFor({ name, nonce: analysisNonceRef.current });
    },
    [handleSelectVolcano]
  );
  const handleCloseSheet = useCallback(() => setSheetOpen(false), []);
  // Once the panel has opened the analysis and brought it into view, the request is spent;
  // otherwise it would replay every time the card mounts again (a tab switch, a warning card).
  const handleAnalysisHandled = useCallback(() => setAnalysisFor(null), []);
  // The sheet is measured while it is on screen; React 19 runs the returned cleanup on detach.
  const sheetRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(() => setSheetHeight(Math.round(node.getBoundingClientRect().height)));
    observer.observe(node);
    return () => {
      observer.disconnect();
      setSheetHeight(0);
    };
  }, []);
  const handleOpenSources = useCallback(() => openPanel('sumber'), [openPanel]);
  const handleOpenAlerts = useCallback(() => openPanel('notifikasi'), [openPanel]);

  // ---- Location-based notifications ----------------------------------------
  // Shown by the browser (see hooks/useLocalAlerts). Near-field earthquakes and eruptions also
  // sound the dashboard's tone (a tsunami statement has its own). A click on a notification
  // shows its event: an eruption opens its volcano's panel, anything else is flown to, and the
  // test notification opens the notification panel.
  const handleLocalAlert = useCallback(
    (alert: LocalAlert) => {
      if (alert.kind !== 'tsunami') playChime('high');
    },
    [playChime]
  );
  const handleOpenNotification = useCallback(
    (target: NotificationTarget) => {
      if (target.kind === 'volcano' && target.volcanoName) handleSelectVolcano(target.volcanoName);
      else if (target.point) handleFocusMap(target.point.lat, target.point.lon);
      else openPanel('notifikasi');
    },
    [handleSelectVolcano, handleFocusMap, openPanel]
  );
  const localAlerts = useLocalAlerts({
    latest: realQuakes?.latest_bmkg ?? null,
    recent: realQuakes?.recent_bmkg ?? NO_EVENTS,
    notice,
    volcanoReports: volcanoes,
    paused: dashboardMode === 'SIMULASI',
    onAlert: handleLocalAlert,
    onOpen: handleOpenNotification,
  });

  const seismographProps = {
    seismicEnergy: isDrill ? activePhase.seismicEnergy : 1.2,
    activityLevel: isDrill ? activePhase.activityLevel : 15,
    phaseName: isDrill ? activePhase.phaseName : 'KONDISI_LATAR',
    volcanoes,
    selectedVolcano,
    onSelectVolcano: handleSelectVolcano,
    onAnalyzeVolcano: handleAnalyzeVolcano,
    isSimulasi: isDrill,
    theme,
  };

  const quakeCard = (
    <LatestQuakeCard
      quake={shownQuake}
      realQuakes={realQuakes}
      onFocusMap={handleFocusMap}
      isDrill={isDrill}
      feedState={bmkgHealth}
    />
  );

  const telemetryCard = (
    <div className="glass-hud flex flex-col gap-4 rounded-2xl p-4">
      {isDrill ? (
        <div className="rounded-xl border border-[var(--drill-border)] bg-[var(--drill-bg)] p-3">
          <p className="t-micro text-[var(--drill)]">Skenario latihan</p>
          <p className="t-heading mt-1">{activeScenario.name}</p>
          <p className="t-meta mt-1">{activePhase.title}</p>
        </div>
      ) : (
        <ActivityStrip days={weekDays} assessment={liveAttention} />
      )}
      <MetricCards
        bare={true}
        isSimulasi={isDrill}
        fromBackend={!isDrill && status !== null && status.provenance === undefined}
        oceanStatus={shownStatus?.ocean_status ?? null}
        weatherStatus={shownStatus?.weather_status ?? null}
        infraStatus={isDrill ? shownStatus?.infra_status : undefined}
        activityIndex={shownActivityIndex}
      />
      <EventStream bare={true} events={events} maxHeightClass="max-h-[320px]" />
    </div>
  );

  // The pill row starts at the map's left edge, so Leaflet's own controls sit below it —
  // and, on a phone, below a collapsed warning header too.
  const controlsOffset = 44 + (isDesktop === false && warningCard && alertCollapsed ? 58 : 0);
  // Written on <html>, not on this page's root: `scroll-padding-top` is resolved there, and
  // a custom property set further down the tree never reaches it.
  useEffect(() => {
    if (hudTop === null) return;
    const root = document.documentElement;
    root.style.setProperty('--hud-top', `${hudTop}px`);
    root.style.setProperty('--map-controls-top', `${hudTop + controlsOffset}px`);
  }, [hudTop, controlsOffset]);
  useEffect(
    () => () => {
      const root = document.documentElement;
      root.style.removeProperty('--hud-top');
      root.style.removeProperty('--map-controls-top');
    },
    []
  );

  // What the HUD covers of the map, so the overview, fly-to targets and popups use the part left open.
  const rightColumnShown = isDesktop !== false && (showHudInspector || warningCard !== null);
  // A warning card is read first: while it is open below `lg`, the sheet steps aside
  // (it comes back when the card is collapsed).
  const sheetShown = isDesktop === false && sheetOpen && !(warningCard !== null && !alertCollapsed);
  const sheetIsSide = isWide === true;
  const mapInsets: MapViewInsets = useMemo(
    () => ({
      top: (hudTop ?? 84) + controlsOffset,
      // Beside the map: the inspector column, or the side panel from `sm` up.
      right: rightColumnShown || (sheetShown && sheetIsSide) ? 396 : 0,
      // Below `lg` the dock runs along the bottom edge, and on a phone the sheet sits above it.
      bottom:
        isDesktop === false
          ? sheetShown && !sheetIsSide && sheetHeight > 0
            ? sheetHeight + DOCK_CLEARANCE + 12
            : DOCK_CLEARANCE
          : 0,
    }),
    [hudTop, controlsOffset, rightColumnShown, sheetShown, sheetIsSide, sheetHeight, isDesktop]
  );
  const volcanoListState = feeds.find((feed) => feed.key === 'pvmbg')?.state ?? 'loading';
  const analysisRequest = analysisFor !== null && analysisFor.name === hubVolcano ? analysisFor.nonce : 0;

  const panelIcon = (id: PanelId, Icon: LucideIcon): LucideIcon =>
    id === 'notifikasi' && localAlerts.active ? BellRing : Icon;

  // Below `lg` a dock icon opens its topic, or closes it when it is already up. An open warning
  // card folds to its header first, so the panel asked for does not stay hidden behind it.
  const handleDockSelect = (id: PanelId) => {
    if (sheetShown && inspectorTab === id) {
      setSheetOpen(false);
      return;
    }
    if (warningCard !== null && !alertCollapsed) setCollapsedAlertKey(alertKey);
    setAnalysisFor(null);
    openPanel(id);
  };

  /** One topic of the panel. `inSheet`: the layout below `lg`, where the seismograph strip heads the volcano panel. */
  const renderPanel = (id: PanelId, inSheet: boolean) => {
    switch (id) {
      case 'gempa':
        return quakeCard;
      case 'telemetri':
        return telemetryCard;
      case 'gunung':
        return (
          <div className="flex flex-col gap-2">
            {inSheet && <Seismograph {...seismographProps} compactHud={true} />}
            <VolcanoDetailCard
              key={hubVolcano}
              volcanoName={hubVolcano}
              volcanoes={volcanoes}
              listState={volcanoListState}
              analysisRequest={analysisRequest}
              onAnalysisHandled={handleAnalysisHandled}
            />
          </div>
        );
      case 'analisis':
        return shownAiAnalysis ? (
          <AIPanel analysis={shownAiAnalysis} telemetryContext={telemetryContext} />
        ) : (
          <div className="glass-hud t-body rounded-2xl p-6 text-center text-[var(--text-muted)]">
            Memuat ringkasan situasi…
          </div>
        );
      case 'pasut':
        return (
          <OceanPanel
            tsunami={drillTsunami}
            stations={oceanFeed?.stations}
            oceanSource={oceanFeed?.source}
            onFocusMap={handleFocusMap}
            isSimulasi={isDrill}
            levelKind={oceanFeed?.level_kind ?? 'reference'}
          />
        );
      case 'notifikasi':
        return <LocalAlertsPanel alerts={localAlerts} isDrill={isDrill} />;
      case 'sumber':
        return (
          <div className="flex flex-col gap-2">
            <SourcePanel feeds={feeds} />
            <section className="matte-card p-4">
              <button
                type="button"
                onClick={() => setShowInfraArchitecture((prev) => !prev)}
                aria-expanded={showInfraArchitecture}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
                  <Cpu className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-heading block">Arsitektur streaming (referensi)</span>
                  <span className="t-meta mt-0.5 block text-[var(--text-muted)]">
                    Confluent Kafka · Apache Flink · Schema Registry — angka ilustratif kecuali backend tersambung
                  </span>
                </span>
                <ChevronDown
                  className={`mt-1 h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${
                    showInfraArchitecture ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              {showInfraArchitecture && (
                <div className="mt-4 space-y-4 border-t border-[var(--border-hairline)] pt-4">
                  <FlinkPanel activityIndex={shownActivityIndex} status={shownStatus} isSimulasi={isDrill} />
                  <GovernanceView />
                </div>
              )}
            </section>
          </div>
        );
    }
  };

  return (
    <div
      data-mode={isDrill ? 'simulasi' : 'live'}
      className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]"
    >
      {/* The fade behind the header keeps busy map colour from showing through the gaps around it */}
      <header
        ref={headerRef}
        className="fixed inset-x-3 top-3 z-[1000] space-y-2 before:pointer-events-none before:absolute before:-inset-x-5 before:-top-3 before:-bottom-5 before:-z-10 before:bg-gradient-to-b before:from-[var(--surface-canvas)] before:to-transparent sm:inset-x-5"
      >
        <StatusBar
          mode={dashboardMode}
          onModeChange={handleModeChange}
          status={mastheadStatus}
          feeds={feeds}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => setIsAudioMuted((prev) => !prev)}
          onOpenSources={handleOpenSources}
          alertsEnabled={localAlerts.active}
          onOpenAlerts={handleOpenAlerts}
        />
        {isDrill && (
          <DrillStrip
            scenarios={DRILL_SCENARIOS}
            phases={DRILL_PHASES}
            activeScenario={activeScenario}
            activePhase={activePhase}
            phaseEnteredAtMs={phaseEnteredAt}
            isPlaying={isDrillPlaying}
            autoplaySeconds={AUTOPLAY_SECONDS}
            onSelectScenario={handleSelectScenario}
            onSelectPhase={handleSelectPhase}
            onTogglePlay={() => setIsDrillPlaying((prev) => !prev)}
            onExit={() => handleModeChange('REAL')}
          />
        )}
        {systemMessage && (
          <p role="status" className="hud-solid t-body mx-auto max-w-[1600px] rounded-xl px-3.5 py-2 font-semibold">
            {systemMessage}
          </p>
        )}
      </header>

      {/* Map stage with its floating HUD: everything the dashboard shows is on the map */}
      <section
        id="tactical-map-section"
        aria-label="Peta pemantauan"
        data-map-sheet={sheetShown ? '' : undefined}
        className="relative h-[100dvh] min-h-[480px] w-full overflow-hidden"
      >
        <MapComponent
          realQuakes={realQuakes}
          focusCoords={focusCoords}
          events={events}
          volcanoes={volcanoes}
          selectedVolcano={selectedVolcano}
          onSelectVolcano={handleSelectVolcano}
          tsunamiActive={isDrill && activePhase.tsunamiActive}
          isSimulasi={isDrill}
          phase={drillPhaseForMap}
          drillScenarioData={drillMapData}
          emphasizeLatest={!isDrill && (noticeInForce || liveAttention.level === 'meningkat' || liveAttention.level === 'tinggi')}
          theme={theme}
          floatingHud={true}
          viewInsets={mapInsets}
        />

        {/* Top-left: one row of facts; on small screens the warning card sits here too */}
        <div
          className={`pointer-events-none absolute left-3 right-3 top-[var(--hud-top)] z-[910] flex flex-col gap-2.5 lg:left-4 ${
            showHudInspector || warningCard ? 'lg:right-[400px]' : 'lg:right-4'
          }`}
        >
          <QuakePills
            quake={shownQuake}
            isDrill={isDrill}
            counts={bmkgHealth === 'live' || bmkgHealth === 'unreported' ? liveAttention.counts : null}
            feedState={bmkgHealth}
            compact={warningCard !== null}
          />
          {warningCard && isDesktop === false && (
            <div className="pointer-events-auto max-h-[min(62dvh,440px)] overflow-y-auto rounded-2xl">
              {warningCard}
            </div>
          )}
        </div>

        {/* Below `lg` the panel comes up over the map from the dock: a sheet above the dock on a
            phone, a side panel from `sm` up. */}
        {sheetShown && (
          <div
            ref={sheetRef}
            className="pointer-events-none absolute inset-x-3 bottom-[72px] z-[920] flex max-h-[min(64%,calc(100%_-_var(--map-controls-top)_-_96px))] flex-col sm:inset-x-auto sm:right-3 sm:top-[var(--map-controls-top)] sm:max-h-none sm:w-[372px]"
            // From `sm` the side panel ends above the bottom-right corner, where "Reset peta" sits
          >
            <div className="flex shrink-0 justify-end pb-1.5">
              <button
                type="button"
                onClick={handleCloseSheet}
                aria-label={`Tutup panel ${PANELS.find((panel) => panel.id === inspectorTab)?.label ?? ''}`}
                title="Tutup panel"
                className="hud-solid pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div data-panel-scroll className="no-scrollbar pointer-events-auto min-h-0 overflow-y-auto rounded-2xl">
              {renderPanel(inspectorTab, true)}
            </div>
          </div>
        )}

        {/* Below `lg`: the icon dock that opens each topic */}
        <nav
          aria-label="Panel peta"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-[925] flex sm:inset-x-auto sm:left-3 lg:hidden"
        >
          <div className="hud-solid pointer-events-auto flex w-full items-center gap-0.5 rounded-2xl p-1 sm:w-auto">
            {PANELS.map(({ id, label, Icon }) => {
              const DockIcon = panelIcon(id, Icon);
              const active = sheetShown && inspectorTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  aria-label={label}
                  title={label}
                  onClick={() => handleDockSelect(id)}
                  className={`inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl transition-colors sm:w-11 sm:flex-none ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <DockIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right column (desktop): the warning card stays on top, the inspector below it; it ends
            above the bottom-right corner, where "Reset peta" and the attribution sit */}
        <aside
          aria-label="Inspektor peta"
          className="pointer-events-none hidden lg:absolute lg:bottom-[64px] lg:right-4 lg:top-[var(--hud-top)] lg:z-[890] lg:flex lg:w-[372px] lg:flex-col lg:gap-2"
        >
          {warningCard && isDesktop !== false && (
            <div className="pointer-events-auto max-h-[58%] shrink-0 overflow-y-auto rounded-2xl">{warningCard}</div>
          )}

          {showHudInspector ? (
            <>
              <div className="pointer-events-auto flex shrink-0 items-center justify-between gap-2">
                <div
                  role="tablist"
                  aria-label="Panel peta"
                  className="hud-solid inline-flex items-center gap-0.5 rounded-full p-0.5"
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                    const index = PANELS.findIndex((panel) => panel.id === inspectorTab);
                    const step = event.key === 'ArrowRight' ? 1 : PANELS.length - 1;
                    const next = PANELS[(index + step) % PANELS.length].id;
                    setInspectorTab(next);
                    setAnalysisFor(null);
                    document.getElementById(`inspector-tab-${next}`)?.focus();
                  }}
                >
                  {PANELS.map(({ id, label, Icon }) => {
                    const TabIcon = panelIcon(id, Icon);
                    return (
                      <button
                        key={id}
                        id={`inspector-tab-${id}`}
                        type="button"
                        role="tab"
                        aria-selected={inspectorTab === id}
                        aria-controls="inspector-panel"
                        aria-label={label}
                        title={label}
                        tabIndex={inspectorTab === id ? 0 : -1}
                        onClick={() => {
                          setInspectorTab(id);
                          setAnalysisFor(null);
                        }}
                        className={`inline-flex h-8 w-9 items-center justify-center rounded-full transition-colors ${
                          inspectorTab === id
                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <TabIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowHudInspector(false)}
                  aria-label="Sembunyikan panel"
                  title="Sembunyikan panel"
                  className="hud-solid inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div
                id="inspector-panel"
                role="tabpanel"
                aria-labelledby={`inspector-tab-${inspectorTab}`}
                data-panel-scroll
                className="no-scrollbar pointer-events-auto min-h-0 flex-1 overflow-y-auto rounded-2xl"
              >
                {/* Below `lg` the sheet carries the panel; one copy only */}
                {isDesktop !== false && renderPanel(inspectorTab, false)}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowHudInspector(true)}
              aria-label="Tampilkan panel"
              title="Tampilkan panel"
              className="hud-solid pointer-events-auto inline-flex h-8 w-8 items-center justify-center self-end rounded-full text-[var(--text-primary)]"
            >
              <Eye className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
            </button>
          )}
        </aside>

        {/* Bottom-left (desktop): seismograph strip */}
        {isDesktop !== false && (
          <div
            className={`hidden lg:absolute lg:bottom-4 lg:left-4 lg:z-[880] lg:block ${
              showHudInspector || warningCard
                ? 'lg:w-[540px] lg:max-w-[calc(100%-412px)]'
                : 'lg:w-[580px] lg:max-w-[calc(100%-32px)]'
            }`}
          >
            <Seismograph {...seismographProps} compactHud={true} />
          </div>
        )}
      </section>

    </div>
  );
}
