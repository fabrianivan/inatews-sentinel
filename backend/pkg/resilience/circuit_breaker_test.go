package resilience

import (
	"errors"
	"testing"
	"time"
)

func TestCircuitBreakerTripsAndRecovers(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		MaxFailures:       2,
		Timeout:           50 * time.Millisecond,
		HalfOpenSuccesses: 2,
	})

	dummyErr := errors.New("simulated network failure")

	// 1st failure
	_ = cb.Execute(func() error { return dummyErr })
	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed after 1 failure, got %s", cb.State())
	}

	// 2nd failure -> Trips to OPEN
	_ = cb.Execute(func() error { return dummyErr })
	if cb.State() != StateOpen {
		t.Fatalf("expected state Open after 2 failures, got %s", cb.State())
	}

	// Call rejected while OPEN
	err := cb.Execute(func() error { return nil })
	if !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("expected ErrCircuitOpen, got %v", err)
	}

	// Wait for timeout to expire
	time.Sleep(70 * time.Millisecond)

	// Next call should be permitted in HALF_OPEN
	err = cb.Execute(func() error { return nil })
	if err != nil {
		t.Fatalf("expected nil error on half-open success, got %v", err)
	}

	// 2nd success -> CLOSED
	err = cb.Execute(func() error { return nil })
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed after recovery, got %s", cb.State())
	}
}
