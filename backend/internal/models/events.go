package models

import (
	"encoding/json"
	"strings"
	"time"
)

// SeismicEvent represents an earthquake detection
type SeismicEvent struct {
	Type      string    `json:"type"`
	Magnitude float64   `json:"magnitude"`
	Depth     float64   `json:"depth"`
	Frequency float64   `json:"frequency"`
	Count     int       `json:"count"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	MMI       int       `json:"mmi"` // Modified Mercalli Intensity (I-XII)
	PGA       float64   `json:"pga"` // Peak Ground Acceleration (g)
	FaultZone string    `json:"fault_zone"`
	Timestamp time.Time `json:"timestamp"`
}

// StationEvent represents seismic station network data
type StationEvent struct {
	Type          string    `json:"type"`
	StationID     string    `json:"station_id"`
	StationName   string    `json:"station_name"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
	SignalQuality float64   `json:"signal_quality"` // 0-100%
	PWaveArrival  float64   `json:"p_wave_arrival"` // seconds since origin
	SWaveArrival  float64   `json:"s_wave_arrival"` // seconds since origin
	PGARecorded   float64   `json:"pga_recorded"`   // g
	Status        string    `json:"status"`         // ONLINE, OFFLINE, CLIPPED
	Timestamp     time.Time `json:"timestamp"`
}

// OceanEvent represents tsunami gauge / tide sensor data
type OceanEvent struct {
	Type                 string    `json:"type"`
	SensorID             string    `json:"sensor_id"`
	SeaLevel             float64   `json:"sea_level"`
	WaveHeight           float64   `json:"wave_height"`
	TsunamiSensorReading float64   `json:"tsunami_sensor_reading"`
	BuoyData             float64   `json:"buoy_data"`
	WaveETA              int       `json:"wave_eta"` // minutes to coast
	Latitude             float64   `json:"latitude"`
	Longitude            float64   `json:"longitude"`
	Timestamp            time.Time `json:"timestamp"`
}

// WeatherEvent represents meteorological data
type WeatherEvent struct {
	Type                string    `json:"type"`
	WindSpeed           float64   `json:"wind_speed"`
	WindDirection       string    `json:"wind_direction"`
	Rainfall            float64   `json:"rainfall"`
	AtmosphericPressure float64   `json:"atmospheric_pressure"`
	Temperature         float64   `json:"temperature"`
	Humidity            float64   `json:"humidity"`
	Anomaly             string    `json:"anomaly,omitempty"`
	AnomalySeverity     string    `json:"anomaly_severity,omitempty"`
	Timestamp           time.Time `json:"timestamp"`
}

// ClassifyWeatherAnomaly identifies a tornado-like wind/pressure signature.
// It is a screening signal only; confirmed tornado detection requires radar
// or an official meteorological warning.
func ClassifyWeatherAnomaly(event WeatherEvent) (string, string) {
	if event.WindSpeed >= 110 && event.AtmosphericPressure <= 995 {
		return "TORNADO WARNING PROXY", "CRITICAL"
	}
	if event.WindSpeed >= 90 && event.AtmosphericPressure <= 1000 {
		return "TORNADO WATCH PROXY", "HIGH"
	}
	return "", "LOW"
}

// SatelliteEvent represents satellite observation (InSAR, SAR)
type SatelliteEvent struct {
	Type               string    `json:"type"`
	GroundDisplacement float64   `json:"ground_displacement"` // cm
	Deformation        float64   `json:"deformation"`
	CoseismicSlip      float64   `json:"coseismic_slip"` // meters of fault slip
	SatelliteID        string    `json:"satellite_id"`
	Timestamp          time.Time `json:"timestamp"`
}

// InfrastructureEvent represents infrastructure impact data
type InfrastructureEvent struct {
	Type         string    `json:"type"`
	FacilityID   string    `json:"facility_id"`
	FacilityName string    `json:"facility_name"`
	FacilityType string    `json:"facility_type"` // BRIDGE, HOSPITAL, SCHOOL, PORT
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	DamageLevel  string    `json:"damage_level"` // NONE, MINOR, MODERATE, SEVERE, COLLAPSED
	Operational  bool      `json:"operational"`
	Timestamp    time.Time `json:"timestamp"`
}

