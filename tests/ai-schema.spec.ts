import { test, expect } from '@playwright/test';
import { flightFieldDecisionSchema } from '../src/agent/schemas.js';

test('accepts a complete AI field decision', () => {
  const result = flightFieldDecisionSchema.safeParse({
    originInputSelector: '#flightStatusForm-origin',
    destinationInputSelector: '#flightStatusForm-destination',
    requiredFields: ['origin', 'destination'],
    optionalFields: ['flightNumber'],
    reasoning: 'Origin and destination define the route; flight number is optional.',
  });

  expect(result.success).toBe(true);
});

test('rejects incomplete or unexpected AI output', () => {
  const result = flightFieldDecisionSchema.safeParse({
    requiredFields: ['origin'],
    optionalFields: [],
    unexpectedField: true,
  });

  expect(result.success).toBe(false);
});