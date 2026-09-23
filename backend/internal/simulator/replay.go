package simulator

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"gempa-sentinel/internal/cascading"
	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/kafka"
	"gempa-sentinel/internal/models"
)

// ReplayScenario defines a full cascading disaster scenario for simulation replay
type ReplayScenario struct {
	ID                     string
	Name                   string
	Description            string
	Magnitude              float64
	Depth                  float64
	EpicenterLat           float64
	EpicenterLon           float64
	Region                 string
	MMI                    string
	TsunamiWave            float64
	SeismicSlip            float64
	PopulationExposed      int
	CriticalInfrastructure int
	RoadDisruptions        int
}

var ReplayScenarios = []ReplayScenario{
	{
		ID:                     "south-java-m78",
		Name:                   "Megathrust Selatan Jawa (M7.8)",
		Description:            "Java Trench Subduction rupture triggering severe ground acceleration, seabed displacement, tsunami propagation, and coastal infrastructure disruption.",
		Magnitude:              7.8,
		Depth:                  15.0,
		EpicenterLat:           -9.15,
		EpicenterLon:           109.52,
		Region:                 "Java Trench (Cilacap - Pangandaran - Pacitan)",
		MMI:                    "VII",
		TsunamiWave:            4.5,
		SeismicSlip:            2.4,
		PopulationExposed:      1842000,
		CriticalInfrastructure: 37,
		RoadDisruptions:        12,
	},
	{
		ID:                     "sunda-strait-m82",
		Name:                   "Megathrust Selat Sunda (M8.2)",
		Description:            "Sunda Strait Subduction megathrust with catastrophic 8-12m tsunami wave front toward Banten and Lampung coasts.",
		Magnitude:              8.2,
		Depth:                  22.0,
		EpicenterLat:           -6.82,
		EpicenterLon:           105.25,
		Region:                 "Selat Sunda / Banten & Lampung",
		MMI:                    "VIII",
		TsunamiWave:            8.2,
		SeismicSlip:            3.8,
		PopulationExposed:      2450000,
		CriticalInfrastructure: 54,
		RoadDisruptions:        26,
	},
	{
		ID:                     "palu-m75",
		Name:                   "Palu-Koro Rupture & Landslide Tsunami (M7.5)",
		Description:            "Central Sulawesi strike-slip rupture causing massive liquefaction (Petobo/Balaroa) and submarine landslide bay tsunami.",
		Magnitude:              7.5,
		Depth:                  10.0,
		EpicenterLat:           -0.89,
		EpicenterLon:           119.85,
		Region:                 "Palu Bay / Central Sulawesi",
		MMI:                    "VIII",
		TsunamiWave:            6.0,
		SeismicSlip:            4.5,
		PopulationExposed:      820000,
		CriticalInfrastructure: 41,
		RoadDisruptions:        31,
	},
}

// ReplayManager orchestrates the sequential injection of cascading disaster events
type ReplayManager struct {
	producer *kafka.Producer
	sse      *hub.SSEHub
	cascade  *cascading.Engine

	mu          sync.RWMutex
	status      models.ReplayStatus
	cancelFunc  context.CancelFunc
	currentScen *ReplayScenario
	isPaused    bool
}

// NewReplayManager creates a new incident replay manager
func NewReplayManager(prod *kafka.Producer, sse *hub.SSEHub, cas *cascading.Engine) *ReplayManager {
	return &ReplayManager{
		producer: prod,
		sse:      sse,
		cascade:  cas,
		status: models.ReplayStatus{
			Active:        false,
			ScenarioID:    ReplayScenarios[0].ID,
			ScenarioName:  ReplayScenarios[0].Name,
			Speed:         1,
			CurrentStep:   0,
			TotalSteps:    8,
			ElapsedSec:    0,
			DurationSec:   30,
			StageName:     "STANDBY",
			LastEventTime: "LIVE",
			Timestamp:     time.Now(),
		},
		currentScen: &ReplayScenarios[0],
	}
}

// GetStatus returns the current replay status
func (rm *ReplayManager) GetStatus() models.ReplayStatus {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.status
}

