import { test, expect } from '@playwright/test';
import { knownFlightFieldMapping } from '../src/pages/FlightStatusPage.js';

test('baseline mode has an explicit known POM mapping', () => {
  expect(knownFlightFieldMapping).toEqual({
    originInputSelector: '#flightStatusForm-origin',
    destinationInputSelector: '#flightStatusForm-destination',
  });
});