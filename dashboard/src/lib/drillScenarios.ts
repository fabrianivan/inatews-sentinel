/**
 * Tsunami drill definitions — the single source for everything a simulated
 * scenario shows: the map's arrival badges, the warning table, the drill
 * control strip and the synthesized status / AI text all read from here.
 *
 * Every number in this file is an illustrative training value. None of it is
 * a BMKG model output or a measurement, and the UI must label anything derived
 * from it as a simulation.
 *
 * Phases follow the order of a real InaTEWS warning: the mainshock, then the
 * bulletins PD-1 (target under 3 minutes), PD-2 (under 10 minutes), PD-3
 * (sea-level observations, 30–60 minutes) and PD-4, which ends the warning.
 */

export type DrillScenarioId = 'sunda-strait' | 'south-java' | 'mentawai' | 'palu-koro';

/** A coastal segment with its estimated first-wave arrival and maximum height. */
export interface CoastalZoneEstimate {
  name: string;
  lat: number;
  lon: number;
  /** Minutes after the mainshock (scenario T0) until the first wave arrives. */
  etaMin: number;
  /** Estimated maximum tsunami height at the coast, in metres. */
  heightM: number;
}

interface DrillScenarioBase {
  id: DrillScenarioId;
  name: string;
  shortLabel: string;
  faultZone: string;
  magnitude: number;
  depth: number;
  lat: number;
  lon: number;
  sensorId: string;
  oceanSensorLabel: string;
  faultMechanism: string;
  coseismicSlip: string;
  /** Ordered by arrival time. */
  zones: CoastalZoneEstimate[];
}

export interface DrillScenario extends DrillScenarioBase {
  /** Largest estimated height across the zones, in metres. */
  tsunamiHeight: number;
  /** Earliest estimated arrival across the zones, minutes after the mainshock. */
  evacuationWindowMin: number;
  /** Zone names in arrival order. */
  affectedZones: string[];
}

/** Derives the summary fields from the zone table so they can never disagree with it. */
function defineScenario(base: DrillScenarioBase): DrillScenario {
  const zones = [...base.zones].sort((a, b) => a.etaMin - b.etaMin);
  return {
    ...base,
    zones,
    tsunamiHeight: Math.max(...zones.map((zone) => zone.heightM)),
    evacuationWindowMin: Math.min(...zones.map((zone) => zone.etaMin)),
    affectedZones: zones.map((zone) => zone.name),
  };
}

