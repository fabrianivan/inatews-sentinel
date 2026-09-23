package simulator

import (
	"context"
	"math/rand"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

type zoneInfo struct {
	name       string
	population int
	shelter    int
	route      string
}

var zones = []zoneInfo{
	{"Anyer", 45000, 8000, "Route A — Highway to Serang"},
	{"Carita Beach", 12000, 3000, "Route B — Coastal Road North"},
	{"Labuan", 28000, 6000, "Route C — Main Road to Pandeglang"},
	{"Pandeglang Coast", 18000, 4500, "Route D — Inland Highway"},
	{"Merak", 35000, 7000, "Route E — Port Evacuation"},
	{"Sumur", 8000, 2000, "Route F — Mountain Road"},
}

// generatePopulationEvents produces evacuation readiness data
func (s *Simulator) generatePopulationEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			zone := zones[rand.Intn(len(zones))]

			event := models.PopulationEvent{
				Type:                  "POPULATION",
				Zone:                  zone.name,
				Population:            zone.population + rand.Intn(1000) - 500,
				ShelterCapacity:       zone.shelter,
				EvacuationRouteStatus: "OPEN",
				EvacuationReadiness:   0.7 + rand.Float64()*0.3,
				Timestamp:             time.Now(),
			}

			_ = s.producer.Produce(config.TopicNames.Population, zone.name, event)

			time.Sleep(jitter(30*time.Second, 0.5))
		}
	}
}
