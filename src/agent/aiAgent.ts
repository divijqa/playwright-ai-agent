import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ChatOllama } from '@langchain/ollama';
import { logger } from '../utils/logger.js';
import type { FlightFieldMapping } from '../types/flight.js';
import { flightFieldDecisionSchema, type ValidatedFlightFieldDecision } from './schemas.js';
import { canonicalizeUrl } from '../utils/url.js';
import { loadMapping, saveMapping } from './mappingStore.js';
import { getPrompt } from './prompts.js';
import { environment as env } from '../config/environment.js';
import { FlightStatusPage, knownFlightFieldMapping } from '../pages/FlightStatusPage.js';

type AgentTimingMetrics = {
  browserInitializationMs: number;
  domExtractionMs: number;
  ollamaInferenceMs: number;
  playwrightExecutionMs: number;
  totalMs: number;
};

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

async function writeTimingArtifact(metrics: AgentTimingMetrics) {
  const artifact = {
    mode: env.aiEnabled ? 'ai-assisted' : 'baseline',
    model: env.aiEnabled ? env.ollamaModel : null,
    recordedAt: new Date().toISOString(),
    durationsMs: metrics,
  };

  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/ai-timing.json', `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
}

function logTimingMetrics(metrics: AgentTimingMetrics) {
  logger.info('⏱️ Agent timing metrics:');
  logger.info(`  Browser initialization: ${metrics.browserInitializationMs}ms`);
  logger.info(`  DOM extraction:          ${metrics.domExtractionMs}ms`);
  logger.info(`  Ollama inference:       ${metrics.ollamaInferenceMs}ms`);
  logger.info(`  Playwright execution:   ${metrics.playwrightExecutionMs}ms`);
  logger.info(`  Total:                  ${metrics.totalMs}ms`);
}

async function writeAiDecisionArtifact(
  decision: ValidatedFlightFieldDecision,
  selectedLocators: { origin: string; destination: string },
) {
  const artifact = {
    model: env.ollamaModel,
    optionalFields: decision.optionalFields,
    selectedLocators,
    timestamp: new Date().toISOString(),
  };

  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/ai-decision.json', `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  logger.info('🧾 AI decision artifact saved to test-results/ai-decision.json');
}

