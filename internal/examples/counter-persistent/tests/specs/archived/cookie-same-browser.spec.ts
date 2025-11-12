import { test, expect, Page, Browser } from '@playwright/test';

/**
 * Cookie mode: Same browser multi-tab sync
 *
 * Configuration: Cookie Mode (Default)
 * Description: Traditional session cookies, single browser only
 */

test.describe('Cookie mode: Same browser multi-tab sync', () => {
  let serverProcess: any;

  test.beforeAll(async () => {
    // TODO: Start server with environment variables
    // {
    //   "VIA_SESSION_MODE": "cookie"
    // }
    console.log('⚠️  Start server manually with: task dev');
  });

  test.afterAll(async () => {
    // TODO: Stop server
    console.log('⚠️  Stop server manually with: task kill');
  });

  test('cookie-same-browser', async ({ browser }) => {
    // Create browser context and pages
    // Create context (shared cookies/session)
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    await page1.goto('/');
    await page2.goto('/');


    // Test steps
    // Assert session IDs are same
    // Both Safari windows should have same session ID
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 === sessionId2).toBeTruthy();

    // Click #increment
    await page1.getByRole('button', { name: 'Increment' }).click();

    // Wait 500ms
    await page1.waitForTimeout(500);

    // Assert counter value is 1
    // 
    const counter0 = await getCounterValue(page1);
    expect(counter0).toBe(1);

    // Assert counter value is 1
    // Window 2 should sync immediately
    const counter1 = await getCounterValue(page2);
    expect(counter1).toBe(1);

    // Refresh page
    await page2.reload();

    // Assert counter value is 1
    // Counter persists after refresh
    const counter2 = await getCounterValue(page2);
    expect(counter2).toBe(1);

    // Click #increment
    await page2.getByRole('button', { name: 'Increment' }).click();

    // Wait 500ms
    await page1.waitForTimeout(500);

    // Assert counter value is 2
    // Window 1 syncs after window 2 increment
    const counter3 = await getCounterValue(page1);
    expect(counter3).toBe(2);


    
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