export const DRILL_SCENARIOS: DrillScenario[] = [
  defineScenario({
    id: 'sunda-strait',
    name: 'Sunda Strait Megathrust M8.2',
    shortLabel: 'Selat Sunda (M8.2)',
    faultZone: 'Megathrust Selat Sunda-Banten',
    magnitude: 8.2,
    depth: 25,
    lat: -6.8,
    lon: 105.2,
    sensorId: 'BUOY-INA-01 (Selat Sunda)',
    oceanSensorLabel: 'BUOY-INA-01 & PASUT CIWANDAN',
    faultMechanism: 'Subduksi Oblique Thrust (Indo-Australia vs Eurasia)',
    coseismicSlip: '7.5 - 11.2 m pada kedalaman dangkal 25 km',
    zones: [
      { name: 'Ujung Kulon, Pandeglang', lat: -6.78, lon: 105.23, etaMin: 7, heightM: 12.0 },
      { name: 'Kalianda, Lampung Selatan', lat: -5.75, lon: 105.59, etaMin: 14, heightM: 6.5 },
      { name: 'Anyer & Carita, Banten', lat: -6.07, lon: 105.88, etaMin: 16, heightM: 8.0 },
      { name: 'Palabuhanratu, Sukabumi', lat: -6.99, lon: 106.54, etaMin: 26, heightM: 3.2 },
      { name: 'Krui, Pesisir Barat', lat: -5.19, lon: 103.93, etaMin: 31, heightM: 2.4 },
    ],
  }),
  defineScenario({
    id: 'south-java',
    name: 'South Java Megathrust M8.8',
    shortLabel: 'Selatan Jawa (M8.8)',
    faultZone: 'Zona Subduksi Selatan Jawa-Cilacap',
    magnitude: 8.8,
    depth: 15,
    lat: -9.1,
    lon: 109.5,
    sensorId: 'BUOY-INA-03 (Selatan Jawa)',
    oceanSensorLabel: 'BUOY-INA-03 & PASUT CILACAP',
    faultMechanism: 'Full-Segment Megathrust Locking Release (Java Trench)',
    coseismicSlip: '11.0 - 16.5 m pada zona seismogenik 15 km',
    zones: [
      { name: 'Pangandaran', lat: -7.69, lon: 108.65, etaMin: 19, heightM: 16.0 },
      { name: 'Cilacap', lat: -7.74, lon: 109.01, etaMin: 21, heightM: 20.0 },
      { name: 'Parangtritis, DIY', lat: -8.02, lon: 110.33, etaMin: 24, heightM: 12.0 },
      { name: 'Prigi, Trenggalek', lat: -8.3, lon: 111.72, etaMin: 29, heightM: 9.0 },
      { name: 'Palabuhanratu, Sukabumi', lat: -6.99, lon: 106.54, etaMin: 41, heightM: 3.5 },
    ],
  }),
  defineScenario({
    id: 'mentawai',
    name: 'Mentawai-Siberut Megathrust M9.0',
    shortLabel: 'Mentawai-Siberut (M9.0)',
    faultZone: 'Segmen Mentawai-Siberut Sumatra Trench',
    magnitude: 9.0,
    depth: 12,
    lat: -2.5,
    lon: 99.8,
    sensorId: 'BUOY-INA-05 (Mentawai Siberut)',
    oceanSensorLabel: 'BUOY-INA-05 & PASUT TELUK BAYUR',
    faultMechanism: 'Mega-Rupture Interplate Thrust (>350 km panjang patahan)',
    coseismicSlip: '14.0 - 21.0 m uplift dasar samudera',
    zones: [
      { name: 'Pulau Siberut, Mentawai', lat: -1.55, lon: 99.18, etaMin: 9, heightM: 25.0 },
      { name: 'Kota Padang & Teluk Bayur', lat: -0.96, lon: 100.35, etaMin: 18, heightM: 11.0 },
      { name: 'Pesisir Bengkulu', lat: -3.8, lon: 102.25, etaMin: 27, heightM: 6.0 },
      { name: 'Sibolga, Sumatra Utara', lat: 1.74, lon: 98.78, etaMin: 34, heightM: 3.5 },
    ],
  }),
  defineScenario({
    id: 'palu-koro',
    name: 'Palu-Koro Strike-Slip M7.5',
    shortLabel: 'Palu-Koro (M7.5)',
    faultZone: 'Sesar Aktif Palu-Koro & Teluk Palu',
    magnitude: 7.5,
    depth: 10,
    lat: -0.18,
    lon: 119.85,
    sensorId: 'BUOY-INA-07 (Selat Makassar - Toli-Toli)',
    oceanSensorLabel: 'BUOY-INA-07 & PASUT TOLI-TOLI',
    faultMechanism: 'Supershear Left-Lateral Strike-Slip + Submarine Landslide',
    coseismicSlip: '4.8 - 6.9 m sesar mendatar dangkal',
    zones: [
      { name: 'Donggala', lat: -0.68, lon: 119.74, etaMin: 4, heightM: 7.0 },
      { name: 'Teluk Palu', lat: -0.89, lon: 119.86, etaMin: 5, heightM: 11.0 },
      { name: 'Toli-Toli', lat: 1.04, lon: 120.82, etaMin: 22, heightM: 1.2 },
      { name: 'Mamuju & Majene', lat: -2.68, lon: 118.89, etaMin: 28, heightM: 0.4 },
    ],
  }),
];

/** Official bulletin sequence of an InaTEWS tsunami warning. */
export type DrillBulletin = 'PD-1' | 'PD-2' | 'PD-3' | 'PD-4';

/** Minutes after the mainshock at which the first official bulletin is expected. */
export const PD1_LATENCY_MIN = 3;

export interface DrillPhase {
  phaseNumber: number;
  phaseName: string;
  shortLabel: string;
  title: string;
  /**
   * Nominal scenario time at which the phase starts, in minutes relative to the
   * mainshock (negative = before it). The drill clock runs on from here in real
   * seconds while the phase is on screen, and stops just short of the next phase.
   */
  tPlusMin: number;
  mainshockOccurred: boolean;
  /** The official bulletin in force during the phase, if any. */
  bulletin: DrillBulletin | null;
  /** A tsunami threat is in force: from the mainshock until PD-4 ends it. */
  tsunamiActive: boolean;
  /** Share of the scenario's maximum height that sensors "observe" in this phase. */
  tsunamiFactor: number;
  /** Unofficial attention level the dashboard would show. */
  attention: 'rutin' | 'meningkat' | 'tinggi';
  /** Status-payload vocabulary, kept for parity with the backend. */
  riskLevel: string;
  trendDirection: string;
  activityLevel: number;
  seismicEnergy: number;
  activeAlerts: number;
  earthquakeCount: number;
  mmi: number;
  weatherStatus: string;
  infraStatus: string;
}

