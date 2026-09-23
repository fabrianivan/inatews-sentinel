package simulator_test

import (
	"testing"

	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/simulator"
)

func TestSimulatorStatusAndReset(t *testing.T) {
	h := hub.NewSSEHub()
	// Pass nil producer for testing simulator status/reset logic
	sim := simulator.NewSimulator(nil, h)

	status := sim.GetStatus()
	if status.RiskLevel == "" {
		t.Error("Expected non-empty risk level")
	}

	sim.Reset()
	resetStatus := sim.GetStatus()
	if resetStatus.SeismicIntensity <= 0 {
		t.Errorf("Expected positive baseline activity index, got %f", resetStatus.SeismicIntensity)
	}
}
