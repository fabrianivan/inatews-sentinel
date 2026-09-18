package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"gempa-sentinel/internal/agent"
	"gempa-sentinel/internal/ai"
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
	pm           *ai.ProviderManager
	agent        *agent.StreamingDataAgent
	connectorMgr *connectors.Manager
	cascade      *cascading.Engine
	replay       *simulator.ReplayManager
	port         string
	corsOrigin   string

	// State tracking for AI analysis triggers
	lastAITrigger  time.Time
	aiTriggerMu    sync.Mutex
	recentEvents   []string
	recentEventsMu sync.Mutex
	latestAI       *models.AIAnalysis
	latestAIMu     sync.RWMutex
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
func NewServer(h *hub.SSEHub, sim Simulator, pm *ai.ProviderManager, ag *agent.StreamingDataAgent, connMgr *connectors.Manager, port, corsOrigin string) *Server {
	gin.SetMode(gin.ReleaseMode)

	s := &Server{
		hub:          h,
		sim:          sim,
		pm:           pm,
		agent:        ag,
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

	// AI Provider & Streaming Agent endpoints
	r.GET("/api/ai/provider", s.handleGetAIProvider)
	r.POST("/api/ai/provider", s.handleSetAIProvider)
	r.GET("/api/agent/state", s.handleGetAgentState)
	r.GET("/api/agent/stream", s.handleAgentStream)
	r.POST("/api/agent/chat/stream", s.handleAgentChatStream)

	// REST endpoints
	r.POST("/api/ai/ask", s.handleAIAsk)
	r.GET("/api/ai/latest", s.handleLatestAI)
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

// TrackEvent adds an event description to the recent events list (for AI context)
func (s *Server) TrackEvent(desc string) {
	s.recentEventsMu.Lock()
	defer s.recentEventsMu.Unlock()

	s.recentEvents = append(s.recentEvents, desc)
	if len(s.recentEvents) > 20 {
		s.recentEvents = s.recentEvents[len(s.recentEvents)-20:]
	}
}

// TriggerAIAnalysis runs AI analysis if enough time has passed since last trigger
func (s *Server) TriggerAIAnalysis(activityIndex models.ActivityIndex) {
	s.aiTriggerMu.Lock()
	if time.Since(s.lastAITrigger) < 5*time.Second {
		s.aiTriggerMu.Unlock()
		return
	}
	s.lastAITrigger = time.Now()
	s.aiTriggerMu.Unlock()

	go func() {
		s.recentEventsMu.Lock()
		events := make([]string, len(s.recentEvents))
		copy(events, s.recentEvents)
		s.recentEventsMu.Unlock()

		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if s.pm == nil {
			return
		}

		analysis, err := s.pm.Analyze(ctx, activityIndex, events)
		if err != nil {
			log.Printf("[ERROR] AI analysis failed: %v", err)
			return
		}

		s.latestAIMu.Lock()
		s.latestAI = analysis
		s.latestAIMu.Unlock()

		log.Printf("[INFO] AI Analysis generated via %s (%s): %s (confidence: %.2f)",
			s.pm.ActiveName(), s.pm.GetModelName(), analysis.Status, analysis.Confidence)
		s.hub.BroadcastAll("ai_analysis", analysis)
	}()
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
	s.streamSSE(c, "ai_analysis")
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

	// Trigger AI analysis at key escalation points
	go func() {
		thresholds := []struct {
			delay    time.Duration
			activity float64
		}{
			{8 * time.Second, 48},
			{16 * time.Second, 65},
			{24 * time.Second, 82},
		}

		for _, t := range thresholds {
			time.Sleep(t.delay)
			idx := models.ActivityIndex{
				OverallPercentage: t.activity,
				SeismicChange:     t.activity * 2.9,
				TremorChange:      t.activity * 2.2,
				DeformationTrend:  "INCREASING",
				ThermalTrend:      "INCREASING",
				TrendDirection:    "RAPIDLY INCREASING",
				EarthquakeCount:   int(t.activity / 8),
				AvgMagnitude:      1.5 + (t.activity/100)*2.0,
				MaxMagnitude:      2.5 + (t.activity/100)*1.5,
				Timestamp:         time.Now(),
			}
			s.TriggerAIAnalysis(idx)
		}
	}()

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

	go func() {
		time.Sleep(10 * time.Second)
		idx := models.ActivityIndex{
			OverallPercentage: 96.0,
			SeismicChange:     350.0,
			TremorChange:      280.0,
			DeformationTrend:  "CATASTROPHIC_FLANK_COLLAPSE",
			ThermalTrend:      "EXTREME_HEATING",
			TrendDirection:    "COLLAPSE_DETECTED",
			EarthquakeCount:   38,
			AvgMagnitude:      3.3,
			MaxMagnitude:      4.2,
			Timestamp:         time.Now(),
		}
		s.TriggerAIAnalysis(idx)
	}()

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

	s.latestAIMu.RLock()
	if s.latestAI != nil {
		status.LatestAI = s.latestAI
	}
	s.latestAIMu.RUnlock()

	c.JSON(http.StatusOK, status)
}

func (s *Server) handleLatestAI(c *gin.Context) {
	s.latestAIMu.RLock()
	latest := s.latestAI
	s.latestAIMu.RUnlock()

	if latest != nil {
		c.JSON(http.StatusOK, latest)
		return
	}

	// Generate on demand if not yet cached
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	actIdx := models.ActivityIndex{
		OverallPercentage: 35.0,
		TrendDirection:    "BMKG REAL-TIME FEED",
		MaxMagnitude:      5.2,
		Timestamp:         time.Now(),
	}
	s.recentEventsMu.Lock()
	events := make([]string, len(s.recentEvents))
	copy(events, s.recentEvents)
	s.recentEventsMu.Unlock()
	if len(events) == 0 {
		events = []string{"BMKG TEWS: Pemantauan kontinyu seismometer broadband nasional aktif"}
	}

	if s.pm == nil {
		c.JSON(http.StatusOK, gin.H{"error": "AI provider not configured"})
		return
	}

	analysis, err := s.pm.Analyze(ctx, actIdx, events)
	if err == nil && analysis != nil {
		s.latestAIMu.Lock()
		s.latestAI = analysis
		s.latestAIMu.Unlock()
		c.JSON(http.StatusOK, analysis)
		return
	}

	c.JSON(http.StatusOK, gin.H{"error": "AI analysis not ready"})
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

	// Also broadcast as AI analysis trigger if high severity
	if payload.AlertLevel == "CRITICAL" || payload.AlertLevel == "HIGH" {
		idx := models.ActivityIndex{
			OverallPercentage: 75.0,
			TrendDirection:    "CONNECTOR ALERT: " + payload.Description,
			Timestamp:         time.Now(),
		}
		s.TriggerAIAnalysis(idx)
	}

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

func (s *Server) handleAIAsk(c *gin.Context) {
	var req models.AIQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Question == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "question is required"})
		return
	}

	status := s.sim.GetStatus()
	s.recentEventsMu.Lock()
	eventsContext := strings.Join(s.recentEvents, "\n")
	s.recentEventsMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	telemetry := fmt.Sprintf("Seismic Intensity: %.1f%% | Risk Level: %s | Ocean/Tsunami Status: %s | Trend: %s\nRecent Stream Events:\n%s",
		status.SeismicIntensity, status.RiskLevel, status.OceanStatus, status.TrendDirection, eventsContext)

	if s.pm == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI provider not configured"})
		return
	}

	resp, err := s.pm.AskCopilot(ctx, req.Question, telemetry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// --- AI Provider Handlers ---

func (s *Server) handleGetAIProvider(c *gin.Context) {
	if s.pm == nil {
		c.JSON(http.StatusOK, gin.H{
			"active":    "gemini",
			"model":     "gemini-2.5-flash",
			"available": []string{"gemini"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"active":    s.pm.ActiveName(),
		"model":     s.pm.GetModelName(),
		"available": s.pm.ListProviders(),
	})
}

func (s *Server) handleSetAIProvider(c *gin.Context) {
	if s.pm == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "AI provider manager not initialized"})
		return
	}

	var body struct {
		Provider string `json:"provider"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider field is required"})
		return
	}

	if err := s.pm.SetActive(body.Provider); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[INFO] Switched active AI provider to: %s (%s)", s.pm.ActiveName(), s.pm.GetModelName())
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"active":  s.pm.ActiveName(),
		"model":   s.pm.GetModelName(),
		"message": fmt.Sprintf("AI provider switched to %s", s.pm.ActiveName()),
	})
}

// --- Streaming Data Agent Handlers ---

func (s *Server) handleGetAgentState(c *gin.Context) {
	if s.agent == nil {
		c.JSON(http.StatusOK, gin.H{"status": "Streaming Data Agent not initialized"})
		return
	}

	c.JSON(http.StatusOK, s.agent.GetState())
}

func (s *Server) handleAgentStream(c *gin.Context) {
	eventType := c.DefaultQuery("type", "agent_thought")
	s.streamSSE(c, eventType)
}

func (s *Server) handleAgentChatStream(c *gin.Context) {
	var req models.AIQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Question == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "question is required"})
		return
	}

	if s.agent == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming agent not initialized"})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming unsupported by response writer"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	resp, err := s.agent.ChatStream(ctx, req.Question, func(token string) {
		payload, _ := json.Marshal(map[string]interface{}{
			"token": token,
		})
		fmt.Fprintf(c.Writer, "event: token\ndata: %s\n\n", payload)
		flusher.Flush()
	})

	if err != nil {
		errPayload, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", errPayload)
		flusher.Flush()
		return
	}

	finalPayload, _ := json.Marshal(resp)
	fmt.Fprintf(c.Writer, "event: done\ndata: %s\n\n", finalPayload)
	flusher.Flush()
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

