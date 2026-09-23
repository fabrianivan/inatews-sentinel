package hub_test

import (
	"strings"
	"testing"
	"time"

	"gempa-sentinel/internal/hub"
)

func TestSSEHubBroadcast(t *testing.T) {
	h := hub.NewSSEHub()
	ch := h.Subscribe("test_event")
	defer h.Unsubscribe("test_event", ch)

	testPayload := map[string]string{"message": "alert"}
	h.BroadcastAll("test_event", testPayload)

	select {
	case msg := <-ch:
		if !strings.Contains(msg, "event: test_event") {
			t.Errorf("Expected event name in message, got '%s'", msg)
		}
		if !strings.Contains(msg, "alert") {
			t.Errorf("Expected payload in message, got '%s'", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Timed out waiting for SSE broadcast")
	}
}

func TestSSEHubUnregister(t *testing.T) {
	h := hub.NewSSEHub()
	ch := h.Subscribe("test_event")
	h.Unsubscribe("test_event", ch)

	// Ensure channel is closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("Expected channel to be closed after Unsubscribe")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Channel did not close after Unsubscribe")
	}
}
