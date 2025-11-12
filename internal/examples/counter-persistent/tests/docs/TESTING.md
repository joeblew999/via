# Manual Testing Guide

> **Auto-generated from [test-matrix.yml](test-matrix.yml)**
>
> This guide provides manual test procedures. Later, these will be automated with Playwright.

## Quick Reference: Server Configurations

| Mode | Command | Session Source | Cross-Browser Sync | Multi-Region |
|------|---------|----------------|-------------------|--------------|
| Cookie (default) | `task dev` | Cookie | ❌ No | ❌ No |
| URL Parameter | `task dev-url` | URL `?sid=...` | ✅ Yes | ❌ No |
| Hybrid (Both) | `task dev-both` | URL or Cookie | ✅ Yes (with URL) | ❌ No |
| NATS JetStream | `task dev-nats` | URL or Cookie | ✅ Yes (with URL) | ✅ Yes |

---

## Test 1: Cookie Mode - Same Browser Sync

**Configuration:** Cookie Mode (Default)
**Command:** `task dev`

**What it tests:** Traditional cookie-based sessions work within same browser

### Setup
1. Start server: `task dev`
2. Open 2 Safari windows: `task test_safari`

### Test Steps

**Step 1: Verify Session IDs**
- [ ] Both Safari windows show **same Session ID**
- [ ] Session Source shows: `cookie`
- [ ] State Store shows: `MemoryStore`

**Step 2: Test Multi-Tab Sync**
- [ ] Click **Increment** in left window
- [ ] Right window updates to **Count: 1** (within 500ms)

**Step 3: Test Persistence**
- [ ] Refresh right window
- [ ] Counter still shows **Count: 1**

**Step 4: Test Bi-Directional Sync**
- [ ] Click **Increment** in right window
- [ ] Left window updates to **Count: 2** (within 500ms)

**Expected Outcome:** ✅ Multi-tab sync works within Safari

---

## Test 2: Cookie Mode - Cross-Browser Isolation

**Configuration:** Cookie Mode (Default)
**Command:** `task dev`

**What it tests:** Different browsers don't sync (expected behavior)

### Setup
1. Start server: `task dev`
2. Open Safari: `task test_safari`
3. Open Chrome: `task test_chrome`

### Test Steps

**Step 1: Verify Session Isolation**
- [ ] Safari Session ID: `________`
- [ ] Chrome Session ID: `________`
- [ ] Session IDs are **DIFFERENT** ✅

**Step 2: Verify No Cross-Browser Sync**
- [ ] Click **Increment** in Safari
- [ ] Safari shows **Count: 1**
- [ ] Chrome shows **Count: 0** (no sync) ✅

**Expected Outcome:** ✅ Browsers are isolated (correct for cookie mode)

---

## Test 3: URL Parameter Mode - Cross-Browser Sync

**Configuration:** URL Parameter Mode
**Command:** `task dev-url`

**What it tests:** URL parameters enable cross-browser sync

### Setup
1. Start server: `task dev-url`
2. Generate session ID:
   ```bash
   SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
   echo "Session ID: $SESSION_ID"
   ```
3. Get LAN IP:
   ```bash
   LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
   echo "https://${LAN_IP}:3443?sid=${SESSION_ID}"
   ```
4. Open Safari with URL: `https://LAN_IP:3443?sid=SESSION_ID`
5. Open Chrome with **same URL**

### Test Steps

**Step 1: Verify Shared Session**
- [ ] Safari Session ID: `________`
- [ ] Chrome Session ID: `________`
- [ ] Session IDs are **SAME** ✅
- [ ] Session Source shows: `url-param` ✅

**Step 2: Test Cross-Browser Sync**
- [ ] Click **Increment** in Safari
- [ ] Chrome updates to **Count: 1** (within 500ms) ✅

**Step 3: Test Persistence with URL**
- [ ] Refresh Chrome (URL still has `?sid=...`)
- [ ] Counter shows **Count: 1** ✅

**Expected Outcome:** ✅ Safari and Chrome sync perfectly!

---

## Test 4: URL Parameter Mode - No Parameter Creates New Session

**Configuration:** URL Parameter Mode
**Command:** `task dev-url`

**What it tests:** Without URL param, each window gets new session

### Setup
1. Start server: `task dev-url`
2. Open Safari window 1: `https://LAN_IP:3443` (no `?sid=`)
3. Open Safari window 2: `https://LAN_IP:3443` (no `?sid=`)

### Test Steps

**Step 1: Verify Different Sessions**
- [ ] Window 1 Session ID: `________`
- [ ] Window 2 Session ID: `________`
- [ ] Session IDs are **DIFFERENT** ✅
- [ ] Session Source shows: `new` ✅

**Step 2: Verify No Sync**
- [ ] Click **Increment** in window 1
- [ ] Window 2 shows **Count: 0** (no sync) ✅

**Expected Outcome:** ✅ URL mode without parameter = isolated sessions

---

## Test 5: Hybrid Mode - URL Wins Over Cookie

**Configuration:** Hybrid Mode (Cookie + URL)
**Command:** `task dev-both`

**What it tests:** URL parameter takes precedence over cookie

### Setup
1. Start server: `task dev-both`
2. Open Safari: `https://LAN_IP:3443` (no URL param)
3. Wait for page load, note Session ID from cookie
4. Generate new session ID:
   ```bash
   NEW_SESSION=$(uuidgen | tr '[:upper:]' '[:lower:]')
   ```
