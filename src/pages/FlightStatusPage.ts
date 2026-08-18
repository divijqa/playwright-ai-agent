import { BasePage } from './BasePage.js';
import type { Page } from 'playwright';

export class FlightStatusPage extends BasePage {
  constructor(page: Page) {
    super(page);
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
