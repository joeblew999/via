import { test, expect, Page, Browser } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { startServer, stopServer } from '../scripts/server-utils';

/**
 * Both mode: Cookie fallback when no URL param
 *
 * Configuration: Hybrid Mode (URL + Cookie)
 * Description: URL parameter wins, falls back to cookie
 */

test.describe('Both mode: Cookie fallback when no URL param', () => {
  let serverProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    // Start server with correct configuration
    serverProcess = await startServer('dev-both');
  });

  test.afterAll(async () => {
    // Stop server and cleanup
    await stopServer(serverProcess);
  });

  test('both-cookie-fallback', async ({ browser }) => {
    // Create browser context and pages
    // Create context (shared cookies/session)
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    await page1.goto('/');
    await page2.goto('/');


    // Test steps
    // Assert session IDs are same
    // Both windows use cookie (no URL param)
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 === sessionId2).toBeTruthy();

    // Assert session source is 'cookie'
    const source = await getSessionSource(page);
    expect(source).toBe('cookie');

    // Click #increment
    await Promise.all([
      page1.waitForResponse(resp => resp.url().includes('/_action/')),
      page1.getByRole('button', { name: 'Increment' }).click()
    ]);

    // Wait 500ms
    await page1.waitForTimeout(500);

    // Assert counter value is 1
    // Cookie-based sync works
    const counter0 = await getCounterValue(page2);
    expect(counter0).toBe(1);


    
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

