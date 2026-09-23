package simulator

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

type usgsResponse struct {
	Features []struct {
		Properties struct {
			Mag   float64 `json:"mag"`
			Place string  `json:"place"`
			Time  int64   `json:"time"`
		} `json:"properties"`
		Geometry struct {
			Coordinates []float64 `json:"coordinates"` // [lon, lat, depth]
		} `json:"geometry"`
	} `json:"features"`
}

var (
	lastUSGSFetch time.Time
	usgsCache     []models.SeismicEvent
	usgsMu        sync.Mutex
)

// fetchRealUSGSEvents fetches actual earthquakes across Indonesia from USGS
func fetchRealUSGSEvents() []models.SeismicEvent {
	usgsMu.Lock()
	defer usgsMu.Unlock()

	if time.Since(lastUSGSFetch) < 2*time.Minute && len(usgsCache) > 0 {
		return usgsCache
	}

	client := http.Client{Timeout: 5 * time.Second}
	// Indonesia-wide bounding box
	url := "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&limit=10&orderby=time"

	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != http.StatusOK {
		return usgsCache
	}
	defer resp.Body.Close()

	var data usgsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return usgsCache
	}

	var events []models.SeismicEvent
	for _, f := range data.Features {
		if len(f.Geometry.Coordinates) >= 3 {
			mag := f.Properties.Mag
			events = append(events, models.SeismicEvent{
				Type:      "SEISMIC",
				Magnitude: mag,
				Depth:     f.Geometry.Coordinates[2],
				Frequency: 1.5,
				Count:     1,
				Longitude: f.Geometry.Coordinates[0],
				Latitude:  f.Geometry.Coordinates[1],
				MMI:       estimateMMI(mag, f.Geometry.Coordinates[2]),
				PGA:       estimatePGA(mag, f.Geometry.Coordinates[2]),
				FaultZone: classifyFaultZone(f.Geometry.Coordinates[1], f.Geometry.Coordinates[0]),
				Timestamp: time.UnixMilli(f.Properties.Time),
			})
		}
	}

	if len(events) > 0 {
		usgsCache = events
		lastUSGSFetch = time.Now()
	}

	return usgsCache
}

// generateSeismicEvents produces real USGS and scenario-based seismic events
func (s *Simulator) generateSeismicEvents(ctx context.Context) {
	tickerIndex := 0
	for {
		select {
		case <-ctx.Done():
			return
		default:
			s.mu.RLock()
			mode := s.mode
			phase := s.currentPhase
			sc := s.currentScenario
			s.mu.RUnlock()

			var event models.SeismicEvent

			switch {
			case mode == ModeMegathrustActive || phase.PhaseName == "MAINSHOCK":
				// During mainshock: large quakes near epicenter
				event = s.megathrustSeismicEvent(sc)
				time.Sleep(jitter(2*time.Second, 0.3))
			case phase.PhaseName == "PRECURSOR_SWARM":
				// Foreshock swarm
				event = s.foreshockEvent(sc)
				time.Sleep(jitter(3*time.Second, 0.3))
			case phase.PhaseName == "AFTERSHOCK_RECOVERY":
				// Aftershock sequence
				event = s.aftershockEvent(sc)
				time.Sleep(jitter(4*time.Second, 0.4))
			default:
				tickerIndex++
				// Every 3rd event inject real USGS
				realEvents := fetchRealUSGSEvents()
				if tickerIndex%3 == 0 && len(realEvents) > 0 {
					pick := realEvents[rand.Intn(len(realEvents))]
					event = pick
					event.Timestamp = time.Now()
				} else {
					event = s.baselineSeismicEvent()
				}
				time.Sleep(jitter(7*time.Second, 0.4))
			}

			_ = s.producer.Produce(config.TopicNames.Seismic, "indonesia", event)

			desc := fmt.Sprintf("Gempa M%.1f — Kedalaman %.0fkm — %s", event.Magnitude, event.Depth, event.FaultZone)
			if event.Magnitude >= 5.0 {
				desc = fmt.Sprintf("⚡ GEMPA BESAR M%.1f — Kedalaman %.0fkm — %s (MMI %s)", event.Magnitude, event.Depth, event.FaultZone, romanMMI(event.MMI))
			}

			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        "SEISMIC",
				"description": desc,
				"severity":    seismicSeverity(event.Magnitude),
				"timestamp":   event.Timestamp,
				"data":        event,
			})
		}
	}
}

