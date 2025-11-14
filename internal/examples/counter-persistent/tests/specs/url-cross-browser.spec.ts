import { test, expect, Page, Browser } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { startServer, stopServer } from '../scripts/server-utils';

/**
 * URL mode: Cross-browser sync
 *
 * Configuration: URL Parameter Mode
 * Description: Session ID in URL, works across browsers
 */

test.describe('URL mode: Cross-browser sync', () => {
  let serverProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    // Start server with correct configuration
    serverProcess = await startServer('dev-url');
  });

  test.afterAll(async () => {
    // Stop server and cleanup
    await stopServer(serverProcess);
  });

  test('url-cross-browser', async ({ browser }) => {
    // Create browser context and pages
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto('/');


    // Test steps
    // Assert session IDs are same
    // Safari and Chrome should have SAME session ID from URL
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 === sessionId2).toBeTruthy();

    // Assert session source is 'url-param'
    const source = await getSessionSource(page);
    expect(source).toBe('url-param');

    // Click #increment
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/_action/')),
      page.getByRole('button', { name: 'Increment' }).click()
    ]);

    // Wait 500ms
    await page1.waitForTimeout(500);

    // Assert counter value is 1
    // 
    const counter0 = await getCounterValue(page);
    expect(counter0).toBe(1);

    // Assert counter value is 1
    // Chrome SHOULD sync (same session)
    const counter1 = await getCounterValue(page);
    expect(counter1).toBe(1);

    // Refresh page
    await page.reload();

    // Assert counter value is 1
    // Counter persists after refresh
    const counter2 = await getCounterValue(page);
    expect(counter2).toBe(1);


    
    // Cleanup
    await context.close();

  });
});


/**
 * Helper Functions
 */

async function getSessionId(page: Page): Promise<string> {
  return await page.locator('[data-session-id]').getAttribute('data-session-id') || '';
}

async function getSessionSource(page: Page): Promise<string> {
  return await page.locator('[data-session-source]').getAttribute('data-session-source') || '';
}

async function getCounterValue(page: Page): Promise<number> {
  const text = await page.locator('h2').filter({ hasText: 'Count:' }).textContent();
  const match = text?.match(/Count:s*(d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getStateStore(page: Page): Promise<string> {
  return await page.locator('#state-store').textContent() || '';
}

