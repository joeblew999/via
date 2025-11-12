// Package via provides a reactive web framework for Go.
// It lets you build live, type-safe web interfaces without JavaScript.
//
// Via unifies routing, state, and UI reactivity through a simple mental model:
// Go on the server — HTML in the browser — updated in real time via Datastar.
package via

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"github.com/go-via/via/h"
	"github.com/starfederation/datastar-go/datastar"
)

//go:embed datastar.js
var datastarJS []byte

// V is the root application.
// It manages page routing, user sessions, and SSE connections for live updates.
type V struct {
	cfg                       Options
	mux                       *http.ServeMux
	contextRegistry           map[string]*Context
	contextRegistryMutex      sync.RWMutex
	documentHeadIncludes      []h.H
	documentFootIncludes      []h.H
	devModePageInitFnMap      map[string]func(*Context)
	devModePageInitFnMapMutex sync.Mutex
	stateStore                StateStore // Optional state store for session persistence
}

func (v *V) logErr(c *Context, format string, a ...any) {
	cRef := ""
	if c != nil && c.id != "" {
		cRef = fmt.Sprintf("via-ctx=%q ", c.id)
	}
	log.Printf("[error] %smsg=%q", cRef, fmt.Sprintf(format, a...))
}

func (v *V) logWarn(c *Context, format string, a ...any) {
	cRef := ""
	if c != nil && c.id != "" {
		cRef = fmt.Sprintf("via-ctx=%q ", c.id)
	}
	if v.cfg.LogLvl >= LogLevelWarn {
		log.Printf("[warn] %smsg=%q", cRef, fmt.Sprintf(format, a...))
	}
}

func (v *V) logInfo(c *Context, format string, a ...any) {
	cRef := ""
	if c != nil && c.id != "" {
		cRef = fmt.Sprintf("via-ctx=%q ", c.id)
	}
	if v.cfg.LogLvl >= LogLevelInfo {
		log.Printf("[info] %smsg=%q", cRef, fmt.Sprintf(format, a...))
	}
}

func (v *V) logDebug(c *Context, format string, a ...any) {
	cRef := ""
	if c != nil && c.id != "" {
		cRef = fmt.Sprintf("via-ctx=%q ", c.id)
	}
	if v.cfg.LogLvl == LogLevelDebug {
		log.Printf("[debug] %smsg=%q", cRef, fmt.Sprintf(format, a...))
	}
}

// Config overrides the default configuration with the given configuration options.
func (v *V) Config(cfg Options) {
	if cfg.LogLvl != v.cfg.LogLvl {
		v.cfg.LogLvl = cfg.LogLvl
	}
	if cfg.DocumentTitle != "" {
		v.cfg.DocumentTitle = cfg.DocumentTitle
	}
	if cfg.Plugins != nil {
		for _, plugin := range cfg.Plugins {
			if plugin != nil {
				plugin(v)
			}
		}
	}
	if cfg.DevMode != v.cfg.DevMode {
		v.cfg.DevMode = cfg.DevMode
	}
	if cfg.ServerAddress != "" {
		v.cfg.ServerAddress = cfg.ServerAddress
	}
	if cfg.StatePersistence {
		v.cfg.StatePersistence = true
		if cfg.StateStore != nil {
			v.stateStore = cfg.StateStore
		} else {
			v.stateStore = NewMemoryStore()
		}
	}
}

// AppendToHead appends the given h.H nodes to the head of the base HTML document.
// Useful for including css stylesheets and JS scripts.
func (v *V) AppendToHead(elements ...h.H) {
	for _, el := range elements {
		if el != nil {
			v.documentHeadIncludes = append(v.documentHeadIncludes, el)
		}
	}
}

// AppendToFoot appends the given h.H nodes to the end of the base HTML document body.
// Useful for including JS scripts.
func (v *V) AppendToFoot(elements ...h.H) {
	for _, el := range elements {
		if el != nil {
			v.documentFootIncludes = append(v.documentFootIncludes, el)
		}
	}
}

