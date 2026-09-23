package cascading

import (
	"testing"
	"time"

	"gempa-sentinel/internal/models"
)

func TestCascadingEngine_ConfidenceAndProgression(t *testing.T) {
	eng := NewEngine(nil, nil)

	inc := eng.GetActiveIncident()
	if inc.Status != "MONITORING" {
		t.Errorf("expected initial status MONITORING, got %s", inc.Status)
	}
	if inc.ConfidenceScore != 40 {
		t.Errorf("expected initial confidence 40, got %d", inc.ConfidenceScore)
	}

	// 1. Ingest M7.8 Earthquake
	eng.OnSeismicEvent(models.SeismicEvent{
		Type:      "SEISMIC",
		Magnitude: 7.8,
		Depth:     15.0,
		FaultZone: "South Java Trench",
		Timestamp: time.Now(),
	})

	inc = eng.GetActiveIncident()
	if inc.Magnitude != 7.8 {
		t.Errorf("expected magnitude 7.8, got %.1f", inc.Magnitude)
	}
	if inc.Status != "ESCALATING" && inc.Status != "CRITICAL" {
		t.Errorf("expected status ESCALATING or CRITICAL, got %s", inc.Status)
	}

	// 2. Ingest Broadband Station events
	for i := 0; i < 4; i++ {
		eng.OnStationEvent(models.StationEvent{
			StationID:     "LEM",
			StationName:   "Lembang",
			PGARecorded:   0.65,
			SignalQuality: 98.5,
			Timestamp:     time.Now(),
		})
	}

	inc = eng.GetActiveIncident()
	if inc.ConfidenceBreakdown.SeismicStations != 35 {
		t.Errorf("expected SeismicStations breakdown 35, got %d", inc.ConfidenceBreakdown.SeismicStations)
	}

	// 3. Ingest Satellite InSAR coseismic slip
	eng.OnSatelliteEvent(models.SatelliteEvent{
		GroundDisplacement: 120.0,
		CoseismicSlip:      2.4,
		SatelliteID:        "SENTINEL-1A",
		Timestamp:          time.Now(),
	})

	inc = eng.GetActiveIncident()
	if inc.ConfidenceBreakdown.SatelliteInSAR != 15 {
		t.Errorf("expected SatelliteInSAR breakdown 15, got %d", inc.ConfidenceBreakdown.SatelliteInSAR)
	}

	// 4. Ingest Tsunami ocean buoy anomaly
	eng.OnOceanEvent(models.OceanEvent{
		SensorID:   "DART-BUOY-04",
		WaveHeight: 4.2,
		WaveETA:    18,
		Timestamp:  time.Now(),
	})

	inc = eng.GetActiveIncident()
	if inc.ConfidenceBreakdown.TsunamiBuoy != 20 {
		t.Errorf("expected TsunamiBuoy breakdown 20, got %d", inc.ConfidenceBreakdown.TsunamiBuoy)
	}

	// 5. Ingest Critical Infrastructure disruption
	for i := 0; i < 12; i++ {
		eng.OnInfrastructureEvent(models.InfrastructureEvent{
			FacilityID:   "BRIDGE-01",
			FacilityName: "Jembatan Kali Serayu",
			FacilityType: "BRIDGE",
			DamageLevel:  "SEVERE",
			Operational:  false,
			Timestamp:    time.Now(),
		})
	}

	inc = eng.GetActiveIncident()
	if inc.ConfidenceBreakdown.InfrastructureSignal != 10 {
		t.Errorf("expected InfrastructureSignal breakdown 10, got %d", inc.ConfidenceBreakdown.InfrastructureSignal)
	}

	// Total confidence should be 35 + 20 + 15 + 20 + 10 = 100
	if inc.ConfidenceScore != 100 {
		t.Errorf("expected total confidence score 100, got %d", inc.ConfidenceScore)
	}
	if inc.Confidence != 1.0 {
		t.Errorf("expected confidence 1.0, got %.2f", inc.Confidence)
	}
	if inc.Status != "CRITICAL" {
		t.Errorf("expected final status CRITICAL, got %s", inc.Status)
	}

	// Timeline check
	timeline := eng.GetEvolutionTimeline()
	if len(timeline) < 5 {
		t.Errorf("expected at least 5 timeline milestones, got %d", len(timeline))
	}
}