// PopulationEvent represents population/evacuation data
type PopulationEvent struct {
	Type                  string    `json:"type"`
	Zone                  string    `json:"zone"`
	Population            int       `json:"population"`
	ShelterCapacity       int       `json:"shelter_capacity"`
	EvacuationRouteStatus string    `json:"evacuation_route_status"`
	EvacuationReadiness   float64   `json:"evacuation_readiness"`
	Timestamp             time.Time `json:"timestamp"`
}

// ActivityIndex represents the computed seismic intensity index
type ActivityIndex struct {
	OverallPercentage float64   `json:"overall_percentage"`
	SeismicChange     float64   `json:"seismic_change"`
	TremorChange      float64   `json:"tremor_change"`
	DeformationTrend  string    `json:"deformation_trend"`
	ThermalTrend      string    `json:"thermal_trend"`
	TrendDirection    string    `json:"trend_direction"`
	EarthquakeCount   int       `json:"earthquake_count"`
	AvgMagnitude      float64   `json:"avg_magnitude"`
	MaxMagnitude      float64   `json:"max_magnitude"`
	Timestamp         time.Time `json:"timestamp"`
}

// AgencyAction represents tactical recommendations broken down by responder agency
type AgencyAction struct {
	Agency   string `json:"agency"`   // BMKG, BNPB, BASARNAS, KEMENHUB
	Priority string `json:"priority"` // IMMEDIATE, URGENT, STANDBY
	Action   string `json:"action"`
}

// HazardDeepDive contains technical seismological assessments
type HazardDeepDive struct {
	FaultMechanism         string `json:"fault_mechanism"`          // e.g. Subduction Megathrust Thrust
	EstimatedCoseismicSlip string `json:"estimated_coseismic_slip"` // e.g. 5.2 meters
	AftershockRisk         string `json:"aftershock_risk"`          // e.g. HIGH (Probability M>6.5 in 48h: 78%)
	TsunamiRunupEstimate   string `json:"tsunami_runup_estimate"`   // e.g. 8 - 15 meters
	EvacuationWindowMin    int    `json:"evacuation_window_min"`    // Golden evacuation window
}

// AIAnalysis represents the AI intelligence layer output
type AIAnalysis struct {
	Status              string               `json:"status"`
	ThreatSummary       string               `json:"threat_summary,omitempty"`
	Observations        []string             `json:"observations"`
	Assessment          string               `json:"assessment"`
	Recommendations     []string             `json:"recommendations"`
	AgencyActions       []AgencyAction       `json:"agency_actions,omitempty"`
	HazardDetails       *HazardDeepDive      `json:"hazard_details,omitempty"`
	Confidence          float64              `json:"confidence"`
	LatencyMs           int64                `json:"latency_ms,omitempty"`
	ModelUsed           string               `json:"model_used,omitempty"`
	Disclaimer          string               `json:"disclaimer"`
	ContributingFactors []ContributingFactor `json:"contributing_factors"`
	Timestamp           time.Time            `json:"timestamp"`
}

// AIQuestionRequest represents an interactive question to Gemini Copilot
type AIQuestionRequest struct {
	Question string `json:"question"`
}

// AIQuestionResponse represents the reply from Gemini Copilot
type AIQuestionResponse struct {
	Answer    string    `json:"answer"`
	Model     string    `json:"model"`
	LatencyMs int64     `json:"latency_ms"`
	Timestamp time.Time `json:"timestamp"`
}

// ContributingFactor represents a single factor contributing to an alert
type ContributingFactor struct {
	Indicator    string  `json:"indicator"`
	Value        string  `json:"value"`
	Change       string  `json:"change"`
	Significance float64 `json:"significance"`
}

// TsunamiScenario represents a tsunami detection scenario
type TsunamiScenario struct {
	Active          bool      `json:"active"`
	DetectionTime   time.Time `json:"detection_time"`
	SensorID        string    `json:"sensor_id"`
	WaveAnomaly     float64   `json:"wave_anomaly"`
	AffectedZones   []string  `json:"affected_zones"`
	ResponseActions []string  `json:"response_actions"`
	Severity        string    `json:"severity"`
	Timestamp       time.Time `json:"timestamp"`
}

