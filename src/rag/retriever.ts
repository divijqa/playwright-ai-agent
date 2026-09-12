/**
 * retriever.ts
 * Runtime-facing API used by aiAgent.ts / prompts.ts.
 */

import {
  fieldSignature,
  failureSignature,
} from "./embeddings.js";
import {
  searchLocatorMemory,
  searchFailureMemory,
  upsertLocatorMemory,
  upsertFailureMemory,
} from "./store.js";
import type { LocatorMemoryRecord, FailureMemoryRecord } from "./store.js";

const SIMILARITY_TOP_K = Number(process.env.RAG_TOP_K || 5);

/**
 * Call before asking the LLM to pick a selector for a field.
 */
export async function getLocatorFewShotContext(
  field: { label?: string; name?: string; placeholder?: string; tag?: string; type?: string },
  domain?: string
): Promise<string> {
  const signature = fieldSignature(field);
  if (!signature) return "";

  let hits: LocatorMemoryRecord[] = [];
  try {
    hits = await searchLocatorMemory(signature, SIMILARITY_TOP_K, domain);
  } catch (err) {
    console.warn("[rag] locator memory search failed, continuing without it:", err);
    return "";
  }

  if (hits.length === 0) return "";

  const lines = hits.map(
    (h, i) => `${i + 1}. field("${h.signature}") -> selector: ${h.selector}`
  );

  return [
    "Similar fields seen previously (use as guidance, not ground truth):",
    ...lines,
  ].join("\n");
}

/**
 * Call after a locator decision is validated and successfully used.
 */
export async function recordLocatorSuccess(params: {
  field: { label?: string; name?: string; placeholder?: string; tag?: string; type?: string };
  selector: string;
  domain: string;
  url: string;
}): Promise<void> {
  const signature = fieldSignature(params.field);
  if (!signature) return;

  const safeDomain = params.domain.replace(/[^a-zA-Z0-9]/g, "_");
  const safeSignature = signature.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);

  try {
    await upsertLocatorMemory({
      id: `${safeDomain}:${safeSignature}:${Date.now()}`,
      signature,
      selector: params.selector,
      domain: params.domain,
      url: params.url,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[rag] failed to record locator success:", err);
  }
}

/**
 * Call when a step fails, before asking the LLM to propose a repair.
 */
export async function getFailureFewShotContext(
  failure: { errorMessage?: string; attemptedSelector?: string; domSummary?: string },
  domain?: string
): Promise<string> {
  const signature = failureSignature(failure);
  if (!signature) return "";

  let hits: FailureMemoryRecord[] = [];
  try {
    // Fetch top K * 2 to ensure enough results after filtering for fixSelector
    hits = await searchFailureMemory(signature, SIMILARITY_TOP_K * 2, domain);
  } catch (err) {
    console.warn("[rag] failure memory search failed, continuing without it:", err);
    return "";
  }

  const resolvedHits = hits.filter((h) => Boolean(h.fixSelector)).slice(0, SIMILARITY_TOP_K);
  if (resolvedHits.length === 0) return "";

  const lines = resolvedHits.map(
    (h, i) =>
      `${i + 1}. error("${h.errorMessage}") on selector("${h.attemptedSelector}") -> fixed with: ${h.fixSelector}`
  );

  return [
    "Similar past failures and how they were resolved:",
    ...lines,
  ].join("\n");
}

/**
 * Call once a retry/repair succeeds, to close the loop for next time.
 */
export async function recordFailureResolution(params: {
  failure: { errorMessage?: string; attemptedSelector?: string; domSummary?: string };
  fixSelector: string;
  domain: string;
  url: string;
}): Promise<void> {
  const signature = failureSignature(params.failure);
  if (!signature) return;

  const safeDomain = params.domain.replace(/[^a-zA-Z0-9]/g, "_");
  const safeSignature = signature.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);

  try {
    await upsertFailureMemory({
      id: `${safeDomain}:${safeSignature}:${Date.now()}`,
      signature,
      errorMessage: params.failure.errorMessage || "",
      attemptedSelector: params.failure.attemptedSelector || "",
      fixSelector: params.fixSelector,
      domain: params.domain,
      url: params.url,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[rag] failed to record failure resolution:", err);
  }
}