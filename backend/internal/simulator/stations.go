package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

type seismicStation struct {
	id   string
	name string
	lat  float64
	lon  float64
}

var bmkgStations = []seismicStation{
	{"LEM", "Lembang (West Java)", -6.83, 107.62},
	{"JATS", "Jatiluhur (West Java)", -6.52, 107.41},
	{"CBJI", "Cibinong (West Java)", -6.49, 106.85},
	{"KLI", "Kotabumi (Lampung)", -4.83, 104.88},
	{"BKB", "Bukittinggi (West Sumatra)", -0.30, 100.37},
	{"PDSI", "Padang (West Sumatra)", -0.95, 100.35},
	{"YOGI", "Yogyakarta (DIY)", -7.78, 110.37},
	{"PLAI", "Palu (Central Sulawesi)", -0.90, 119.87},
	{"MNI", "Manado (North Sulawesi)", 1.48, 124.84},
	{"AAI", "Ambon (Maluku)", -3.70, 128.18},
	{"BND", "Banda Aceh (Aceh)", 5.55, 95.32},
	{"JAY", "Jayapura (Papua)", -2.53, 140.72},
}

// generateStationEvents produces real-time telemetry from BMKG seismic stations
func (s *Simulator) generateStationEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			st := bmkgStations[rand.Intn(len(bmkgStations))]

			s.mu.RLock()
			mode := s.mode
			phase := s.currentPhase
			s.mu.RUnlock()

			var pArrival, sArrival, pga float64
			status := "ONLINE"
			sigQuality := 94.0 + rand.Float64()*5.5

			if mode == ModeMegathrustActive || phase.PhaseNumber == 2 || phase.PhaseNumber == 3 {
				// Earthquake wave detection
				pArrival = 3.0 + rand.Float64()*8.0
				sArrival = pArrival*1.73 + rand.Float64()*2.0
				pga = (phase.ActivityLevel / 100.0) * (0.3 + rand.Float64()*0.6)
				if pga > 0.6 {
					status = "CLIPPED"
				}
			} else {
				pArrival = 0
				sArrival = 0
				pga = 0.001 + rand.Float64()*0.005
			}

			event := models.StationEvent{
				Type:          "STATION",
				StationID:     st.id,
				StationName:   st.name,
				Latitude:      st.lat,
				Longitude:     st.lon,
				SignalQuality: sigQuality,
				PWaveArrival:  pArrival,
				SWaveArrival:  sArrival,
				PGARecorded:   pga,
				Status:        status,
				Timestamp:     time.Now(),
			}

			_ = s.producer.Produce(config.TopicNames.Activity, st.id, event)
			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        "STATION",
				"description": fmt.Sprintf("Station %s (%s): PGA %.4fg, Signal %.0f%% [%s]", st.id, st.name, pga, sigQuality, status),
				"severity":    stationSeverity(status, pga),
				"timestamp":   event.Timestamp,
				"data":        event,
			})

			time.Sleep(jitter(4*time.Second, 0.4))
		}
	}
}

func stationSeverity(status string, pga float64) string {
	if status == "CLIPPED" || pga > 0.25 {
		return "CRITICAL"
	}
	if pga > 0.05 {
		return "HIGH"
	}
	if pga > 0.01 {
		return "MEDIUM"
	}
	return "LOW"
}
