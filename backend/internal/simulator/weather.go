package simulator

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/models"
)

var windDirections = []string{"N", "NE", "E", "SE", "S", "SW", "W", "NW"}

// openMeteoResponse represents Open-Meteo API response
type openMeteoResponse struct {
	Current struct {
		Temperature2m    float64 `json:"temperature_2m"`
		RelativeHumidity float64 `json:"relative_humidity_2m"`
		SurfacePressure  float64 `json:"surface_pressure"`
		WindSpeed10m     float64 `json:"wind_speed_10m"`
		WindDirection10m float64 `json:"wind_direction_10m"`
	} `json:"current"`
}

// fetchRealWeather fetches actual real-time weather at Anak Krakatau (-6.102, 105.423)
func fetchRealWeather() *models.WeatherEvent {
	client := http.Client{Timeout: 4 * time.Second}
	url := "https://api.open-meteo.com/v1/forecast?latitude=-6.102&longitude=105.423&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m"

	resp, err := client.Get(url)
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil
	}
	defer resp.Body.Close()

	var data openMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil
	}

	// Convert wind direction degrees to compass
	deg := int(data.Current.WindDirection10m) % 360
	compass := windDirections[(deg+22)/45%8]

	return &models.WeatherEvent{
		Type:                "WEATHER",
		WindSpeed:           data.Current.WindSpeed10m,
		WindDirection:       compass,
		Rainfall:            0,
		AtmosphericPressure: data.Current.SurfacePressure,
		Temperature:         data.Current.Temperature2m,
		Humidity:            data.Current.RelativeHumidity,
		Timestamp:           time.Now(),
	}
}

// generateWeatherEvents produces real and simulated weather station readings
func (s *Simulator) generateWeatherEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			// Attempt to fetch real weather from Open-Meteo
			eventPtr := fetchRealWeather()
			var event models.WeatherEvent

			if eventPtr != nil {
				event = *eventPtr
			} else {
				// Fallback baseline
				event = models.WeatherEvent{
					Type:                "WEATHER",
					WindSpeed:           12 + rand.Float64()*15,
					WindDirection:       windDirections[rand.Intn(len(windDirections))],
					Rainfall:            rand.Float64() * 5,
					AtmosphericPressure: 1008 + rand.Float64()*6,
					Temperature:         26 + rand.Float64()*4,
					Humidity:            70 + rand.Float64()*15,
					Timestamp:           time.Now(),
				}
			}
			event.Anomaly, event.AnomalySeverity = models.ClassifyWeatherAnomaly(event)
			s.mu.Lock()
			s.latestWeatherAnomaly = event.Anomaly
			s.mu.Unlock()

			_ = s.producer.Produce(config.TopicNames.Weather, "station-krakatau", event)
			severity := "LOW"
			description := fmt.Sprintf("Real-time Wind %.0fkm/h %s, pressure %.0fhPa, temp %.1f°C", event.WindSpeed, event.WindDirection, event.AtmosphericPressure, event.Temperature)
			if event.Anomaly != "" {
				severity = event.AnomalySeverity
				description = fmt.Sprintf("[%s] Wind %.0fkm/h %s, pressure %.0fhPa. Verifikasi radar BMKG diperlukan.", event.Anomaly, event.WindSpeed, event.WindDirection, event.AtmosphericPressure)
			}
			s.hub.BroadcastAll("event", map[string]interface{}{
				"type":        "WEATHER",
				"description": description,
				"severity":    severity,
				"timestamp":   event.Timestamp,
				"data":        event,
			})

			time.Sleep(jitter(15*time.Second, 0.3))
		}
	}
}
