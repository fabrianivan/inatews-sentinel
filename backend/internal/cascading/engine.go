package cascading

import (
	"fmt"
	"math"
	"sync"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/kafka"
	"gempa-sentinel/internal/models"
)

// Engine correlates multi-stream events, computes dynamic confidence,
// tracks cascading disaster impacts, and publishes incident & response events.
type Engine struct {
	producer *kafka.Producer
	sse      *hub.SSEHub

	mu             sync.RWMutex
	activeIncident models.IncidentEvent
	history        []models.IncidentTimelineItem

	// Correlation state
	stationConfirmations int
	hasCrossAgency       bool
	hasSatelliteSlip     bool
	hasTsunamiAnomaly    bool
	infraImpactCount     int
	roadDisruptionCount  int
	exposedPopulation    int
	lastPGA              float64
	lastSlip             float64
	lastWaveHeight       float64
	activeStage          string

	// Response generation callback / throttler
	lastResponseTime time.Time
}

// NewEngine creates a new cascading impact & confidence engine
func NewEngine(producer *kafka.Producer, sse *hub.SSEHub) *Engine {
	e := &Engine{
		producer: producer,
		sse:      sse,
		history:  make([]models.IncidentTimelineItem, 0),
	}
	e.resetState(time.Now())
	return e
}

// resetState sets the baseline incident state
func (e *Engine) resetState(now time.Time) {
	baselineItem := models.IncidentTimelineItem{
		Time:      now.Format("15:04:05"),
		Timestamp: now,
		Title:     "System Standing Watch",
		Detail:    "Continuous multi-stream ingestion active across 7 BMKG/USGS topics",
		Source:    "gempa.seismic",
		Severity:  "NORMAL",
	}

	e.stationConfirmations = 0
	e.hasCrossAgency = false
	e.hasSatelliteSlip = false
	e.hasTsunamiAnomaly = false
	e.infraImpactCount = 0
	e.roadDisruptionCount = 0
	e.exposedPopulation = 0
	e.lastPGA = 0.005
	e.lastSlip = 0.0
	e.lastWaveHeight = 0.05
	e.activeStage = "SEISMIC_TRIGGER"

	e.history = []models.IncidentTimelineItem{baselineItem}

	e.activeIncident = models.IncidentEvent{
		IncidentID:             "INC-20260915-001",
		Hazard:                 "EARTHQUAKE",
		Magnitude:              3.8,
		Region:                 "Selat Sunda / South Java Trench",
		Latitude:               -9.15,
		Longitude:              109.52,
		Depth:                  15.0,
		RiskScore:              18,
		SeismicIntensity:       "II",
		TsunamiRisk:            "NONE",
		PopulationExposed:      0,
		CriticalInfrastructure: 0,
		RoadDisruptions:        0,
		Confidence:             0.40,
		ConfidenceScore:        40,
		ConfidenceBreakdown: models.ConfidenceBreakdown{
			SeismicStations:       20,
			CrossAgencyAgreement: 20,
			SatelliteInSAR:        0,
			TsunamiBuoy:           0,
			InfrastructureSignal:  0,
		},
		Status:         "MONITORING",
		CascadingStage: "SEISMIC_TRIGGER",
		Timeline:       e.history,
		UpdatedAt:      now,
	}
}

// Reset clears the cascading state back to baseline
func (e *Engine) Reset() {
	e.mu.Lock()
	e.resetState(time.Now())
	inc := e.activeIncident
	e.mu.Unlock()

	e.broadcastIncident(inc)
}

// GetActiveIncident returns current evolving incident state
func (e *Engine) GetActiveIncident() models.IncidentEvent {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.activeIncident
}

// GetEvolutionTimeline returns the chronological timeline items
func (e *Engine) GetEvolutionTimeline() []models.IncidentTimelineItem {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]models.IncidentTimelineItem, len(e.history))
	copy(result, e.history)
	return result
}

// SetIncident replaces active incident (useful for replay / drills)
func (e *Engine) SetIncident(inc models.IncidentEvent) {
	e.mu.Lock()
	e.activeIncident = inc
	e.history = inc.Timeline
	e.mu.Unlock()

	e.broadcastIncident(inc)
}

