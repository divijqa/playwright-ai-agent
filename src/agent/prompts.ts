export function getPrompt(cleanInputs: any[], domain?: string): string {
  // Ask the model to classify the form before selecting selectors.
  return `
    You are an autonomous browser agent. You need to fill out a Flight Status search form on domain: ${domain ?? 'unknown'}.
    Here is a list of inputs found on the current page view:
    ${JSON.stringify(cleanInputs)}

    Determine which fields are required for a route-based flight search. Origin and destination are required. Flight number is optional and must not be treated as required for a route search.
    
    **Selector Priority (in order of preference):**
    1. Use \`id\` attributes that are **simple and stable** (e.g., flights-booking-id-1-input)
    2. Avoid IDs with UUIDs or timestamps in them (they change on each page load)
    3. Fall back to simple single-attribute selectors if no stable ID exists (e.g., input[aria-label="From"])
    4. Do NOT use complex multi-attribute selectors; they are unreliable

    Return ONLY a raw JSON object matching this schema exactly without markdown, code blocks, or explanation:
    {
      "originInputSelector": "a single CSS selector string (stable id or simple attribute) for the origin/departure city input",
      "destinationInputSelector": "a single CSS selector string (stable id or simple attribute) for the destination/arrival city input",
      "requiredFields": ["origin", "destination"],
      "optionalFields": ["flightNumber"],
      "reasoning": "brief explanation based on labels, names, placeholders, and field semantics"
    }
  `;
}

export default getPrompt;
