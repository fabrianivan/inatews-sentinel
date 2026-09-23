package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gempa-sentinel/internal/cascading"
	"gempa-sentinel/internal/connectors"
	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/models"
	"gempa-sentinel/internal/simulator"
)

type mockSimulator struct{}

func (m *mockSimulator) TriggerMegathrustScenario(id string) {}
func (m *mockSimulator) TriggerVolcanicEscalation()          {}
func (m *mockSimulator) TriggerTsunami()                     {}
func (m *mockSimulator) TriggerReal2018Disaster()            {}
func (m *mockSimulator) Reset()                              {}
func (m *mockSimulator) GetStatus() models.SystemStatus      { return models.SystemStatus{} }

func setupTestServer(t *testing.T) *Server {
	h := hub.NewSSEHub()
	sim := &mockSimulator{}

	connMgr := connectors.NewManager("test-cluster")

	cas := cascading.NewEngine(nil, h)
	rep := simulator.NewReplayManager(nil, h, cas)

	s := NewServer(h, sim, connMgr, "8080", "*")
	s.SetCascadingEngine(cas)
	s.SetReplayManager(rep)
	return s
}

func TestGetIncidentAndEvolution(t *testing.T) {
	s := setupTestServer(t)

	// 1. GET /api/incidents/active
	req, _ := http.NewRequest("GET", "/api/incidents/active", nil)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var inc models.IncidentEvent
	if err := json.Unmarshal(w.Body.Bytes(), &inc); err != nil {
		t.Fatalf("failed to unmarshal incident: %v", err)
	}
	if inc.IncidentID == "" {
		t.Fatalf("expected non-empty incident ID")
	}

	// 2. GET /api/incidents/evolution
	req2, _ := http.NewRequest("GET", "/api/incidents/evolution", nil)
	w2 := httptest.NewRecorder()
	s.router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w2.Code)
	}

	var timeline []models.IncidentTimelineItem
	if err := json.Unmarshal(w2.Body.Bytes(), &timeline); err != nil {
		t.Fatalf("failed to unmarshal timeline: %v", err)
	}
	if len(timeline) == 0 {
		t.Fatalf("expected at least one timeline item")
	}
}

func TestReplayEndpoints(t *testing.T) {
	s := setupTestServer(t)

	// 1. GET /api/replay/status
	req, _ := http.NewRequest("GET", "/api/replay/status", nil)
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// 2. POST /api/replay/start
	body, _ := json.Marshal(map[string]interface{}{
		"scenario_id": "south-java-m78",
		"speed":       2,
	})
	req2, _ := http.NewRequest("POST", "/api/replay/start", bytes.NewBuffer(body))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	s.router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	// 3. POST /api/replay/step
	req3, _ := http.NewRequest("POST", "/api/replay/step", nil)
	w3 := httptest.NewRecorder()
	s.router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w3.Code)
	}

	// 4. POST /api/replay/pause
	req4, _ := http.NewRequest("POST", "/api/replay/pause", nil)
	w4 := httptest.NewRecorder()
	s.router.ServeHTTP(w4, req4)
	if w4.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w4.Code)
	}

	// 5. POST /api/replay/resume
	req5, _ := http.NewRequest("POST", "/api/replay/resume", nil)
	w5 := httptest.NewRecorder()
	s.router.ServeHTTP(w5, req5)
	if w5.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w5.Code)
	}

	// 6. POST /api/replay/reset
	req6, _ := http.NewRequest("POST", "/api/replay/reset", nil)
	w6 := httptest.NewRecorder()
	s.router.ServeHTTP(w6, req6)
	if w6.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w6.Code)
	}
}
