package models_test

import (
	"encoding/json"
	"testing"
	"time"

	"gempa-sentinel/internal/models"
)

func TestSeismicEventJSON(t *testing.T) {
	now := time.Now().UTC()
	event := models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: 2.8,
		Depth:     5.2,
		Frequency: 4.5,
		Count:     14,
		Latitude:  -6.102,
		Longitude: 105.423,
		Timestamp: now,
	}

	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("Failed to marshal SeismicEvent: %v", err)
	}

	var decoded models.SeismicEvent
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal SeismicEvent: %v", err)
	}

	if decoded.Magnitude != 2.8 || decoded.Depth != 5.2 {
		t.Errorf("Unexpected values: got mag=%.1f, depth=%.1f", decoded.Magnitude, decoded.Depth)
	}
	if decoded.Type != "SEISMIC" {
		t.Errorf("Unexpected type: %s", decoded.Type)
	}
}

func TestActivityIndexJSON(t *testing.T) {
	now := time.Now().UTC()
	idx := models.ActivityIndex{
		OverallPercentage: 78.5,
		SeismicChange:     240.0,
		TremorChange:      180.0,
		DeformationTrend:  "RAPID_INFLATION",
		ThermalTrend:      "ANOMALOUS_HEATING",
		TrendDirection:    "INCREASING",
		EarthquakeCount:   18,
		AvgMagnitude:      2.4,
		MaxMagnitude:      3.1,
		Timestamp:         now,
	}

	data, err := json.Marshal(idx)
	if err != nil {
		t.Fatalf("Failed to marshal ActivityIndex: %v", err)
	}

	var decoded models.ActivityIndex
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal ActivityIndex: %v", err)
	}

	if decoded.OverallPercentage != 78.5 || decoded.TrendDirection != "INCREASING" {
		t.Errorf("Decoded mismatch: %+v", decoded)
	}
	if decoded.EarthquakeCount != 18 {
		t.Errorf("Expected 18 earthquakes, got %d", decoded.EarthquakeCount)
	}
}

func TestClassifyWeatherAnomaly(t *testing.T) {
	tests := []struct {
		name     string
		wind     float64
		pressure float64
		anomaly  string
		severity string
	}{
		{name: "warning proxy", wind: 115, pressure: 992, anomaly: "TORNADO WARNING PROXY", severity: "CRITICAL"},
		{name: "watch proxy", wind: 95, pressure: 998, anomaly: "TORNADO WATCH PROXY", severity: "HIGH"},
		{name: "normal", wind: 40, pressure: 1012, anomaly: "", severity: "LOW"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			anomaly, severity := models.ClassifyWeatherAnomaly(models.WeatherEvent{
				WindSpeed:           tt.wind,
				AtmosphericPressure: tt.pressure,
			})
			if anomaly != tt.anomaly || severity != tt.severity {
				t.Fatalf("got anomaly=%q severity=%q, want anomaly=%q severity=%q", anomaly, severity, tt.anomaly, tt.severity)
			}
		})
	}
}

func TestAIAnalysisJSON(t *testing.T) {
	now := time.Now().UTC()
	ai := models.AIAnalysis{
		Status:          "ELEVATED ACTIVITY",
		Observations:    []string{"Seismic activity up 240%", "Tremor up 180%"},
		Assessment:      "Consistent with magma migration at shallow depth.",
		Recommendations: []string{"Increase monitoring", "Review exclusion zone"},
		Confidence:      85.0,
		Disclaimer:      "Decision-support assessment, not an eruption prediction.",
		ContributingFactors: []models.ContributingFactor{
			{
				Indicator:    "Seismic Frequency",
				Value:        "14 events/hr",
				Change:       "+240%",
				Significance: 0.85,
			},
		},
		Timestamp: now,
	}

	data, err := json.Marshal(ai)
	if err != nil {
		t.Fatalf("Failed to marshal AIAnalysis: %v", err)
	}

	var decoded models.AIAnalysis
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal AIAnalysis: %v", err)
	}

	if decoded.Status != "ELEVATED ACTIVITY" || decoded.Confidence != 85.0 {
		t.Errorf("Decoded mismatch: %+v", decoded)
	}
	if len(decoded.ContributingFactors) != 1 {
		t.Errorf("Expected 1 factor, got %d", len(decoded.ContributingFactors))
	}
}

func TestCorrelatedAlertJSON(t *testing.T) {
	// 1. Test Array representation
	arrayJSON := `{"alert_level":"CRITICAL","correlated_indicators":["Seismic Alert","PGA Spike"],"time_window":"2026-09-09 to 2026-09-09","description":"High risk","timestamp":"2026-09-09T03:00:00Z"}`
	var alert1 models.CorrelatedAlert
	if err := json.Unmarshal([]byte(arrayJSON), &alert1); err != nil {
		t.Fatalf("Failed to unmarshal array CorrelatedAlert: %v", err)
	}
	if len(alert1.CorrelatedIndicators) != 2 || alert1.CorrelatedIndicators[0] != "Seismic Alert" {
		t.Errorf("Unexpected CorrelatedIndicators: %v", alert1.CorrelatedIndicators)
	}

	// 2. Test String representation (backward-compatibility / raw text)
	strJSON := `{"alert_level":"HIGH","correlated_indicators":"Seismic(M7.2) StationPGA(0.35g)","time_window":"2026-09-09 to 2026-09-09","description":"Warning","timestamp":"2026-09-09T03:00:00Z"}`
	var alert2 models.CorrelatedAlert
	if err := json.Unmarshal([]byte(strJSON), &alert2); err != nil {
		t.Fatalf("Failed to unmarshal string CorrelatedAlert: %v", err)
	}
	if len(alert2.CorrelatedIndicators) != 2 {
		t.Errorf("Expected 2 indicators, got: %v", alert2.CorrelatedIndicators)
	}
}

func TestTsunamiScenarioJSON(t *testing.T) {
	// 1. Test Array representation
	arrayJSON := `{"active":true,"detection_time":"2026-09-09T03:00:00Z","sensor_id":"IOC-01","wave_anomaly":4.5,"affected_zones":["Padang","Mentawai"],"response_actions":["Evacuate"],"severity":"CRITICAL","timestamp":"2026-09-09T03:00:00Z"}`
	var ts1 models.TsunamiScenario
	if err := json.Unmarshal([]byte(arrayJSON), &ts1); err != nil {
		t.Fatalf("Failed to unmarshal array TsunamiScenario: %v", err)
	}
	if len(ts1.AffectedZones) != 2 || ts1.AffectedZones[0] != "Padang" {
		t.Errorf("Unexpected AffectedZones: %v", ts1.AffectedZones)
	}

	// 2. Test Comma-separated string representation
	strJSON := `{"active":true,"detection_time":"2026-09-09T03:00:00Z","sensor_id":"IOC-01","wave_anomaly":4.5,"affected_zones":"Padang, Mentawai, Cilacap","response_actions":"Evacuate, Sirens","severity":"CRITICAL","timestamp":"2026-09-09T03:00:00Z"}`
	var ts2 models.TsunamiScenario
	if err := json.Unmarshal([]byte(strJSON), &ts2); err != nil {
		t.Fatalf("Failed to unmarshal string TsunamiScenario: %v", err)
	}
	if len(ts2.AffectedZones) != 3 || ts2.AffectedZones[1] != "Mentawai" {
		t.Errorf("Unexpected AffectedZones: %v", ts2.AffectedZones)
	}
}
