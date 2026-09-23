package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"gempa-sentinel/internal/models"
)

type usgsGeoJSON struct {
	Features []struct {
		ID         string `json:"id"`
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

// USGSClient fetches real-time earthquakes from USGS GeoJSON API
type USGSClient struct {
	httpClient *http.Client
}

// NewUSGSClient creates a new USGS client
func NewUSGSClient() *USGSClient {
	return &USGSClient{
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

// FetchIndonesiaQuakes gets recent earthquakes within Indonesia bounding box
func (u *USGSClient) FetchIndonesiaQuakes(limit int) ([]models.SeismicEvent, error) {
	if limit <= 0 {
		limit = 15
	}
	url := fmt.Sprintf(
		"https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-11&maxlatitude=6&minlongitude=95&maxlongitude=141&limit=%d&orderby=time",
		limit,
	)

	resp, err := u.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch USGS feed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("USGS feed returned HTTP status %d", resp.StatusCode)
	}

	var data usgsGeoJSON
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode USGS GeoJSON: %w", err)
	}

	var events []models.SeismicEvent
	for _, f := range data.Features {
		if len(f.Geometry.Coordinates) < 3 {
			continue
		}
		lon := f.Geometry.Coordinates[0]
		lat := f.Geometry.Coordinates[1]
		depth := f.Geometry.Coordinates[2]
		mag := f.Properties.Mag
		t := time.UnixMilli(f.Properties.Time)

		mmi := int(mag*1.5 - depth*0.015)
		if mmi < 1 {
			mmi = 1
		}
		if mmi > 12 {
			mmi = 12
		}

		pga := (mag * 0.14) / (1.0 + depth*0.01)
		if pga < 0.001 {
			pga = 0.001
		}

		events = append(events, models.SeismicEvent{
			Type:      "SEISMIC",
			Magnitude: mag,
			Depth:     depth,
			Frequency: 1.0 + mag*0.5,
			Count:     1,
			Latitude:  lat,
			Longitude: lon,
			MMI:       mmi,
			PGA:       pga,
			FaultZone: f.Properties.Place,
			Timestamp: t,
		})
	}

	return events, nil
}
