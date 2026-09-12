/**
 * store.ts
 * Embedded LanceDB vector store — two tables:
 *   - locator_memory: successful field -> selector mappings
 *   - failure_memory: past failures and (if found) their working fix
 */

import * as lancedb from "@lancedb/lancedb";
import { embedText } from "./embeddings.js";

const DB_PATH = process.env.RAG_DB_PATH || ".rag/lancedb";

export interface LocatorMemoryRecord {
  [key: string]: unknown;
  id: string;
  vector: number[];
  signature: string; // raw text signature that was embedded
  selector: string;  // validated working selector
  domain: string;    // page domain/origin for filtering
  url: string;
  createdAt: string;
}

export interface FailureMemoryRecord {
  [key: string]: unknown;
  id: string;
  vector: number[];
  signature: string;
  errorMessage: string;
  attemptedSelector: string;
  fixSelector?: string; // populated once a retry succeeds
  domain: string;
  url: string;
  createdAt: string;
}

let dbPromise: Promise<lancedb.Connection> | null = null;

async function getDb(): Promise<lancedb.Connection> {
  if (!dbPromise) {
    dbPromise = lancedb.connect(DB_PATH);
  }
  return dbPromise;
}

async function getOrCreateTable<T extends Record<string, unknown>>(
  name: string,
  sampleRow: T
): Promise<lancedb.Table> {
  const db = await getDb();
  const existing = await db.tableNames();
  if (existing.includes(name)) {
    return db.openTable(name);
  }
  return db.createTable(name, [sampleRow]);
}

// ---------- locator_memory ----------

export async function upsertLocatorMemory(
  record: Omit<LocatorMemoryRecord, "vector"> & { vector?: number[] }
): Promise<void> {
  // Documents embedded using 'search_document' task type
  const vector = record.vector ?? (await embedText(record.signature as string, "search_document"));
  const fullRecord: LocatorMemoryRecord = { ...record, vector } as LocatorMemoryRecord;
  const table = await getOrCreateTable(
    "locator_memory",
    fullRecord as unknown as Record<string, unknown>
  );
  await table.add([fullRecord]);
}

export async function searchLocatorMemory(
  signature: string,
  topK = 5,
  domain?: string
): Promise<LocatorMemoryRecord[]> {
  const db = await getDb();
  const names = await db.tableNames();
  if (!names.includes("locator_memory")) return [];

  const table = await db.openTable("locator_memory");
  
  // Queries embedded using 'search_query' task type
  const queryVector = await embedText(signature, "search_query");

  let builder = table.vectorSearch(queryVector).limit(topK);
  if (domain) {
    builder = builder.where(`domain = '${domain.replace(/'/g, "''")}'`);
  }
  
  const results = await builder.toArray();
  return results as unknown as LocatorMemoryRecord[];
}

// ---------- failure_memory ----------

export async function upsertFailureMemory(
  record: Omit<FailureMemoryRecord, "vector"> & { vector?: number[] }
): Promise<void> {
  const vector = record.vector ?? (await embedText(record.signature as string, "search_document"));
  const fullRecord: FailureMemoryRecord = { ...record, vector } as FailureMemoryRecord;
  const table = await getOrCreateTable(
    "failure_memory",
    fullRecord as unknown as Record<string, unknown>
  );
  await table.add([fullRecord]);
}

export async function searchFailureMemory(
  signature: string,
  topK = 5,
  domain?: string
): Promise<FailureMemoryRecord[]> {
  const db = await getDb();
  const names = await db.tableNames();
  if (!names.includes("failure_memory")) return [];

  const table = await db.openTable("failure_memory");
  const queryVector = await embedText(signature, "search_query");

  let builder = table.vectorSearch(queryVector).limit(topK);
  if (domain) {
    builder = builder.where(`domain = '${domain.replace(/'/g, "''")}'`);
  }

  const results = await builder.toArray();
  return results as unknown as FailureMemoryRecord[];
}