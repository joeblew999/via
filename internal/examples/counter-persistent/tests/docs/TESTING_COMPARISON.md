# Testing Approaches: AppleScript vs Playwright

This document compares the two testing approaches we have for multi-tab synchronization.

## TL;DR

- **AppleScript** - Great for **visual debugging** and **quick manual checks** (macOS only)
- **Playwright** - Great for **automation**, **CI/CD**, and **cross-platform** testing

**Use both!** They complement each other.

---

## AppleScript Automation ([test-browser.sh](test-browser.sh))

### What It Does

Opens 2 **real browser windows** side-by-side using macOS AppleScript.

```bash
task test_safari    # 2 Safari windows, side-by-side
task test_chrome    # 2 Chrome windows, side-by-side
task test_firefox   # 2 Firefox windows, side-by-side
```

### Pros ✅

- **Visual** - You see exactly what's happening
- **Real browsers** - Actual Safari, Chrome, Firefox (not simulated)
- **Real windows** - Not tabs, not contexts, actual OS windows
- **Easy debugging** - Watch it work, interact manually
- **Fast setup** - One command, windows appear
- **Great for demos** - Show clients how it works

### Cons ❌

- **macOS only** - Won't work on Linux CI/CD
- **Not automated** - You must watch and verify manually
- **Platform-specific** - Different script for each OS
- **Brittle** - Can break if browser UI changes
- **No assertions** - Can't auto-verify "counter = 1"
- **Can't run headless** - Always needs display

### Best For

- **Local development** - Quick visual checks
- **Debugging issues** - See exactly what's wrong
- **Demos** - Show stakeholders how sync works
- **Manual testing** - Follow [TESTING.md](TESTING.md) checklists

---

## Playwright Automation

### What It Does

Creates **browser contexts** (isolated cookie/storage environments) and **pages** (like tabs).

```bash
task test_playwright         # Headless (no UI)
task test_playwright_headed  # With visible browser
task test_playwright_ui      # Interactive debugging UI
task test_playwright_debug   # Step-by-step debugger
```

### How It Works

**Important:** Playwright **does not** open multiple windows like AppleScript!

Instead, it uses **contexts** and **pages**:

```typescript
// Same-browser multi-tab sync test
const context = await browser.newContext();  // One "session" (shares cookies)
const page1 = await context.newPage();       // "Window 1"
const page2 = await context.newPage();       // "Window 2"
// Both pages share cookies ✅ (like 2 Safari windows)

// Cross-browser sync test
const context1 = await browser.newContext(); // "Safari" (separate cookies)
const page1 = await context1.newPage();

const context2 = await browser.newContext(); // "Chrome" (separate cookies)
const page2 = await context2.newPage();
// Different cookies ✅ (like Safari + Chrome)
```

**Key difference:**
- AppleScript: Real OS windows (user can see them)
- Playwright: Browser contexts (isolated environments, may not be visible)

### Pros ✅

- **Cross-platform** - Works on macOS, Linux, Windows
- **Automated assertions** - `expect(counter).toBe(1)`
- **CI/CD ready** - GitHub Actions, GitLab CI, etc.
- **Headless mode** - Fast, no display needed
- **Screenshot/video** - Auto-capture on failure
- **Traces** - Timeline of what happened
- **Reliable** - Uses CDP/WebDriver protocols
- **Parallel tests** - Run 100s of tests quickly

### Cons ❌

- **Not real windows** - Uses contexts, not OS windows
- **Harder to debug** - Need to learn Playwright DevTools
- **Slower setup** - Install Bun, Playwright, browsers
- **More complex** - TypeScript, async/await, APIs
- **Not visual** - Headless mode shows nothing (by design)

### Best For

- **CI/CD pipelines** - Automated testing on every commit
- **Regression testing** - Run 100+ tests after changes
- **Cross-browser testing** - Test Chromium + WebKit together
- **Automated QA** - No manual verification needed

---

## Feature Comparison Table