// OnSeismicEvent handles incoming earthquake detections
func (e *Engine) OnSeismicEvent(evt models.SeismicEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	e.activeIncident.Magnitude = math.Max(e.activeIncident.Magnitude, evt.Magnitude)
	if evt.FaultZone != "" {
		e.activeIncident.Region = evt.FaultZone
	}
	if evt.Latitude != 0 || evt.Longitude != 0 {
		e.activeIncident.Latitude = evt.Latitude
		e.activeIncident.Longitude = evt.Longitude
		e.activeIncident.Depth = evt.Depth
	}

	severity := "NORMAL"
	if evt.Magnitude >= 7.0 {
		severity = "CRITICAL"
		e.activeIncident.Status = "ESCALATING"
		e.activeIncident.RiskScore = int(math.Min(100, float64(e.activeIncident.RiskScore+40)))
	} else if evt.Magnitude >= 5.5 {
		severity = "HIGH"
		e.activeIncident.Status = "CONFIRMING"
		e.activeIncident.RiskScore = int(math.Min(100, float64(e.activeIncident.RiskScore+20)))
	}

	timeStr := now.Format("15:04:05")
	if !evt.Timestamp.IsZero() {
		timeStr = evt.Timestamp.Format("15:04:05")
	}

	item := models.IncidentTimelineItem{
		Time:      timeStr,
		Timestamp: now,
		Title:     fmt.Sprintf("Earthquake Detected M%.1f", evt.Magnitude),
		Detail:    fmt.Sprintf("Hypocenter depth %.1f km at %s", evt.Depth, evt.FaultZone),
		Source:    config.TopicNames.Seismic,
		Severity:  severity,
	}

	e.appendTimeline(item)
	e.recalculateConfidence(now)
}

// OnStationEvent handles broadband station telemetry
func (e *Engine) OnStationEvent(evt models.StationEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	if evt.PGARecorded > 0.05 {
		e.stationConfirmations++
		e.lastPGA = math.Max(e.lastPGA, evt.PGARecorded)

		if e.stationConfirmations == 1 || e.stationConfirmations == 4 {
			timeStr := now.Format("15:04:05")
			item := models.IncidentTimelineItem{
				Time:      timeStr,
				Timestamp: now,
				Title:     fmt.Sprintf("%d Stations Confirmed P/S Wave", e.stationConfirmations),
				Detail:    fmt.Sprintf("Station %s recorded PGA %.3fg (Signal quality %.0f%%)", evt.StationName, evt.PGARecorded, evt.SignalQuality),
				Source:    config.TopicNames.Activity,
				Severity:  "HIGH",
			}
			e.appendTimeline(item)
			e.activeStage = "STATION_CONFIRMED"
		}
	}

	e.recalculateConfidence(now)
}

// OnSatelliteEvent handles InSAR surface deformation / coseismic slip
func (e *Engine) OnSatelliteEvent(evt models.SatelliteEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	if evt.CoseismicSlip >= 0.5 {
		e.hasSatelliteSlip = true
		e.lastSlip = evt.CoseismicSlip

		timeStr := now.Format("15:04:05")
		item := models.IncidentTimelineItem{
			Time:      timeStr,
			Timestamp: now,
			Title:     "InSAR Fault Rupture & Seabed Slip Confirmed",
			Detail:    fmt.Sprintf("Satellite %s detected coseismic displacement of %.1fm", evt.SatelliteID, evt.CoseismicSlip),
			Source:    config.TopicNames.Satellite,
			Severity:  "HIGH",
		}
		e.appendTimeline(item)
		e.activeStage = "SEABED_SLIP"
	}

	e.recalculateConfidence(now)
}

// OnOceanEvent handles DART buoy and tide gauge telemetry
func (e *Engine) OnOceanEvent(evt models.OceanEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	if evt.WaveHeight >= 1.0 || evt.TsunamiSensorReading >= 1.0 {
		e.hasTsunamiAnomaly = true
		e.lastWaveHeight = math.Max(e.lastWaveHeight, evt.WaveHeight)
		e.activeIncident.TsunamiRisk = "HIGH"

		timeStr := now.Format("15:04:05")
		item := models.IncidentTimelineItem{
			Time:      timeStr,
			Timestamp: now,
			Title:     fmt.Sprintf("Tsunami Wave Anomaly Confirmed (%.1fm)", evt.WaveHeight),
			Detail:    fmt.Sprintf("Sensor %s recorded ocean surge with ETA %d min to coast", evt.SensorID, evt.WaveETA),
			Source:    config.TopicNames.Ocean,
			Severity:  "CRITICAL",
		}
		e.appendTimeline(item)
		e.activeStage = "TSUNAMI_PROPAGATION"
		e.activeIncident.Status = "ESCALATING"
	}

	e.recalculateConfidence(now)
}