// Page registers a route and its associated page handler.
// The handler receives a *Context to define UI, signals, and actions.
//
// Example:
//
//	v.Page("/", func(c *via.Context) {
//		c.View(func() h.H {
//			return h.H1(h.Text("Hello, Via!"))
//		})
//	})
func (v *V) Page(route string, initContextFn func(c *Context)) {
	if v.cfg.DevMode {
		v.devModePageInitFnMapMutex.Lock()
		defer v.devModePageInitFnMapMutex.Unlock()
		v.devModePageInitFnMap[route] = initContextFn
	}
	v.mux.HandleFunc("GET "+route, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "favicon") {
			return
		}
		id := fmt.Sprintf("%s_/%s", route, genRandID())
		c := newContext(id, v)

		// Register context FIRST so SSE can find it
		v.logDebug(c, "Registering context with ID: %s", c.id)
		v.registerCtx(c.id, c)
		v.logDebug(c, "Context registered, registry size: %d", len(v.contextRegistry))

		// Session management (if StatePersistence is enabled)
		if v.cfg.StatePersistence && v.stateStore != nil {
			sessionID, sessionSource := v.extractSessionID(w, r)
			v.logDebug(c, "Session ID: %s (source: %s, route: %s)", sessionID, sessionSource, route)
			c.sessionID = sessionID
			c.sessionSource = sessionSource
			c.route = route

			// Load existing session state
			if sessionState, err := v.stateStore.Get(sessionID); err == nil {
				v.logDebug(c, "Loaded existing session state with %d state keys", len(sessionState.State))
				c.loadSessionState(sessionState)
			} else {
				v.logDebug(c, "No existing session state found (new session)")
			}
		}

		v.logDebug(c, "GET %s", route)
		initContextFn(c)
		headElements := v.documentHeadIncludes
		headElements = append(headElements, h.Meta(h.Data("signals", fmt.Sprintf("{'via-ctx':'%s'}", id))))
		headElements = append(headElements, h.Meta(h.Data("init", "@get('/_sse')")))
		bottomBodyElements := []h.H{c.view()}
		bottomBodyElements = append(bottomBodyElements, v.documentFootIncludes...)
		view := h.HTML5(h.HTML5Props{
			Title: v.cfg.DocumentTitle,
			Head:  headElements,
			Body:  bottomBodyElements,
		})
		_ = view.Render(w)
	}))
}

func (v *V) registerCtx(id string, c *Context) {
	v.contextRegistryMutex.Lock()
	defer v.contextRegistryMutex.Unlock()
	if c == nil {
		v.logErr(c, "failed to add nil context to registry")
		return
	}
	v.contextRegistry[id] = c
	v.logDebug(c, "new context added to registry")
}

// func (a *App) unregisterCtx(id string) {
// 	if _, ok := a.contextRegistry[id]; ok {
// 		a.contextRegistryMutex.Lock()
// 		defer a.contextRegistryMutex.Unlock()
// 		delete(a.contextRegistry, id)
// 	}
// }

func (v *V) getCtx(id string) (*Context, error) {
	v.contextRegistryMutex.RLock()
	defer v.contextRegistryMutex.RUnlock()
	if c, ok := v.contextRegistry[id]; ok {
		return c, nil
	}
	return nil, fmt.Errorf("ctx '%s' not found", id)
}

// HandleFunc registers the HTTP handler function for a given pattern. The handler function panics if
// in conflict with another registered handler with the same pattern.
func (v *V) HandleFunc(pattern string, f http.HandlerFunc) {
	v.mux.HandleFunc(pattern, f)
}

// Start starts the Via HTTP server on the given address.
func (v *V) Start() {
	v.logInfo(nil, "via started on address: %s", v.cfg.ServerAddress)
	log.Fatalf("[fatal] %v", http.ListenAndServe(v.cfg.ServerAddress, v.mux))
}

func (v *V) persistCtx(c *Context) error {
	idsplit := strings.Split(c.id, "_")
	if len(idsplit) < 2 {
		return fmt.Errorf("failed to identify ctx page route")
	}
	route := idsplit[0]
	ctxmap := map[string]any{"id": c.id, "route": route}

	p := path.Join(".via", "devmode", "ctx.json")
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return fmt.Errorf("failed to create directory for devmode files: %v", err)
	}

	file, err := os.Create(p)
	if err != nil {
		return fmt.Errorf("failed to create file in devmode directory: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	if err := encoder.Encode(ctxmap); err != nil {
		return fmt.Errorf("failed to encode ctx: %s", err)
	}
	return nil
}