// UnmarshalJSON handles both JSON array and comma-separated string for affected_zones and response_actions
func (t *TsunamiScenario) UnmarshalJSON(data []byte) error {
	type Alias TsunamiScenario
	aux := &struct {
		AffectedZones   interface{} `json:"affected_zones"`
		ResponseActions interface{} `json:"response_actions"`
		*Alias
	}{
		Alias: (*Alias)(t),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	t.AffectedZones = parseStringOrSlice(aux.AffectedZones)
	t.ResponseActions = parseStringOrSlice(aux.ResponseActions)
	return nil
}

// CorrelatedAlert represents a multi-stream correlation alert
type CorrelatedAlert struct {
	AlertLevel           string    `json:"alert_level"`
	CorrelatedIndicators []string  `json:"correlated_indicators"`
	TimeWindow           string    `json:"time_window"`
	Description          string    `json:"description"`
	Timestamp            time.Time `json:"timestamp"`
}

// UnmarshalJSON handles both JSON array and string for correlated_indicators
func (c *CorrelatedAlert) UnmarshalJSON(data []byte) error {
	type Alias CorrelatedAlert
	aux := &struct {
		CorrelatedIndicators interface{} `json:"correlated_indicators"`
		*Alias
	}{
		Alias: (*Alias)(c),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	c.CorrelatedIndicators = parseStringOrSlice(aux.CorrelatedIndicators)
	return nil
}

func parseStringOrSlice(val interface{}) []string {
	if val == nil {
		return nil
	}
	var res []string
	switch v := val.(type) {
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok && s != "" {
				res = append(res, strings.TrimSpace(s))
			}
		}
	case []string:
		return v
	case string:
		if v != "" {
			parts := strings.Split(v, ",")
			if len(parts) == 1 {
				parts = strings.Fields(v)
			}
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					res = append(res, p)
				}
			}
		}
	}
	return res
}

// SystemStatus represents the overall system state
type SystemStatus struct {
	SeismicIntensity float64          `json:"seismic_intensity"`
	OceanStatus      string           `json:"ocean_status"`
	WeatherStatus    string           `json:"weather_status"`
	InfraStatus      string           `json:"infra_status"`
	ActiveAlerts     int              `json:"active_alerts"`
	RiskLevel        string           `json:"risk_level"`
	TrendDirection   string           `json:"trend_direction"`
	LastUpdate       time.Time        `json:"last_update"`
	TsunamiScenario  *TsunamiScenario `json:"tsunami_scenario,omitempty"`
	LatestAI         *AIAnalysis      `json:"latest_ai,omitempty"`
}

// GovernanceInfo represents data governance metadata for a topic
type GovernanceInfo struct {
	Topic          string `json:"topic"`
	Classification string `json:"classification"`
	PII            string `json:"pii"`
	SchemaVersion  string `json:"schema_version"`
	Owner          string `json:"owner"`
	Access         string `json:"access"`
}