// OnTsunamiScenario handles Flink CEP tsunami propagation scenarios
func (e *Engine) OnTsunamiScenario(ts models.TsunamiScenario) {
	if !ts.Active {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	e.hasTsunamiAnomaly = true
	e.lastWaveHeight = math.Max(e.lastWaveHeight, ts.WaveAnomaly)
	e.activeIncident.TsunamiRisk = "CRITICAL"
	e.activeIncident.Status = "CRITICAL"

	timeStr := now.Format("15:04:05")
	item := models.IncidentTimelineItem{
		Time:      timeStr,
		Timestamp: now,
		Title:     fmt.Sprintf("Tsunami Propagation Alert (%s, %.1fm)", ts.SensorID, ts.WaveAnomaly),
		Detail:    fmt.Sprintf("Zones affected: %v", ts.AffectedZones),
		Source:    config.TopicNames.TsunamiScenarios,
		Severity:  "CRITICAL",
	}
	e.appendTimeline(item)
	e.activeStage = "TSUNAMI_PROPAGATION"

	e.recalculateConfidence(now)
}

// OnPopulationEvent handles civil protection and evacuation corridor readiness
func (e *Engine) OnPopulationEvent(evt models.PopulationEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	e.exposedPopulation += evt.Population
	e.activeIncident.PopulationExposed = e.exposedPopulation

	timeStr := now.Format("15:04:05")
	item := models.IncidentTimelineItem{
		Time:      timeStr,
		Timestamp: now,
		Title:     "Coastal Population Exposure Escalated",
		Detail:    fmt.Sprintf("Zone %s: %d residents at risk. Route status: %s", evt.Zone, evt.Population, evt.EvacuationRouteStatus),
		Source:    config.TopicNames.Population,
		Severity:  "CRITICAL",
	}
	e.appendTimeline(item)
	e.activeStage = "COASTAL_IMPACT"

	e.recalculateConfidence(now)
}

// OnInfrastructureEvent handles critical facility damage / disruptions
func (e *Engine) OnInfrastructureEvent(evt models.InfrastructureEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	e.infraImpactCount++
	if evt.DamageLevel == "SEVERE" || evt.DamageLevel == "COLLAPSED" || !evt.Operational {
		e.roadDisruptionCount++
	}
	e.activeIncident.CriticalInfrastructure = e.infraImpactCount
	e.activeIncident.RoadDisruptions = e.roadDisruptionCount

	if e.infraImpactCount == 1 || e.infraImpactCount%5 == 0 {
		timeStr := now.Format("15:04:05")
		item := models.IncidentTimelineItem{
			Time:      timeStr,
			Timestamp: now,
			Title:     fmt.Sprintf("Critical Infrastructure Impact (%s)", evt.FacilityName),
			Detail:    fmt.Sprintf("%s damage level: %s (Operational: %v)", evt.FacilityType, evt.DamageLevel, evt.Operational),
			Source:    config.TopicNames.Maritime,
			Severity:  "HIGH",
		}
		e.appendTimeline(item)
		e.activeStage = "INFRASTRUCTURE_CRITICAL"
	}

	e.recalculateConfidence(now)
}

// OnActivityIndex handles Flink CEP computed national seismic intensity
func (e *Engine) OnActivityIndex(idx models.ActivityIndex) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	mmi := mmiRoman(idx.MaxMagnitude)
	e.activeIncident.SeismicIntensity = mmi
	if idx.MaxMagnitude > 0 {
		e.activeIncident.Magnitude = math.Max(e.activeIncident.Magnitude, idx.MaxMagnitude)
	}

	if idx.OverallPercentage >= 60 {
		timeStr := now.Format("15:04:05")
		item := models.IncidentTimelineItem{
			Time:      timeStr,
			Timestamp: now,
			Title:     fmt.Sprintf("MMI %s Intensity Calculated", mmi),
			Detail:    fmt.Sprintf("Flink intensity surge %.1f%% (Trend: %s)", idx.OverallPercentage, idx.TrendDirection),
			Source:    config.TopicNames.ActivityIndex,
			Severity:  "HIGH",
		}
		e.appendTimeline(item)
		e.activeStage = "INTENSITY_SPIKE"
	}

	e.recalculateConfidence(now)
}

