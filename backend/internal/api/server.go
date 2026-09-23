package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"time"

	"gempa-sentinel/internal/cascading"
	"gempa-sentinel/internal/connectors"
	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/models"
	"gempa-sentinel/internal/realtime"
	"gempa-sentinel/internal/simulator"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Server is the main API server
type Server struct {
	router       *gin.Engine
	hub          *hub.SSEHub
	sim          Simulator
	ingestor     *realtime.Ingestor
	connectorMgr *connectors.Manager
	cascade      *cascading.Engine
	replay       *simulator.ReplayManager
	port         string
	corsOrigin   string
}

// Simulator defines the interface for the event simulator
type Simulator interface {
	TriggerMegathrustScenario(id string)
	TriggerVolcanicEscalation()
	TriggerTsunami()
	TriggerReal2018Disaster()
	Reset()
	GetStatus() models.SystemStatus
}

// NewServer creates a new API server
func NewServer(h *hub.SSEHub, sim Simulator, connMgr *connectors.Manager, port, corsOrigin string) *Server {
	gin.SetMode(gin.ReleaseMode)

	s := &Server{
		hub:          h,
		sim:          sim,
		connectorMgr: connMgr,
		port:         port,
		corsOrigin:   corsOrigin,
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{corsOrigin, "http://localhost:3000", "http://localhost:3001"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Cache-Control"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// SSE streaming endpoints
	r.GET("/api/events/stream", s.handleEventStream)
	r.GET("/api/metrics/stream", s.handleMetricsStream)
	r.GET("/api/alerts/stream", s.handleAlertsStream)
	r.GET("/api/stream", s.handleAllStream)

	// REST endpoints
	r.POST("/api/simulate/volcanic-escalation", s.handleVolcanicEscalation)
	r.POST("/api/simulate/tsunami", s.handleTsunamiScenario)
	r.POST("/api/simulate/real-2018", s.handleReal2018Disaster)
	r.POST("/api/simulate/scenario/:id", s.handleScenarioTrigger)
	r.POST("/api/simulate/reset", s.handleReset)
	r.POST("/api/mode", s.handleModeToggle)
	r.GET("/api/realtime/summary", s.handleRealtimeSummary)
	r.GET("/api/realtime/earthquakes", s.handleRealtimeEarthquakes)
	r.GET("/api/earthquakes", s.handleRealtimeEarthquakes)
	r.GET("/api/earthquake", s.handleRealtimeEarthquakes)
	r.GET("/api/quake/latest", s.handleRealtimeEarthquakes)
	r.GET("/api/quake/recent", s.handleRealtimeEarthquakes)
	r.GET("/api/bmkg/latest", s.handleLatestBMKG)
	r.GET("/api/bmkg/recent", s.handleRecentBMKG)
	r.GET("/api/usgs/latest", s.handleLatestUSGS)
	r.GET("/api/usgs/recent", s.handleRecentUSGS)
	r.GET("/api/realtime/stations", s.handleRealtimeStations)
	r.GET("/api/realtime/volcanoes", s.handleRealtimeVolcanoes)
	r.GET("/api/status", s.handleStatus)
	r.GET("/api/governance", s.handleGovernance)
	r.GET("/api/health", s.handleHealth)

	// Connector management endpoints
	r.GET("/api/connectors", s.handleGetConnectors)
	r.POST("/api/connectors/:name/action", s.handleConnectorAction)
	r.POST("/api/webhook/alerts", s.handleWebhookAlert)

	// Cascading Incident & Disaster Replay endpoints
	r.GET("/api/incidents/active", s.handleGetActiveIncident)
	r.GET("/api/incidents/evolution", s.handleGetIncidentEvolution)
	r.GET("/api/replay/status", s.handleGetReplayStatus)
	r.POST("/api/replay/start", s.handleReplayStart)
	r.POST("/api/replay/pause", s.handleReplayPause)
	r.POST("/api/replay/resume", s.handleReplayResume)
	r.POST("/api/replay/reset", s.handleReplayReset)
	r.POST("/api/replay/step", s.handleReplayStep)

	s.router = r
	return s
}

// Start begins listening for HTTP connections
func (s *Server) Start() error {
	addr := fmt.Sprintf(":%s", s.port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Printf("[WARN] Port :%s busy or unavailable (%v), trying fallback port :8081...", s.port, err)
		fallbackAddr := ":8081"
		lnFallback, errFallback := net.Listen("tcp", fallbackAddr)
		if errFallback == nil {
			log.Printf("[INFO] API server starting on fallback %s", fallbackAddr)
			s.port = "8081"
			return http.Serve(lnFallback, s.router)
		}
		return fmt.Errorf("failed to bind port %s and fallback 8081: %w", s.port, err)
	}

	log.Printf("[INFO] API server starting on %s", addr)
	return http.Serve(ln, s.router)
}

// --- SSE Handlers ---

func (s *Server) handleAllStream(c *gin.Context) {
	s.streamSSE(c, "all")
}

func (s *Server) handleEventStream(c *gin.Context) {
	s.streamSSE(c, "event")
}

func (s *Server) handleMetricsStream(c *gin.Context) {
	s.streamSSE(c, "metrics")
}

func (s *Server) handleAlertsStream(c *gin.Context) {
	s.streamSSE(c, "correlated_alert")
}

func (s *Server) streamSSE(c *gin.Context, eventType string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	ch := s.hub.Subscribe(eventType)
	defer s.hub.Unsubscribe(eventType, ch)

	c.Stream(func(w io.Writer) bool {
		select {
		case msg, ok := <-ch:
			if !ok {
				return false
			}
			c.Writer.WriteString(msg)
			c.Writer.Flush()
			return true
		case <-c.Request.Context().Done():
			return false
		}
	})
}

// --- REST Handlers ---

func (s *Server) handleVolcanicEscalation(c *gin.Context) {
	log.Println("[INFO] API: Escalation triggered")
	s.sim.TriggerVolcanicEscalation()

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Escalation scenario triggered",
	})
}

