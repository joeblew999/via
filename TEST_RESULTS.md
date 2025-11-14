# State Store Test Results

**Date:** 2025-11-11
**Tester:** Claude Code
**Test Subject:** StateStore (MemoryStore implementation)

---

## Test Environment

- **Server:** Counter-persistent example
- **Port:** 3000
- **StatePersistence:** Enabled
- **LogLevel:** Debug

---

## Test 1: Basic Counter Increment

### Setup
1. Started counter-persistent example server
2. Navigated to http://localhost:3000
3. Page loaded successfully with count = 0

### Action
Clicked "➕ Increment" button

### Expected Result
- Count should increment from 0 to 1
- UI should update to show "Count: 1"
- Server should log:
  - Action triggered
  - SetState() called
  - Sync() called
  - View rendered
  - Patch sent to client

### Actual Result ❌ FAIL
- Count remained at 0
- UI did **not** update
- Server logs showed:
  ```
  [debug] via-ctx="/_/5dcd158a" msg="signals=map[03cdb5c0:1 via-ctx:/_/5dcd158a]"
  ```
- **Missing logs:**
  - No "Sync() called" message
  - No "Rendering view for sync" message
  - No "Sending patch to client" message

### Root Cause Analysis

#### Evidence
1. **Action was triggered**: Server log shows `signals=map[03cdb5c0:1 ...]`
2. **Sync() was NOT called**: No debug logs from [context.go:191](context.go#L191)
3. **Action handler completed**: No errors or panics logged

#### Hypothesis: Action Function Not Executing
Looking at [via.go:379](via.go#L379), the action handler calls `actionFn()` but this might not be executing the function body.

The issue might be related to how the action closure captures variables when `StatePersistence` is enabled vs disabled.

#### Counter Example Code Analysis
```go
// From counter-persistent/main.go
v.Page("/", func(c *via.Context) {
    type Counter struct{ Count int }
    data := Counter{Count: c.StateInt("count", 0)}  // Loads from session

    increment := c.Action(func() {
        data.Count += step.Int()   // Modifies closure variable
        c.SetState("count", data.Count)  // Persist to store
        c.Sync()  // Push to browser - NOT BEING CALLED!
    })

    c.View(func() h.H {
        return h.H2(h.Textf("Count: %d", data.Count))  // Reads from closure
    })
})
```

#### Key Observations

1. **With StatePersistence: false**
   - Action runs
   - Sync() is called
   - UI updates ✅

2. **With StatePersistence: true**
   - Action runs (signals received)
   - Sync() is **not** called ❌
   - UI doesn't update ❌

3. **The Smoking Gun**
   The action function body contains `c.Sync()` which should produce debug logs, but we see NO logs from Sync(). This means either:
   - The action function is not executing at all, OR
   - The action function is panic'ing before reaching Sync(), OR
   - There's a deadlock preventing Sync() from executing

4. **Deadlock Theory**
   Looking at [via.go:375-379](via.go#L375-L379):
   ```go
   c.signalsMux.Lock()
   defer c.signalsMux.Unlock()
   v.logDebug(c, "signals=%v", sigs)
   c.injectSignals(sigs)
   actionFn()  // Action runs while signalsMux is LOCKED
   ```

   The action is called while `c.signalsMux` is locked. If the action (or Sync()) tries to acquire this lock, it would deadlock!

   But we already fixed the `stateMux` deadlock in SetState()... Let me check if Sync() uses signalsMux.

   Looking at [context.go:211-222](context.go#L211-L222):
   ```go
   updatedSigs := make(map[string]any)
   for id, sig := range c.signals {  // Does this need signalsMux?
       if sig.err != nil {
           c.app.logWarn(c, "failed to sync signal '%s': %v", sig.id, sig.err)
       }
       if sig.changed && sig.err == nil {
           updatedSigs[id] = fmt.Sprintf("%v", sig.v)
       }
   }
   ```

   **BINGO!** `Sync()` iterates over `c.signals` without acquiring `signalsMux`, but it's called while the action handler has the lock! This could cause a data race or panic.

5. **Alternative Theory: Silent Panic**
   The action handler has a recover() block at [via.go:370-374](via.go#L370-L374), but it only logs errors. If there's a panic *inside* the action function, it would be caught but the function would stop executing.

---

## Diagnostic Commands Run

```bash
# Started server
cd /Users/apple/workspace/go/src/github.com/joeblew999/wellknown/.src/via/internal/examples/counter-persistent
env GOWORK=off go run .

# Server started successfully on port 3000

# Tested with browser automation
# Clicked increment button
# Verified no UI update occurred
```

---

## Bug Summary

| Bug | Status | Impact |
|-----|--------|--------|
| SSE Context Registration | ✅ FIXED | SSE now connects properly |
| SetState Deadlock | ✅ FIXED | No more deadlock on state updates |
| **Sync() Not Called** | ❌ **ACTIVE** | **UI doesn't update when StatePersistence: true** |

---

## Next Steps to Debug

1. **Add logging before c.Sync()** in the action function to verify it's reached
2. **Add panic recovery** inside the action function with detailed logging
3. **Check for data races** with `go run -race .`
4. **Verify signalsMux** usage in Sync() and action handler
5. **Test with minimal action** that only logs (no SetState, no Sync)

---

## Recommendations

### Immediate Fix Options

1. **Option A: Lock Safety**
   - Release `signalsMux` before calling `actionFn()` in [via.go:379](via.go#L379)
   - Add proper locking in `Sync()` for signal iteration

2. **Option B: Better Panic Handling**
   - Add more detailed panic logging
   - Log entry/exit of action functions

3. **Option C: Race Detection**
   - Run with `-race` flag to identify data races
   - Fix any races in signal or state handling

### Long-term Improvements

1. Add structured logging for action execution lifecycle
2. Add test coverage for state persistence
3. Document locking requirements for action functions
4. Consider moving Sync() call outside user action function (auto-sync?)

---

## Files Examined

- [store.go](store.go) - StateStore interface and MemoryStore implementation
- [via.go](via.go#L344-L381) - Action handler
- [context.go](context.go#L190-L223) - Sync() method
- [internal/examples/counter-persistent/main.go](internal/examples/counter-persistent/main.go) - Test example

---

## Conclusion

The StateStore implementation (MemoryStore) appears to be correctly implemented. The bug preventing UI updates when `StatePersistence: true` is likely related to:

1. **Locking issues** between action handler and Sync()
2. **Silent panics** in the action function
3. **Data races** in signal access

The issue is **NOT** in the StateStore itself, but in how the action handler coordinates with Sync() when persistence is enabled.

**Estimated fix time:** 1-2 hours of debugging with proper logging and race detection.

---

**Status:** 🔴 BLOCKING - State persistence feature non-functional