// Start begins a fresh replay of a given scenario
func (rm *ReplayManager) Start(scenarioID string, speed int) error {
	rm.mu.Lock()
	if rm.cancelFunc != nil {
		rm.cancelFunc()
	}

	var target *ReplayScenario
	for i := range ReplayScenarios {
		if ReplayScenarios[i].ID == scenarioID {
			target = &ReplayScenarios[i]
			break
		}
	}
	if target == nil {
		target = &ReplayScenarios[0]
	}

	if speed <= 0 {
		speed = 1
	} else if speed > 5 {
		speed = 5
	}

	rm.currentScen = target
	rm.isPaused = false

	ctx, cancel := context.WithCancel(context.Background())
	rm.cancelFunc = cancel

	rm.status = models.ReplayStatus{
		Active:        true,
		ScenarioID:    target.ID,
		ScenarioName:  target.Name,
		Speed:         speed,
		CurrentStep:   0,
		TotalSteps:    8,
		ElapsedSec:    0,
		DurationSec:   30 / speed,
		StageName:     "INITIALIZING",
		LastEventTime: time.Now().Format("15:04:05"),
		Timestamp:     time.Now(),
	}
	rm.mu.Unlock()

	rm.broadcastStatus()
	go rm.runReplayLoop(ctx, target, speed)

	log.Printf("[INFO] Disaster Incident Replay started: %s (Speed: %dx)", target.Name, speed)
	return nil
}

// Pause pauses the current replay
func (rm *ReplayManager) Pause() {
	rm.mu.Lock()
	rm.isPaused = true
	rm.status.StageName = "PAUSED"
	rm.status.Timestamp = time.Now()
	rm.mu.Unlock()

	rm.broadcastStatus()
	log.Println("[INFO] Incident Replay paused")
}

// Resume resumes a paused replay
func (rm *ReplayManager) Resume() {
	rm.mu.Lock()
	rm.isPaused = false
	rm.status.StageName = "PLAYING"
	rm.status.Timestamp = time.Now()
	rm.mu.Unlock()

	rm.broadcastStatus()
	log.Println("[INFO] Incident Replay resumed")
}

// Reset stops the replay and resets cascading engine
func (rm *ReplayManager) Reset() {
	rm.mu.Lock()
	if rm.cancelFunc != nil {
		rm.cancelFunc()
		rm.cancelFunc = nil
	}
	rm.isPaused = false
	scen := rm.currentScen
	if scen == nil {
		scen = &ReplayScenarios[0]
	}
	rm.status = models.ReplayStatus{
		Active:        false,
		ScenarioID:    scen.ID,
		ScenarioName:  scen.Name,
		Speed:         1,
		CurrentStep:   0,
		TotalSteps:    8,
		ElapsedSec:    0,
		DurationSec:   30,
		StageName:     "STANDBY",
		LastEventTime: time.Now().Format("15:04:05"),
		Timestamp:     time.Now(),
	}
	rm.mu.Unlock()

	if rm.cascade != nil {
		rm.cascade.Reset()
	}

	rm.broadcastStatus()
	log.Println("[INFO] Incident Replay reset to baseline")
}

// Step manually executes the next step in the cascade
func (rm *ReplayManager) Step() {
	rm.mu.Lock()
	step := rm.status.CurrentStep + 1
	if step > 8 {
		step = 8
	}
	scen := rm.currentScen
	if scen == nil {
		scen = &ReplayScenarios[0]
	}
	rm.status.CurrentStep = step
	rm.status.Active = true
	rm.mu.Unlock()

	rm.executeStep(step, scen)
	rm.broadcastStatus()
}

func (rm *ReplayManager) runReplayLoop(ctx context.Context, scen *ReplayScenario, speed int) {
	stepInterval := time.Duration(3500/speed) * time.Millisecond
	ticker := time.NewTicker(stepInterval)
	defer ticker.Stop()

	for step := 1; step <= 8; step++ {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rm.mu.RLock()
			paused := rm.isPaused
			rm.mu.RUnlock()

			for paused {
				select {
				case <-ctx.Done():
					return
				case <-time.After(500 * time.Millisecond):
					rm.mu.RLock()
					paused = rm.isPaused
					rm.mu.RUnlock()
				}
			}

			rm.mu.Lock()
			rm.status.CurrentStep = step
			rm.status.ElapsedSec = step * (4 / speed)
			rm.status.Timestamp = time.Now()
			rm.mu.Unlock()

			rm.executeStep(step, scen)
			rm.broadcastStatus()
		}
	}

	rm.mu.Lock()
	rm.status.StageName = "COMPLETED (CRITICAL RESPONSE DISPATCHED)"
	rm.status.Active = false
	rm.status.Timestamp = time.Now()
	rm.mu.Unlock()

	rm.broadcastStatus()
	log.Printf("[INFO] Disaster Incident Replay completed for %s", scen.Name)
}

