# Testing Strategy

This document explains our testing approach for the Via persistent counter example.

## Test Types

### 1. Playwright Automated Tests ✅
**Location:** `specs/config-visibility.spec.ts`
**What they test:** Basic configuration display and session persistence
**Run with:** `task test_playwright`

**Status:** ✅ Working (12 tests passing in Chromium + WebKit)

These tests verify:
- Session mode is displayed correctly in UI
- Session ID format and persistence
- Session source tracking (new/cookie/url)
- Configuration defaults

### 2. Manual Browser Tests ✅ (RECOMMENDED)
**Location:** `manual/test-browser.sh`
**What they test:** Real multi-window Safari behavior and cross-tab sync
**Run with:**
- `task test_safari` - Opens 2 Safari windows side-by-side
- `task test_chrome` - Opens 2 Chrome windows side-by-side
- `task test_firefox` - Opens 2 Firefox windows side-by-side

**Status:** ✅ Working perfectly

**Why manual tests are better:**
- Tests ACTUAL Safari behavior (Playwright can't do this)
- Visual verification of state sync
- Real SSE/Datastar interaction
- Fast feedback loop
- Easy to debug

### 3. Generated Multi-Window Tests ❌ (ARCHIVED)
**Location:** `specs/archived/`
**Status:** ❌ Not working - archived

**Why archived:**
- Playwright cannot open multiple Safari.app windows
- Playwright contexts don't match real multi-window behavior
- Datastar SSE timing issues
- Fighting tool limitations instead of testing features

**Future:** May revisit if Playwright adds better multi-window support or we switch to API-level testing.

## How to Test

### Quick Check (Automated)
```bash
task test_playwright
```
Runs the config-visibility tests (takes ~10 seconds).

### Full Testing (Manual)
```bash
# Start the server
task dev

# In another terminal, open Safari windows
task test_safari

# Manually test:
# 1. Click increment in window 1 → verify window 2 updates
# 2. Refresh window 2 → verify count persists
# 3. Click increment in window 2 → verify window 1 updates
```

### Different Session Modes
```bash
task dev          # Cookie mode (default)
task dev-url      # URL parameter mode
task dev-both     # Hybrid mode (URL + Cookie fallback)
```

## Test Coverage

| Feature | Playwright | Manual | Coverage |
|---------|-----------|--------|----------|
| Config display | ✅ | ✅ | 100% |
| Session creation | ✅ | ✅ | 100% |
| Session persistence | ✅ | ✅ | 100% |
| Multi-tab sync (same browser) | ❌ | ✅ | Manual only |
| Cross-browser sync | ❌ | ✅ | Manual only |
| Safari-specific behavior | ❌ | ✅ | Manual only |

## Future Testing Plans

### When to Add Go Tests
Consider adding Go unit/integration tests when:
- Core session/state logic stabilizes
- Preparing to refactor
- Need regression prevention
- Have bugs that unit tests would catch

### What Go Tests Would Cover
- Session management logic
- State storage (MemoryStore, NATS)
- Pub/sub broadcasting
- Session mode routing

## Notes

- **Playwright limitations:** Cannot test true multi-window Safari behavior
- **Manual tests are first-class:** They test the real thing, not an approximation
- **Keep it simple:** Working tests > comprehensive but broken tests
- **Go tests later:** Once the API stabilizes and core features are complete
