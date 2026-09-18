package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"gempa-sentinel/internal/models"
)

type openMeteoResponse struct {
	CurrentWeather struct {
		Time          string  `json:"time"`
		Temperature   float64 `json:"temperature"`
		Windspeed     float64 `json:"windspeed"`
		Winddirection float64 `json:"winddirection"`
		Weathercode   int     `json:"weathercode"`
	} `json:"current_weather"`
}

// WeatherClient fetches real-time meteorological conditions from Open-Meteo
type WeatherClient struct {
	httpClient *http.Client
}

// NewWeatherClient creates a new weather client
func NewWeatherClient() *WeatherClient {
	return &WeatherClient{
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

// Key Indonesian subduction coordinates for weather sampling
var WeatherStations = []struct {
	Name string
	Lat  float64
	Lon  float64
}{
	{"Sunda Strait Coast (Anyer/Carita)", -6.15, 105.85},
	{"South Java Ocean (Cilacap)", -7.72, 109.01},
	{"West Sumatra Trench (Padang)", -0.95, 100.35},
	{"Palu Bay Coast (Central Sulawesi)", -0.89, 119.87},
	{"Banda Sea Offshore (Ambon)", -3.70, 128.18},
}

// FetchStationWeather gets live meteorological observation for a coordinate
func (w *WeatherClient) FetchStationWeather(lat, lon float64, stationName string) (*models.WeatherEvent, error) {
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current_weather=true",
		lat, lon,
	)

	resp, err := w.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Open-Meteo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Open-Meteo HTTP status %d", resp.StatusCode)
	}

	var data openMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode Open-Meteo: %w", err)
	}

	windDirStr := degreesToCompass(data.CurrentWeather.Winddirection)
	pressure := 1010.0 + (data.CurrentWeather.Windspeed * -0.2) // approximated atmospheric pressure

	event := &models.WeatherEvent{
		Type:                "WEATHER",
		AtmosphericPressure: pressure,
		WindSpeed:           data.CurrentWeather.Windspeed,
		WindDirection:       windDirStr,
		Rainfall:            0.0,
		Temperature:         data.CurrentWeather.Temperature,
		Humidity:            75.0,
		Timestamp:           time.Now(),
	}
	event.Anomaly, event.AnomalySeverity = models.ClassifyWeatherAnomaly(*event)
	return event, nil
}

func degreesToCompass(deg float64) string {
	val := int((deg / 22.5) + 0.5)
	compass := []string{
		"N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
		"S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
	}
	return compass[val%16]
}
