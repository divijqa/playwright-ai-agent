import { chromium } from 'playwright';
import { environment as env } from '../config/environment.js';

export async function createTestContext() {
  const browser = await chromium.launch({ headless: env.headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, context, page };
}

export default createTestContext;