5. Navigate Safari to: `https://LAN_IP:3443?sid=NEW_SESSION`

### Test Steps

**Step 1: Verify URL Wins**
- [ ] Session ID changes to new value from URL ✅
- [ ] Session Source shows: `url-param` ✅
- [ ] Counter resets to **Count: 0** (different session) ✅

**Expected Outcome:** ✅ URL parameter overrides cookie

---

## Test 6: Hybrid Mode - Cookie Fallback

**Configuration:** Hybrid Mode (Cookie + URL)
**Command:** `task dev-both`

**What it tests:** Falls back to cookie when no URL parameter

### Setup
1. Start server: `task dev-both`
2. Open 2 Safari windows: `https://LAN_IP:3443` (no URL param)

### Test Steps

**Step 1: Verify Cookie-Based Sync**
- [ ] Both windows show **same Session ID**
- [ ] Session Source shows: `cookie` ✅
- [ ] Click **Increment** in window 1
- [ ] Window 2 updates to **Count: 1** ✅

**Expected Outcome:** ✅ Cookie mode works when URL param absent

---

## Test 7: Hybrid Mode - Shareable URL Cross-Browser

**Configuration:** Hybrid Mode (Cookie + URL)
**Command:** `task dev-both`

**What it tests:** Shareable URL enables cross-browser sync

### Setup
1. Start server: `task dev-both`
2. Open Safari: `https://LAN_IP:3443`
3. Copy shareable URL from GUI (has `?sid=...`)
4. Open Chrome with copied URL

### Test Steps

**Step 1: Verify Shared Session**
- [ ] Safari and Chrome have **same Session ID** ✅
- [ ] Session Source shows: `url-param` ✅

**Step 2: Test Cross-Browser Sync**
- [ ] Click **Increment** in Safari
- [ ] Chrome updates to **Count: 1** ✅

**Expected Outcome:** ✅ Best of both worlds - cookie convenience + URL sharing

---

## Test 8: NATS JetStream - Multi-Region Sync

**Configuration:** NATS JetStream + URL
**Command:** `task dev-nats`

**What it tests:** State syncs across multiple server instances

### Setup
1. Start NATS server: `task _start-nats`
2. Start server instance 1: `VIA_NATS_URL=nats://localhost:4222 task dev-nats`
3. Start server instance 2 (different port): `VIA_PORT=3001 VIA_NATS_URL=nats://localhost:4222 task dev-nats`
4. Generate session ID:
   ```bash
   SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
   ```
5. Open Safari: `https://localhost:3443?sid=SESSION_ID` (server 1)
6. Open Chrome: `https://localhost:3001?sid=SESSION_ID` (server 2)

### Test Steps

**Step 1: Verify NATS Connection**
- [ ] State Store shows: `NATS JetStream` ✅
- [ ] Both browsers show same Session ID ✅

**Step 2: Test Multi-Server Sync**
- [ ] Click **Increment** in Safari (server 1)
- [ ] Chrome (server 2) updates to **Count: 1** ✅
- [ ] Note: May take up to 1 second (NATS propagation)

**Expected Outcome:** ✅ Different servers sync via NATS

---

## Troubleshooting Test Failures

### Session IDs Don't Match
- **Check:** Are you using the same URL? (`localhost` ≠ LAN IP)
- **Check:** Did you copy the full URL including `?sid=...`?
- **Fix:** Clear browser cookies and retry

### Counter Doesn't Sync
- **Check:** Are Session IDs the same? (shown in debug section)
- **Check:** Safari background tabs? (keep windows side-by-side)
- **Check:** Browser console for errors (F12 → Console)
- **Fix:** Refresh page and wait for "Connected to server" message

### State Store Shows Wrong Type
- **Check:** Did you start server with correct task? (`task dev` vs `task dev-nats`)
- **Check:** Environment variables set correctly?
- **Fix:** Run `task kill` and restart with correct task

---

## Automated Testing with Playwright

This manual guide is generated from [test-matrix.yml](test-matrix.yml).

### Setup (One-Time)

Install Bun (faster than Node.js):

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart shell
```

Install Playwright:

```bash
cd counter-persistent/
bun add -d playwright @playwright/test
bun playwright install
```

### Running Automated Tests

```bash
# Run all tests (headless)
task test_playwright

# Run tests with interactive UI (debugging)
task test_playwright_ui

# Run specific test file
bun playwright test playwright-tests/cookie-mode.spec.ts

# Generate tests from test-matrix.yml (future)
task gen_playwright
```

### Test Structure

Generated test files (from [test-matrix.yml](test-matrix.yml)):
- `playwright-tests/cookie-mode.spec.ts` - Cookie-based session tests
- `playwright-tests/url-mode.spec.ts` - URL parameter tests
- `playwright-tests/both-mode.spec.ts` - Hybrid mode tests
- `playwright-tests/nats-mode.spec.ts` - Multi-region NATS tests

Each test automatically:
- Starts server with correct configuration
- Opens browsers (Chromium, WebKit) with correct URLs
- Performs actions and assertions
- Captures screenshots/videos on failure
- Tears down cleanly

### Why Bun?

- **Faster installs** - 10-100x faster than npm
- **Simpler** - No `package-lock.json` or `node_modules` bloat
- **Built-in test runner** - No need for separate test framework
- **Works with Playwright** - Drop-in replacement for Node.js

### CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v1

- name: Install Playwright
  run: |
    bun add -d playwright @playwright/test
    bun playwright install --with-deps

- name: Run tests
  run: task test_playwright
```
