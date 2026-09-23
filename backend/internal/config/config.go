package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	// Confluent Cloud Kafka
	BootstrapServers string
	KafkaAPIKey      string
	KafkaAPISecret   string

	// Schema Registry
	SchemaRegistryURL    string
	SchemaRegistryKey    string
	SchemaRegistrySecret string

	// Server
	ServerPort string
	CORSOrigin string

	// Standalone Demo Mode
	DemoMode bool
}

// TopicNames defines all Kafka topic names
var TopicNames = struct {
	Seismic          string
	Activity         string
	Ocean            string
	Weather          string
	Satellite        string
	Maritime         string
	Population       string
	ActivityIndex    string
	CorrelatedAlerts string
	TsunamiScenarios string
	Incidents        string
	Response         string
}{
	Seismic:          "gempa.seismic",
	Activity:         "gempa.stations",
	Ocean:            "gempa.tsunami",
	Weather:          "gempa.weather",
	Satellite:        "gempa.satellite",
	Maritime:         "gempa.infrastructure",
	Population:       "gempa.population",
	ActivityIndex:    "gempa.intensity_index",
	CorrelatedAlerts: "gempa.correlated_alerts",
	TsunamiScenarios: "gempa.tsunami_scenarios",
	Incidents:        "gempa.incidents",
	Response:         "gempa.response",
}

// AllSourceTopics returns all source topic names
func AllSourceTopics() []string {
	return []string{
		TopicNames.Seismic,
		TopicNames.Activity,
		TopicNames.Ocean,
		TopicNames.Weather,
		TopicNames.Satellite,
		TopicNames.Maritime,
		TopicNames.Population,
	}
}

// AllOutputTopics returns all Flink output topic names
func AllOutputTopics() []string {
	return []string{
		TopicNames.ActivityIndex,
		TopicNames.CorrelatedAlerts,
		TopicNames.TsunamiScenarios,
		TopicNames.Incidents,
		TopicNames.Response,
	}
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	// Try to load .env file (ignore error if not found)
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := &Config{
		BootstrapServers:     os.Getenv("CONFLUENT_BOOTSTRAP_SERVERS"),
		KafkaAPIKey:          os.Getenv("CONFLUENT_API_KEY"),
		KafkaAPISecret:       os.Getenv("CONFLUENT_API_SECRET"),
		SchemaRegistryURL:    os.Getenv("CONFLUENT_SCHEMA_REGISTRY_URL"),
		SchemaRegistryKey:    os.Getenv("CONFLUENT_SR_API_KEY"),
		SchemaRegistrySecret: os.Getenv("CONFLUENT_SR_API_SECRET"),
		ServerPort:           os.Getenv("SERVER_PORT"),
		CORSOrigin:           os.Getenv("CORS_ORIGIN"),
		DemoMode:             os.Getenv("DEMO_MODE") == "true" || os.Getenv("DEMO_MODE") == "1",
	}

	if cfg.ServerPort == "" {
		cfg.ServerPort = "8080"
	}
	if cfg.CORSOrigin == "" {
		cfg.CORSOrigin = "http://localhost:3000"
	}

	// In Demo Mode, external Confluent credentials are optional
	if cfg.DemoMode {
		return cfg, nil
	}

	// Validate required fields for production / Confluent Cloud mode
	if cfg.BootstrapServers == "" {
		return nil, fmt.Errorf("CONFLUENT_BOOTSTRAP_SERVERS is required (or set DEMO_MODE=true to run in standalone demo mode)")
	}
	if cfg.KafkaAPIKey == "" {
		return nil, fmt.Errorf("CONFLUENT_API_KEY is required")
	}
	if cfg.KafkaAPISecret == "" {
		return nil, fmt.Errorf("CONFLUENT_API_SECRET is required")
	}

	return cfg, nil
}
