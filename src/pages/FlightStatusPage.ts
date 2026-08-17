import { BasePage } from './BasePage.js';
import type { Page } from 'playwright';

export class FlightStatusPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // humanType expects an id-like selector string; we try to use it safely
  async humanType(selectorId: string, text: string) {
    const candidates = [
      selectorId,
      `#${selectorId}`,
      `input[id="${selectorId}"]`,
      `input[name="${selectorId}"]`,
      `input[placeholder="${selectorId}"]`,
      `input[aria-label="${selectorId}"]`,
      `label:has-text("${selectorId}") >> input`
    ];

    for (const sel of candidates) {
      try {
        const el = this.page.locator(sel);
        if (await el.count() > 0) {
          await el.fill('');
          for (const ch of text) {
            console.log(`[Emulating Type] Inputting character "${ch}" into field: ${sel}`);
            await this.page.waitForTimeout(Math.random() * 50 + 30);
            await el.type(ch);
          }
          return;
        }
      } catch (e) {
        // continue to next candidate
      }
    }

    console.warn(`No matching selector found for '${selectorId}'.`);
  }
}

export default FlightStatusPage;
