package telemetry

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

var (
	ErrBufferFull   = errors.New("telemetry buffer capacity exceeded")
	ErrBufferClosed = errors.New("telemetry buffer already closed")
)

type Event struct {
	ID        string                 `json:"id"`
	StationID string                 `json:"station_id"`
	EventType string                 `json:"event_type"`
	Timestamp time.Time              `json:"timestamp"`
	Payload   map[string]interface{} `json:"payload"`
}

type FlushFunc func(ctx context.Context, batch []Event) error

type EventRingBuffer struct {
	mu           sync.RWMutex
	capacity     int
	batchSize    int
	flushTimeout time.Duration
	events       []Event
	flushHandler FlushFunc
	ctx          context.Context
	cancel       context.CancelFunc
	closed       atomic.Bool
	flushSignal  chan struct{}
	wg           sync.WaitGroup
	flushedTotal atomic.Uint64
}

func NewEventRingBuffer(capacity, batchSize int, flushTimeout time.Duration, handler FlushFunc) *EventRingBuffer {
	ctx, cancel := context.WithCancel(context.Background())
	b := &EventRingBuffer{
		capacity:     capacity,
		batchSize:    batchSize,
		flushTimeout: flushTimeout,
		events:       make([]Event, 0, capacity),
		flushHandler: handler,
		ctx:          ctx,
		cancel:       cancel,
		flushSignal:  make(chan struct{}, 1),
	}

	b.wg.Add(1)
	go b.worker()
	return b
}

func (b *EventRingBuffer) Ingest(evt Event) error {
	if b.closed.Load() {
		return ErrBufferClosed
	}

	b.mu.Lock()
	if len(b.events) >= b.capacity {
		b.mu.Unlock()
		return ErrBufferFull
	}

	b.events = append(b.events, evt)
	trigger := len(b.events) >= b.batchSize
	b.mu.Unlock()

	if trigger {
		select {
		case b.flushSignal <- struct{}{}:
		default:
		}
	}
	return nil
}

func (b *EventRingBuffer) worker() {
	defer b.wg.Done()
	ticker := time.NewTicker(b.flushTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-b.ctx.Done():
			b.flushRemaining()
			return
		case <-ticker.C:
			b.flushBatch()
		case <-b.flushSignal:
			b.flushBatch()
		}
	}
}

func (b *EventRingBuffer) flushBatch() {
	b.mu.Lock()
	if len(b.events) == 0 {
		b.mu.Unlock()
		return
	}

	n := len(b.events)
	if n > b.batchSize {
		n = b.batchSize
	}

	batch := make([]Event, n)
	copy(batch, b.events[:n])
	b.events = b.events[n:]
	b.mu.Unlock()

	if b.flushHandler != nil {
		_ = b.flushHandler(b.ctx, batch)
	}
	b.flushedTotal.Add(uint64(n))
}

func (b *EventRingBuffer) flushRemaining() {
	b.mu.Lock()
	remaining := b.events
	b.events = nil
	b.mu.Unlock()

	if len(remaining) > 0 && b.flushHandler != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = b.flushHandler(ctx, remaining)
		b.flushedTotal.Add(uint64(len(remaining)))
	}
}

func (b *EventRingBuffer) Close() error {
	if b.closed.CompareAndSwap(false, true) {
		b.cancel()
		b.wg.Wait()
	}
	return nil
}

func (b *EventRingBuffer) TotalFlushed() uint64 {
	return b.flushedTotal.Load()
}
