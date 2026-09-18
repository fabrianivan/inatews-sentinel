package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"gempa-sentinel/internal/agent"
	"gempa-sentinel/internal/ai"
	"gempa-sentinel/internal/api"
	"gempa-sentinel/internal/cascading"
	"gempa-sentinel/internal/config"
	"gempa-sentinel/internal/connectors"
	"gempa-sentinel/internal/hub"
	"gempa-sentinel/internal/kafka"
	"gempa-sentinel/internal/models"
	"gempa-sentinel/internal/realtime"
	"gempa-sentinel/internal/simulator"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("[INFO] INATEWS SENTINEL - Real-Time Disaster Intelligence & Early Warning")
	log.Println("------------------------------------------------------------")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Configuration error: %v", err)
	}
	log.Println("[INFO] Configuration loaded")

	// Initialize Kafka producer
	producer, err := kafka.NewProducer(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Failed to create Kafka producer: %v", err)
	}
	defer producer.Close()

	// Create topics
	if err := producer.CreateTopics(); err != nil {
		log.Printf("[WARN] Topic creation warning: %v", err)
	}

	// Initialize SSE Hub
	sseHub := hub.NewSSEHub()

	// Initialize LLM Providers (Google Gemini & AWS Bedrock)
	providers := make(map[string]ai.LLMProvider)

	geminiAnalyzer, err := ai.NewGeminiAnalyzer(cfg.GeminiAPIKey)
	if err != nil {
		log.Printf("[WARN] Gemini analyzer initialization note: %v", err)
	} else {
		providers["gemini"] = geminiAnalyzer
	}

	bedrockProvider, err := ai.NewBedrockProvider(cfg)
	if err != nil {
		log.Printf("[WARN] Bedrock provider initialization note: %v", err)
	} else {
		providers["bedrock"] = bedrockProvider
	}

	pm := ai.NewProviderManager(cfg.AIProvider, providers)
	log.Printf("[INFO] AI Provider Manager active: %s (model: %s, available: %v)",
		pm.ActiveName(), pm.GetModelName(), pm.ListProviders())

	// Initialize Autonomous Streaming Data Agent
	streamingAgent := agent.NewStreamingDataAgent(pm, sseHub)

	// Initialize Simulator (for on-demand drill/scenarios with dummy data, completely isolated from Confluent Cloud)
	sim := simulator.NewSimulator(nil, sseHub)

	// Initialize Real-Time Ingestor (BMKG + USGS + IOC Sea Level + Open-Meteo)
	ingestor := realtime.NewIngestor(producer, sseHub)

	// Initialize Cascading Impact & Confidence Engine
	cascadingEngine := cascading.NewEngine(producer, sseHub)

	// Initialize Disaster Incident Replay Manager
	replayManager := simulator.NewReplayManager(producer, sseHub, cascadingEngine)

	// Initialize API Server
	server := api.NewServer(sseHub, sim, pm, streamingAgent, nil, cfg.ServerPort, cfg.CORSOrigin)
	server.SetIngestor(ingestor)
	server.SetCascadingEngine(cascadingEngine)
	server.SetReplayManager(replayManager)

	// Wire AI analysis trigger from real-time and simulator to server analyzer, streaming agent, and cascading engine
	sim.SetAnalysisTrigger(func(idx models.ActivityIndex) {
		cascadingEngine.OnActivityIndex(idx)
		streamingAgent.OnActivityIndex(idx)
		server.TriggerAIAnalysis(idx)
	})
	ingestor.SetAnalysisTrigger(func(idx models.ActivityIndex) {
		cascadingEngine.OnActivityIndex(idx)
		streamingAgent.OnActivityIndex(idx)
		server.TriggerAIAnalysis(idx)
	})

	// Initialize Kafka consumer for Flink output topics
	consumer, err := kafka.NewConsumer(cfg, kafka.ConsumerCallbacks{
		OnActivity: func(idx models.ActivityIndex) {
			sseHub.BroadcastAll("activity_index", idx)
			cascadingEngine.OnActivityIndex(idx)
			streamingAgent.OnActivityIndex(idx)
			// Trigger AI analysis on significant changes
			if idx.OverallPercentage > 40 {
				server.TriggerAIAnalysis(idx)
			}
		},
		OnAlert: func(alert models.CorrelatedAlert) {
			sseHub.BroadcastAll("correlated_alert", alert)
			streamingAgent.OnCorrelatedAlert(alert)
		},
		OnTsunami: func(ts models.TsunamiScenario) {
			sseHub.BroadcastAll("tsunami", ts)
			cascadingEngine.OnTsunamiScenario(ts)
			streamingAgent.OnTsunamiScenario(ts)
		},
		OnIncident: func(inc models.IncidentEvent) {
			sseHub.BroadcastAll("incident_update", inc)
			cascadingEngine.SetIncident(inc)
		},
		OnResponse: func(resp models.IncidentResponseEvent) {
			sseHub.BroadcastAll("incident_response", resp)
		},
	})
	if err != nil {
		log.Printf("[WARN] Kafka consumer warning (Flink output topics may not exist yet): %v", err)
	}

	// Create a context that cancels on interrupt
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Connector Manager
	clusterID := "lkc-xqxxgr1"
	connectorMgr := connectors.NewManager(clusterID)
	go connectorMgr.Start(ctx)

	// Set connector manager on server
	server.SetConnectorManager(connectorMgr)

	// Start the autonomous streaming data agent
	streamingAgent.Start(ctx)

	// Start the real-time API data ingestor (default live mode)
	ingestor.Start(ctx)

	// Start the simulator (runs in background for drill/scenario injection)
	sim.Start(ctx)

	// Start the Kafka consumer (if available)
	if consumer != nil {
		go consumer.Start(ctx)
		defer consumer.Close()
	}

	// Handle graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("\n[INFO] Shutting down InaTEWS Sentinel...")
		cancel()
		os.Exit(0)
	}()

	// Start the API server (blocking)
	log.Printf("[INFO] InaTEWS Sentinel ready - API on :%s", cfg.ServerPort)
	if err := server.Start(); err != nil {
		log.Fatalf("[FATAL] Server error: %v", err)
	}
}
