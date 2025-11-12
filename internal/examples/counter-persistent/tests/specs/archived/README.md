# Archived Tests

These tests were generated from `test-matrix.yml` but are not currently working due to Playwright limitations.

## Why Archived

1. **Playwright cannot open multiple Safari windows** - The generator assumes `open_browser: safari, windows: 2` can create 2 Safari.app instances, but Playwright can only create contexts/pages within a single browser process.

2. **Datastar SSE timing issues** - Tests don't properly wait for Server-Sent Events patches to arrive after button clicks.

3. **Wrong approach** - Trying to test multi-window behavior in a tool that can't do multi-window testing.

## What's Here

- `cookie-same-browser.spec.ts` - Cookie mode multi-tab sync
- `cookie-cross-browser.spec.ts` - Cookie mode isolation
- `url-cross-browser.spec.ts` - URL mode cross-browser sync
- `url-no-param.spec.ts` - URL mode without parameters
- `both-*.spec.ts` - Hybrid mode tests
- `nats-*.spec.ts` - NATS JetStream tests

## Alternative: Manual Tests

Use the manual test scripts instead:
```bash
task test_safari   # Real Safari multi-window testing
task test_chrome   # Real Chrome multi-window testing
task test_firefox  # Real Firefox multi-window testing
```

These scripts open actual browser windows side-by-side and work perfectly for testing multi-tab sync.

## Future

These tests may be useful if:
- Playwright adds true multi-window support
- We switch to API-level testing (bypassing UI)
- Someone fixes the Datastar SSE waiting logic
- We need them as reference for manual test scenarios
