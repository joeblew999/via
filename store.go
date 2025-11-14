package via

import (
	"fmt"
	"sync"
	"time"
)

// StateStore manages session state persistence and synchronization.
// Implementations can use in-memory storage, databases, or distributed caches.
type StateStore interface {
	// Get retrieves session state by session ID
	Get(sessionID string) (*SessionState, error)

	// Set persists session state
	Set(sessionID string, state *SessionState) error

	// Delete removes session state
	Delete(sessionID string) error

	// Subscribe registers a callback for session state changes (for multi-tab sync)
	Subscribe(sessionID string, callback func(*SessionState)) error

	// Unsubscribe removes a callback
	Unsubscribe(sessionID string) error
}

// SessionState represents the persistent state for a user session.
type SessionState struct {
	SessionID string         `json:"session_id"`
	Route     string         `json:"route"`
	Signals   map[string]any `json:"signals"`   // Signal values
	State     map[string]any `json:"state"`     // Arbitrary application state
	UpdatedAt time.Time      `json:"updated_at"`
}

// MemoryStore implements StateStore using in-memory storage with pub/sub for multi-tab sync.
// Suitable for single-server deployments. State is lost on server restart.
type MemoryStore struct {
	sessions map[string]*SessionState
	mu       sync.RWMutex
	subs     map[string][]chan *SessionState
	subsMu   sync.RWMutex
}

// NewMemoryStore creates a new in-memory state store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		sessions: make(map[string]*SessionState),
		subs:     make(map[string][]chan *SessionState),
	}
}

// Get retrieves session state by ID.
func (m *MemoryStore) Get(sessionID string) (*SessionState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state, ok := m.sessions[sessionID]
	if !ok {
		return nil, fmt.Errorf("session '%s' not found", sessionID)
	}

	// Return a copy to prevent external modification
	return &SessionState{
		SessionID: state.SessionID,
		Route:     state.Route,
		Signals:   copyMap(state.Signals),
		State:     copyMap(state.State),
		UpdatedAt: state.UpdatedAt,
	}, nil
}

// Set persists session state and broadcasts to subscribers.
func (m *MemoryStore) Set(sessionID string, state *SessionState) error {
	if state == nil {
		return fmt.Errorf("cannot set nil state")
	}

	state.UpdatedAt = time.Now()

	m.mu.Lock()
	// Store a copy to prevent external modification
	m.sessions[sessionID] = &SessionState{
		SessionID: state.SessionID,
		Route:     state.Route,
		Signals:   copyMap(state.Signals),
		State:     copyMap(state.State),
		UpdatedAt: state.UpdatedAt,
	}
	m.mu.Unlock()

	// Broadcast to subscribers (for multi-tab sync)
	m.broadcast(sessionID, state)

	return nil
}

// Delete removes session state.
func (m *MemoryStore) Delete(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.sessions, sessionID)
	return nil
}

// Subscribe registers a callback for session state changes.
func (m *MemoryStore) Subscribe(sessionID string, callback func(*SessionState)) error {
	m.subsMu.Lock()
	defer m.subsMu.Unlock()

	ch := make(chan *SessionState, 10)
	m.subs[sessionID] = append(m.subs[sessionID], ch)

	// Use WaitGroup to ensure goroutine is ready before returning
	var ready sync.WaitGroup
	ready.Add(1)

	// Start goroutine to call callback when state changes
	go func() {
		ready.Done() // Signal that goroutine is running
		for state := range ch {
			callback(state)
		}
	}()

	ready.Wait() // Wait for goroutine to start

	return nil
}

// Unsubscribe removes all callbacks for a session.
func (m *MemoryStore) Unsubscribe(sessionID string) error {
	m.subsMu.Lock()
	defer m.subsMu.Unlock()

	// Close all channels
	if channels, ok := m.subs[sessionID]; ok {
		for _, ch := range channels {
			close(ch)
		}
		delete(m.subs, sessionID)
	}

	return nil
}

// broadcast sends state updates to all subscribers.
func (m *MemoryStore) broadcast(sessionID string, state *SessionState) {
	m.subsMu.RLock()
	defer m.subsMu.RUnlock()

	channels, ok := m.subs[sessionID]
	if !ok {
		return
	}

	// Send to all subscribers (non-blocking)
	for _, ch := range channels {
		select {
		case ch <- state:
		default:
			// Channel full, skip this update
		}
	}
}

// copyMap creates a shallow copy of a map.
func copyMap(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	copy := make(map[string]any, len(m))
	for k, v := range m {
		copy[k] = v
	}
	return copy
}