func (s *Server) handleTsunamiScenario(c *gin.Context) {
	log.Println("[INFO] API: Tsunami scenario triggered")
	s.sim.TriggerTsunami()

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Tsunami scenario triggered",
	})
}

func (s *Server) handleReal2018Disaster(c *gin.Context) {
	log.Println("[INFO] API: Real disaster replay triggered")
	s.sim.TriggerReal2018Disaster()

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Historical Real Flank Collapse & Tsunami replay initiated",
	})
}

func (s *Server) handleScenarioTrigger(c *gin.Context) {
	id := c.Param("id")
	log.Printf("[INFO] API: Megathrust scenario '%s' triggered", id)
	s.sim.TriggerMegathrustScenario(id)

	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"scenario": id,
		"message":  fmt.Sprintf("Scenario '%s' triggered", id),
	})
}

func (s *Server) handleReset(c *gin.Context) {
	log.Println("[INFO] API: System reset")
	s.sim.Reset()

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "System reset to normal baseline",
	})
}

func (s *Server) handleStatus(c *gin.Context) {
	var status models.SystemStatus
	if s.ingestor != nil && s.ingestor.GetMode() == "real" {
		status = s.ingestor.GetStatus()
	} else {
		status = s.sim.GetStatus()
	}

	c.JSON(http.StatusOK, status)
}

func (s *Server) handleRealtimeEarthquakes(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"error": "ingestor not initialized"})
		return
	}
	c.JSON(http.StatusOK, s.ingestor.GetEarthquakes())
}

func (s *Server) handleLatestBMKG(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"error": "ingestor not initialized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"latest_bmkg": s.ingestor.GetLatestBMKG(),
		"timestamp":   time.Now(),
	})
}

func (s *Server) handleRecentBMKG(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"error": "ingestor not initialized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"recent_bmkg": s.ingestor.GetRecentBMKG(),
		"timestamp":   time.Now(),
	})
}

func (s *Server) handleLatestUSGS(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"error": "ingestor not initialized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"latest_usgs": s.ingestor.GetLatestUSGS(),
		"timestamp":   time.Now(),
	})
}

func (s *Server) handleRecentUSGS(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"error": "ingestor not initialized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"recent_usgs": s.ingestor.GetRecentUSGS(),
		"timestamp":   time.Now(),
	})
}

func (s *Server) handleRealtimeStations(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"stations": []interface{}{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"stations": s.ingestor.GetStations(),
		"total":    len(s.ingestor.GetStations()),
	})
}

func (s *Server) handleRealtimeVolcanoes(c *gin.Context) {
	if s.ingestor != nil {
		c.JSON(http.StatusOK, s.ingestor.GetVolcanoEruptions())
		return
	}
	vc := realtime.NewVolcanoClient()
	list, _ := vc.FetchLatestEruptions(c.Request.Context())
	c.JSON(http.StatusOK, list)
}

