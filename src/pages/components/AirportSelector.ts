import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';

export class AirportSelector {
  readonly input: Locator;

  constructor(
    private readonly page: Page,
    selector: string,
    readonly fieldName: 'origin' | 'destination',
  ) {
    this.input = page.locator(selector).first();
  }

  async fill(airportCode: string) {
    await expect(this.input).toBeVisible();
    await this.input.scrollIntoViewIfNeeded();
    await this.input.click();
    await this.input.focus();
    await this.input.press('Control+A');
    await this.input.press('Delete');

    for (const character of airportCode) {
      console.log(`[Emulating Type] ${this.fieldName}: inputting "${character}"`);
      await this.page.waitForTimeout(Math.random() * 50 + 30);
      await this.input.type(character);
    }

    const value = await this.input.inputValue();
    console.log(`Typed ${this.fieldName}: "${value}"`);
  }

  async selectSuggestion(airportCode: string) {
    const option = this.page
      .locator('[role="option"]')
      .filter({ hasText: new RegExp(`\\b${airportCode}\\b`, 'i') })
      .first();

    if (await option.count()) {
      await expect(option).toBeVisible();
      await option.click();
      return;
    }

    // The local fixture has no autocomplete list; aa.com does.
    const suggestion = this.page
      .getByText(new RegExp(`\\b${airportCode}\\b`, 'i'))
      .first();
    if (await suggestion.count() && await suggestion.isVisible()) {
      await suggestion.click();
    }
  }

  async value() {
    return this.input.inputValue();
  }
}

export default AirportSelector;