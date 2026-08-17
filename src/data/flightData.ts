import type { FlightSearchData } from '../types/flight.js';

export const flightSearchData: FlightSearchData[] = [
  { origin: 'DFW', destination: 'LAX' },
  { origin: 'JFK', destination: 'LAX', flightNumber: 'AA100' },
  { origin: 'ORD', destination: 'DFW', flightNumber: 'UA230' },
];

export function getRandomFlight(): FlightSearchData {
  if (flightSearchData.length === 0) throw new Error('No sample flights available');
  const idx = Math.floor(Math.random() * flightSearchData.length);
  const flight = flightSearchData[idx];
  if (!flight) throw new Error('Unexpected empty flight entry');
  return flight;
}

export default flightSearchData;
