package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

// generateSatelliteEvents produces InSAR and SAR satellite observation data
func (s *Simulator) generateSatelliteEvents(ctx context.Context) {
	satellites := []string{"Sentinel-1A (InSAR)", "ALOS-2 PALSAR", "TerraSAR-X", "Sentinel-1B"}

	for {
		select {
		case <-ctx.Done():
			return
		default:
			s.mu.RLock()
			phase := s.currentPhase
			s.mu.RUnlock()

			sat := satellites[rand.Intn(len(satellites))]
			var displacement, deformation, slip float64

			if phase.PhaseNumber == 2 || phase.PhaseNumber == 3 {
				// Coseismic deformation during/after mainshock
				displacement = (phase.ActivityLevel / 100.0) * (50.0 + rand.Float64()*120.0) // cm
				deformation = displacement * 0.1
				slip = (phase.ActivityLevel / 100.0) * (2.0 + rand.Float64()*6.0)            // meters
			} else {
				displacement = rand.Float64() * 0.8
				deformation = rand.Float64() * 0.2
				slip = 0.0
			}

			event := models.SatelliteEvent{
				Type:               "SATELLITE",
				GroundDisplacement: displacement,
				Deformation:        deformation,
				CoseismicSlip:      slip,
				SatelliteID:        sat,
				Timestamp:          time.Now(),
			}

			_ = s.producer.Produce(config.TopicNames.Satellite, sat, event)
			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        "SATELLITE",
				"description": formatSatelliteDescription(event),
				"severity":    satelliteSeverity(event),
				"timestamp":   event.Timestamp,
				"data":        event,
			})

			time.Sleep(jitter(15*time.Second, 0.4))
		}
	}
}

func formatSatelliteDescription(e models.SatelliteEvent) string {
	if e.CoseismicSlip > 1.0 {
		return fmt.Sprintf("InSAR Alert: Coseismic slip %.1fm, displacement %.1fcm via %s", e.CoseismicSlip, e.GroundDisplacement, e.SatelliteID)
	}
	if e.GroundDisplacement > 5.0 {
		return fmt.Sprintf("Ground displacement %.1fcm detected via %s", e.GroundDisplacement, e.SatelliteID)
	}
	return fmt.Sprintf("Interferometry scan normal — %s: displacement %.1fcm", e.SatelliteID, e.GroundDisplacement)
}

func satelliteSeverity(e models.SatelliteEvent) string {
	if e.CoseismicSlip > 3.0 || e.GroundDisplacement > 50.0 {
		return "CRITICAL"
	}
	if e.CoseismicSlip > 0.5 || e.GroundDisplacement > 10.0 {
		return "HIGH"
	}
	if e.GroundDisplacement > 2.0 {
		return "MEDIUM"
	}
	return "LOW"
}