| Feature | AppleScript | Playwright Headless | Playwright Headed | Playwright UI |
|---------|-------------|---------------------|-------------------|---------------|
| **Visual feedback** | ✅ Always | ❌ None | ✅ Browser visible | ✅ Interactive UI |
| **Real OS windows** | ✅ Yes | ❌ Contexts | ❌ Contexts | ❌ Contexts |
| **Cross-platform** | ❌ macOS only | ✅ All platforms | ✅ All platforms | ✅ All platforms |
| **CI/CD ready** | ❌ No | ✅ Yes | ⚠️ Needs display | ⚠️ Needs display |
| **Auto assertions** | ❌ Manual | ✅ Code | ✅ Code | ✅ Code |
| **Speed** | Fast | Fastest | Medium | Slow |
| **Debugging** | Easy (watch) | Hard (logs) | Medium (watch) | Easy (step through) |
| **Screenshots** | Manual | ✅ Auto | ✅ Auto | ✅ Auto |
| **Video recording** | Manual | ✅ Auto | ✅ Auto | ✅ Auto |
| **Setup complexity** | Low | Medium | Medium | Medium |

---

## Recommended Workflow

### During Development (Local)

1. **Quick check**: `task test_safari`
   - See it work visually
   - Verify basic functionality

2. **Detailed debugging**: `task test_playwright_ui`
   - Step through test code
   - Inspect DOM, network, console
   - Fix issues

3. **Pre-commit check**: `task test_playwright`
   - Run all tests headless
   - Ensure nothing broke

### In CI/CD (GitHub Actions)

```yaml
- name: Run Playwright tests
  run: task test_playwright  # Headless only
```

### When Demoing to Stakeholders

```bash
task test_safari  # Show real browser windows
```

---

## Multi-Window Testing: The Reality

### Your AppleScript Approach ✅

```bash
./test-browser.sh safari https://192.168.1.49:3443
```

**What happens:**
- Safari launches
- Window 1 appears on left half of screen
- Window 2 appears on right half of screen
- You can see both windows updating
- **This is perfect for visual verification!**

### Playwright Approach ⚠️

```typescript
const context = await browser.newContext();
const page1 = await context.newPage();  // Not a visible window!
const page2 = await context.newPage();  // Not a visible window!
```

**What happens in headless mode:**
- No windows appear
- Everything runs in memory
- You see test output in terminal
- Screenshots/videos saved on failure

**What happens in headed mode (`--headed`):**
- Browser window appears
- Pages open as **tabs** in one window
- Not side-by-side like AppleScript!
- Still useful for debugging

**What happens in UI mode (`--ui`):**
- Playwright UI appears
- You can step through tests
- Watch pages update
- Best debugging experience

---

## The Tricky Stuff You Mentioned

### 1. "Can Playwright really open windows with a single tab?"

**Answer:** No, not like AppleScript does.

Playwright doesn't open multiple OS windows. It uses:
- **Contexts** (isolated cookie/storage)
- **Pages** (like tabs, but not visible windows)

**For your use case:**
- Same-browser sync: One context, two pages ✅ (cookies shared)
- Cross-browser sync: Two contexts, one page each ✅ (cookies separate)

**This is actually better for automated testing** because:
- More reliable (no window manager issues)
- Works cross-platform (no AppleScript needed)
- Faster (no window rendering overhead in headless mode)

### 2. "We need headless and non-headless. This will be tricky."

**Answer:** It's not tricky! Playwright handles this perfectly.

```bash
# Headless (CI/CD) - No display needed
task test_playwright

# Headed (debugging) - See browser
task test_playwright_headed

# UI mode (best debugging) - Interactive
task test_playwright_ui

# Debug mode (step through) - Pause on breakpoints
task test_playwright_debug
```

**All use the same test code!** Just different flags.

---

## Recommendation

**Keep both approaches:**

```
┌─────────────────────┬─────────────────────────┐
│   AppleScript       │      Playwright         │
│   (Visual)          │      (Automated)        │
├─────────────────────┼─────────────────────────┤
│ • Local development │ • CI/CD pipelines       │
│ • Quick checks      │ • Regression testing    │
│ • Demos             │ • Automated QA          │
│ • Debugging         │ • Cross-platform        │
└─────────────────────┴─────────────────────────┘
```

**Why both?**
- AppleScript: Fast visual feedback during development
- Playwright: Automated regression testing in CI/CD

**You get the best of both worlds!**
