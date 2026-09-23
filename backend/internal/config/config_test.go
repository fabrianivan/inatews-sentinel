package config_test

import (
	"os"
	"testing"

	"gempa-sentinel/internal/config"
)

func TestConfigDefaults(t *testing.T) {
	// Set mock environment variables
	os.Setenv("CONFLUENT_BOOTSTRAP_SERVERS", "mock:9092")
	os.Setenv("CONFLUENT_API_KEY", "mock-key")
	os.Setenv("CONFLUENT_API_SECRET", "mock-secret")
	os.Unsetenv("SERVER_PORT")
	os.Unsetenv("CORS_ORIGIN")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load() returned error: %v", err)
	}

	if cfg.ServerPort != "8080" {
		t.Errorf("Expected default port 8080, got %s", cfg.ServerPort)
	}

	if cfg.CORSOrigin != "http://localhost:3000" {
		t.Errorf("Expected default CORSOrigin 'http://localhost:3000', got %s", cfg.CORSOrigin)
	}
}

func TestConfigMissingRequired(t *testing.T) {
	os.Unsetenv("CONFLUENT_BOOTSTRAP_SERVERS")
	_, err := config.Load()
	if err == nil {
		t.Error("Expected error when CONFLUENT_BOOTSTRAP_SERVERS is missing")
	}
}
