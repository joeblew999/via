# Test Generation Scripts

This directory contains scripts for generating automated tests from the declarative test matrix.

## gen-playwright-tests.ts

Generates Playwright test files from [test-matrix.yml](../test-matrix.yml).

### Usage

```bash
# From counter-persistent directory
bun run scripts/gen-playwright-tests.ts

# Or via Task
task gen_playwright
```

### What it does

1. Reads `test-matrix.yml`
2. Parses test scenarios and configurations
3. Generates TypeScript test files in `playwright-tests/`
4. Each test includes:
   - Setup and teardown hooks
   - Browser automation steps
   - Assertions with expected outcomes
   - Helper functions for common operations

### Generated Files

- `playwright-tests/cookie-same-browser.spec.ts`
- `playwright-tests/cookie-cross-browser.spec.ts`
- `playwright-tests/url-cross-browser.spec.ts`
- `playwright-tests/url-no-param.spec.ts`
- `playwright-tests/both-url-wins.spec.ts`
- `playwright-tests/both-cookie-fallback.spec.ts`
- `playwright-tests/both-shareable-url.spec.ts`
- `playwright-tests/nats-multi-region.spec.ts`

### Customization

To add new test scenarios:

1. Edit `test-matrix.yml`
2. Add your test under the `tests:` section
3. Run `task gen_playwright`
4. Generated tests will include TODO comments for unimplemented actions

### Example Test Matrix Entry

```yaml
tests:
  - id: my-custom-test
    config: cookie-mode
    name: "My custom test scenario"
    setup:
      - action: start_server
        config: cookie-mode
      - action: open_browser
        browser: safari
        windows: 2
        url: "https://{{LAN_IP}}:3443"
    steps:
      - action: wait_for_load
        timeout: 3000
      - action: click
        window: 1
        selector: "#increment"
      - action: assert_counter_value
        window: 2
        expect: 1
```

### Supported Actions

The generator currently supports these actions:

- `start_server` - Start development server
- `open_browser` - Open browser windows
- `wait_for_load` - Wait for page load
- `click` - Click element
- `wait` - Wait specified milliseconds
- `refresh` - Reload page
- `assert_session_ids` - Compare session IDs
- `assert_counter_value` - Verify counter value
- `assert_session_source` - Verify session source (cookie, url-param, new)
- `assert_state_store` - Verify state store type

Unsupported actions will generate TODO comments in the test file.

### Helper Functions

Generated tests include these helper functions:

```typescript
async function getSessionId(page: Page): Promise<string>
async function getSessionSource(page: Page): Promise<string>
async function getCounterValue(page: Page): Promise<number>
async function getStateStore(page: Page): Promise<string>
```

These functions expect the GUI to have elements with these IDs:
- `#session-id`
- `#session-source`
- `#count`
- `#state-store`

## Future Scripts

### gen-manual-tests.ts (Planned)

Generate manual test checklists in Markdown format from test-matrix.yml.

### validate-matrix.ts (Planned)

Validate test-matrix.yml for:
- Schema correctness
- Missing configurations
- Duplicate test IDs
- Broken references
