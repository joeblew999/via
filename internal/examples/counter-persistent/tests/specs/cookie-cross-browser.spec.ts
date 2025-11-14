import { test, expect, Page, Browser } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { startServer, stopServer } from '../scripts/server-utils';

/**
 * Cookie mode: Cross-browser isolation
 *
 * Configuration: Cookie Mode (Default)
 * Description: Traditional session cookies, single browser only
 */

test.describe('Cookie mode: Cross-browser isolation', () => {
  let serverProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    // Start server with correct configuration
    serverProcess = await startServer('dev');
  });

  test.afterAll(async () => {
    // Stop server and cleanup
    await stopServer(serverProcess);
  });

  test('cookie-cross-browser', async ({ browser }) => {
    // Create browser context and pages
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto('/');


    // Test steps
    // Assert session IDs are different
    // Safari and Chrome should have different session IDs
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 !== sessionId2).toBeTruthy();

    // Click #increment
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/_action/')),
      page.getByRole('button', { name: 'Increment' }).click()
    ]);

    // Wait 1000ms
    await page1.waitForTimeout(1000);

    // Assert counter value is 1
    // 
    const counter0 = await getCounterValue(page);
    expect(counter0).toBe(1);

    // Assert counter value is 0
    // Chrome should NOT sync (different session)
    const counter1 = await getCounterValue(page);
    expect(counter1).toBe(0);


    
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

