package resilience

import (
	"errors"
	"sync"
	"time"
)

var (
	ErrCircuitOpen = errors.New("circuit breaker is in OPEN state")
)

type State int

const (
	StateClosed State = iota
	StateHalfOpen
	StateOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateHalfOpen:
		return "HALF_OPEN"
	case StateOpen:
		return "OPEN"
	default:
		return "UNKNOWN"
	}
}

type Config struct {
	MaxFailures      uint32
	Timeout          time.Duration
	HalfOpenSuccesses uint32
}

type CircuitBreaker struct {
	mu               sync.RWMutex
	state            State
	config           Config
	consecutiveFails uint32
	successCount     uint32
	lastStateChange  time.Time
}

func NewCircuitBreaker(cfg Config) *CircuitBreaker {
	if cfg.MaxFailures == 0 {
		cfg.MaxFailures = 5
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Second
	}
	if cfg.HalfOpenSuccesses == 0 {
		cfg.HalfOpenSuccesses = 2
	}

	return &CircuitBreaker{
		state:           StateClosed,
		config:          cfg,
		lastStateChange: time.Now(),
	}
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
	if err := cb.beforeExecution(); err != nil {
		return err
	}

	err := fn()
	cb.afterExecution(err)
	return err
}

func (cb *CircuitBreaker) beforeExecution() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	if cb.state == StateOpen {
		if now.Sub(cb.lastStateChange) > cb.config.Timeout {
			cb.state = StateHalfOpen
			cb.successCount = 0
			cb.lastStateChange = now
			return nil
		}
		return ErrCircuitOpen
	}
	return nil
}

func (cb *CircuitBreaker) afterExecution(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	if err != nil {
		cb.consecutiveFails++
		cb.successCount = 0
		if cb.state == StateHalfOpen || cb.consecutiveFails >= cb.config.MaxFailures {
			cb.state = StateOpen
			cb.lastStateChange = now
		}
	} else {
		if cb.state == StateHalfOpen {
			cb.successCount++
			if cb.successCount >= cb.config.HalfOpenSuccesses {
				cb.state = StateClosed
				cb.consecutiveFails = 0
				cb.lastStateChange = now
			}
		} else if cb.state == StateClosed {
			cb.consecutiveFails = 0
		}
	}
}

func (cb *CircuitBreaker) State() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}