func (s *Server) handleGovernance(c *gin.Context) {
	governance := []models.GovernanceInfo{
		{Topic: "gempa.seismic", Classification: "Scientific", PII: "None", SchemaVersion: "v1", Owner: "BMKG Seismology", Access: "Public"},
		{Topic: "gempa.stations", Classification: "Scientific", PII: "None", SchemaVersion: "v1", Owner: "BMKG Network Ops", Access: "Public"},
		{Topic: "gempa.tsunami", Classification: "Scientific", PII: "None", SchemaVersion: "v1", Owner: "InaTEWS Ocean Sensors", Access: "Public"},
		{Topic: "gempa.weather", Classification: "Scientific", PII: "None", SchemaVersion: "v1", Owner: "BMKG Meteorology", Access: "Public"},
		{Topic: "gempa.satellite", Classification: "Scientific", PII: "None", SchemaVersion: "v1", Owner: "BRIN / InSAR Ops", Access: "Public"},
		{Topic: "gempa.infrastructure", Classification: "Operational", PII: "Potential", SchemaVersion: "v1", Owner: "PUPR & BNPB", Access: "Restricted"},
		{Topic: "gempa.population", Classification: "Sensitive", PII: "Yes", SchemaVersion: "v2", Owner: "BNPB Disaster Relief", Access: "Restricted"},
		{Topic: "gempa.intensity_index", Classification: "Derived", PII: "None", SchemaVersion: "v1", Owner: "Flink Pipeline", Access: "Internal"},
		{Topic: "gempa.correlated_alerts", Classification: "Derived", PII: "None", SchemaVersion: "v1", Owner: "Flink Pipeline", Access: "Internal"},
		{Topic: "gempa.tsunami_scenarios", Classification: "Derived", PII: "None", SchemaVersion: "v1", Owner: "Flink Pipeline", Access: "Internal"},
	}
	c.JSON(http.StatusOK, governance)
}

func (s *Server) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":      "healthy",
		"service":     "krakatau-sentinel",
		"sse_clients": s.hub.ClientCount(),
		"timestamp":   time.Now(),
	})
}

// handleGetConnectors returns all connector statuses
func (s *Server) handleGetConnectors(c *gin.Context) {
	if s.connectorMgr == nil {
		c.JSON(http.StatusOK, []models.ConnectorInfo{})
		return
	}
	connectors := s.connectorMgr.GetConnectors()
	c.JSON(http.StatusOK, connectors)
}

// handleConnectorAction performs an action on a connector (pause, resume, restart)
func (s *Server) handleConnectorAction(c *gin.Context) {
	if s.connectorMgr == nil {
		c.JSON(http.StatusServiceUnavailable, models.ConnectorActionResponse{
			Success: false,
			Message: "Connector manager not initialized",
		})
		return
	}

	name := c.Param("name")
	var req models.ConnectorActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ConnectorActionResponse{
			Success: false,
			Message: "Invalid request body: " + err.Error(),
		})
		return
	}

	var err error
	switch req.Action {
	case "pause":
		err = s.connectorMgr.PauseConnector(name)
	case "resume":
		err = s.connectorMgr.ResumeConnector(name)
	case "restart":
		err = s.connectorMgr.RestartConnector(name)
	default:
		c.JSON(http.StatusBadRequest, models.ConnectorActionResponse{
			Success: false,
			Message: "Invalid action: must be pause, resume, or restart",
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ConnectorActionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ConnectorActionResponse{
		Success: true,
		Message: fmt.Sprintf("Connector %s %s successfully", name, req.Action),
	})
}

// handleWebhookAlert receives alerts from HttpSink connector or external webhooks
func (s *Server) handleWebhookAlert(c *gin.Context) {
	var payload models.WebhookAlertPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		// Accept any JSON payload
		var raw map[string]interface{}
		if err2 := c.ShouldBindJSON(&raw); err2 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON payload"})
			return
		}
		payload = models.WebhookAlertPayload{
			AlertLevel:           "INFO",
			CorrelatedIndicators: []string{"webhook"},
			TimeWindow:           "real-time",
			Description:          "Alert received via webhook",
			Timestamp:            time.Now(),
			Raw:                  raw,
		}
	}

	// Record in connector manager for telemetry
	if s.connectorMgr != nil {
		rawMap := make(map[string]interface{})
		b, _ := json.Marshal(payload)
		_ = json.Unmarshal(b, &rawMap)
		s.connectorMgr.RecordWebhookAlert(rawMap)
	}

	// Broadcast to SSE clients
	alertData := map[string]interface{}{
		"event": "connector_alert",
		"data":  payload,
	}
	alertJSON, _ := json.Marshal(alertData)
	s.hub.BroadcastAll("connector_alert", string(alertJSON))

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Alert received and broadcasted",
	})
}

