import { test, expect } from '@playwright/test';

test('deliberately failing demo captures diagnostic artifacts', async ({ page }) => {
  test.skip(
    process.env.DEMO_FAILURE_ARTIFACTS !== 'true',
    'Opt-in demo: set DEMO_FAILURE_ARTIFACTS=true to generate failure artifacts.',
  );

  const diagnosticLogs: string[] = [];
  page.on('console', (message) => {
    diagnosticLogs.push(`[browser:${message.type()}] ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    diagnosticLogs.push(`[browser:error] ${error.message}`);
  });

  diagnosticLogs.push('[test] Opening the local flight search demo.');
  await page.goto('/flight-form.html');
  await page.getByLabel('From city or airport').fill('DFW');
  await page.getByLabel('To city or airport').fill('LAX');
  await page.getByRole('button', { name: 'Search' }).click();
  diagnosticLogs.push(`[test] Search submitted; page URL: ${page.url()}`);
  diagnosticLogs.push('[test] Expected heading: "This result does not exist".');

  await test.info().attach('sample-diagnostic-logs.txt', {
    body: diagnosticLogs.join('\n'),
    contentType: 'text/plain',
  });

  // Intentionally incorrect expectation: this demonstrates screenshot/video/trace capture.
  await expect(page.getByRole('heading', { name: 'This result does not exist' })).toBeVisible();
});