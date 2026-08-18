import { test, expect } from '@playwright/test';
import { flightSearchData } from '../src/data/flightData.js';

for (const testCase of flightSearchData) {
  test(testCase.name, async ({ page }) => {
    await page.goto('/flight-form.html');

    await page.getByLabel('From city or airport').fill(testCase.origin);
    await page.getByLabel('To city or airport').fill(testCase.destination);

    if (testCase.flightNumber) {
      await page.getByLabel('Flight number').fill(testCase.flightNumber);
    }

    await page.getByRole('button', { name: 'Search' }).click();

    if (testCase.expectedResult === 'success') {
      await expect(page.getByRole('heading', { name: 'Flight search results' })).toBeVisible();
      await expect(page.getByText(`Flight search results: ${testCase.origin} to ${testCase.destination}`)).toBeVisible();
    } else if (testCase.expectedResult === 'validation-error') {
      await expect(page.getByRole('alert')).toContainText('Please enter valid airport codes');
    } else {
      await expect(page.getByRole('alert')).toContainText('No flights found');
    }
  });
}