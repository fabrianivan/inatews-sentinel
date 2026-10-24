package cascading

import (
	"testing"
	"time"
)

func TestEvaluateCascadingThreat(t *testing.T) {
	event := SeismicEvent{
		Magnitude:      7.9,
		DepthKm:        15.0,
		IsOffshore:     true,
		DistanceToCity: 45.0,
		RecordedAt:     time.Now(),
	}

	eval := EvaluateCascadingThreat(event, 80.0, 35.0)

	if eval.TsunamiThreatLevel != ThreatCritical {
		t.Fatalf("expected Critical tsunami threat for M7.9 offshore shallow event, got %s", eval.TsunamiThreatLevel)
	}

	if eval.CompoundRiskScore < 70.0 {
		t.Fatalf("expected high compound risk score, got %f", eval.CompoundRiskScore)
	}

	if eval.EvacuationUrgency != "IMMEDIATE_MANDATORY_EVACUATION" {
		t.Fatalf("expected immediate mandatory evacuation, got %s", eval.EvacuationUrgency)
	}
}