export const DRILL_PHASES: DrillPhase[] = [
  {
    phaseNumber: 1,
    phaseName: 'KONDISI_LATAR',
    shortLabel: 'Latar',
    title: 'Kondisi latar — pemantauan rutin (gempa tidak dapat diprediksi)',
    tPlusMin: -10,
    mainshockOccurred: false,
    bulletin: null,
    tsunamiActive: false,
    tsunamiFactor: 0,
    attention: 'rutin',
    riskLevel: 'NORMAL',
    trendDirection: 'STABLE',
    activityLevel: 18.0,
    seismicEnergy: 1.8,
    activeAlerts: 0,
    earthquakeCount: 4,
    mmi: 2.5,
    weatherStatus: 'CUACA PESISIR TERPANTAU',
    infraStatus: 'OPERASIONAL',
  },
  {
    phaseNumber: 2,
    phaseName: 'GEMPA_UTAMA',
    shortLabel: 'Gempa utama',
    title: 'Gempa utama — guncangan kuat, peringatan resmi belum terbit',
    tPlusMin: 0,
    mainshockOccurred: true,
    bulletin: null,
    tsunamiActive: true,
    tsunamiFactor: 0.2,
    attention: 'tinggi',
    riskLevel: 'CRITICAL',
    trendDirection: 'SPIKE',
    activityLevel: 94.0,
    seismicEnergy: 9.2,
    activeAlerts: 3,
    earthquakeCount: 12,
    mmi: 8.6,
    weatherStatus: 'GUNCANGAN KUAT DI PESISIR',
    infraStatus: 'SENSOR PESISIR JENUH',
  },
  {
    phaseNumber: 3,
    phaseName: 'PD1',
    shortLabel: 'PD-1',
    title: 'PD-1 — parameter gempa, potensi tsunami, estimasi tiba dan status wilayah',
    tPlusMin: PD1_LATENCY_MIN,
    mainshockOccurred: true,
    bulletin: 'PD-1',
    tsunamiActive: true,
    tsunamiFactor: 0.65,
    attention: 'tinggi',
    riskLevel: 'CRITICAL',
    trendDirection: 'SPIKE',
    activityLevel: 96.0,
    seismicEnergy: 9.0,
    activeAlerts: 5,
    earthquakeCount: 21,
    mmi: 8.6,
    weatherStatus: 'PD-1 DISEBARKAN',
    infraStatus: 'EVAKUASI PESISIR BERJALAN',
  },
  {
    phaseNumber: 4,
    phaseName: 'PD2',
    shortLabel: 'PD-2',
    title: 'PD-2 — pemutakhiran parameter dan status ancaman',
    tPlusMin: 10,
    mainshockOccurred: true,
    bulletin: 'PD-2',
    tsunamiActive: true,
    tsunamiFactor: 1.0,
    attention: 'tinggi',
    riskLevel: 'CRITICAL',
    trendDirection: 'CRITICAL',
    activityLevel: 98.0,
    seismicEnergy: 8.7,
    activeAlerts: 8,
    earthquakeCount: 38,
    mmi: 8.9,
    weatherStatus: 'GELOMBANG DI PESISIR (SKENARIO)',
    infraStatus: 'EVAKUASI DARURAT',
  },
  {
    phaseNumber: 5,
    phaseName: 'PD3',
    shortLabel: 'PD-3',
    title: 'PD-3 — hasil observasi muka laut (pasut dan buoy)',
    tPlusMin: 30,
    mainshockOccurred: true,
    bulletin: 'PD-3',
    tsunamiActive: true,
    tsunamiFactor: 0.8,
    attention: 'tinggi',
    riskLevel: 'CRITICAL',
    trendDirection: 'CRITICAL',
    activityLevel: 90.0,
    seismicEnergy: 7.2,
    activeAlerts: 7,
    earthquakeCount: 47,
    mmi: 7.4,
    weatherStatus: 'OBSERVASI PASUT & BUOY',
    infraStatus: 'JALUR EVAKUASI DIJAGA',
  },
  {
    phaseNumber: 6,
    phaseName: 'PD4',
    shortLabel: 'PD-4',
    title: 'PD-4 — peringatan dinyatakan berakhir, operasi SAR dimulai',
    tPlusMin: 180,
    mainshockOccurred: true,
    bulletin: 'PD-4',
    tsunamiActive: false,
    tsunamiFactor: 0.1,
    attention: 'meningkat',
    riskLevel: 'HIGH',
    trendDirection: 'FALLING',
    activityLevel: 68.0,
    seismicEnergy: 5.9,
    activeAlerts: 4,
    earthquakeCount: 63,
    mmi: 6.2,
    weatherStatus: 'PERINGATAN BERAKHIR — PEMULIHAN',
    infraStatus: 'KORIDOR SAR & LOGISTIK AKTIF',
  },
];

