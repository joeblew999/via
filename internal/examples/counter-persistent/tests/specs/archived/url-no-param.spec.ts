import { test, expect, Page, Browser } from '@playwright/test';

/**
 * URL mode: No parameter creates new session
 *
 * Configuration: URL Parameter Mode
 * Description: Session ID in URL, works across browsers
 */

test.describe('URL mode: No parameter creates new session', () => {
  test.beforeAll(async () => {
    // TODO: Start server with environment variables
    // {
    //   "VIA_SESSION_MODE": "url"
    // }
    console.log('⚠️  Start server manually with: task dev-url');
  });

  test.afterAll(async () => {
    // TODO: Stop server
    console.log('⚠️  Stop server manually with: task kill');
  });

  test('url-no-param', async ({ browser }) => {
    // Create browser context and pages
    // Create context (shared cookies/session)
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    await page1.goto('/');
    await page2.goto('/');


    // Test steps
    // Assert session IDs are different
    // Each window gets NEW session (no cookie in URL mode)
    const sessionId1 = await getSessionId(page1);
    const sessionId2 = await getSessionId(page2);
    expect(sessionId1 !== sessionId2).toBeTruthy();

    // Assert session source is 'new'
    const source = await getSessionSource(page);
    expect(source).toBe('new');

    // Click #increment
    await Promise.all([
      page1.waitForResponse(resp => resp.url().includes('/_action/')),
      page1.getByRole('button', { name: 'Increment' }).click()
    ]);

    // Wait 1000ms
    await page1.waitForTimeout(1000);

    // Assert counter value is 1
    // 
    const counter0 = await getCounterValue(page1);
    expect(counter0).toBe(1);

    // Assert counter value is 0
    // Windows do NOT sync (different sessions)
    const counter1 = await getCounterValue(page2);
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

