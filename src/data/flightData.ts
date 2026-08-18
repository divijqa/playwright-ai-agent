import type { FlightSearchData } from '../types/flight.js';

/**
 * Comprehensive flight search test data covering positive (happy path) and negative (error path) scenarios.
 * Used for data-driven testing to validate autonomous agent behavior across multiple scenarios.
 */
export const flightSearchData: FlightSearchData[] = [
  // ============ POSITIVE TEST CASES (Happy Path) ============
  {
    name: 'Valid route: DFW to LAX',
    origin: 'DFW',
    destination: 'LAX',
    expectedResult: 'success',
  },
  {
    name: 'Valid route: JFK to LAX',
    origin: 'JFK',
    destination: 'LAX',
    flightNumber: 'AA100',
    expectedResult: 'success',
  },
  {
    name: 'Valid route: ORD to DFW',
    origin: 'ORD',
    destination: 'DFW',
    flightNumber: 'UA230',
    expectedResult: 'success',
  },
  {
    name: 'Valid route: ATL to SFO',
    origin: 'ATL',
    destination: 'SFO',
    expectedResult: 'success',
  },
  {
    name: 'Valid route: LAX to NYC (with flight number)',
    origin: 'LAX',
    destination: 'JFK',
    flightNumber: 'AA1',
    expectedResult: 'success',
  },

  // ============ NEGATIVE TEST CASES (Error Paths) ============
  {
    name: 'Missing origin',
    origin: '',
    destination: 'LAX',
    expectedResult: 'validation-error',
  },
  {
    name: 'Missing destination',
    origin: 'DFW',
    destination: '',
    expectedResult: 'validation-error',
  },
  {
    name: 'Both origin and destination missing',
    origin: '',
    destination: '',
    expectedResult: 'validation-error',
  },
  {
    name: 'Invalid airport code: origin',
    origin: 'XXX',
    destination: 'LAX',
    expectedResult: 'validation-error',
  },
  {
    name: 'Invalid airport code: destination',
    origin: 'DFW',
    destination: 'ZZZ',
    expectedResult: 'validation-error',
  },
  {
    name: 'Both codes invalid',
    origin: 'INVALID',
    destination: 'BOGUS',
    expectedResult: 'validation-error',
  },
  {
    name: 'Same origin and destination',
    origin: 'DFW',
    destination: 'DFW',
    expectedResult: 'validation-error',
  },
  {
    name: 'Invalid flight number format',
    origin: 'DFW',
    destination: 'LAX',
    flightNumber: 'INVALID123456',
    expectedResult: 'no-results',
  },
];

/**
 * Get a random flight from the test data.
 * Useful for randomized testing and CI runs.
 */
export function getRandomFlight(): FlightSearchData {
  if (flightSearchData.length === 0) throw new Error('No sample flights available');
  const idx = Math.floor(Math.random() * flightSearchData.length);
  const flight = flightSearchData[idx];
  if (!flight) throw new Error('Unexpected empty flight entry');
  return flight;
}

/**
 * Get positive (success) test cases only.
 */
export function getPositiveFlights(): FlightSearchData[] {
  return flightSearchData.filter((f) => f.expectedResult === 'success');
}

/**
 * Get negative (error) test cases only.
 */
export function getNegativeFlights(): FlightSearchData[] {
  return flightSearchData.filter((f) => f.expectedResult !== 'success');
}

export default flightSearchData;