// recalculateConfidence updates the 0-100 score and triggers response when needed
func (e *Engine) recalculateConfidence(now time.Time) {
	breakdown := models.ConfidenceBreakdown{}

	// 1. Seismic stations (+35 max)
	if e.stationConfirmations >= 4 {
		breakdown.SeismicStations = 35
	} else if e.stationConfirmations >= 2 {
		breakdown.SeismicStations = 25
	} else if e.stationConfirmations >= 1 {
		breakdown.SeismicStations = 15
	} else {
		breakdown.SeismicStations = 10
	}

	// 2. Cross-agency agreement (+20 max)
	if e.activeIncident.Magnitude >= 5.0 {
		breakdown.CrossAgencyAgreement = 20
	} else {
		breakdown.CrossAgencyAgreement = 10
	}

	// 3. Satellite InSAR displacement (+15 max)
	if e.hasSatelliteSlip {
		breakdown.SatelliteInSAR = 15
	} else if e.activeIncident.Magnitude >= 7.0 {
		breakdown.SatelliteInSAR = 8
	}

	// 4. Tsunami buoy sensor (+20 max)
	if e.hasTsunamiAnomaly {
		breakdown.TsunamiBuoy = 20
	} else if e.activeIncident.TsunamiRisk == "HIGH" {
		breakdown.TsunamiBuoy = 12
	}

	// 5. Infrastructure signal (+10 max)
	if e.infraImpactCount >= 10 {
		breakdown.InfrastructureSignal = 10
	} else if e.infraImpactCount >= 1 {
		breakdown.InfrastructureSignal = 5
	}

	totalScore := breakdown.SeismicStations + breakdown.CrossAgencyAgreement + breakdown.SatelliteInSAR + breakdown.TsunamiBuoy + breakdown.InfrastructureSignal
	if totalScore > 100 {
		totalScore = 100
	}

	e.activeIncident.ConfidenceScore = totalScore
	e.activeIncident.Confidence = float64(totalScore) / 100.0
	e.activeIncident.ConfidenceBreakdown = breakdown
	e.activeIncident.CascadingStage = e.activeStage
	e.activeIncident.Timeline = e.history
	e.activeIncident.UpdatedAt = now

	// Escalate status
	if totalScore >= 80 || e.activeIncident.Magnitude >= 7.5 || e.hasTsunamiAnomaly {
		e.activeIncident.Status = "CRITICAL"
		e.activeIncident.RiskScore = int(math.Max(float64(e.activeIncident.RiskScore), 88))
	} else if totalScore >= 55 || e.activeIncident.Magnitude >= 6.0 {
		e.activeIncident.Status = "ESCALATING"
		e.activeIncident.RiskScore = int(math.Max(float64(e.activeIncident.RiskScore), 65))
	}

	inc := e.activeIncident
	go e.broadcastIncident(inc)

	// Check if we should dispatch response event
	if (inc.Status == "CRITICAL" || inc.Status == "ESCALATING") && now.Sub(e.lastResponseTime) > 10*time.Second {
		e.lastResponseTime = now
		go e.dispatchResponseEvent(inc)
	}
}

func (e *Engine) appendTimeline(item models.IncidentTimelineItem) {
	e.history = append(e.history, item)
	if len(e.history) > 50 {
		e.history = e.history[len(e.history)-50:]
	}
	e.activeIncident.Timeline = e.history

	if e.sse != nil {
		e.sse.BroadcastAll("incident_timeline", item)
	}
}

func (e *Engine) broadcastIncident(inc models.IncidentEvent) {
	if e.sse != nil {
		e.sse.BroadcastAll("incident_update", inc)
	}

	if e.producer != nil {
		_ = e.producer.Produce(config.TopicNames.Incidents, inc.IncidentID, inc)
	}
}

func (e *Engine) dispatchResponseEvent(inc models.IncidentEvent) {
	reasons := []string{
		fmt.Sprintf("Magnitude M%.1f with MMI %s seismic intensity", inc.Magnitude, inc.SeismicIntensity),
	}
	if inc.TsunamiRisk == "HIGH" || inc.TsunamiRisk == "CRITICAL" {
		reasons = append(reasons, "Tsunami wave anomaly confirmed by ocean buoy sensors")
	}
	if inc.PopulationExposed > 0 {
		reasons = append(reasons, fmt.Sprintf("High coastal population exposure: %s residents", formatPop(inc.PopulationExposed)))
	}
	if inc.CriticalInfrastructure > 0 {
		reasons = append(reasons, fmt.Sprintf("%d critical facilities reporting operational disruption", inc.CriticalInfrastructure))
	}

	resp := models.IncidentResponseEvent{
		IncidentID:  inc.IncidentID,
		Priority:    "CRITICAL",
		Target:      "EMERGENCY_OPERATIONS",
		Action:      "EVACUATION_ASSESSMENT",
		Reason:      reasons,
		GeneratedAt: time.Now(),
		Confidence:  inc.Confidence,
	}

	if e.sse != nil {
		e.sse.BroadcastAll("incident_response", resp)
	}

	if e.producer != nil {
		_ = e.producer.Produce(config.TopicNames.Response, inc.IncidentID, resp)
	}
}

func mmiRoman(mag float64) string {
	switch {
	case mag >= 8.5:
		return "X"
	case mag >= 8.0:
		return "IX"
	case mag >= 7.5:
		return "VIII"
	case mag >= 7.0:
		return "VII"
	case mag >= 6.0:
		return "VI"
	case mag >= 5.0:
		return "V"
	case mag >= 4.0:
		return "IV"
	case mag >= 3.0:
		return "III"
	default:
		return "II"
	}
}

func formatPop(pop int) string {
	if pop >= 1000000 {
		return fmt.Sprintf("%.2fM", float64(pop)/1000000.0)
	}
	if pop >= 1000 {
		return fmt.Sprintf("%dk", pop/1000)
	}
	return fmt.Sprintf("%d", pop)
}
