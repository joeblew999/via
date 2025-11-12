# Persistent Counter Example

Demonstrates Via's state persistence and multi-tab synchronization features.

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
task          # List all available tasks
task dev      # Start HTTPS development server with live reload
task kill     # Stop server
```

Opens at **https://localhost:3443** (and your LAN IP for mobile testing).

**Live reload:** Edit code, save, auto-restarts.
**Certificates:** Uses mkcert for trusted local HTTPS (works on localhost AND LAN).

## Automated Testing

**Quick setup for multi-window testing:**

```bash
task test-safari    # Opens 2 Safari windows side-by-side
task test-chrome    # Opens 2 Chrome windows side-by-side
task test-firefox   # Opens 2 Firefox windows side-by-side
```

Each command:
- Kills existing browser instances (avoids race conditions)
- Opens 2 separate windows with your LAN IP
- Positions windows side-by-side automatically
- Ready to test multi-tab sync immediately!

**Note:** Firefox requires Accessibility permissions:
- System Preferences > Security & Privacy > Privacy > Accessibility
- Add Terminal (or your script runner)

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
- Run `task kill` to stop existing processes
- Or manually: `lsof -ti:3000 :3443 | xargs kill -9`

**Multi-tab sync not working?**
- Check Session IDs match (shown in debug section)
- Safari: keep tabs visible side-by-side (background tabs suspend)
- Check browser console for errors

**mkcert errors?**
- Ensure `$GOPATH/bin` is in your PATH
- Try: `mkcert -install` manually
- macOS may prompt for password (certificate trust)
