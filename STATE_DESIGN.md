# Via State Management Design

## Problem Statement

Current via framework has these state management issues:

1. **No persistence**: Server-side variables (`count := 0`, `data := Counter{Count: 0}`) don't persist
2. **No multi-tab sync**: Each tab gets unique context ID, no shared state
3. **No multi-server support**: In-memory `contextRegistry` doesn't work across servers
4. **Refresh loses state**: New page load creates new context with fresh state

**Only signals work** because they sync via SSE, but they reset on refresh.

## Current Architecture

```
Browser Tab 1          Browser Tab 2          Server
-----------            -----------            ------
Context ID: abc123     Context ID: def456     contextRegistry (in-memory)
Signals: synced        Signals: synced        {
State: isolated        State: isolated          "abc123": Context{signals, view, actions}
                                                "def456": Context{signals, view, actions}
                                              }
```

**Issues:**
- Each tab has different context ID → no shared state
- State only in memory → lost on server restart
- Signals sync to browser but reset on page refresh

## Proposed Architecture

### 1. Session-Based State Management

```
Browser Tab 1          Browser Tab 2          Server                  State Store
-----------            -----------            ------                  -----------
Session ID: sess-xyz   Session ID: sess-xyz   contextRegistry         {
Context ID: abc123     Context ID: def456     {                         "sess-xyz": {
Signals: synced        Signals: synced          "abc123": ctx1            "signals": {...}
State: shared          State: shared            "def456": ctx2            "state": {...}
                                              }                           "updated_at": ts
                                              sessionStore              }
                                              ↕︎                       }
                                              Redis/SQLite/Memory
```

### 2. Core Components

#### A. State Store Interface
```go
type StateStore interface {
    // Get session state
    Get(sessionID string) (*SessionState, error)

    // Set session state
    Set(sessionID string, state *SessionState) error

    // Delete session (cleanup)
    Delete(sessionID string) error

    // Subscribe to state changes (for multi-tab sync)
    Subscribe(sessionID string, callback func(*SessionState)) error
}

type SessionState struct {
    SessionID  string                 // Shared across tabs
    Signals    map[string]any         // Reactive signals
    State      map[string]any         // Arbitrary Go state
    Route      string                 // Current page route
    UpdatedAt  time.Time             // Last update timestamp
}
```

#### B. State Store Implementations

**Memory Store** (default, single-server):
```go
type MemoryStore struct {
    sessions map[string]*SessionState
    mu       sync.RWMutex
    subs     map[string][]chan *SessionState
}
```

**Redis Store** (multi-server):
```go
type RedisStore struct {
    client *redis.Client
    pubsub *redis.PubSub
}
```

**SQLite Store** (persistent, single-server):
```go
type SQLiteStore struct {
    db *sql.DB
}
```

#### C. Context Changes

```go
type Context struct {
    id                string
    sessionID         string              // NEW: shared session ID
    app               *V
    view              func() h.H
    componentRegistry map[string]*Context
    parentPageCtx     *Context
    sse               *datastar.ServerSentEventGenerator
    actionRegistry    map[string]func()
    signals           map[string]*signal
    signalsMux        sync.Mutex
    state             map[string]any      // NEW: arbitrary state storage
    stateMux          sync.Mutex          // NEW: state access mutex
}

// NEW: Store arbitrary state
func (c *Context) SetState(key string, value any) {
    c.stateMux.Lock()
    defer c.stateMux.Unlock()
    c.state[key] = value
    c.app.stateStore.Set(c.sessionID, c.getSessionState())
}

// NEW: Get arbitrary state
func (c *Context) GetState(key string) (any, bool) {
    c.stateMux.Lock()
    defer c.stateMux.Unlock()
    val, ok := c.state[key]
    return val, ok
}

// NEW: Typed state helpers
func (c *Context) StateInt(key string, defaultVal int) int {
    if val, ok := c.GetState(key); ok {
        if i, ok := val.(int); ok {
            return i
        }
    }
    return defaultVal
}

func (c *Context) StateString(key string, defaultVal string) string {
    if val, ok := c.GetState(key); ok {
        if s, ok := val.(string); ok {
            return s
        }
    }
    return defaultVal
}
```

### 3. Session Lifecycle

```
1. First page visit:
   - Browser sends GET /page
   - Server checks for session cookie
   - No cookie → Create new session ID
   - Set cookie: session-id=sess-xyz
   - Create context with session ID
   - Load state from store (or create new)
   - Render page with signals injected

2. SSE connection:
   - Browser connects to /_sse
   - Sends session ID + context ID
   - Server loads session state
   - Syncs signals + state to browser
   - Subscribe to state changes

3. User action:
   - Browser sends POST /_action/{id}
   - Sends session ID + signals
   - Server loads session state
   - Injects signals into context
   - Executes action
   - Action updates state: c.SetState("count", count+1)
   - State persisted to store
   - State broadcast to all tabs with same session

4. Page refresh:
   - Browser sends GET /page (with session cookie)
   - Server loads existing session state
   - Recreates context with loaded state
   - User sees same state as before refresh

5. Second tab:
   - Browser sends GET /page (with same session cookie)
   - Server loads same session state
   - Creates new context but links to same session
   - Both tabs sync via state store broadcasts
```