export async function runAgent(targetBaseUrl = env.baseUrl, allowFallback = true) {
  const totalStart = performance.now();
  const timing: AgentTimingMetrics = {
    browserInitializationMs: 0,
    domExtractionMs: 0,
    ollamaInferenceMs: 0,
    playwrightExecutionMs: 0,
    totalMs: 0,
  };
  logger.info('✈️ Initializing Autonomous Agent (modular)...');

  const browserStart = performance.now();
  const browser = await chromium.launch({ headless: env.headless });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  timing.browserInitializationMs = elapsedMs(browserStart);

  // Navigate to canonical base URL
  try {
    const entry = canonicalizeUrl(targetBaseUrl);
    logger.info(`🔗 Navigating to: ${entry}`);
    await page.goto(entry, { waitUntil: 'domcontentloaded' });
    logger.info('✅ Page navigation successful');
  } catch (e) {
    logger.warn('❌ Failed to navigate to baseUrl:', targetBaseUrl, e);
    // Continue anyway - may still work with fallback selectors
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
  timing.browserInitializationMs = elapsedMs(browserStart);

  const cleanInputs = [
    { tag: 'input', id: 'flightStatusForm.origin', name: 'originAirport', placeholder: 'From', label: 'From Airport' },
    { tag: 'input', id: 'flightStatusForm.destination', name: 'destinationAirport', placeholder: 'To', label: 'Arrival Airport' },
    { tag: 'input', id: 'flightStatusForm.flightNumber', name: 'flightNumber', placeholder: 'Flight Number', label: 'Flight Number (Optional)' }
  ];

  // Extract actual form inputs from the page DOM
  // Note: code inside page.evaluate() runs in browser context, so DOM APIs are available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domExtractionStart = performance.now();
  const extractedInputs = env.aiEnabled ? await page.evaluate(() => {
    // @ts-ignore - this code runs in browser context where document is available
    const inputs: any[] = [];
    // @ts-ignore
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    // @ts-ignore
    allInputs.forEach((el: any) => {
      const input = el as any;
      inputs.push({
        tag: input.tagName.toLowerCase(),
        id: input.id || '',
        name: input.name || '',
        placeholder: input.placeholder || '',
        type: input.type || 'text',
        ariaLabel: input.getAttribute('aria-label') || '',
        ariaPlaceholder: input.getAttribute('aria-placeholder') || '',
        label: (() => {
          // @ts-ignore - this callback executes in the browser context.
          const label = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
          return label?.textContent?.trim() || input.getAttribute('aria-label') || '';
        })(),
      });
    });
    return inputs;
  }) : [];
  timing.domExtractionMs = env.aiEnabled ? elapsedMs(domExtractionStart) : 0;

  // Use extracted inputs if available, otherwise fall back to hardcoded schema
  const formInputs = extractedInputs.length > 0 ? extractedInputs : cleanInputs;
  logger.info(
    env.aiEnabled
      ? `🖋️ Extracted ${formInputs.length} potential form fields from page DOM.`
      : `🖋️ AI disabled; using ${formInputs.length} fields from the known POM mapping.`,
  );
  if (env.aiEnabled && extractedInputs.length > 0) {
    logger.info('Page DOM inputs extracted for LLM analysis');
  }

  const domain = (() => { try { return new URL(targetBaseUrl).hostname; } catch { return 'unknown'; }})();
  let mapping: FlightFieldMapping | null = null;
  let decision: ValidatedFlightFieldDecision | null = null;

  if (env.aiEnabled) {
    const existing = await loadMapping(domain);
    if (existing) {
      logger.info('Using stored mapping for domain:', domain);
    }

    const prompt = getPrompt(formInputs, domain);
    logger.info('🧠 Sending prompt to local Ollama...');
    const llm = new ChatOllama({ model: env.ollamaModel, temperature: env.ollamaTemperature });
    const inferenceStart = performance.now();
    const response = await llm.invoke(prompt);
    timing.ollamaInferenceMs = elapsedMs(inferenceStart);
    const cleanJson = response.content.toString().replace(/```json|```/g, '').trim();
    try {
      const parsed: unknown = JSON.parse(cleanJson);
      const validation = flightFieldDecisionSchema.safeParse(parsed);
      if (!validation.success) {
        throw new Error(validation.error.issues.map((issue) => issue.message).join('; '));
      }
      decision = validation.data;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid AI field decision; refusing to interact with the page: ${reason}`);
    }

    mapping = decision;
    logger.info(`✅ Zod validated AI decision: required=${decision.requiredFields.join(', ')}, optional=${decision.optionalFields.join(', ')}`);
    logger.info(`🤖 AI reasoning: ${decision.reasoning}`);
  } else {
    mapping = knownFlightFieldMapping;
    logger.info('🚫 AI disabled; using known FlightStatusPage mapping.');
  }

  logger.info(`🎯 Mapping -> origin: ${mapping.originInputSelector} destination: ${mapping.destinationInputSelector}`);

  // Utility: check if a CSS selector actually matches elements on the page
  const selectorExists = async (selector: string): Promise<boolean> => {
    try {
      const loc = page.locator(selector);
      return (await loc.count()) > 0;
    } catch (e) {
      return false;
    }
  };

  // If mapping missing or invalid, attempt fallback heuristics to locate inputs
  const findSelector = async (candidates: string[]) => {
    for (const sel of candidates) {
      if (await selectorExists(sel)) {
        logger.info(`Found selector via heuristics: ${sel}`);
        return sel;
      }
    }
    return null;
  };

  // Try stored mapping first, but validate it exists on the page
  let originSelector: string | null = null;
  let destSelector: string | null = null;

  if (mapping) {
    if (await selectorExists(mapping.originInputSelector)) {
      originSelector = mapping.originInputSelector;
      logger.info(`Using mapped origin selector: ${originSelector}`);
    } else {
      logger.warn(`Stored origin selector not found on page: ${mapping.originInputSelector}, falling back to heuristics.`);
    }

    if (await selectorExists(mapping.destinationInputSelector)) {
      destSelector = mapping.destinationInputSelector;
      logger.info(`Using mapped destination selector: ${destSelector}`);
    } else {
      logger.warn(`Stored destination selector not found on page: ${mapping.destinationInputSelector}, falling back to heuristics.`);
    }
  }

  // Fall back to heuristics if stored mapping didn't work
  if (!originSelector) {
    originSelector = await findSelector([
      'input[name*=origin]', 'input[id*=origin]', 'input[placeholder*=From]', 'input[aria-label*=From]',
      '#flightStatusForm-origin'
    ]);
  }

  if (!destSelector) {
    destSelector = await findSelector([
      'input[name*=dest]', 'input[id*=dest]', 'input[placeholder*=To]', 'input[aria-label*=To]',
      '#flightStatusForm-destination'
    ]);
  }

  if (!originSelector || !destSelector) {
    throw new Error('Unable to identify both origin and destination inputs.');
  }

  if (decision && (!decision.requiredFields.includes('origin') || !decision.requiredFields.includes('destination'))) {
    throw new Error('AI field decision did not classify origin and destination as required fields.');
  }

  if (decision) {
    try {
      await writeAiDecisionArtifact(decision, {
        origin: originSelector,
        destination: destSelector,
      });
    } catch (error) {
      logger.warn('Failed to save AI decision artifact:', error);
    }
  }

  const pageModel = new FlightStatusPage(page, originSelector, destSelector);

  const playwrightStart = performance.now();
  await pageModel.origin.fill('DFW');
  await pageModel.origin.selectSuggestion('DFW');
  await page.waitForTimeout(500);
  await pageModel.destination.fill('LAX');
  await pageModel.destination.selectSuggestion('LAX');

  const originValue = await pageModel.origin.value();
    timing.playwrightExecutionMs = elapsedMs(playwrightStart);
  const destinationValue = await pageModel.destination.value();
  if (!originValue.startsWith('DFW') || !destinationValue.startsWith('LAX')) {
    throw new Error(`Flight fields were not filled correctly: ${originValue} -> ${destinationValue}`);
  }

  // The LLM identifies fields only. Playwright performs Search and verifies the response.
  try {
    await pageModel.search();
    logger.info('✅ Search completed and the target application rendered a response.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canFallback =
      allowFallback &&
      env.allowLocalFallback &&
      targetBaseUrl !== env.fallbackBaseUrl &&
      /Access Denied|anti-bot|blocked the search request/i.test(message);

    if (!canFallback) {
      throw error;
    }

    logger.warn(`⚠️ ${message}`);
    logger.warn(`↪️ Falling back transparently to demo page: ${env.fallbackBaseUrl}`);
    await browser.close();
    return runAgent(env.fallbackBaseUrl, false);
  }
  // Capture screenshot to verify what happened
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `screenshots/agent-run-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath });
    logger.info(`📸 Screenshot saved to: ${screenshotPath}`);
  } catch (e) {
    logger.warn('Failed to capture screenshot:', e);
  }

  // persist mapping if obtained from LLM
  if (env.aiEnabled && mapping) {
    try {
      await saveMapping(domain, mapping);
      logger.info('Saved mapping for domain:', domain);
    } catch (e) {
      logger.warn('Failed to save mapping:', e);
    }
  }
  await page.waitForTimeout(500);

  timing.playwrightExecutionMs = elapsedMs(playwrightStart);
  timing.totalMs = elapsedMs(totalStart);
  logTimingMetrics(timing);
  try {
    await writeTimingArtifact(timing);
    logger.info('⏱️ Timing artifact saved to test-results/ai-timing.json');
  } catch (error) {
    logger.warn('Failed to save timing artifact:', error);
  }

  logger.info('🏁 Agent run complete. Closing browser.');
  await browser.close();
}

export default runAgent;