func (s *Simulator) baselineSeismicEvent() models.SeismicEvent {
	// Random location across Indonesian subduction zones
	zones := []struct {
		lat, lon float64
		zone     string
	}{
		{-6.8, 105.2, "Sunda Strait"},
		{-8.5, 110.0, "Java Trench"},
		{-2.5, 99.8, "Mentawai Segment"},
		{-0.5, 119.5, "Sulawesi"},
		{-3.5, 128.0, "Banda Sea"},
		{2.0, 97.0, "North Sumatra"},
	}
	z := zones[rand.Intn(len(zones))]

	mag := 1.5 + rand.Float64()*2.5
	depth := 5.0 + rand.Float64()*50.0

	return models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: mag,
		Depth:     depth,
		Frequency: 0.5 + rand.Float64()*2.0,
		Count:     1 + rand.Intn(3),
		Latitude:  z.lat + (rand.Float64()-0.5)*0.5,
		Longitude: z.lon + (rand.Float64()-0.5)*0.5,
		MMI:       estimateMMI(mag, depth),
		PGA:       estimatePGA(mag, depth),
		FaultZone: z.zone,
		Timestamp: time.Now(),
	}
}

func (s *Simulator) foreshockEvent(sc *MegathrustScenario) models.SeismicEvent {
	mag := 2.5 + rand.Float64()*2.0
	depth := sc.Depth + rand.Float64()*10.0

	return models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: mag,
		Depth:     depth,
		Frequency: 3.0 + rand.Float64()*5.0,
		Count:     3 + rand.Intn(8),
		Latitude:  sc.EpicenterLat + (rand.Float64()-0.5)*0.3,
		Longitude: sc.EpicenterLon + (rand.Float64()-0.5)*0.3,
		MMI:       estimateMMI(mag, depth),
		PGA:       estimatePGA(mag, depth),
		FaultZone: sc.FaultZone,
		Timestamp: time.Now(),
	}
}

func (s *Simulator) megathrustSeismicEvent(sc *MegathrustScenario) models.SeismicEvent {
	// During mainshock, produce large events
	mag := sc.Magnitude - 0.5 + rand.Float64()*1.0
	if mag > sc.Magnitude {
		mag = sc.Magnitude
	}
	depth := sc.Depth + (rand.Float64()-0.5)*5.0
	if depth < 5 {
		depth = 5
	}

	return models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: mag,
		Depth:     depth,
		Frequency: 10.0 + rand.Float64()*15.0,
		Count:     10 + rand.Intn(20),
		Latitude:  sc.EpicenterLat + (rand.Float64()-0.5)*0.2,
		Longitude: sc.EpicenterLon + (rand.Float64()-0.5)*0.2,
		MMI:       mmiFromMagnitude(sc.Magnitude),
		PGA:       estimatePGA(mag, depth),
		FaultZone: sc.FaultZone,
		Timestamp: time.Now(),
	}
}

func (s *Simulator) aftershockEvent(sc *MegathrustScenario) models.SeismicEvent {
	// Aftershocks decrease over time (Bath's law: largest aftershock ~1 magnitude less)
	mag := sc.Magnitude - 1.0 - rand.Float64()*2.5
	if mag < 2.0 {
		mag = 2.0 + rand.Float64()*1.0
	}
	depth := sc.Depth + rand.Float64()*20.0

	return models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: mag,
		Depth:     depth,
		Frequency: 2.0 + rand.Float64()*3.0,
		Count:     1 + rand.Intn(5),
		Latitude:  sc.EpicenterLat + (rand.Float64()-0.5)*0.8,
		Longitude: sc.EpicenterLon + (rand.Float64()-0.5)*0.8,
		MMI:       estimateMMI(mag, depth),
		PGA:       estimatePGA(mag, depth),
		FaultZone: sc.FaultZone,
		Timestamp: time.Now(),
	}
}

func seismicSeverity(mag float64) string {
	switch {
	case mag >= 7.0:
		return "CRITICAL"
	case mag >= 5.0:
		return "HIGH"
	case mag >= 3.0:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

func estimateMMI(mag, depth float64) int {
	// Simplified MMI estimation
	mmi := int(mag*1.5 - depth*0.02)
	if mmi < 1 {
		mmi = 1
	}
	if mmi > 12 {
		mmi = 12
	}
	return mmi
}

func estimatePGA(mag, depth float64) float64 {
	// Simplified PGA in g
	pga := (mag * 0.15) / (1.0 + depth*0.01)
	if pga < 0.001 {
		pga = 0.001
	}
	return pga
}

func romanMMI(mmi int) string {
	romans := []string{"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
	if mmi < 1 || mmi > 12 {
		return "I"
	}
	return romans[mmi-1]
}

func classifyFaultZone(lat, lon float64) string {
	switch {
	case lon < 100 && lat > 0:
		return "North Sumatra Megathrust"
	case lon < 103:
		return "Mentawai-Siberut Segment"
	case lon < 107:
		return "Sunda Strait Subduction"
	case lon < 113:
		return "Java Trench (South)"
	case lon < 120:
		return "Flores-Banda Arc"
	case lon < 125:
		return "Palu-Koro Fault / Sulawesi"
	default:
		return "Eastern Indonesia Arc"
	}
}
