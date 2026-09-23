package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"gempa-sentinel/internal/models"
)

type iocStationData struct {
	Code        string  `json:"Code"`
	Location    string  `json:"Location"`
	Country     string  `json:"country"`
	Lat         float64 `json:"Lat"`
	Lon         float64 `json:"Lon"`
	LastTime    string  `json:"lasttime"`
	LastValue   float64 `json:"lastvalue"`
	Sensor      string  `json:"sensor"`
	Status      int     `json:"status"`
	Units       string  `json:"units"`
	CountryName string  `json:"countryname"`
}

// OceanClient fetches live sea level and tide gauge readings from IOC Sea Level Facility
type OceanClient struct {
	httpClient *http.Client
}

// NewOceanClient creates a new Ocean client
func NewOceanClient() *OceanClient {
	return &OceanClient{
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// FetchIndonesiaTideGauges fetches current water level displacement across Indonesian coastal stations
func (o *OceanClient) FetchIndonesiaTideGauges() ([]models.OceanEvent, error) {
	url := "http://www.ioc-sealevelmonitoring.org/service.php?format=json&query=stationlist"
	resp, err := o.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch IOC sea level data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IOC service returned HTTP status %d", resp.StatusCode)
	}

	var allStations []iocStationData
	if err := json.NewDecoder(resp.Body).Decode(&allStations); err != nil {
		return nil, fmt.Errorf("failed to decode IOC response: %w", err)
	}

	var events []models.OceanEvent
	seen := make(map[string]bool)

	for _, s := range allStations {
		if s.Country != "IDN" && s.CountryName != "Indonesia" {
			continue
		}
		if seen[s.Code] {
			continue
		}
		seen[s.Code] = true

		// Calculate anomaly against nominal sea level (~2.0m baseline)
		waveHeight := s.LastValue
		if waveHeight < 0 {
			waveHeight = 0.5
		}
		displacement := waveHeight - 1.8
		if displacement < 0 {
			displacement = 0.05
		}
		events = append(events, models.OceanEvent{
			Type:                 "OCEAN",
			SensorID:             fmt.Sprintf("IOC-%s", s.Code),
			SeaLevel:             waveHeight,
			WaveHeight:           displacement,
			TsunamiSensorReading: displacement,
			BuoyData:             waveHeight,
			WaveETA:              15,
			Latitude:             s.Lat,
			Longitude:            s.Lon,
			Timestamp:            time.Now(),
		})
	}

	return events, nil
}
