package hub

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
)

// SSEHub manages Server-Sent Events broadcast to connected clients
type SSEHub struct {
	clients    map[string]map[chan string]bool // event type -> set of channels
	mu         sync.RWMutex
}

// NewSSEHub creates a new SSE broadcast hub
func NewSSEHub() *SSEHub {
	return &SSEHub{
		clients: make(map[string]map[chan string]bool),
	}
}

// Subscribe registers a new client for a specific event stream
func (h *SSEHub) Subscribe(eventType string) chan string {
	h.mu.Lock()
	defer h.mu.Unlock()

	ch := make(chan string, 100)
	if h.clients[eventType] == nil {
		h.clients[eventType] = make(map[chan string]bool)
	}
	h.clients[eventType][ch] = true

	log.Printf("[INFO] SSE client subscribed to: %s (total: %d)", eventType, len(h.clients[eventType]))
	return ch
}

// Unsubscribe removes a client from a specific event stream
func (h *SSEHub) Unsubscribe(eventType string, ch chan string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.clients[eventType]; ok {
		delete(clients, ch)
		close(ch)
		log.Printf("[INFO] SSE client unsubscribed from: %s (remaining: %d)", eventType, len(clients))
	}
}

// Broadcast sends data to all clients subscribed to the given event type
func (h *SSEHub) Broadcast(eventType string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Printf("[ERROR] SSE marshal error: %v", err)
		return
	}

	msg := fmt.Sprintf("event: %s\ndata: %s\n\n", eventType, string(jsonData))

	clients := h.clients[eventType]
	for ch := range clients {
		select {
		case ch <- msg:
		default:
			// Client is too slow, skip this message
		}
	}
}

// BroadcastAll sends data to the specific event type and the catch-all "all" stream
func (h *SSEHub) BroadcastAll(eventType string, data interface{}) {
	h.Broadcast(eventType, data)
	h.Broadcast("all", map[string]interface{}{
		"event": eventType,
		"data":  data,
	})
}

// ClientCount returns the number of connected clients
func (h *SSEHub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	total := 0
	for _, clients := range h.clients {
		total += len(clients)
	}
	return total
}
