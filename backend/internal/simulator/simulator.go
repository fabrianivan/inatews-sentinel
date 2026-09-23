package simulator

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/kafka"
	"gempa-sentinel/internal/models"
)

// SimulationMode represents the current simulation state
type SimulationMode int

const (
	ModeNormal SimulationMode = iota
	ModeMegathrustActive
	ModeTsunamiPropagation
)

// MegathrustScenario defines a megathrust earthquake simulation scenario
type MegathrustScenario struct {
	ID          string
	Name        string
	FaultZone   string
	Magnitude   float64
	Depth       float64
	EpicenterLat float64
	EpicenterLon float64
	AffectedAreas []string
	TsunamiMaxHeight float64
	TsunamiZones []string
	TsunamiActions []string
}

// LifecyclePhase describes the current autonomous simulation phase
type LifecyclePhase = models.LifecyclePhase

// Simulator orchestrates event generation across all domains
type Simulator struct {
	producer  *kafka.Producer
	hub       *hub.SSEHub
	mode      SimulationMode
	mu        sync.RWMutex
	cancel    context.CancelFunc

	// Current computed state
	currentActivity float64
	trendDirection  string
	latestWeatherAnomaly string

	// Autonomous lifecycle state
	currentPhase        LifecyclePhase
	currentScenario     *MegathrustScenario
	currentScenarioIdx  int
	onAnalysisTrigger   func(models.ActivityIndex)
	isDrillActive       bool
}

