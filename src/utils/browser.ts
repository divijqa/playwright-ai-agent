import { chromium } from 'playwright';
import { environment as env } from '../config/environment.js';

export async function launchBrowser() {
  return chromium.launch({ headless: env.headless });
}

export default launchBrowser;
