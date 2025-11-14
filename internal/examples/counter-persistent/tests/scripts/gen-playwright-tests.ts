#!/usr/bin/env bun
/**
 * Generate Playwright test files from test-matrix.yml
 *
 * Usage: bun run scripts/gen-playwright-tests.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { parse } from 'yaml';
import { ChildProcess } from 'child_process';

// Read and parse test-matrix.yml
const yamlContent = readFileSync('test-matrix.yml', 'utf-8');
const matrix = parse(yamlContent);

// Ensure output directory exists
mkdirSync(matrix.playwright.output_dir, { recursive: true });

console.log('🎭 Generating Playwright tests from test-matrix.yml...\n');

// Generate a test file for each test scenario
for (const test of matrix.tests) {
  const fileName = `${test.id}.spec.ts`;
  const filePath = `${matrix.playwright.output_dir}/${fileName}`;

  const testCode = generateTestCode(test, matrix);

  writeFileSync(filePath, testCode);
  console.log(`✅ Generated: ${filePath}`);
}

console.log(`\n🎉 Generated ${matrix.tests.length} test files!`);
console.log(`\nRun tests with:`);
console.log(`  bun playwright test              # Headless`);
console.log(`  bun playwright test --ui         # Interactive UI`);
console.log(`  bun playwright test --debug      # Debug mode`);

/**
 * Generate Playwright test code for a test scenario
 */
function generateTestCode(test: any, matrix: any): string {
  const config = matrix.configs.find((c: any) => c.id === test.config);

  return `import { test, expect, Page, Browser } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { startServer, stopServer } from '../scripts/server-utils';

/**
 * ${test.name}
 *
 * Configuration: ${config.name}
 * Description: ${config.description}
 */

test.describe('${test.name}', () => {
  let serverProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    // Start server with correct configuration
    serverProcess = await startServer('${config.task}');
  });

  test.afterAll(async () => {
    // Stop server and cleanup
    await stopServer(serverProcess);
  });

  test('${test.id}', async ({ browser }) => {
    ${generateBrowserSetup(test)}
    ${generateTestSteps(test, matrix)}
    ${generateBrowserCleanup(test)}
  });
});

${generateHelperFunctions()}
`;
}

/**
 * Generate browser setup code (create contexts and pages)
 */
function generateBrowserSetup(test: any): string {
  const setup = test.setup?.find((s: any) => s.action === 'open_browser');
  if (!setup) return '';

  const windows = setup.windows || 1;
  let code = '// Create browser context and pages\n';

  if (windows === 1) {
    code += '    const context = await browser.newContext({ ignoreHTTPSErrors: true });\n';
    code += '    const page = await context.newPage();\n';
    code += '    await page.goto(\'/\');\n\n';
  } else if (windows === 2) {
    code += '    // Create context (shared cookies/session)\n';
    code += '    const context = await browser.newContext({ ignoreHTTPSErrors: true });\n';
    code += '    const page1 = await context.newPage();\n';
    code += '    const page2 = await context.newPage();\n';
    code += '    await page1.goto(\'/\');\n';
    code += '    await page2.goto(\'/\');\n\n';
  }

  return code;
}

/**
 * Generate browser cleanup code
 */
function generateBrowserCleanup(test: any): string {
  const setup = test.setup?.find((s: any) => s.action === 'open_browser');
  if (!setup) return '';

  return '\n    // Cleanup\n    await context.close();\n';
}

/**
 * Generate test steps from test scenario
 */
function generateTestSteps(test: any, matrix: any): string {
  let code = '// Test steps\n';
  let counterIndex = 0;

  // Generate test step code (skip setup actions like start_server, open_browser)
  for (const step of test.steps) {
    code += generateStepCode(step, 4, counterIndex);
    if (step.action === 'assert_counter_value') counterIndex++;
  }

  return code;
}

/**
 * Generate code for a single step
 */
function generateStepCode(step: any, indent: number, counterIndex: number = 0): string {
  const spaces = ' '.repeat(indent);

  switch (step.action) {
    case 'wait_for_load':
      // Skip - pages already loaded in setup
      return '';

    case 'assert_session_ids':
      const expectSame = step.expect === 'same';
      return `${spaces}// Assert session IDs are ${step.expect}\n${spaces}// ${step.description || ''}\n${spaces}const sessionId1 = await getSessionId(page1);\n${spaces}const sessionId2 = await getSessionId(page2);\n${spaces}expect(sessionId1 ${expectSame ? '===' : '!=='} sessionId2).toBeTruthy();\n\n`;

    case 'click':
      // Map selector to actual button text
      const buttonText = step.selector === '#increment' ? 'Increment' :
                         step.selector === '#decrement' ? 'Decrement' :
                         step.selector === '#reset' ? 'Reset' : step.selector;
      return `${spaces}// Click ${step.selector}\n${spaces}await Promise.all([\n${spaces}  page${step.window ? step.window : ''}.waitForResponse(resp => resp.url().includes('/_action/')),\n${spaces}  page${step.window ? step.window : ''}.getByRole('button', { name: '${buttonText}' }).click()\n${spaces}]);\n\n`;

    case 'wait':
      return `${spaces}// Wait ${step.ms}ms\n${spaces}await page1.waitForTimeout(${step.ms});\n\n`;

    case 'assert_counter_value':
      return `${spaces}// Assert counter value is ${step.expect}\n${spaces}// ${step.description || ''}\n${spaces}const counter${counterIndex} = await getCounterValue(page${step.window || step.browser ? (step.window || '') : ''});\n${spaces}expect(counter${counterIndex}).toBe(${step.expect});\n\n`;

    case 'refresh':
      return `${spaces}// Refresh page\n${spaces}await page${step.window || step.browser ? (step.window || '') : ''}.reload();\n\n`;

    case 'assert_session_source':
      return `${spaces}// Assert session source is '${step.expect}'\n${spaces}const source = await getSessionSource(page);\n${spaces}expect(source).toBe('${step.expect}');\n\n`;

    default:
      return `${spaces}// TODO: Implement action '${step.action}'\n${spaces}// ${JSON.stringify(step)}\n\n`;
  }
}

/**
 * Generate helper functions
 */
function generateHelperFunctions(): string {
  return `
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
  const match = text?.match(/Count:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getStateStore(page: Page): Promise<string> {
  return await page.locator('#state-store').textContent() || '';
}
`;
}

// Export for use in other scripts
export { generateTestCode, generateTestSteps, generateBrowserSetup, generateBrowserCleanup };