var scenarios = []MegathrustScenario{
	{
		ID:          "sunda-strait",
		Name:        "MEGATHRUST SELAT SUNDA",
		FaultZone:   "Sunda Strait Subduction",
		Magnitude:   8.2,
		Depth:       25.0,
		EpicenterLat: -6.8,
		EpicenterLon: 105.2,
		AffectedAreas: []string{"Banten", "Lampung", "West Java"},
		TsunamiMaxHeight: 12.0,
		TsunamiZones: []string{
			"Zona A — Pesisir Anyer & Carita (Gelombang: 8.2m, ETA: 18 menit)",
			"Zona B — Pelabuhan Merak & Cilegon (Gelombang: 5.6m, ETA: 22 menit)",
			"Zona C — Pandeglang & Labuan (Gelombang: 7.4m, ETA: 25 menit)",
			"Zona D — Lampung Selatan / Kalianda (Gelombang: 6.1m, ETA: 28 menit)",
		},
		TsunamiActions: []string{
			"[ACTION] EVAKUASI SEGERA ke dataran tinggi (>30m)",
			"[ACTION] Aktifkan sirene peringatan tsunami seluruh pesisir Banten & Lampung",
			"[ACTION] Hentikan seluruh aktivitas penyeberangan Merak-Bakauheni",
			"[ACTION] Mobilisasi BASARNAS & BNPB forward response unit",
		},
	},
	{
		ID:          "south-java",
		Name:        "MEGATHRUST SELATAN JAWA",
		FaultZone:   "Java Trench Subduction",
		Magnitude:   8.8,
		Depth:       15.0,
		EpicenterLat: -9.1,
		EpicenterLon: 109.5,
		AffectedAreas: []string{"Central Java", "Yogyakarta", "East Java"},
		TsunamiMaxHeight: 20.0,
		TsunamiZones: []string{
			"Zona A — Cilacap & Pangandaran (Gelombang: 15.2m, ETA: 22 menit)",
			"Zona B — Kebumen & Purworejo Coast (Gelombang: 12.8m, ETA: 26 menit)",
			"Zona C — Pacitan & Trenggalek (Gelombang: 10.4m, ETA: 30 menit)",
			"Zona D — Gunung Kidul (Yogyakarta) (Gelombang: 11.6m, ETA: 28 menit)",
		},
		TsunamiActions: []string{
			"[ACTION] EVAKUASI MASSAL SEGERA — zona pesisir selatan Jawa",
			"[ACTION] Aktifkan EWS (Early Warning System) BMKG seluruh Jawa",
			"[ACTION] Tutup seluruh pelabuhan pesisir selatan",
			"[ACTION] Deploy TNI & Polri untuk evakuasi Cilacap-Pangandaran-Pacitan corridor",
		},
	},
	{
		ID:          "mentawai",
		Name:        "MEGATHRUST MENTAWAI-SIBERUT",
		FaultZone:   "Sunda Megathrust (Mentawai Segment)",
		Magnitude:   9.0,
		Depth:       12.0,
		EpicenterLat: -2.5,
		EpicenterLon: 99.8,
		AffectedAreas: []string{"West Sumatra", "Mentawai Islands", "Bengkulu"},
		TsunamiMaxHeight: 25.0,
		TsunamiZones: []string{
			"Zona A — Kota Padang (Gelombang: 18.5m, ETA: 20 menit)",
			"Zona B — Pariaman & Padang Pariaman (Gelombang: 14.2m, ETA: 22 menit)",
			"Zona C — Kepulauan Mentawai (Gelombang: 22.0m, ETA: 8 menit)",
			"Zona D — Bengkulu Coast (Gelombang: 12.6m, ETA: 35 menit)",
		},
		TsunamiActions: []string{
			"[ACTION] TSUNAMI MERUSAK — EVAKUASI TOTAL Padang & Mentawai",
			"[ACTION] Maximum alert: Gelombang 20m+ menuju Padang",
			"[ACTION] Aktifkan semua shelter tsunami vertikal di Padang",
			"[ACTION] Evakuasi udara penduduk Mentawai oleh TNI AU",
		},
	},
	{
		ID:          "palu-koro",
		Name:        "MEGATHRUST SULAWESI-PALU",
		FaultZone:   "Palu-Koro Strike-Slip Fault",
		Magnitude:   7.5,
		Depth:       10.0,
		EpicenterLat: -0.18,
		EpicenterLon: 119.85,
		AffectedAreas: []string{"Palu", "Donggala", "Sigi", "Parigi"},
		TsunamiMaxHeight: 11.0,
		TsunamiZones: []string{
			"Zona A — Teluk Palu (Gelombang: 9.8m, Tipe: Submarine Landslide Tsunami)",
			"Zona B — Donggala & Sirenja (Gelombang: 6.2m, ETA: 5 menit)",
			"Zona C — Zona Likuefaksi Petobo & Balaroa (Liquefaction)",
			"Zona D — Pantai Barat Donggala (Gelombang: 5.4m, ETA: 8 menit)",
		},
		TsunamiActions: []string{
			"[ACTION] TSUNAMI LOKAL — waktu evakuasi sangat singkat (<5 menit)",
			"[ACTION] Alert: Liquefaction terdeteksi di Petobo & Balaroa",
			"[ACTION] Evakuasi vertikal immediate — Teluk Palu",
			"[ACTION] Koordinasi SAR terpadu Palu-Donggala-Sigi",
		},
	},
}

// NewSimulator creates a new event simulator
func NewSimulator(producer *kafka.Producer, h *hub.SSEHub) *Simulator {
	sc := &scenarios[0]
	return &Simulator{
		producer:        producer,
		hub:             h,
		mode:            ModeNormal,
		currentActivity: 12.0 + rand.Float64()*5.0,
		trendDirection:  "STABLE",
		currentScenario: sc,
		currentScenarioIdx: 0,
		currentPhase: LifecyclePhase{
			PhaseNumber:   1,
			PhaseName:     "SEISMIC_BASELINE",
			PhaseTitle:    "Fase 1: Baseline Monitoring & USGS Feed Ingestion",
			ActivityLevel: 12.0,
			DurationSec:   30,
			ElapsedSec:    1,
			SeismicEnergy: 0.8,
			Status:        "NORMAL",
			ScenarioName:  sc.Name,
			Magnitude:     0,
			Depth:         0,
			FaultZone:     sc.FaultZone,
			MMI:           1,
			Timestamp:     time.Now(),
		},
	}
}

// SetAnalysisTrigger binds the event analysis callback
func (s *Simulator) SetAnalysisTrigger(fn func(models.ActivityIndex)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onAnalysisTrigger = fn
}