export const DEFAULT_DRILL_SCENARIO_ID: DrillScenarioId = 'sunda-strait';
/** Drills open on PD-1: the warning is out and every zone is still counting down. */
export const DEFAULT_DRILL_PHASE_NUMBER = 3;

export function findDrillScenario(id: string | null | undefined): DrillScenario {
  return DRILL_SCENARIOS.find((scenario) => scenario.id === id) ?? DRILL_SCENARIOS[0];
}

export function findDrillPhase(phaseNumber: number): DrillPhase {
  return (
    DRILL_PHASES.find((phase) => phase.phaseNumber === phaseNumber) ??
    DRILL_PHASES[DEFAULT_DRILL_PHASE_NUMBER - 1]
  );
}

/** The phase after this one; the last phase wraps round to the first. */
export function nextDrillPhaseNumber(phaseNumber: number): number {
  return phaseNumber >= DRILL_PHASES.length ? 1 : phaseNumber + 1;
}

/**
 * Minutes between the first official bulletin and the first estimated arrival.
 * Zero means the official warning cannot reach the nearest coast in time —
 * which is why strong or long shaking at the coast is itself the warning.
 */
export function warningLeadMin(scenario: Pick<DrillScenario, 'evacuationWindowMin'>): number {
  return Math.max(0, scenario.evacuationWindowMin - PD1_LATENCY_MIN);
}

/**
 * Wall-clock instant (epoch ms) that corresponds to scenario T0, given when the
 * current phase came on screen.
 */
export function scenarioOriginMs(phase: Pick<DrillPhase, 'tPlusMin'>, phaseEnteredAtMs: number): number {
  return phaseEnteredAtMs - phase.tPlusMin * 60_000;
}

/**
 * Scenario time in seconds relative to the mainshock. It runs in real seconds
 * while a phase is on screen but never crosses into the next phase: a phase
 * left running stops one second short of the next one's start.
 */
export function scenarioSeconds(
  phase: Pick<DrillPhase, 'phaseNumber' | 'tPlusMin'>,
  phaseEnteredAtMs: number,
  nowMs: number
): number {
  const elapsed = Math.max(0, (nowMs - phaseEnteredAtMs) / 1000);
  const running = phase.tPlusMin * 60 + elapsed;
  const next = DRILL_PHASES.find((candidate) => candidate.phaseNumber === phase.phaseNumber + 1);
  return next ? Math.min(running, next.tPlusMin * 60 - 1) : running;
}

export interface ZoneArrival {
  zone: CoastalZoneEstimate;
  /** Milliseconds until the estimated first wave; zero or negative once it has passed. */
  remainingMs: number;
  /** The estimated arrival time has passed. Later waves can still be larger. */
  passed: boolean;
}

/** Arrival state of every zone at the given scenario time, earliest first. */
export function zoneArrivals(zones: CoastalZoneEstimate[], scenarioSec: number): ZoneArrival[] {
  return [...zones]
    .sort((a, b) => a.etaMin - b.etaMin)
    .map((zone) => {
      const remainingMs = (zone.etaMin * 60 - scenarioSec) * 1000;
      return { zone, remainingMs, passed: remainingMs <= 0 };
    });
}

/** The next zone still waiting for its first wave, or null once every estimate has passed. */
export function nextArrival(arrivals: ZoneArrival[]): ZoneArrival | null {
  return arrivals.find((arrival) => !arrival.passed) ?? null;
}

/**
 * An estimate is shown in whole minutes, never as a seconds countdown: "≈ 4 mnt",
 * "< 1 mnt", or "terlampaui" once the estimated time has passed.
 */
export function formatApproxMinutes(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'terlampaui';
  if (remainingMs < 60_000) return '< 1 mnt';
  return `≈ ${Math.ceil(remainingMs / 60_000)} mnt`;
}
