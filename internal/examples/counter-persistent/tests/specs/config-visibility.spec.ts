import { test, expect } from '@playwright/test';

/**
 * Configuration Visibility Test
 * 
 * Validates that SessionMode configuration is visible in:
 * 1. GUI debug section (data attributes for Playwright discovery)
 * 2. Server startup output
 * 
 * This test ensures Steps 1-5 are working correctly.
 */

test.describe('Configuration Visibility', () => {
  test('should display session mode in GUI debug section', async ({ page }) => {
    await page.goto('/');

    // Find the debug info section
    const debugInfo = page.locator('#debug-info');
    await expect(debugInfo).toBeVisible();

    // Check that session mode is displayed
    const sessionModeElement = debugInfo.locator('[data-session-mode]');
    await expect(sessionModeElement).toBeVisible();

    // Get the session mode value
    const sessionMode = await sessionModeElement.getAttribute('data-session-mode');
    
    // Should be one of the three valid modes
    expect(['Cookie', 'URL', 'Cookie + URL']).toContain(sessionMode);

    console.log(`✅ Session Mode detected: ${sessionMode}`);
  });

  test('should display session ID in GUI debug section', async ({ page }) => {
    await page.goto('/');

    const debugInfo = page.locator('#debug-info');
    const sessionIdElement = debugInfo.locator('[data-session-id]');
    await expect(sessionIdElement).toBeVisible();

    const sessionId = await sessionIdElement.getAttribute('data-session-id');
    
    // Session ID should start with "sess-" and have 8 hex chars
    expect(sessionId).toMatch(/^sess-[0-9a-f]{8}$/);

    console.log(`✅ Session ID detected: ${sessionId}`);
  });

  test('should display session source in GUI debug section', async ({ page }) => {
    await page.goto('/');

    const debugInfo = page.locator('#debug-info');
    const sessionSourceElement = debugInfo.locator('[data-session-source]');
    await expect(sessionSourceElement).toBeVisible();

    const sessionSource = await sessionSourceElement.getAttribute('data-session-source');
    
    // Should be one of: cookie, url-param, or new
    expect(['cookie', 'url-param', 'new']).toContain(sessionSource);

    console.log(`✅ Session Source detected: ${sessionSource}`);
  });

  test('should have correct default session mode (Cookie)', async ({ page }) => {
    await page.goto('/');

    const debugInfo = page.locator('#debug-info');
    const sessionModeElement = debugInfo.locator('[data-session-mode]');
    const sessionMode = await sessionModeElement.getAttribute('data-session-mode');

    // Default mode should be Cookie
    expect(sessionMode).toBe('Cookie');

    console.log(`✅ Default session mode verified: ${sessionMode}`);
  });

  test('should have new session source on first visit', async ({ page }) => {
    // Use a new context to ensure no existing session
    await page.goto('/');

    const debugInfo = page.locator('#debug-info');
    const sessionSourceElement = debugInfo.locator('[data-session-source]');
    const sessionSource = await sessionSourceElement.getAttribute('data-session-source');

    // First visit should create a new session
    expect(sessionSource).toBe('new');

    console.log(`✅ New session created on first visit`);
  });

  test('should persist session ID on refresh', async ({ page }) => {
    await page.goto('/');

    // Get initial session ID
    const debugInfo = page.locator('#debug-info');
    const sessionIdElement = debugInfo.locator('[data-session-id]');
    const initialSessionId = await sessionIdElement.getAttribute('data-session-id');

    // Refresh the page
    await page.reload();

    // Get session ID after refresh
    const refreshedSessionId = await sessionIdElement.getAttribute('data-session-id');

    // Session ID should be the same
    expect(refreshedSessionId).toBe(initialSessionId);

    // Session source should now be "cookie" (not "new")
    const sessionSourceElement = debugInfo.locator('[data-session-source]');
    const sessionSource = await sessionSourceElement.getAttribute('data-session-source');
    expect(sessionSource).toBe('cookie');

    console.log(`✅ Session persisted across refresh: ${refreshedSessionId}`);
  });
});