// Start begins generating events and starts autonomous megathrust lifecycle
func (s *Simulator) Start(ctx context.Context) {
	log.Println("[INFO] INATEWS SENTINEL - Event simulator started")

	ctx, cancel := context.WithCancel(ctx)
	s.cancel = cancel

	go s.generateSeismicEvents(ctx)
	go s.generateStationEvents(ctx)
	go s.generateOceanEvents(ctx)
	go s.generateWeatherEvents(ctx)
	go s.generateSatelliteEvents(ctx)
	go s.generateInfrastructureEvents(ctx)
	go s.generatePopulationEvents(ctx)
	go s.broadcastMetrics(ctx)
	go s.startAutonomousLifecycle(ctx)
}

// Reset returns the simulator to normal mode
func (s *Simulator) Reset() {
	s.mu.Lock()
	s.isDrillActive = false
	s.mode = ModeNormal
	s.currentActivity = 12.0 + rand.Float64()*5.0
	s.trendDirection = "STABLE"
	sc := s.currentScenario
	if sc == nil {
		sc = &scenarios[0]
		s.currentScenario = sc
	}
	phaseObj := LifecyclePhase{
		PhaseNumber:   1,
		PhaseName:     "SEISMIC_BASELINE",
		PhaseTitle:    "LIVE REAL DATA (BMKG TEWS + USGS + IOC UNESCO)",
		ActivityLevel: s.currentActivity,
		DurationSec:   30,
		ElapsedSec:    1,
		SeismicEnergy: 0.8,
		Status:        "NORMAL",
		ScenarioName:  "LIVE REAL-TIME STREAM",
		Magnitude:     0.0,
		Depth:         10.0,
		FaultZone:     "Indonesian Subduction Corridors",
		MMI:           1,
		Timestamp:     time.Now(),
	}
	s.currentPhase = phaseObj
	s.mu.Unlock()

	log.Println("[INFO] Simulator reset to standby / normal real-time mode")

	s.hub.BroadcastAll("lifecycle_phase", phaseObj)
	s.hub.BroadcastAll("tsunami", models.TsunamiScenario{Active: false, Timestamp: time.Now()})
}

// TriggerMegathrustScenario jumps to or triggers a specific scenario
func (s *Simulator) TriggerMegathrustScenario(id string) {
	s.mu.Lock()
	s.isDrillActive = true
	for i, sc := range scenarios {
		if sc.ID == id {
			s.currentScenarioIdx = i
			s.currentScenario = &scenarios[i]
			break
		}
	}
	s.mode = ModeMegathrustActive
	s.currentActivity = 88.0
	s.trendDirection = "RUPTURE DETECTED"

	sc := s.currentScenario
	phaseObj := LifecyclePhase{
		PhaseNumber:   3,
		PhaseName:     "MAINSHOCK",
		PhaseTitle:    fmt.Sprintf("Fase 3: ⚡ MAINSHOCK M%.1f — %s", sc.Magnitude, sc.Name),
		ActivityLevel: 88.0,
		DurationSec:   30,
		ElapsedSec:    1,
		SeismicEnergy: sc.Magnitude * 5.0,
		Status:        "CRITICAL",
		ScenarioName:  sc.Name,
		Magnitude:     sc.Magnitude,
		Depth:         sc.Depth,
		FaultZone:     sc.FaultZone,
		MMI:           mmiFromMagnitude(sc.Magnitude),
		Timestamp:     time.Now(),
	}
	s.currentPhase = phaseObj
	s.mu.Unlock()

	s.hub.BroadcastAll("lifecycle_phase", phaseObj)
	log.Printf("[INFO] Manual trigger: Megathrust scenario %s", id)
}

// TriggerVolcanicEscalation triggers megathrust scenario (backward compatibility)
func (s *Simulator) TriggerVolcanicEscalation() {
	s.TriggerMegathrustScenario("sunda-strait")
}