// SetIngestor binds the real-time ingestor
func (s *Server) SetIngestor(ing *realtime.Ingestor) {
	s.ingestor = ing
}

// SetConnectorManager binds the connector manager
func (s *Server) SetConnectorManager(mgr *connectors.Manager) {
	s.connectorMgr = mgr
}

// SetCascadingEngine binds the cascading impact engine
func (s *Server) SetCascadingEngine(c *cascading.Engine) {
	s.cascade = c
}

// SetReplayManager binds the disaster incident replay manager
func (s *Server) SetReplayManager(r *simulator.ReplayManager) {
	s.replay = r
}

func (s *Server) handleModeToggle(c *gin.Context) {
	var body struct {
		Mode string `json:"mode"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mode is required"})
		return
	}

	if s.ingestor != nil {
		s.ingestor.SetMode(body.Mode)
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"mode":   body.Mode,
	})
}

func (s *Server) handleRealtimeSummary(c *gin.Context) {
	if s.ingestor == nil {
		c.JSON(http.StatusOK, gin.H{"status": "ingestor not initialized"})
		return
	}
	c.JSON(http.StatusOK, s.ingestor.GetSummary())
}

// --- Cascading Incident & Disaster Replay Handlers ---

func (s *Server) handleGetActiveIncident(c *gin.Context) {
	if s.cascade == nil {
		c.JSON(http.StatusOK, models.IncidentEvent{
			IncidentID: "INC-20260915-001",
			Status:     "MONITORING",
		})
		return
	}
	c.JSON(http.StatusOK, s.cascade.GetActiveIncident())
}

func (s *Server) handleGetIncidentEvolution(c *gin.Context) {
	if s.cascade == nil {
		c.JSON(http.StatusOK, []models.IncidentTimelineItem{})
		return
	}
	c.JSON(http.StatusOK, s.cascade.GetEvolutionTimeline())
}

func (s *Server) handleGetReplayStatus(c *gin.Context) {
	if s.replay == nil {
		c.JSON(http.StatusOK, models.ReplayStatus{
			Active:    false,
			StageName: "STANDBY",
		})
		return
	}
	c.JSON(http.StatusOK, s.replay.GetStatus())
}

type ReplayStartRequest struct {
	ScenarioID string `json:"scenario_id"`
	Speed      int    `json:"speed"`
}

func (s *Server) handleReplayStart(c *gin.Context) {
	if s.replay == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "replay manager not configured"})
		return
	}
	var req ReplayStartRequest
	_ = c.ShouldBindJSON(&req)
	if req.ScenarioID == "" {
		req.ScenarioID = "south-java-m78"
	}
	if req.Speed <= 0 {
		req.Speed = 1
	}

	err := s.replay.Start(req.ScenarioID, req.Speed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": fmt.Sprintf("Disaster Replay started: %s (Speed: %dx)", req.ScenarioID, req.Speed),
		"replay":  s.replay.GetStatus(),
	})
}

func (s *Server) handleReplayPause(c *gin.Context) {
	if s.replay != nil {
		s.replay.Pause()
	}
	c.JSON(http.StatusOK, gin.H{"status": "paused"})
}

func (s *Server) handleReplayResume(c *gin.Context) {
	if s.replay != nil {
		s.replay.Resume()
	}
	c.JSON(http.StatusOK, gin.H{"status": "resumed"})
}

func (s *Server) handleReplayReset(c *gin.Context) {
	if s.replay != nil {
		s.replay.Reset()
	}
	c.JSON(http.StatusOK, gin.H{"status": "reset"})
}

func (s *Server) handleReplayStep(c *gin.Context) {
	if s.replay != nil {
		s.replay.Step()
	}
	c.JSON(http.StatusOK, gin.H{"status": "stepped"})
}

