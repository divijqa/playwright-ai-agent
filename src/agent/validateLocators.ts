// src/agent/validateLocators.ts

import type { Page } from 'playwright';
import { flightFieldDecisionSchema } from './schemas.js';
import type { infer as ZodInfer } from 'zod';
import { getPrompt } from './prompts.js';
import { recordFailureResolution } from '../rag/retriever.js';
import { logger } from '../utils/logger.js';

type FlightFieldDecision = ZodInfer<typeof flightFieldDecisionSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RepairOptions {
  page: Page;
  cleanInputs: any[];
  domain: string;
  ragContext?: string;
  callLLM: (prompt: string) => Promise<string>;
  maxAttempts?: number;
}

/**
 * Validates that candidate selectors match exactly ONE element on the active DOM page.
 */
export async function validateDecisionLocators(
  page: Page,
  decision: FlightFieldDecision
): Promise<ValidationResult> {
  const errors: string[] = [];

  const checkSelector = async (fieldName: string, selector: string) => {
    try {
      const count = await page.locator(selector).count();
      if (count === 0) {
        errors.push(`Selector for '${fieldName}' ("${selector}") matched 0 elements on page.`);
      } else if (count > 1) {
        errors.push(`Selector for '${fieldName}' ("${selector}") matched ${count} elements (expected exactly 1).`);
      }
    } catch (err: any) {
      errors.push(`Invalid CSS selector syntax for '${fieldName}': "${selector}" (${err.message})`);
    }
  };

  await checkSelector('originInputSelector', decision.originInputSelector);
  await checkSelector('destinationInputSelector', decision.destinationInputSelector);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Executes LLM inference + Zod validation + live DOM locator verification.
 * Automatically retries with failure context on error and updates RAG failure memory.
 */
export async function getValidatedDecisionWithRepair(
  options: RepairOptions
): Promise<FlightFieldDecision> {
  const { page, cleanInputs, domain, ragContext, callLLM, maxAttempts = 3 } = options;

  let failureContext: string | undefined = undefined;
  let attemptedSelectors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.info(`🧠 LLM Decision Attempt ${attempt}/${maxAttempts}...`);

    const prompt = getPrompt(cleanInputs, domain, ragContext ?? failureContext);
    const rawResponse = await callLLM(prompt);

    let decision: FlightFieldDecision;
    try {
      const cleanedJson = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
      decision = flightFieldDecisionSchema.parse(JSON.parse(cleanedJson));
    } catch (err: any) {
      const parseError = `JSON/Zod Parsing failed on attempt ${attempt}: ${err.message}`;
      logger.warn(`⚠️ ${parseError}`);
      failureContext = parseError;
      continue;
    }

    const domValidation = await validateDecisionLocators(page, decision);

    if (domValidation.valid) {
      logger.info(`✅ Locators validated on live DOM on attempt ${attempt}.`);

      if (attempt > 1 && attemptedSelectors.length > 0) {
        logger.info(`💾 Self-healing repair successful! Storing resolution in LanceDB RAG failure memory.`);
        await recordFailureResolution({
          failure: {
            errorMessage: failureContext || 'Failed initial locator validation',
            attemptedSelector: attemptedSelectors.join(' | '),
          },
          fixSelector: `${decision.originInputSelector} | ${decision.destinationInputSelector}`,
          domain,
          url: page.url(),
        });
      }

      return decision;
    }

    attemptedSelectors.push(`${decision.originInputSelector} | ${decision.destinationInputSelector}`);
    failureContext = domValidation.errors.join(' ');
    logger.warn(`❌ Locator validation failed on attempt ${attempt}: ${failureContext}`);
  }

  throw new Error(`Failed to obtain valid, matching locators after ${maxAttempts} attempts.`);
}