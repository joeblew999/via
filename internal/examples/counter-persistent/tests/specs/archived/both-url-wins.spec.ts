import { test, expect, Page, Browser } from '@playwright/test';

/**
 * Both mode: URL parameter wins over cookie
 *
 * Configuration: Hybrid Mode (URL + Cookie)
 * Description: URL parameter wins, falls back to cookie
 */

test.describe('Both mode: URL parameter wins over cookie', () => {
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

  test('both-url-wins', async ({ browser }) => {
    // Create browser context and pages
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto('/');


    // Test steps
    // TODO: Implement action 'assert_session_id'
    // {"action":"assert_session_id","browser":"safari","expect":"{{URL_SESSION}}","description":"URL parameter should override existing cookie"}

    // Assert session source is 'url-param'
    const source = await getSessionSource(page);
    expect(source).toBe('url-param');


    
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

