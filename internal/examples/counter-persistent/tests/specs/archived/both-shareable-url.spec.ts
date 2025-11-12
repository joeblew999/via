import { test, expect, Page, Browser } from '@playwright/test';

/**
 * Both mode: Shareable URL cross-browser
 *
 * Configuration: Hybrid Mode (URL + Cookie)
 * Description: URL parameter wins, falls back to cookie
 */

test.describe('Both mode: Shareable URL cross-browser', () => {
  let serverProcess: any;

  test.beforeAll(async () => {
    // TODO: Start server with environment variables
    // {
    //   "VIA_SESSION_MODE": "both"
    // }
    console.log('⚠️  Start server manually with: task dev-both');
  });

  test.afterAll(async () => {
    // TODO: Stop server
    console.log('⚠️  Stop server manually with: task kill');
  });

  test('both-shareable-url', async ({ browser }) => {
    // Create browser context and pages
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto('/');


    // Test steps
    // Assert session IDs are same
    // Shareable URL enables cross-browser sync
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 === sessionId2).toBeTruthy();

    // Click #increment
    await page.getByRole('button', { name: 'Increment' }).click();

    // Wait 500ms
    await page1.waitForTimeout(500);

    // Assert counter value is 1
    // Chrome syncs with Safari
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

