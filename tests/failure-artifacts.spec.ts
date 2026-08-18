import { test, expect } from '@playwright/test';

test('deliberately failing demo captures diagnostic artifacts', async ({ page }) => {
  test.skip(
    process.env.DEMO_FAILURE_ARTIFACTS !== 'true',
    'Opt-in demo: set DEMO_FAILURE_ARTIFACTS=true to generate failure artifacts.',
  );

  await page.goto('/flight-form.html');
  await page.getByLabel('From city or airport').fill('DFW');
  await page.getByLabel('To city or airport').fill('LAX');
  await page.getByRole('button', { name: 'Search' }).click();

  // Intentionally incorrect expectation: this demonstrates screenshot/video/trace capture.
  await expect(page.getByRole('heading', { name: 'This result does not exist' })).toBeVisible();
});