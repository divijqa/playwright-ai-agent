export type TestExpectation = 'success' | 'validation-error' | 'no-results';

export interface FlightSearchData {
  name: string;
  origin: string;
  destination: string;
  flightNumber?: string;
  expectedResult: TestExpectation;
}

/** CSS selector or Playwright locator string for an input field on the page */
export interface FlightFieldMapping {
  originInputSelector: string;
  destinationInputSelector: string;
}

export type FlightFieldRole = 'origin' | 'destination' | 'flightNumber';

export interface FlightFieldDecision extends FlightFieldMapping {
  requiredFields: FlightFieldRole[];
  optionalFields: FlightFieldRole[];
  reasoning: string;
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

export function isFlightFieldDecision(obj: unknown): obj is FlightFieldDecision {
  return (
    isFlightFieldMapping(obj) &&
    Array.isArray((obj as any).requiredFields) &&
    Array.isArray((obj as any).optionalFields) &&
    typeof (obj as any).reasoning === 'string'
  );
}
