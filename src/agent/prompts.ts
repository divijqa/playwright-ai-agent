/**
 * prompts.ts — v1.5 patch
 *
 * Adds an optional `failureContext` param to the existing getPrompt.
 * No new schema needed: a failed validation just re-runs the SAME
 * prompt/schema with an extra block telling the LLM what selector(s)
 * failed and why, so it returns a corrected full decision object.
 *
 * Merge this into your existing prompts.ts — only the signature and
 * the new `formattedFailureContext` block are additions; the rest of
 * your function body (RAG block, selector-priority rules, schema)
 * stays exactly as you have it.
 */

export function getPrompt(
  cleanInputs: any[],
  domain?: string,
  ragContext?: string,
  failureContext?: string // NEW
): string {
  const formattedRagContext = ragContext && ragContext.trim()
    ? `
    **Historical Context & Few-Shot RAG Examples (from similar DOMs/pages):**
    ${ragContext.trim()}
    `
    : '';

  // NEW: only present on a repair attempt
  const formattedFailureContext = failureContext && failureContext.trim()
    ? `
    **Previous Attempt Failed Validation:**
    ${failureContext.trim()}
    The selector(s) above did not resolve to exactly one element on the live page.
    Do not repeat the same selector for the same field — propose a different one,
    using the DOM metadata below and the selector-priority rules.
    `
    : '';

  return `
    You are an autonomous browser agent. You need to fill out a Flight Status search form on domain: ${domain ?? 'unknown'}.
    
    Here is a list of inputs found on the current page view:
    ${JSON.stringify(cleanInputs, null, 2)}
    ${formattedRagContext}
    ${formattedFailureContext}
    Determine which fields are required for a route-based flight search. Origin and destination are required. Flight number is optional and must not be treated as required for a route search.
    
    **Selector Priority (in order of preference):**
    1. Leverage historical successful selectors from RAG context if they match candidates in the current input list.
    2. Use \`id\` attributes that are **simple and stable** (e.g., flights-booking-id-1-input).
    3. Avoid IDs with UUIDs, dynamic hashes, or timestamps in them (they change on each page load).
    4. Fall back to simple single-attribute selectors if no stable ID exists (e.g., input[aria-label="From"]).
    5. Do NOT use complex multi-attribute selectors; they are unreliable.

    Return ONLY a raw JSON object matching this schema exactly without markdown, code blocks, or explanation:
    {
      "originInputSelector": "a single CSS selector string (stable id or simple attribute) for the origin/departure city input",
      "destinationInputSelector": "a single CSS selector string (stable id or simple attribute) for the destination/arrival city input",
      "requiredFields": ["origin", "destination"],
      "optionalFields": ["flightNumber"],
      "reasoning": "brief explanation based on labels, names, placeholders, field semantics, and RAG historical context"
    }
  `;
}

export default getPrompt;