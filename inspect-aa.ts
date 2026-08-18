import { chromium } from 'playwright';

async function inspectPage() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    console.log('🌐 Navigating to aa.com...');
    await page.goto('https://www.aa.com/en-us/flights', { waitUntil: 'domcontentloaded' });

    // Dismiss cookies/privacy modals
    try {
      const dismissBtns = page.locator('button:has-text("Dismiss"), button[aria-label*="close"], .cookie-dismiss');
      if (await dismissBtns.count() > 0) {
        await dismissBtns.first().click();
        console.log('✅ Dismissed modal');
      }
    } catch (_) {
      // ignore
    }

    // Wait a moment for page to fully load
    await page.waitForTimeout(2000);

    // Extract all form inputs
    const inputs = await page.evaluate(() => {
      const result: any[] = [];
      document.querySelectorAll('input').forEach((el) => {
        result.push({
          id: el.id,
          name: el.name,
          type: el.type,
          placeholder: el.placeholder,
          ariaLabel: el.getAttribute('aria-label'),
          visible: el.offsetParent !== null,
          classList: Array.from(el.classList)
        });
      });
      return result;
    });

    console.log('\n📋 All form inputs on aa.com:\n');
    inputs.forEach((input, i) => {
      if (input.visible) {
        console.log(`[${i}] VISIBLE - id: ${input.id}, name: ${input.name}, placeholder: ${input.placeholder}`);
        console.log(`    aria-label: ${input.ariaLabel}`);
        console.log(`    type: ${input.type}, classes: ${input.classList.join(' ')}\n`);
      }
    });

    // Try to find origin/destination inputs specifically
    console.log('\n🔍 Testing common selectors:\n');
    const testSelectors = [
      'input[placeholder="City or airport"]',
      'input[aria-label*="origin"]',
      'input[aria-label*="destination"]',
      'input[id*="origin"]',
      'input[id*="dest"]',
      'input[placeholder*="From"]',
      'input[placeholder*="To"]'
    ];

    for (const sel of testSelectors) {
      const count = await page.locator(sel).count();
      console.log(`${sel} → ${count} matches`);
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
}

inspectPage();
