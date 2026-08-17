import { chromium } from 'playwright';
import { ChatOllama } from '@langchain/ollama';
import { logger } from '../utils/logger.js';
import type { FlightFieldMapping } from '../types/flight.js';
import { isFlightFieldMapping } from '../types/flight.js';
import { canonicalizeUrl } from '../utils/url.js';
import { loadMapping, saveMapping } from './mappingStore.js';
import { getPrompt } from './prompts.js';
import { environment as env } from '../config/environment.js';
import { FlightStatusPage } from '../pages/FlightStatusPage.js';

export async function runAgent() {
  logger.info('✈️ Initializing Autonomous Agent (modular)...');

  const browser = await chromium.launch({ headless: env.headless });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const llm = new ChatOllama({ model: env.ollamaModel, temperature: env.ollamaTemperature });

  // Navigate to canonical base URL
  try {
    const entry = canonicalizeUrl(env.baseUrl);
    await page.goto(entry, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    logger.warn('Failed to navigate to baseUrl:', env.baseUrl, e);
  }
  // attempt to dismiss common cookie/privacy modals
  try {
    const cookieSelectors = [
      'button:has-text("Dismiss")',
      'button:has-text("Dismiss")',
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      'button:has-text("Got it")',
      'button[aria-label*="cookie"]',
      '#onetrust-accept-btn-handler',
      '.cookie-consent button',
      '.consent-banner button'
    ];
    for (const cs of cookieSelectors) {
      try {
        const btn = page.locator(cs);
        if (await btn.count() > 0) {
          await btn.first().click();
          logger.info('Clicked cookie/privacy dismiss button:', cs);
          break;
        }
      } catch (_) {
        // ignore
      }
    }
  } catch (_) {
    // ignore
  }

  const cleanInputs = [
    { id: 'flightStatusForm.origin', name: 'originAirport', placeholder: 'From' },
    { id: 'flightStatusForm.destination', name: 'destinationAirport', placeholder: 'To' },
    { id: 'flightStatusForm.flightNumber', name: 'flightNumber', placeholder: 'Flight Number (Optional)' }
  ];

  logger.info(`🖋️ Extracted ${cleanInputs.length} potential form fields from schema profile.`);

  const domain = (() => { try { return new URL(env.baseUrl).hostname; } catch { return 'unknown'; }})();
  // check store first
  const existing = await loadMapping(domain);
  if (existing) {
    logger.info('Using stored mapping for domain:', domain);
  }

  const prompt = getPrompt(cleanInputs, domain);
  logger.info('🧠 Sending prompt to local Ollama...');
  const response = await llm.invoke(prompt);
  const cleanJson = response.content.toString().replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  let mapping: FlightFieldMapping | null = null;
  if (isFlightFieldMapping(parsed)) {
    mapping = parsed;
  } else {
    logger.warn('LLM returned unexpected mapping, falling back to heuristic selectors.');
  }

  if (mapping) logger.info(`🎯 Mapping -> origin: ${mapping.originInputSelector} destination: ${mapping.destinationInputSelector}`);

  const pageModel = new FlightStatusPage(page);

  // If mapping missing or invalid, attempt fallback heuristics to locate inputs
  const findSelector = async (candidates: string[]) => {
    for (const sel of candidates) {
      try {
        const loc = page.locator(sel);
        if (await loc.count() > 0) return sel;
      } catch (e) {
        // ignore
      }
    }
    return null;
  };

  const originSelector = mapping?.originInputSelector ?? await findSelector([
    'input[name*=origin]', 'input[id*=origin]', 'input[placeholder*=From]', 'input[aria-label*=From]'
  ]);

  const destSelector = mapping?.destinationInputSelector ?? await findSelector([
    'input[name*=dest]', 'input[id*=dest]', 'input[placeholder*=To]', 'input[aria-label*=To]'
  ]);

  if (originSelector) await pageModel.humanType(originSelector, 'DFW');
  await page.waitForTimeout(500);
  if (destSelector) await pageModel.humanType(destSelector, 'LAX');

  // persist mapping if obtained from LLM
  if (mapping) {
    try {
      await saveMapping(domain, mapping);
      logger.info('Saved mapping for domain:', domain);
    } catch (e) {
      logger.warn('Failed to save mapping:', e);
    }
  }
  await page.waitForTimeout(500);

  logger.info('🏁 Agent run complete. Closing browser.');
  await browser.close();
}

export default runAgent;
