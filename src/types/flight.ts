export interface FlightSearchData {
  origin: string;
  destination: string;
  flightNumber?: string;
}

/** CSS selector or Playwright locator string for an input field on the page */
export interface FlightFieldMapping {
  originInputSelector: string;
  destinationInputSelector: string;
}

/** Runtime type guard to validate parsed LLM output before use */
export function isFlightFieldMapping(obj: unknown): obj is FlightFieldMapping {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).originInputSelector === 'string' &&
    typeof (obj as any).destinationInputSelector === 'string'
  );
}
