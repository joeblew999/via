# Via State Persistence - Implementation Status

## Branch
`feature/state-persistence`

## Summary
Session-based state persistence implementation is 90% complete. Core functionality works but has one blocking bug with SSE when StatePersistence is enabled.

## ✅ What Works

### 1. Core Infrastructure (100%)
- ✅ [store.go](store.go) - StateStore interface + MemoryStore with pub/sub
- ✅ [configuration.go](configuration.go) - StatePersistence option added
- ✅ [via.go](via.go) - Session cookie management implemented
- ✅ [context.go](context.go) - State methods: SetState(), GetState(), StateInt(), StateString(), StateBool()

### 2. Counter Example (Works with Persistence Disabled)
- ✅ [internal/examples/counter-persistent/main.go](internal/examples/counter-persistent/main.go)
- ✅ Uses closure pattern (like original counter)
- ✅ Calls `c.SetState()` to persist state
- ✅ Loads initial state with `c.StateInt("count", 0)`
- ✅ **Tested**: Increment button works when `StatePersistence: false`

### 3. Backward Compatibility
- ✅ Original counter example still works unchanged
- ✅ All existing examples unaffected
- ✅ Feature is opt-in via Config

## ❌ Known Bug

### SSE Connection Fails When StatePersistence Enabled

**Symptom:**
```
StatePersistence: true  → Counter doesn't work, SSE fails
StatePersistence: false → Counter works perfectly
```

**Error Logs:**
```
[error] msg="failed to render page: ctx '/_/xxxxx' not found"
```

**Root Cause:**
When `StatePersistence: true`, something in the session management code ([via.go:146-156](via.go#L146-L156)) interferes with context registration or SSE connection establishment.

**Likely Issues:**
1. Session state loading happens before context is fully registered
2. SSE handler can't find context in registry
3. Timing issue between `loadSessionState()` and `v.registerCtx()`

**Code Location:**
```go
// via.go:146-160
if v.cfg.StatePersistence && v.stateStore != nil {
    sessionID := v.getOrCreateSessionID(w, r)
    c.sessionID = sessionID
    c.route = route

    // Load existing session state
    if sessionState, err := v.stateStore.Get(sessionID); err == nil {
        c.loadSessionState(sessionState)
    }
}

v.logDebug(c, "GET %s", route)
initContextFn(c)
v.registerCtx(c.id, c)  // Context registered AFTER session loading
```

## 🔧 Next Steps to Fix

### Debug Plan
1. Add debug logging to understand order of operations
2. Verify context is registered before SSE connects
3. Check if `loadSessionState()` has side effects
4. Ensure StateStore.Get() handles missing sessions gracefully

### Potential Fixes
1. **Option A**: Register context BEFORE loading session state
2. **Option B**: Make session loading async/deferred
3. **Option C**: Ensure SSE handler waits for context registration

### Testing Checklist
Once bug is fixed, verify:
- [ ] Counter increments when StatePersistence: true
- [ ] Count persists after page refresh
- [ ] Second browser tab shows same count
- [ ] Incrementing in one tab updates other tab
- [ ] Original counter example still works

## 📝 Files Modified

### Created
- `store.go` (220 lines) - StateStore interface + MemoryStore
- `internal/examples/counter-persistent/main.go` (76 lines) - Demo example
- `STATE_DESIGN.md` (300+ lines) - Architecture documentation
- `STATUS.md` (this file)

### Modified
- `configuration.go` - Added StatePersistence + StateStore fields
- `via.go` - Added session management + stateStore field
- `context.go` - Added state map + SetState/GetState methods

### Unchanged
- ✅ All existing examples (counter, greeter, countercomp, etc.)
- ✅ Core via framework functionality

## 🎯 Goal

Enable this usage pattern:

```go
v := via.New()
v.Config(via.Options{
    StatePersistence: true,  // Enable persistence
})

v.Page("/", func(c *via.Context) {
    type Counter struct{ Count int }
    data := Counter{Count: c.StateInt("count", 0)}  // Load from session

    increment := c.Action(func() {
        data.Count += 1
        c.SetState("count", data.Count)  // Persist to session
        c.Sync()
    })

    c.View(func() h.H {
        return h.P(h.Textf("Count: %d", data.Count))
    })
})
```

**Result:** State persists across refreshes and syncs across tabs!

## 🐛 Bug Reproduction

```bash
cd via/internal/examples/counter-persistent

# Edit main.go: Set StatePersistence: true
# Run server
env GOWORK=off go run .

# Open http://localhost:3000
# Click increment button
# Result: Count stays at 0 (SSE not working)

# Edit main.go: Set StatePersistence: false
# Restart server
# Click increment button
# Result: Count increments to 1 ✅ (works perfectly)
```

## 💡 Recommendations

1. **Immediate**: Add debug logging around context registration
2. **Short-term**: Fix SSE bug, enable StatePersistence
3. **Medium-term**: Test multi-tab sync thoroughly
4. **Long-term**: Add Redis/SQLite store implementations