### 4. Multi-Tab Synchronization

```go
// When state changes in one tab:
func (c *Context) Sync() {
    // 1. Sync view
    elemsPatch := bytes.NewBuffer(make([]byte, 0))
    if err := c.view().Render(elemsPatch); err != nil {
        c.app.logErr(c, "sync view failed: %v", err)
        return
    }
    _ = c.sse.PatchElements(elemsPatch.String())

    // 2. Sync signals
    updatedSigs := make(map[string]any)
    for id, sig := range c.signals {
        if sig.changed && sig.err == nil {
            updatedSigs[id] = fmt.Sprintf("%v", sig.v)
        }
    }

    // 3. NEW: Persist session state
    sessionState := c.getSessionState()
    c.app.stateStore.Set(c.sessionID, sessionState)

    // 4. NEW: Broadcast to other tabs with same session
    c.app.stateStore.Broadcast(c.sessionID, sessionState)

    // 5. Sync to current tab
    if len(updatedSigs) != 0 {
        _ = c.sse.MarshalAndPatchSignals(updatedSigs)
    }
}

// Other tabs receive broadcast:
func (v *V) handleStateUpdate(sessionID string, state *SessionState) {
    // Find all contexts with this session ID
    for _, ctx := range v.contextRegistry {
        if ctx.sessionID == sessionID && ctx.sse != nil {
            // Update context state
            ctx.updateFromSessionState(state)

            // Sync to browser
            ctx.Sync()
        }
    }
}
```

### 5. Migration Path for Existing Code

**Before (doesn't persist):**
```go
v.Page("/", func(c *via.Context) {
    count := 0  // Lost on refresh
    step := c.Signal(1)

    increment := c.Action(func() {
        count += step.Int()
        c.Sync()
    })

    c.View(func() h.H {
        return h.Div(
            h.P(h.Textf("Count: %d", count)),
            h.Button(h.Text("Increment"), increment.OnClick()),
        )
    })
})
```

**After (persists + multi-tab sync):**
```go
v.Page("/", func(c *via.Context) {
    // Initialize from session state or default
    count := c.StateInt("count", 0)
    step := c.Signal(1)

    increment := c.Action(func() {
        count = c.StateInt("count", 0) + step.Int()
        c.SetState("count", count)  // Persists + broadcasts
        c.Sync()
    })

    c.View(func() h.H {
        count := c.StateInt("count", 0)  // Always get latest
        return h.Div(
            h.P(h.Textf("Count: %d", count)),
            h.Button(h.Text("Increment"), increment.OnClick()),
        )
    })
})
```

### 6. Implementation Phases

**Phase 1: State Store Interface + Memory Implementation**
- Add `StateStore` interface
- Implement `MemoryStore` with pub/sub for multi-tab
- Add session ID cookie management
- Add `state` map to Context
- Add `SetState()` / `GetState()` / typed helpers

**Phase 2: Context Session Management**
- Modify `Page()` to use session cookies
- Load/save session state on page load
- Update `Sync()` to persist + broadcast state
- Subscribe contexts to session state updates

**Phase 3: Redis/SQLite Implementations**
- Implement `RedisStore` for multi-server
- Implement `SQLiteStore` for persistence
- Add configuration for store selection

**Phase 4: Update Examples**
- Migrate counter example to use `c.SetState()`
- Demonstrate multi-tab sync
- Add example with refresh persistence

**Phase 5: Advanced Features**
- State serialization (JSON encoding)
- State versioning (handle schema changes)
- State garbage collection (expire old sessions)
- State compression (for large state objects)

## Benefits

1. **State persists** across page refreshes
2. **Multi-tab sync** via session-based state store
3. **Multi-server support** with Redis/DB backends
4. **Backward compatible** - existing signal-only code still works
5. **Flexible** - start with MemoryStore, upgrade to Redis for production
6. **Clean API** - `c.SetState("key", val)` / `c.StateInt("key", default)`

## Trade-offs

1. **Serialization overhead**: State must be JSON-encodable
2. **Storage cost**: Session state stored in external store
3. **Complexity**: More moving parts (sessions, stores, broadcasts)
4. **Type safety**: `SetState(any)` loses compile-time type checking

## Next Steps

1. Implement Phase 1 (State Store + Memory backend)
2. Test with counter example
3. Verify multi-tab sync works
4. Add Redis implementation
5. Update all examples
