export function getPrompt(cleanInputs: any[], domain?: string): string {
  // Prefer real-world locators (placeholder, aria-label, name, id) and return
  // CSS selector strings. If a stable selector exists, include it.
  return `
    You are an autonomous browser agent. You need to fill out a Flight Status search form on domain: ${domain ?? 'unknown'}.
    Here is a list of inputs found on the current page view:
    ${JSON.stringify(cleanInputs)}

    Identify the input fields needed to search for a flight status by route.
    Prefer returning CSS selectors that use placeholder text, aria-label, or input name attributes where possible (e.g. input[placeholder="From"], input[aria-label="From city"], input[name="origin"]).

    Return ONLY a raw JSON object matching this schema exactly without any markdown or explanation:
    {
      "originInputSelector": "a single CSS selector string to locate the origin input",
      "destinationInputSelector": "a single CSS selector string to locate the destination input"
    }
  `;
}

export default getPrompt;
