package telemetry

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestEventRingBuffer(t *testing.T) {
	var mu sync.Mutex
	var received []Event

	handler := func(ctx context.Context, batch []Event) error {
		mu.Lock()
		defer mu.Unlock()
		received = append(received, batch...)
		return nil
	}

	buf := NewEventRingBuffer(50, 5, 50*time.Millisecond, handler)

	for i := 0; i < 12; i++ {
		err := buf.Ingest(Event{
			ID:        fmt.Sprintf("evt-%d", i),
			StationID: "BMKG-JKT",
			EventType: "SEISMIC_WAVE",
			Timestamp: time.Now(),
		})
		if err != nil {
			t.Fatalf("failed to ingest: %v", err)
		}
	}

	time.Sleep(150 * time.Millisecond)
	_ = buf.Close()

	mu.Lock()
	defer mu.Unlock()
	if len(received) != 12 {
		t.Fatalf("expected 12 events received, got %d", len(received))
	}
}

func BenchmarkEventRingBufferIngest(b *testing.B) {
	handler := func(ctx context.Context, batch []Event) error {
		return nil
	}
	buf := NewEventRingBuffer(50000, 500, 100*time.Millisecond, handler)
	defer buf.Close()

	evt := Event{
		ID:        "bench",
		StationID: "STN-01",
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = buf.Ingest(evt)
	}
}
