package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

type facility struct {
	id       string
	name     string
	facType  string
	lat      float64
	lon      float64
}

var criticalFacilities = []facility{
	{"FAC-001", "RSUD Banten", "HOSPITAL", -6.12, 106.15},
	{"FAC-002", "Pelabuhan Penyeberangan Merak", "PORT", -5.93, 105.99},
	{"FAC-003", "PLTU Suralaya Power Station", "POWER_GRID", -5.89, 106.03},
	{"FAC-004", "RSUP Dr. M. Djamil Padang", "HOSPITAL", -0.94, 100.36},
	{"FAC-005", "Pelabuhan Teluk Bayur Padang", "PORT", -0.99, 100.37},
	{"FAC-006", "Jembatan Palu IV (Ponulele)", "BRIDGE", -0.89, 119.86},
	{"FAC-007", "RSUD Anutapura Palu", "HOSPITAL", -0.91, 119.85},
	{"FAC-008", "Pelabuhan Tanjung Intan Cilacap", "PORT", -7.74, 109.01},
	{"FAC-009", "Bandara Internasional Yogyakarta (YIA)", "AIRPORT", -7.90, 110.05},
}

// generateInfrastructureEvents monitors vital infrastructure during seismic events
func (s *Simulator) generateInfrastructureEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			fac := criticalFacilities[rand.Intn(len(criticalFacilities))]

			s.mu.RLock()
			phase := s.currentPhase
			s.mu.RUnlock()

			damageLevel := "NONE"
			operational := true

			if phase.PhaseNumber == 2 || phase.PhaseNumber == 3 {
				// During mainshock and aftershocks
				roll := rand.Float64()
				if phase.ActivityLevel > 80 {
					if roll > 0.7 {
						damageLevel = "SEVERE"
						operational = false
					} else if roll > 0.4 {
						damageLevel = "MODERATE"
						operational = true
					} else {
						damageLevel = "MINOR"
						operational = true
					}
				} else if phase.ActivityLevel > 50 {
					if roll > 0.5 {
						damageLevel = "MINOR"
					}
				}
			}

			event := models.InfrastructureEvent{
				Type:         "INFRASTRUCTURE",
				FacilityID:   fac.id,
				FacilityName: fac.name,
				FacilityType: fac.facType,
				Latitude:     fac.lat,
				Longitude:    fac.lon,
				DamageLevel:  damageLevel,
				Operational:  operational,
				Timestamp:    time.Now(),
			}

			_ = s.producer.Produce(config.TopicNames.Maritime, fac.id, event)
			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        "INFRASTRUCTURE",
				"description": fmt.Sprintf("%s (%s): %s | Operational: %t", fac.name, fac.facType, damageLevel, operational),
				"severity":    infraSeverity(damageLevel),
				"timestamp":   event.Timestamp,
				"data":        event,
			})

			time.Sleep(jitter(12*time.Second, 0.4))
		}
	}
}

func infraSeverity(damage string) string {
	switch damage {
	case "COLLAPSED", "SEVERE":
		return "CRITICAL"
	case "MODERATE":
		return "HIGH"
	case "MINOR":
		return "MEDIUM"
	default:
		return "LOW"
	}
}