// SSEMessage is a wrapper for SSE events
type SSEMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// LifecyclePhase describes the current real-time or simulation phase
type LifecyclePhase struct {
	PhaseNumber   int       `json:"phase_number"`
	PhaseName     string    `json:"phase_name"`
	PhaseTitle    string    `json:"phase_title"`
	ActivityLevel float64   `json:"activity_level"`
	DurationSec   int       `json:"duration_sec"`
	ElapsedSec    int       `json:"elapsed_sec"`
	SeismicEnergy float64   `json:"seismic_energy"`
	Status        string    `json:"status"`
	ScenarioName  string    `json:"scenario_name"`
	Magnitude     float64   `json:"magnitude"`
	Depth         float64   `json:"depth"`
	FaultZone     string    `json:"fault_zone"`
	MMI           int       `json:"mmi"`
	Latitude      float64   `json:"latitude,omitempty"`
	Longitude     float64   `json:"longitude,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

// ConnectorInfo represents a Confluent Cloud connector
type ConnectorInfo struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Status        string                 `json:"status"`
	Type          string                 `json:"type"`
	Class         string                 `json:"class"`
	Topic         string                 `json:"topic"`
	TasksActive   int                    `json:"tasks_active"`
	TasksMax      int                    `json:"tasks_max"`
	Throughput    string                 `json:"throughput"`
	TotalRecords  int64                  `json:"total_records"`
	LastHeartbeat time.Time              `json:"last_heartbeat"`
	Config        map[string]interface{} `json:"config,omitempty"`
}

// ConnectorActionRequest represents a connector management action
type ConnectorActionRequest struct {
	Action string `json:"action"` // pause, resume, restart
}

// ConnectorActionResponse represents the result of a connector action
type ConnectorActionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// WebhookAlertPayload represents an alert received from HttpSink connector
type WebhookAlertPayload struct {
	AlertLevel           string                 `json:"alert_level"`
	CorrelatedIndicators []string               `json:"correlated_indicators"`
	TimeWindow           string                 `json:"time_window"`
	Description          string                 `json:"description"`
	Timestamp            time.Time              `json:"timestamp"`
	Raw                  map[string]interface{} `json:"raw,omitempty"`
}

// ConfidenceBreakdown specifies the multi-factor evidence components (0-100 total)
type ConfidenceBreakdown struct {
	SeismicStations       int `json:"seismic_stations"`        // Max +35
	CrossAgencyAgreement int `json:"cross_agency_agreement"` // Max +20 (BMKG/USGS)
	SatelliteInSAR        int `json:"satellite_insar"`         // Max +15
	TsunamiBuoy           int `json:"tsunami_buoy"`            // Max +20
	InfrastructureSignal  int `json:"infrastructure_signal"`   // Max +10
}

// IncidentTimelineItem represents a chronological progression milestone
type IncidentTimelineItem struct {
	Time      string    `json:"time"`      // e.g. "09:41:02"
	Timestamp time.Time `json:"timestamp"` // exact event time
	Title     string    `json:"title"`     // e.g. "Earthquake detected"
	Detail    string    `json:"detail"`    // e.g. "M7.8 near South Java Trench"
	Source    string    `json:"source"`    // e.g. "gempa.seismic"
	Severity  string    `json:"severity"`  // "NORMAL", "ELEVATED", "HIGH", "CRITICAL"
}

// IncidentEvent represents the single evolving disaster state published to gempa.incidents
type IncidentEvent struct {
	IncidentID             string                 `json:"incident_id"`
	Hazard                 string                 `json:"hazard"`
	Magnitude              float64                `json:"magnitude"`
	Region                 string                 `json:"region"`
	Latitude               float64                `json:"latitude"`
	Longitude              float64                `json:"longitude"`
	Depth                  float64                `json:"depth"`
	RiskScore              int                    `json:"risk_score"`
	SeismicIntensity       string                 `json:"seismic_intensity"`
	TsunamiRisk            string                 `json:"tsunami_risk"`
	PopulationExposed      int                    `json:"population_exposed"`
	CriticalInfrastructure int                    `json:"critical_infrastructure"`
	RoadDisruptions        int                    `json:"road_disruptions"`
	Confidence             float64                `json:"confidence"` // 0.00 - 1.00 (e.g. 0.91)
	ConfidenceScore        int                    `json:"confidence_score"` // 0 - 100
	ConfidenceBreakdown    ConfidenceBreakdown    `json:"confidence_breakdown"`
	Status                 string                 `json:"status"`          // "MONITORING", "CONFIRMING", "ESCALATING", "CRITICAL", "STABILIZING"
	CascadingStage         string                 `json:"cascading_stage"` // "SEISMIC_TRIGGER", "INTENSITY_SPIKE", "SEABED_SLIP", "TSUNAMI_PROPAGATION", "COASTAL_IMPACT", "INFRASTRUCTURE_CRITICAL"
	Timeline               []IncidentTimelineItem `json:"timeline"`
	UpdatedAt              time.Time              `json:"updated_at"`
}

// IncidentResponseEvent represents tactical AI decision-support directives published to gempa.response
type IncidentResponseEvent struct {
	IncidentID  string    `json:"incident_id"`
	Priority    string    `json:"priority"` // "CRITICAL", "HIGH", "ELEVATED", "ADVISORY"
	Target      string    `json:"target"`   // "EMERGENCY_OPERATIONS", "BMKG", "BNPB", "BASARNAS", "KEMENHUB"
	Action      string    `json:"action"`   // "EVACUATION_ASSESSMENT", "COASTAL_SIREN_TRIGGER", etc.
	Reason      []string  `json:"reason"`
	GeneratedAt time.Time `json:"generated_at"`
	Confidence  float64   `json:"confidence"`
}

// ReplayStatus describes the current playback state of the disaster incident replay engine
type ReplayStatus struct {
	Active        bool      `json:"active"`
	ScenarioID    string    `json:"scenario_id"`
	ScenarioName  string    `json:"scenario_name"`
	Speed         int       `json:"speed"` // 1, 2, 5
	CurrentStep   int       `json:"current_step"`
	TotalSteps    int       `json:"total_steps"`
	ElapsedSec    int       `json:"elapsed_sec"`
	DurationSec   int       `json:"duration_sec"`
	StageName     string    `json:"stage_name"`
	LastEventTime string    `json:"last_event_time"`
	Timestamp     time.Time `json:"timestamp"`
}

