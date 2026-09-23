package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

type tideGauge struct {
	id   string
	name string
	lat  float64
	lon  float64
}

var indonesianBuoys = []tideGauge{
	{"BUOY-INA-01", "Selat Sunda / Pulau Sebesi", -5.95, 105.48},
	{"BUOY-INA-02", "Pesisir Padang / Mentawai", -1.15, 100.12},
	{"BUOY-INA-03", "Cilacap Samudra Hindia", -7.95, 109.10},
	{"BUOY-INA-04", "Teluk Palu / Pantoloan", -0.72, 119.86},
	{"BUOY-INA-05", "Banda Aceh Samudra Hindia", 5.62, 95.15},
	{"BUOY-INA-06", "Pangandaran Selatan", -7.78, 108.65},
}

// generateOceanEvents produces tsunami buoy & tide gauge sensor readings
func (s *Simulator) generateOceanEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			sensor := indonesianBuoys[rand.Intn(len(indonesianBuoys))]

			s.mu.RLock()
			mode := s.mode
			phase := s.currentPhase
			sc := s.currentScenario
			s.mu.RUnlock()

			var seaLevel, waveH, tsunamiReading, buoyData float64
			var waveEta int

			if mode == ModeTsunamiPropagation || phase.PhaseNumber == 4 {
				// Megathrust tsunami wave detected
				ratio := float64(phase.ElapsedSec) / float64(max(phase.DurationSec, 1))
				maxH := 8.0
				if sc != nil && sc.TsunamiMaxHeight > 0 {
					maxH = sc.TsunamiMaxHeight
				}
				waveH = 1.0 + ratio*(maxH-1.0) + rand.Float64()*0.8
				seaLevel = waveH * 0.7
				tsunamiReading = waveH * 1.2
				buoyData = waveH * 0.9
				waveEta = max(1, int((1.0-ratio)*25))
			} else {
				seaLevel = -0.1 + rand.Float64()*0.2
				waveH = 0.3 + rand.Float64()*0.5
				tsunamiReading = 0.0
				buoyData = 0.05 + rand.Float64()*0.1
				waveEta = 0
			}

			event := models.OceanEvent{
				Type:                 "OCEAN",
				SensorID:             sensor.id,
				SeaLevel:             seaLevel,
				WaveHeight:           waveH,
				TsunamiSensorReading: tsunamiReading,
				BuoyData:             buoyData,
				WaveETA:              waveEta,
				Latitude:             sensor.lat,
				Longitude:            sensor.lon,
				Timestamp:            time.Now(),
			}

			_ = s.producer.Produce(config.TopicNames.Ocean, sensor.id, event)
			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        "OCEAN",
				"description": formatOceanDescription(event, sensor.name),
				"severity":    oceanSeverity(event),
				"timestamp":   event.Timestamp,
				"data":        event,
			})

			time.Sleep(jitter(5*time.Second, 0.3))
		}
	}
}

func formatOceanDescription(e models.OceanEvent, name string) string {
	if e.WaveHeight > 3.0 {
		return fmt.Sprintf("TSUNAMI ALERT: %.1fm wave detected at %s (%s) — ETA %d min", e.WaveHeight, e.SensorID, name, e.WaveETA)
	}
	if e.WaveHeight > 1.0 {
		return fmt.Sprintf("Wave surge: %.1fm at %s (%s)", e.WaveHeight, e.SensorID, name)
	}
	return fmt.Sprintf("Buoy %s (%s): Normal sea level (%.2fm, wave %.1fm)", e.SensorID, name, e.SeaLevel, e.WaveHeight)
}

func oceanSeverity(e models.OceanEvent) string {
	if e.WaveHeight > 5.0 {
		return "CRITICAL"
	}
	if e.WaveHeight > 1.5 {
		return "HIGH"
	}
	if e.WaveHeight > 0.8 {
		return "MEDIUM"
	}
	return "LOW"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
