import { test, expect, Page, Browser } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { startServer, stopServer } from '../scripts/server-utils';

/**
 * NATS: Multi-region sync
 *
 * Configuration: NATS JetStream + URL
 * Description: Multi-region sync with NATS JetStream
 */

test.describe('NATS: Multi-region sync', () => {
  let serverProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    // Start server with correct configuration
    serverProcess = await startServer('dev-nats');
  });

  test.afterAll(async () => {
    // Stop server and cleanup
    await stopServer(serverProcess);
  });

  test('nats-multi-region', async ({ browser }) => {
    // Create browser context and pages
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto('/');


    // Test steps
    // Assert session IDs are same
    // 
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 === sessionId2).toBeTruthy();

    // TODO: Implement action 'assert_state_store'
    // {"action":"assert_state_store","expect":"nats"}

    // Click #increment
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/_action/')),
      page.getByRole('button', { name: 'Increment' }).click()
    ]);

    // Wait 1000ms
    await page1.waitForTimeout(1000);

    // Assert counter value is 1
    // Chrome in EU region syncs with Safari in US region
    const counter0 = await getCounterValue(page);
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