// TriggerTsunami activates tsunami mode
func (s *Simulator) TriggerTsunami() {
	s.mu.Lock()
	s.mode = ModeTsunamiPropagation
	s.trendDirection = "TSUNAMI WARNING"
	sc := s.currentScenario
	if sc == nil {
		sc = &scenarios[0]
		s.currentScenario = sc
	}

	phaseObj := LifecyclePhase{
		PhaseNumber:   4,
		PhaseName:     "TSUNAMI_PROPAGATION",
		PhaseTitle:    fmt.Sprintf("Fase 4: 🌊 Propagasi Tsunami — Gelombang menuju %s", sc.AffectedAreas[0]),
		ActivityLevel: 95.0,
		DurationSec:   30,
		ElapsedSec:    1,
		SeismicEnergy: sc.Magnitude * 4.2,
		Status:        "TSUNAMI ALERT",
		ScenarioName:  sc.Name,
		Magnitude:     sc.Magnitude,
		Depth:         sc.Depth,
		FaultZone:     sc.FaultZone,
		MMI:           mmiFromMagnitude(sc.Magnitude),
		Timestamp:     time.Now(),
	}
	s.currentPhase = phaseObj
	s.mu.Unlock()

	s.hub.BroadcastAll("lifecycle_phase", phaseObj)
	log.Println("[INFO] Tsunami scenario triggered")

	zones := sc.TsunamiZones
	actions := sc.TsunamiActions
	maxH := sc.TsunamiMaxHeight

	tsScenario := models.TsunamiScenario{
		Active:          true,
		DetectionTime:   time.Now(),
		SensorID:        fmt.Sprintf("DART-Buoy-%s", sc.ID),
		WaveAnomaly:     maxH,
		AffectedZones:   zones,
		ResponseActions: actions,
		Severity:        "CRITICAL",
		Timestamp:       time.Now(),
	}

	s.hub.BroadcastAll("tsunami", tsScenario)
	_ = s.producer.Produce(config.TopicNames.TsunamiScenarios, sc.ID, tsScenario)
}

// TriggerReal2018Disaster triggers the Sulawesi-Palu 2018 scenario
func (s *Simulator) TriggerReal2018Disaster() {
	s.TriggerMegathrustScenario("palu-koro")
}

// GetStatus returns the current system status
func (s *Simulator) GetStatus() models.SystemStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	riskLevel := "NORMAL"
	oceanStatus := "NORMAL"
	infraStatus := "NORMAL"

	if s.currentActivity > 80 {
		riskLevel = "CRITICAL"
	} else if s.currentActivity > 55 {
		riskLevel = "HIGH"
	} else if s.currentActivity > 30 {
		riskLevel = "ADVISORY"
	}

	if s.mode == ModeTsunamiPropagation {
		oceanStatus = "TSUNAMI DETECTED"
	}
	if s.currentActivity > 70 {
		infraStatus = "DAMAGE ASSESSED"
	}

	alerts := 0
	if s.currentActivity > 50 {
		alerts++
	}
	if s.mode == ModeTsunamiPropagation {
		alerts++
	}

	return models.SystemStatus{
		SeismicIntensity: s.currentActivity,
		OceanStatus:      oceanStatus,
		WeatherStatus:    s.resolveWeatherStatus(),
		InfraStatus:      infraStatus,
		ActiveAlerts:     alerts,
		RiskLevel:        riskLevel,
		TrendDirection:   s.trendDirection,
		LastUpdate:       time.Now(),
	}
}

// broadcastMetrics periodically broadcasts current system metrics
func (s *Simulator) broadcastMetrics(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.RLock()
			active := s.isDrillActive
			s.mu.RUnlock()
			if !active {
				continue
			}

			status := s.GetStatus()
			s.hub.BroadcastAll("metrics", status)

			s.mu.RLock()
			actIdx := models.ActivityIndex{
				OverallPercentage: s.currentActivity,
				TrendDirection:    s.trendDirection,
				Timestamp:         time.Now(),
			}
			s.mu.RUnlock()

			s.hub.BroadcastAll("activity_index", actIdx)
		}
	}
}

func (s *Simulator) resolveWeatherStatus() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.latestWeatherAnomaly != "" {
		return s.latestWeatherAnomaly
	}
	return "NORMAL"
}

// GetLifecyclePhase returns the current phase of the autonomous simulation
func (s *Simulator) GetLifecyclePhase() LifecyclePhase {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentPhase
}