func (v *V) restoreCtx() *Context {
	p := path.Join(".via", "devmode", "ctx.json")
	file, err := os.Open(p)
	if err != nil {
		fmt.Println("Error opening file:", err)
		return nil
	}
	defer file.Close()
	var ctxmap map[string]any
	if err := json.NewDecoder(file).Decode(&ctxmap); err != nil {
		fmt.Println("Error restoring ctx:", err)
		return nil
	}
	ctxId, ok := ctxmap["id"].(string)
	if !ok {
		fmt.Println("Error restoring ctx")
		return nil
	}
	pageRoute, ok := ctxmap["route"].(string)
	if !ok {
		fmt.Println("Error restoring ctx")
		return nil
	}
	pageInitFn, ok := v.devModePageInitFnMap[pageRoute]
	if !ok {
		fmt.Println("devmode failed to restore ctx: ")
		return nil
	}

	c := newContext(ctxId, v)
	pageInitFn(c)
	return c
}

// New creates a new Via application with default configuration.
func New() *V {
	mux := http.NewServeMux()
	v := &V{
		mux:                  mux,
		contextRegistry:      make(map[string]*Context),
		devModePageInitFnMap: make(map[string]func(*Context)),
		cfg: Options{
			DevMode:       false,
			ServerAddress: ":3000",
			LogLvl:        LogLevelInfo,
			DocumentTitle: "⚡ Via",
		},
	}

	v.mux.HandleFunc("GET /_datastar.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		_, _ = w.Write(datastarJS)
	})

	v.mux.HandleFunc("GET /_sse", func(w http.ResponseWriter, r *http.Request) {
		var sigs map[string]any
		_ = datastar.ReadSignals(r, &sigs)
		if v.cfg.DevMode && len(v.contextRegistry) == 0 {
			restoredC := v.restoreCtx()
			if restoredC != nil {
				restoredC.injectSignals(sigs)
				v.registerCtx(restoredC.id, restoredC)
			}
		}
		cID, _ := sigs["via-ctx"].(string)
		v.logDebug(nil, "SSE looking for context ID: %s, registry size: %d", cID, len(v.contextRegistry))
		c, err := v.getCtx(cID)
		if err != nil {
			// Debug: print all registered IDs
			v.contextRegistryMutex.RLock()
			registeredIDs := make([]string, 0, len(v.contextRegistry))
			for id := range v.contextRegistry {
				registeredIDs = append(registeredIDs, id)
			}
			v.contextRegistryMutex.RUnlock()
			v.logErr(nil, "failed to render page: %v, registered IDs: %v", err, registeredIDs)
			return
		}
		c.sse = datastar.NewSSE(w, r)
		v.logDebug(c, "SSE connection established")

		// Subscribe to state changes for multi-tab sync
		if v.cfg.StatePersistence && v.stateStore != nil && c.sessionID != "" {
			v.stateStore.Subscribe(c.sessionID, func(state *SessionState) {
				// When state changes in another tab, update this tab
				if c.sse != nil && state != nil {
					v.logDebug(c, "📡 Multi-tab broadcast received! Session: %s, State keys: %d", c.sessionID, len(state.State))
					// Load the updated state
					c.loadSessionState(state)
					// Re-render the view with the new state
					// The view function will re-read from c.state using StateInt/StateString/etc
					c.Sync()
					v.logDebug(c, "✅ Sync completed after receiving multi-tab update")
				} else {
					v.logDebug(c, "⚠️  Multi-tab broadcast ignored (SSE=%v, state=%v)", c.sse != nil, state != nil)
				}
			})
			v.logDebug(c, "✅ Subscribed to multi-tab updates for session: %s", c.sessionID)
		}

		if v.cfg.DevMode {
			c.Sync()
			v.persistCtx(c)
		} else {
			c.SyncSignals()
		}
		<-c.sse.Context().Done()

		// Unsubscribe when SSE closes
		if v.cfg.StatePersistence && v.stateStore != nil && c.sessionID != "" {
			v.stateStore.Unsubscribe(c.sessionID)
			v.logDebug(c, "Unsubscribed from session state updates: %s", c.sessionID)
		}

		c.sse = nil
		v.logDebug(c, "SSE connection closed")
	})
	v.mux.HandleFunc("GET /_action/{id}", func(w http.ResponseWriter, r *http.Request) {
		actionID := r.PathValue("id")
		var sigs map[string]any
		_ = datastar.ReadSignals(r, &sigs)
		cID, _ := sigs["via-ctx"].(string)
		active_ctx_count := 0
		inactive_ctx_count := 0
		for _, c := range v.contextRegistry {
			if c.sse != nil {
				active_ctx_count++
				continue
			}
			inactive_ctx_count++
		}
		v.logDebug(nil, "active_ctx_count=%d inactive_ctx_count=%d", active_ctx_count, inactive_ctx_count)
		c, err := v.getCtx(cID)
		if err != nil {
			v.logErr(nil, "action '%s' failed: %v", actionID, err)
			return
		}
		actionFn, err := c.getActionFn(actionID)
		if err != nil {
			v.logDebug(c, "action '%s' failed: %v", actionID, err)
			return
		}
		// log err if actionFn panics
		defer func() {
			if r := recover(); r != nil {
				v.logErr(c, "action '%s' failed: %v", actionID, r)
			}
		}()
		c.signalsMux.Lock()
		v.logDebug(c, "signals=%v", sigs)
		c.injectSignals(sigs)
		c.signalsMux.Unlock()
		actionFn()

	})
	return v
}