func (rm *ReplayManager) executeStep(step int, scen *ReplayScenario) {
	now := time.Now()
	nowStr := now.Format("15:04:05")

	switch step {
	case 1:
		// Step 1: Earthquake detected (gempa.seismic)
		seismicEvt := models.SeismicEvent{
			Type:      "SEISMIC",
			Magnitude: scen.Magnitude,
			Depth:     scen.Depth,
			Frequency: 4.2,
			Count:     1,
			Latitude:  scen.EpicenterLat,
			Longitude: scen.EpicenterLon,
			MMI:       7,
			PGA:       0.72,
			FaultZone: scen.Region,
			Timestamp: now,
		}
		if rm.cascade != nil {
			rm.cascade.OnSeismicEvent(seismicEvt)
		}
		rm.emitKafkaAndSSE(config.TopicNames.Seismic, "SEISMIC", fmt.Sprintf("EARTHQUAKE DETECTED: M%.1f near %s (Depth: %.1f km)", scen.Magnitude, scen.Region, scen.Depth), "CRITICAL", seismicEvt)
		rm.updateStage("EARTHQUAKE_DETECTED", nowStr)

	case 2:
		// Step 2: Stations confirm P/S waves (gempa.stations)
		stations := []struct {
			id, name string
			pga      float64
		}{
			{"LEM", "Lembang Broadband", 0.68},
			{"YOGI", "Yogyakarta Geodetic", 0.74},
			{"JATS", "Jatiluhur Seismometer", 0.59},
			{"CBJI", "Cibinong Station", 0.62},
		}
		for _, s := range stations {
			stnEvt := models.StationEvent{
				Type:          "STATION",
				StationID:     s.id,
				StationName:   s.name,
				Latitude:      scen.EpicenterLat + 0.5,
				Longitude:     scen.EpicenterLon + 0.4,
				SignalQuality: 99.4,
				PWaveArrival:  4.2,
				SWaveArrival:  11.8,
				PGARecorded:   s.pga,
				Status:        "ONLINE",
				Timestamp:     now,
			}
			if rm.cascade != nil {
				rm.cascade.OnStationEvent(stnEvt)
			}
			rm.emitKafkaAndSSE(config.TopicNames.Activity, "STATION", fmt.Sprintf("Station %s confirmed P/S wave arrival (PGA: %.3fg)", s.name, s.pga), "HIGH", stnEvt)
		}
		rm.updateStage("4_STATIONS_CONFIRMED", nowStr)

	case 3:
		// Step 3: Seismic Intensity Calculated (gempa.intensity_index)
		actIdx := models.ActivityIndex{
			OverallPercentage: 86.0,
			SeismicChange:     45.0,
			TremorChange:      78.0,
			DeformationTrend:  "SEVERE_UPLIFT",
			TrendDirection:    "CASCADING_RUPTURE",
			EarthquakeCount:   18,
			AvgMagnitude:      scen.Magnitude - 1.2,
			MaxMagnitude:      scen.Magnitude,
			Timestamp:         now,
		}
		if rm.cascade != nil {
			rm.cascade.OnActivityIndex(actIdx)
		}
		rm.emitKafkaAndSSE(config.TopicNames.ActivityIndex, "INTENSITY", fmt.Sprintf("Flink CEP: Seismic Intensity surge %.1f%% (MMI %s)", actIdx.OverallPercentage, scen.MMI), "HIGH", actIdx)
		rm.updateStage("INTENSITY_MMI_CALCULATED", nowStr)

	case 4:
		// Step 4: Satellite InSAR slip (gempa.satellite)
		satEvt := models.SatelliteEvent{
			Type:               "SATELLITE",
			GroundDisplacement: scen.SeismicSlip * 50.0, // cm
			Deformation:        scen.SeismicSlip * 30.0,
			CoseismicSlip:      scen.SeismicSlip,
			SatelliteID:        "COPERNICUS-SENTINEL-1B",
			Timestamp:          now,
		}
		if rm.cascade != nil {
			rm.cascade.OnSatelliteEvent(satEvt)
		}
		rm.emitKafkaAndSSE(config.TopicNames.Satellite, "SATELLITE", fmt.Sprintf("InSAR Co-seismic slip detected: %.1fm displacement along subduction megathrust", scen.SeismicSlip), "HIGH", satEvt)
		rm.updateStage("SATELLITE_SEABED_SLIP", nowStr)

	case 5:
		// Step 5: Tsunami anomaly (gempa.tsunami & gempa.tsunami_scenarios)
		oceanEvt := models.OceanEvent{
			Type:                 "OCEAN",
			SensorID:             "DART-BUOY-INA04",
			SeaLevel:             scen.TsunamiWave,
			WaveHeight:           scen.TsunamiWave,
			TsunamiSensorReading: scen.TsunamiWave,
			BuoyData:             scen.TsunamiWave * 1.1,
			WaveETA:              18,
			Latitude:             scen.EpicenterLat + 0.3,
			Longitude:            scen.EpicenterLon - 0.2,
			Timestamp:            now,
		}
		if rm.cascade != nil {
			rm.cascade.OnOceanEvent(oceanEvt)
		}
		rm.emitKafkaAndSSE(config.TopicNames.Ocean, "OCEAN", fmt.Sprintf("TSUNAMI ANOMALY: DART Buoy #04 registered %.1fm wave anomaly (ETA: 18 min)", scen.TsunamiWave), "CRITICAL", oceanEvt)

		tsScenario := models.TsunamiScenario{
			Active:          true,
			DetectionTime:   now,
			SensorID:        "DART-BUOY-INA04",
			WaveAnomaly:     scen.TsunamiWave,
			AffectedZones:   []string{"Pangandaran Pesisir", "Cilacap", "Pacitan Selatan", "Kebumen"},
			ResponseActions: []string{"EVAKUASI SEGERA ke ketinggian >25m", "Aktifkan sirine tsunami pesisir"},
			Severity:        "CRITICAL",
			Timestamp:       now,
		}
		_ = rm.producer.Produce(config.TopicNames.TsunamiScenarios, scen.ID, tsScenario)
		rm.updateStage("TSUNAMI_ANOMALY_CONFIRMED", nowStr)

	case 6:
		// Step 6: Population exposure escalated (gempa.population)
		popEvt := models.PopulationEvent{
			Type:                  "POPULATION",
			Zone:                  scen.Region,
			Population:            scen.PopulationExposed,
			ShelterCapacity:       scen.PopulationExposed / 4,
			EvacuationRouteStatus: "CORRIDOR_CONGESTED_RED",
			EvacuationReadiness:   62.5,
			Timestamp:             now,
		}
		if rm.cascade != nil {
			rm.cascade.OnPopulationEvent(popEvt)
		}
		rm.emitKafkaAndSSE(config.TopicNames.Population, "POPULATION", fmt.Sprintf("Coastal Population At Risk: %s residents in evacuation corridors", formatPop(scen.PopulationExposed)), "CRITICAL", popEvt)
		rm.updateStage("POPULATION_EXPOSURE_ESCALATED", nowStr)

	case 7:
		// Step 7: Infrastructure disruptions (gempa.infrastructure)
		infras := []struct {
			name, ftype, damage string
			op                  bool
		}{
			{"Jembatan Kali Serayu Utama", "BRIDGE", "SEVERE", false},
			{"Pelabuhan Tanjung Intan Cilacap", "PORT", "HEAVY", false},
			{"RSUD Cilacap Emergency Trauma", "HOSPITAL", "MODERATE", true},
			{"PLTU Cilacap Interkoneksi", "POWER", "SEVERE", false},
		}
		for i, inf := range infras {
			infEvt := models.InfrastructureEvent{
				Type:         "INFRASTRUCTURE",
				FacilityID:   fmt.Sprintf("FAC-%03d", i+1),
				FacilityName: inf.name,
				FacilityType: inf.ftype,
				Latitude:     scen.EpicenterLat + 0.8,
				Longitude:    scen.EpicenterLon + 0.6,
				DamageLevel:  inf.damage,
				Operational:  inf.op,
				Timestamp:    now,
			}
			if rm.cascade != nil {
				rm.cascade.OnInfrastructureEvent(infEvt)
			}
			rm.emitKafkaAndSSE(config.TopicNames.Maritime, "INFRASTRUCTURE", fmt.Sprintf("Infrastructure Impact: %s (%s, %s)", inf.name, inf.ftype, inf.damage), "HIGH", infEvt)
		}
		rm.updateStage("INFRASTRUCTURE_DISRUPTION", nowStr)

	case 8:
		// Step 8: Incident State CRITICAL & Autonomous Response dispatched (gempa.incidents & gempa.response)
		rm.updateStage("INCIDENT_ESCALATED_CRITICAL", nowStr)
		log.Printf("[INFO] Cascading disaster confirmed at stage 8: %s", scen.Name)
	}
}

func (rm *ReplayManager) updateStage(stageName, timeStr string) {
	rm.mu.Lock()
	rm.status.StageName = stageName
	rm.status.LastEventTime = timeStr
	rm.status.Timestamp = time.Now()
	rm.mu.Unlock()
}

func (rm *ReplayManager) broadcastStatus() {
	st := rm.GetStatus()
	if rm.sse != nil {
		rm.sse.BroadcastAll("replay_status", st)
	}
}

func (rm *ReplayManager) emitKafkaAndSSE(topic, evtType, desc, severity string, payload interface{}) {
	if rm.producer != nil {
		_ = rm.producer.Produce(topic, "", payload)
	}

	if rm.sse != nil {
		rm.sse.BroadcastAll("event", map[string]interface{}{
			"id":          fmt.Sprintf("evt-replay-%d", time.Now().UnixNano()),
			"type":        evtType,
			"description": desc,
			"severity":    severity,
			"timestamp":   time.Now().Format(time.RFC3339),
			"data":        payload,
		})
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