// startAutonomousLifecycle runs continuous megathrust scenario cycles when drill is active
func (s *Simulator) startAutonomousLifecycle(ctx context.Context) {
	type phase struct {
		number   int
		name     string
		title    string
		duration int
		minAct   float64
		maxAct   float64
		energy   float64
		status   string
		trend    string
		mmi      int
		desc     string
		evtType  string
	}

	for {
		s.mu.RLock()
		active := s.isDrillActive
		s.mu.RUnlock()

		if !active {
			select {
			case <-ctx.Done():
				return
			case <-time.After(1 * time.Second):
				continue
			}
		}

		// Pick the current scenario
		s.mu.Lock()
		sc := scenarios[s.currentScenarioIdx]
		s.currentScenario = &sc
		s.mu.Unlock()

		log.Printf("[INFO] === STARTING DRILL SCENARIO: %s (M%.1f) ===", sc.Name, sc.Magnitude)

		phases := []phase{
			{
				number:   1,
				name:     "SEISMIC_BASELINE",
				title:    fmt.Sprintf("Fase 1: Baseline Monitoring — %s", sc.FaultZone),
				duration: 30,
				minAct:   8.0,
				maxAct:   15.0,
				energy:   0.8,
				status:   "NORMAL",
				trend:    "STABLE",
				mmi:      1,
				desc:     fmt.Sprintf("Monitoring baseline: USGS feed ingestion, %d stasiun seismik aktif di zona %s", 45+rand.Intn(20), sc.FaultZone),
				evtType:  "SEISMIC",
			},
			{
				number:   2,
				name:     "PRECURSOR_SWARM",
				title:    fmt.Sprintf("Fase 2: Precursor Swarm — Foreshock Cluster di %s", sc.AffectedAreas[0]),
				duration: 25,
				minAct:   35.0,
				maxAct:   52.0,
				energy:   4.5,
				status:   "ADVISORY",
				trend:    "SWARM DETECTED",
				mmi:      4,
				desc:     fmt.Sprintf("Seismisitas meningkat: Kluster gempa kecil M2.5-4.2 terdeteksi pada kedalaman %.0fkm di segmen %s", sc.Depth+5, sc.FaultZone),
				evtType:  "SEISMIC",
			},
			{
				number:   3,
				name:     "MAINSHOCK",
				title:    fmt.Sprintf("Fase 3: ⚡ MAINSHOCK M%.1f — %s", sc.Magnitude, sc.Name),
				duration: 20,
				minAct:   88.0,
				maxAct:   98.0,
				energy:   sc.Magnitude * 5.0,
				status:   "CRITICAL",
				trend:    "RUPTURE DETECTED",
				mmi:      mmiFromMagnitude(sc.Magnitude),
				desc:     fmt.Sprintf("🚨 GEMPA BUMI M%.1f! Episenter %.2f°S, %.2f°E kedalaman %.0fkm — Zona sesar %s", sc.Magnitude, -sc.EpicenterLat, sc.EpicenterLon, sc.Depth, sc.FaultZone),
				evtType:  "SEISMIC",
			},
			{
				number:   4,
				name:     "TSUNAMI_PROPAGATION",
				title:    fmt.Sprintf("Fase 4: 🌊 Propagasi Tsunami — Gelombang menuju %s", sc.AffectedAreas[0]),
				duration: 25,
				minAct:   92.0,
				maxAct:   99.0,
				energy:   sc.Magnitude * 4.2,
				status:   "TSUNAMI ALERT",
				trend:    "TSUNAMI PROPAGATING",
				mmi:      mmiFromMagnitude(sc.Magnitude),
				desc:     fmt.Sprintf("🌊 PERINGATAN TSUNAMI: Gelombang %.1fm terdeteksi bergerak menuju pesisir %s", sc.TsunamiMaxHeight, sc.AffectedAreas[0]),
				evtType:  "OCEAN",
			},
			{
				number:   5,
				name:     "AFTERSHOCK_RECOVERY",
				title:    "Fase 5: Aftershock Sequence & Post-Crisis Assessment",
				duration: 25,
				minAct:   45.0,
				maxAct:   18.0,
				energy:   2.5,
				status:   "RECOVERY",
				trend:    "AFTERSHOCK DECAY",
				mmi:      3,
				desc:     "Sekuens aftershock dalam fase atenuasi. Intensitas menurun menuju baseline. Penilaian kerusakan sedang berlangsung.",
				evtType:  "SEISMIC",
			},
		}

		for _, p := range phases {
			select {
			case <-ctx.Done():
				return
			default:
			}

			// Broadcast phase announcement
			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        p.evtType,
				"description": fmt.Sprintf("🛰️ [%s] %s", sc.Name, p.desc),
				"severity":    p.status,
				"timestamp":   time.Now(),
			})

			// Handle Phase 4: Tsunami scenario
			if p.number == 4 {
				s.mu.Lock()
				s.mode = ModeTsunamiPropagation
				s.mu.Unlock()

				scenario := models.TsunamiScenario{
					Active:          true,
					DetectionTime:   time.Now(),
					SensorID:        fmt.Sprintf("DART-Buoy-%s", sc.ID),
					WaveAnomaly:     sc.TsunamiMaxHeight,
					AffectedZones:   sc.TsunamiZones,
					ResponseActions: sc.TsunamiActions,
					Severity:        "CRITICAL",
					Timestamp:       time.Now(),
				}
				s.hub.BroadcastAll("tsunami", scenario)
				_ = s.producer.Produce(config.TopicNames.TsunamiScenarios, sc.ID, scenario)
			} else if p.number == 5 {
				s.mu.Lock()
				s.mode = ModeNormal
				s.mu.Unlock()
				s.hub.BroadcastAll("tsunami", models.TsunamiScenario{Active: false, Timestamp: time.Now()})
			}

			// Progress through duration second by second
			for sec := 0; sec < p.duration; sec++ {
				select {
				case <-ctx.Done():
					return
				default:
				}

				progressRatio := float64(sec) / float64(p.duration)
				activity := p.minAct + (p.maxAct-p.minAct)*progressRatio

				s.mu.Lock()
				s.currentActivity = activity
				s.trendDirection = p.trend
				phaseObj := LifecyclePhase{
					PhaseNumber:   p.number,
					PhaseName:     p.name,
					PhaseTitle:    p.title,
					ActivityLevel: activity,
					DurationSec:   p.duration,
					ElapsedSec:    sec + 1,
					SeismicEnergy: p.energy * (0.85 + 0.3*rand.Float64()),
					Status:        p.status,
					ScenarioName:  sc.Name,
					Magnitude:     sc.Magnitude,
					Depth:         sc.Depth,
					FaultZone:     sc.FaultZone,
					MMI:           p.mmi,
					Timestamp:     time.Now(),
				}
				s.currentPhase = phaseObj
				s.mu.Unlock()

				s.hub.BroadcastAll("lifecycle_phase", phaseObj)

				// Trigger event analysis in Phase 3 or 4
				if (p.number == 3 && sec == 5) || (p.number == 4 && sec == 3) {
					s.mu.RLock()
					triggerFn := s.onAnalysisTrigger
					s.mu.RUnlock()
					if triggerFn != nil {
						triggerFn(models.ActivityIndex{
							OverallPercentage: activity,
							TrendDirection:    p.trend,
							MaxMagnitude:      sc.Magnitude,
							EarthquakeCount:   20 + rand.Intn(30),
							Timestamp:         time.Now(),
						})
					}
				}

				time.Sleep(1 * time.Second)
			}
		}

		// Advance to next scenario
		s.mu.Lock()
		s.currentScenarioIdx = (s.currentScenarioIdx + 1) % len(scenarios)
		s.mu.Unlock()

		log.Printf("[INFO] === SCENARIO %s COMPLETE - cycling to next ===", sc.Name)
	}
}

// Helper: add jitter to intervals
func jitter(base time.Duration, factor float64) time.Duration {
	return base + time.Duration(float64(base)*factor*(rand.Float64()-0.5))
}

func mmiFromMagnitude(mag float64) int {
	switch {
	case mag >= 9.0:
		return 11
	case mag >= 8.5:
		return 10
	case mag >= 8.0:
		return 9
	case mag >= 7.5:
		return 8
	case mag >= 7.0:
		return 7
	case mag >= 6.0:
		return 6
	default:
		return 5
	}
}
