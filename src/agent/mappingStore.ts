import fs from 'fs/promises';
import path from 'path';
import type { FlightFieldMapping } from '../types/flight.js';

const STORE_PATH = path.resolve(process.cwd(), 'mappings.json');

async function readStore(): Promise<Record<string, FlightFieldMapping>> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, FlightFieldMapping>;
  } catch (e) {
    return {};
  }
}

async function writeStore(store: Record<string, FlightFieldMapping>) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export async function loadMapping(domain: string): Promise<FlightFieldMapping | null> {
  const store = await readStore();
  return store[domain] ?? null;
}

export async function saveMapping(domain: string, mapping: FlightFieldMapping): Promise<void> {
  const store = await readStore();
  store[domain] = mapping;
  await writeStore(store);
}

export default { loadMapping, saveMapping };
