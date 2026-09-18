export interface SeismicEvent {
  type: 'SEISMIC';
  magnitude: number;
  depth: number;
  frequency: number;
  count: number;
  latitude: number;
  longitude: number;
  mmi: number;
  pga: number;
  fault_zone: string;
  timestamp: string;
  url?: string;
  status?: string;
  tsunami?: number;
}

export interface StationEvent {
  type: 'STATION';
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
  signal_quality: number;
  p_wave_arrival: number;
  s_wave_arrival: number;
  pga_recorded: number;
  status: 'ONLINE' | 'OFFLINE' | 'CLIPPED';
  timestamp: string;
}

export interface OceanEvent {
  type: 'OCEAN';
  sensor_id: string;
  sea_level: number;
  wave_height: number;
  tsunami_sensor_reading: number;
  buoy_data: number;
  wave_eta: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface WeatherEvent {
  type: 'WEATHER';
  wind_speed: number;
  wind_direction: string;
  rainfall: number;
  atmospheric_pressure: number;
  temperature: number;
  humidity: number;
  timestamp: string;
}

export interface SatelliteEvent {
  type: 'SATELLITE';
  ground_displacement: number;
  deformation: number;
  coseismic_slip: number;
  satellite_id: string;
  timestamp: string;
}

export interface InfrastructureEvent {
  type: 'INFRASTRUCTURE';
  facility_id: string;
  facility_name: string;
  facility_type: string;
  latitude: number;
  longitude: number;
  damage_level: string;
  operational: boolean;
  timestamp: string;
}

export interface PopulationEvent {
  type: 'POPULATION';
  zone: string;
  population: number;
  shelter_capacity: number;
  evacuation_route_status: string;
  evacuation_readiness: number;
  timestamp: string;
}

export interface ActivityIndex {
  overall_percentage: number;
  seismic_change: number;
  tremor_change: number;
  deformation_trend: string;
  thermal_trend: string;
  trend_direction: string;
  earthquake_count: number;
  avg_magnitude: number;
  max_magnitude: number;
  timestamp: string;
}

export interface ContributingFactor {
  indicator: string;
  value: string;
  change: string;
  significance: number;
}

export interface AgencyAction {
  agency: string;
  priority: string;
  action: string;
}

export interface HazardDeepDive {
  fault_mechanism: string;
  estimated_coseismic_slip: string;
  aftershock_risk: string;
  tsunami_runup_estimate: string;
  evacuation_window_min: number;
}

export interface AIAnalysis {
  status: string;
  threat_summary?: string;
  observations: string[];
  assessment: string;
  recommendations: string[];
  agency_actions?: AgencyAction[];
  hazard_details?: HazardDeepDive;
  confidence: number;
  latency_ms?: number;
  model_used?: string;
  disclaimer: string;
  contributing_factors: ContributingFactor[];
  timestamp: string;
}

export interface TsunamiAffectedZoneDetail {
  zone: string;
  province: string;
  estimated_eta: string;
  estimated_wave_height: string;
  status: 'AWAS' | 'SIAGA' | 'WASPADA';
  inundation_depth: string;
  population_at_risk: string;
  safe_elevation: string;
  coords?: [number, number];
  polygon?: [number, number][];
}

export interface InfrastructureDamageDetail {
  facility: string;
  type: string;
  location: string;
  damage_level: 'HEAVY' | 'MODERATE' | 'LIGHT';
  loss_estimate: string;
  operational_status: string;
  critical_action: string;
  coords?: [number, number];
  icon?: string;
}

export interface TsunamiScenario {
  active: boolean;
  detection_time: string;
  sensor_id: string;
  wave_anomaly: number;
  affected_zones: string[];
  response_actions: string[];
  severity: string;
  timestamp: string;
  affected_zone_details?: TsunamiAffectedZoneDetail[];
  infrastructure_impacts?: InfrastructureDamageDetail[];
}

export interface SystemStatus {
  seismic_intensity: number;
  ocean_status: string;
  weather_status: string;
  infra_status: string;
  active_alerts: number;
  risk_level: string;
  trend_direction: string;
  last_update: string;
  tsunami_scenario?: TsunamiScenario;
  latest_ai?: AIAnalysis;
}

export interface LiveEvent {
  id: string;
  type: string;
  description: string;
  severity: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface GovernanceInfo {
  topic: string;
  classification: string;
  pii: string;
  schema_version: string;
  owner: string;
  access: string;
}

export interface SSEMessage {
  event: string;
  data: unknown;
}

export interface LifecyclePhase {
  phase_number: number;
  phase_name: string;
  phase_title: string;
  activity_level: number;
  duration_sec: number;
  elapsed_sec: number;
  seismic_energy: number;
  status: string;
  scenario_name?: string;
  magnitude?: number;
  depth?: number;
  fault_zone?: string;
  mmi?: number;
  latitude?: number;
  longitude?: number;
  timestamp: string;
}

export interface BMKGGempaDetail {
  Tanggal: string;
  Jam: string;
  DateTime: string;
  Coordinates: string;
  Lintang: string;
  Bujur: string;
  Magnitude: string;
  Kedalaman: string;
  Wilayah: string;
  Potensi: string;
  Dirasakan?: string;
  Shakemap?: string;
}

export interface RealtimeEarthquakesData {
  latest_bmkg: BMKGGempaDetail | null;
  recent_bmkg: SeismicEvent[];
  recent_usgs: SeismicEvent[];
  timestamp: string;
}

export interface VolcanoEruption {
  id: string;
  volcano_name: string;
  time: string;
  date: string;
  description: string;
  amplitude: string;
  duration: string;
  visual_ash: string;
  image_url?: string;
  detail_url?: string;
  author: string;
  alert_level: string;
  recommendation: string;
  timestamp: string;
}

export interface AgentThought {
  cycle_id: number;
  phase: 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT';
  message: string;
  severity: string;
  timestamp: string;
}

export interface AgentTacticalAction {
  id: string;
  type: string;
  agency: string;
  target_zone: string;
  priority: string;
  rationale: string;
  timestamp: string;
}

export interface AgentState {
  status: string;
  active_provider: string;
  active_model: string;
  total_cycles: number;
  last_evaluated_at: string;
  current_risk: string;
  latest_intensity?: ActivityIndex;
  recent_thoughts: AgentThought[];
  recent_actions: AgentTacticalAction[];
}

export interface ConfidenceBreakdown {
  seismic_stations: number;        // Max +35
  cross_agency_agreement: number; // Max +20
  satellite_insar: number;         // Max +15
  tsunami_buoy: number;            // Max +20
  infrastructure_signal: number;   // Max +10
}

export interface IncidentTimelineItem {
  time: string;
  timestamp: string;
  title: string;
  detail: string;
  source: string;
  severity: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

export interface IncidentEvent {
  incident_id: string;
  hazard: string;
  magnitude: number;
  region: string;
  latitude?: number;
  longitude?: number;
  depth?: number;
  risk_score: number;
  seismic_intensity: string;
  tsunami_risk: string;
  population_exposed: number;
  critical_infrastructure: number;
  road_disruptions: number;
  confidence: number;
  confidence_score: number;
  confidence_breakdown: ConfidenceBreakdown;
  status: 'MONITORING' | 'CONFIRMING' | 'ESCALATING' | 'CRITICAL' | 'STABILIZING';
  cascading_stage: string;
  timeline: IncidentTimelineItem[];
  updated_at: string;
}

export interface IncidentResponseEvent {
  incident_id: string;
  priority: string;
  target: string;
  action: string;
  reason: string[];
  generated_at: string;
  confidence: number;
}

export interface ReplayStatus {
  active: boolean;
  scenario_id: string;
  scenario_name: string;
  speed: number;
  current_step: number;
  total_steps: number;
  elapsed_sec: number;
  duration_sec: number;
  stage_name: string;
  last_event_time: string;
  timestamp: string;
}

