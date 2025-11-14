# Persistent Counter Example

Demonstrates Via's state persistence and multi-tab synchronization features.

## 📊 Live Test Reports

View automated test results on GitHub Pages (updated after each push to `main`):
- **[Test Reports Dashboard](https://YOUR_USERNAME.github.io/YOUR_REPO/)** - Interactive HTML reports for all test modes

## What It Shows

- **State Persistence** - Counter value survives page refreshes
- **Multi-Tab Sync** - Counter updates across multiple browser tabs/windows in real-time
- **Session Management** - Uses cookies to maintain session across tabs
- **Network Testing** - Displays LAN IP for mobile device testing

## Prerequisites

- **Go+** installed
- **$GOPATH/bin in PATH** (for installed tools)

Install Task (task runner):
```bash
# macOS
brew install go-task

# Or with Go
go install github.com/go-task/task/v3/cmd/task@latest
```

## Running

```bash
task           # List all available tasks
task dev       # Start HTTPS development server with live reload
task dev-kill  # Stop server
```

Opens at **https://localhost:3443** (and your LAN IP for mobile testing).

**Live reload:** Edit code, save, auto-restarts.
**Certificates:** Uses mkcert for trusted local HTTPS (works on localhost AND LAN).

## Testing

**Tests are self-contained** - they automatically start/stop the correct server configuration!

### For CI/CD (Headless)
```bash
task test   # Run all tests (CI-safe, no GUI)
```

### For Development (GUI)
```bash
task test-ui       # Interactive Playwright UI (RECOMMENDED)
task test-debug    # Step through tests
task test-chromium # Run tests in Chromium only
task test-webkit   # Run tests in WebKit/Safari only
task test-report   # Open HTML report in browser
```

**Note:** Tests automatically manage server lifecycle - no need to manually start servers!

### Manual Multi-Window Testing
```bash
task dev-open-safari   # Opens 2 Safari windows side-by-side
task dev-open-chrome   # Opens 2 Chrome windows side-by-side
task dev-open-firefox  # Opens 2 Firefox windows side-by-side
```

**For manual testing:** Start server first with `task dev`, then use these commands.

**Note:** Firefox requires Accessibility permissions:
- System Preferences > Security & Privacy > Privacy > Accessibility
- Add Terminal (or your script runner)

## Test Reports

Playwright automatically generates multiple report formats in `tests/outputs/`:

```
tests/outputs/
├── reports/           # Test reports
│   ├── html/         # Interactive HTML report
│   ├── results.json  # Machine-readable JSON
│   └── junit.xml     # CI integration (JUnit format)
└── artifacts/        # Test artifacts
    ├── videos/       # .webm videos (failures only)
    ├── screenshots/  # .png screenshots (failures only)
    └── traces/       # Playwright traces (for debugging)
```

### HTML Report (Interactive)
- **View:** `task test-report`
- Features: Videos, screenshots, traces, step-by-step debugging
- Best for: Local development and debugging

### JSON Report (Machine-readable)
- **Path:** `tests/outputs/reports/results.json`
- Best for: CI/CD integration, custom reporting

### JUnit XML (CI Integration)
- **Path:** `tests/outputs/reports/junit.xml`
- Best for: GitHub Actions, Jenkins, GitLab CI

### Artifacts (Videos, Screenshots, Traces)
- **Path:** `tests/outputs/artifacts/`
- Captured automatically on test failures
- Videos: `.webm` format, Screenshots: `.png` format
- Traces: Time-travel debugging in Playwright UI

### GitHub Actions Integration

Playwright automatically enables enhanced CI features when `CI=true`:
- GitHub annotations show test failures inline in PRs
- Retries failing tests 2 times automatically
- Captures traces on failures for debugging

**Matrix Strategy for Multiple Server Configurations:**

The CI workflow uses a matrix strategy to test different session modes:
- **Cookie Mode**: Tests cookie-based sessions (cookie-*.spec.ts)
- **URL Mode**: Tests URL parameter sessions (url-*.spec.ts)
- **Hybrid Mode**: Tests URL + Cookie fallback (both-*.spec.ts)

Each matrix job runs tests independently, with tests managing their own server lifecycle.

**Example workflow** (`.github/workflows/test.yml`):
```yaml
jobs:
  test:
    strategy:
      matrix:
        config:
          - name: "Cookie Mode"
            tests: "cookie-*.spec.ts config-visibility.spec.ts"
          - name: "URL Mode"
            tests: "url-*.spec.ts"
          - name: "Hybrid Mode"
            tests: "both-*.spec.ts"

    steps:
      - name: Run tests
        run: cd tests && bun playwright test ${{ matrix.config.tests }}
        env:
          CI: true
```

**Tests handle server management automatically** - no manual start/stop needed!

See [`.github/workflows/test.yml`](.github/workflows/test.yml) for complete example.

## Manual Testing Multi-Tab Sync

⚠️ **Use the same URL in all tabs** - `localhost` and LAN IP don't share cookies!

**Desktop:**
- Both tabs: `https://localhost:3443`

**Mobile + Desktop:**
- Both use: `https://YOUR_LAN_IP:3443` (same WiFi)

## Safari Notes

Safari suspends background tabs to save battery. For live sync:
- Keep both tabs **visible side-by-side**, or
- Use separate Safari **windows** instead of tabs

Background tabs will sync when you switch back to them.

## How It Works

- State stored in `MemoryStore` (in-process key-value store)
- Session ID shared via cookies
- Updates broadcast via pub/sub to all connected tabs
- SSE (Server-Sent Events) pushes updates to browser

## Troubleshooting

**Tabs showing different Session IDs?**
- Use the same URL in both tabs (`localhost` vs LAN IP = different cookies)
- Clear browser cookies and refresh

**Port already in use?**
- Run `task dev-kill` to stop existing processes
- Or manually: `lsof -ti:3000 :3443 | xargs kill -9`

**Multi-tab sync not working?**
- Check Session IDs match (shown in debug section)
- Safari: keep tabs visible side-by-side (background tabs suspend)
- Check browser console for errors

**mkcert errors?**
- Ensure `$GOPATH/bin` is in your PATH
- Try: `mkcert -install` manually
- macOS may prompt for password (certificate trust)