func genRandID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)[:8]
}

// SessionSource indicates where the session ID was extracted from
type SessionSource string

const (
	SessionSourceCookie  SessionSource = "cookie"
	SessionSourceURL     SessionSource = "url-param"
	SessionSourceNew     SessionSource = "new"
)

// extractSessionID retrieves or creates a session ID based on SessionMode configuration.
// Returns the session ID and its source (cookie, url-param, or new).
func (v *V) extractSessionID(w http.ResponseWriter, r *http.Request) (string, SessionSource) {
	// Determine parameter name (default: "sid")
	paramName := v.cfg.SessionParamName
	if paramName == "" {
		paramName = "sid"
	}

	var sessionID string
	var source SessionSource

	switch v.cfg.SessionMode {
	case SessionModeURL:
		// URL parameter only
		sessionID = r.URL.Query().Get(paramName)
		if sessionID != "" {
			source = SessionSourceURL
			v.logDebug(nil, "🔗 Session from URL parameter '%s': %s", paramName, sessionID)
		}

	case SessionModeBoth:
		// Try URL parameter first, fallback to cookie
		sessionID = r.URL.Query().Get(paramName)
		if sessionID != "" {
			source = SessionSourceURL
			v.logDebug(nil, "🔗 Session from URL parameter '%s': %s (mode: Both)", paramName, sessionID)
		} else {
			cookie, err := r.Cookie("via-session-id")
			if err == nil && cookie.Value != "" {
				sessionID = cookie.Value
				source = SessionSourceCookie
				v.logDebug(nil, "🍪 Session from cookie (fallback): %s (mode: Both)", sessionID)
			}
		}

	default: // SessionModeCookie (default, backward compatible)
		cookie, err := r.Cookie("via-session-id")
		if err == nil && cookie.Value != "" {
			sessionID = cookie.Value
			source = SessionSourceCookie
			v.logDebug(nil, "🍪 Session from cookie: %s (mode: Cookie)", sessionID)
		}
	}

	// Create new session if none found
	if sessionID == "" {
		sessionID = "sess-" + genRandID()
		source = SessionSourceNew

		// Set cookie for Cookie and Both modes (not for URL mode)
		if v.cfg.SessionMode != SessionModeURL {
			http.SetCookie(w, &http.Cookie{
				Name:   "via-session-id",
				Value:  sessionID,
				Path:   "/",
				MaxAge: 86400 * 30, // 30 days
				// Note: HttpOnly, Secure, and SameSite are intentionally omitted
				// to maximize Safari compatibility for localhost cookie sharing across tabs
			})
			v.logDebug(nil, "🆕 New session cookie created: %s (mode: %s)", sessionID, v.cfg.SessionMode)
		} else {
			v.logDebug(nil, "🆕 New session created: %s (mode: URL, no cookie set)", sessionID)
		}
	}

	return sessionID, source
}

// getOrCreateSessionID retrieves the session ID from cookie or creates a new one.
// Deprecated: Use extractSessionID() instead for SessionMode support.
func (v *V) getOrCreateSessionID(w http.ResponseWriter, r *http.Request) string {
	sessionID, _ := v.extractSessionID(w, r)
	return sessionID
}
