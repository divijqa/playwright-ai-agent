import { BasePage } from './BasePage.js';
import type { Page } from 'playwright';
import { expect } from '@playwright/test';
import { AirportSelector } from './components/AirportSelector.js';

export class FlightStatusPage extends BasePage {
  readonly origin: AirportSelector;
  readonly destination: AirportSelector;
  readonly searchButton;
  readonly resultsSection;
  readonly resultsMessage;

  constructor(page: Page, originSelector?: string, destinationSelector?: string) {
    super(page);
    this.origin = new AirportSelector(
      page,
      originSelector ?? '#flights-booking-id-1-input, #flightStatusForm-origin',
      'origin',
    );
    this.destination = new AirportSelector(
      page,
      destinationSelector ?? '#flights-booking-id-2-input, #flightStatusForm-destination',
      'destination',
    );
    this.searchButton = page.getByRole('button', { name: /^Search$/i }).first();
    this.resultsSection = page.locator('main, [role="main"], body').first();
    this.resultsMessage = page
      .getByText(/select flights|search results|flights from|no flights|unable to|error/i)
      .first();
  }

  async search() {
    await expect(this.searchButton).toBeVisible();
    const initialUrl = this.page.url();
    await this.searchButton.click();

    // aa.com may navigate or update the current view in place depending on routing state.
    await this.page.waitForTimeout(1500);

    await expect
      .poll(
        async () => {
          const urlChanged = this.page.url() !== initialUrl;
          const responseText = await this.page.locator('body').innerText();
          const hasResponseText = /select flights|search results|flights from|no flights|unable to|error/i.test(
            responseText,
          );
          return urlChanged || hasResponseText;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    const accessDenied = this.page.getByText(/access denied|don't have permission|errors\.edgesuite/i).first();
    if (await accessDenied.count()) {
      throw new Error(
        'aa.com blocked the search request with an Access Denied response. ' +
          'Check Jenkins/network access, proxy, firewall, or aa.com anti-bot restrictions.',
      );
    }

    await expect(this.resultsSection).toBeVisible();
    await expect(this.resultsMessage).toBeVisible();
  }

}

export default FlightStatusPage;
