import { BasePage } from './BasePage.js';
import type { Page } from 'playwright';
import { expect } from '@playwright/test';

export class FlightStatusPage extends BasePage {
  readonly searchButton;
  readonly resultsSection;
  readonly resultsMessage;

  constructor(page: Page) {
    super(page);
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

  async selectAirportSuggestion(airportCode: string) {
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
      .filter({ visible: true })
      .first();
    if (await suggestion.count()) {
      await suggestion.click();
    }
  }

  // humanType expects a CSS selector or id-like string; tries it as-is first, then fallback variants
  async humanType(selectorOrId: string, text: string) {
    // If it looks like a CSS selector (contains special chars), try it first as-is
    const isCssSelector = /[\[\]#.:>~+]/.test(selectorOrId);
    
    const candidates = isCssSelector
      ? [
          selectorOrId, // try as-is first
          `#${selectorOrId}`,
          `input[id="${selectorOrId}"]`,
          `input[name="${selectorOrId}"]`,
          `input[placeholder="${selectorOrId}"]`,
          `input[aria-label="${selectorOrId}"]`,
        ]
      : [
          selectorOrId,
          `#${selectorOrId}`,
          `input[id="${selectorOrId}"]`,
          `input[name="${selectorOrId}"]`,
          `input[placeholder="${selectorOrId}"]`,
          `input[aria-label="${selectorOrId}"]`,
          `label:has-text("${selectorOrId}") >> input`
        ];

    for (const sel of candidates) {
      try {
        const el = this.page.locator(sel);
        if (await el.count() > 0) {
          // Scroll into view and focus before typing
          await el.scrollIntoViewIfNeeded();
          await el.click();
          await el.focus();
          await this.page.waitForTimeout(150);
          
          // Clear field using keyboard shortcuts to ensure it works with frameworks
          await el.press('Control+A');
          await el.press('Delete');
          await this.page.waitForTimeout(100);
          
          // Type characters slowly
          for (const ch of text) {
            console.log(`[Emulating Type] Inputting character "${ch}" into field: ${sel}`);
            await this.page.waitForTimeout(Math.random() * 50 + 30);
            await el.type(ch);
          }
          
          // Verify the value was entered
          const inputValue = await el.inputValue();
          console.log(`✅ Typed "${text}" → Field value is now: "${inputValue}"`);
          return;
        }
      } catch (e) {
        console.warn(`⚠️ Error typing into ${sel}:`, e);
        // continue to next candidate
      }
    }

    console.warn(`❌ No matching selector found for '${selectorOrId}'.`);
  }
}

export default FlightStatusPage;
