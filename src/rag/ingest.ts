/**
 * ingest.ts
 * Backfill script: reads existing test-results/*.json artifacts and seeds 
 * locator_memory + failure_memory so RAG has historical context before tests run.
 *
 * Run with: npx ts-node rag/ingest.ts
 */

import { readdir, readFile } from "fs/promises";
import path from "path";
import { fieldSignature, failureSignature, embedBatch } from "./embeddings.js";
import { upsertLocatorMemory, upsertFailureMemory } from "./store.js";

const RESULTS_DIR = process.env.TEST_RESULTS_DIR || "test-results";

interface RawDecisionEntry {
  url?: string;
  field?: {
    label?: string;
    name?: string;
    placeholder?: string;
    tag?: string;
    type?: string;
  };
  selector?: string;
  success?: boolean;
  error?: string;
  fixSelector?: string;
}

function domainOf(url?: string): string {
  if (!url) return "unknown";
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function sanitizeId(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
}

async function loadJsonFiles(dir: string): Promise<RawDecisionEntry[]> {
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    console.warn(`[ingest] could not read directory '${dir}'; skipping file ingest.`);
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const entries: RawDecisionEntry[] = [];

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(path.join(dir, file), "utf-8");
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      entries.push(...list);
    } catch (err) {
      console.warn(`[ingest] skipping unparsable file ${file}:`, err);
    }
  }

  return entries;
}

async function ingestLocatorMemory(entries: RawDecisionEntry[]) {
  const successful = entries.filter((e) => e.success && e.field && e.selector);
  if (successful.length === 0) {
    console.log("[ingest] no successful locator decisions found.");
    return;
  }

  console.log(`[ingest] processing ${successful.length} successful locator decisions...`);

  // Extract valid signatures
  const validEntries = successful.map((e) => ({
    entry: e,
    signature: fieldSignature(e.field!),
  })).filter((item) => Boolean(item.signature));

  const signatures = validEntries.map((item) => item.signature);
  
  // Perform batch embedding for faster ingestion
  const vectors = await embedBatch(signatures, "search_document");

  for (let i = 0; i < validEntries.length; i++) {
    const item = validEntries[i];
    if (!item) continue;
    const { entry, signature } = item;
    const vector = vectors[i];
    const domain = domainOf(entry.url);

    await upsertLocatorMemory({
      id: `${domain}:${sanitizeId(signature)}`,
      signature,
      selector: entry.selector!,
      domain,
      url: entry.url || "",
      createdAt: new Date().toISOString(),
      ...(vector !== undefined ? { vector } : {}),
    });
  }
}

async function ingestFailureMemory(entries: RawDecisionEntry[]) {
  const failures = entries.filter((e) => !e.success && (e.error || e.selector));
  if (failures.length === 0) {
    console.log("[ingest] no failure entries found.");
    return;
  }

  console.log(`[ingest] processing ${failures.length} failure entries...`);

  const validEntries = failures.map((e) => ({
    entry: e,
    signature: failureSignature({
      ...(e.error !== undefined ? { errorMessage: e.error } : {}),
      ...(e.selector !== undefined ? { attemptedSelector: e.selector } : {}),
    }),
  })).filter((item) => Boolean(item.signature));

  const signatures = validEntries.map((item) => item.signature);
  const vectors = await embedBatch(signatures, "search_document");

  for (let i = 0; i < validEntries.length; i++) {
    const item = validEntries[i];
    if (!item) continue;
    const { entry, signature } = item;
    const vector = vectors[i];
    const domain = domainOf(entry.url);

    await upsertFailureMemory({
      id: `${domain}:${sanitizeId(signature)}`,
      signature,
      errorMessage: entry.error || "",
      attemptedSelector: entry.selector || "",
      ...(entry.fixSelector !== undefined ? { fixSelector: entry.fixSelector } : {}),
      domain,
      url: entry.url || "",
      createdAt: new Date().toISOString(),
      ...(vector !== undefined ? { vector } : {}),
    });
  }
}

async function main() {
  console.log(`[ingest] reading test artifacts from: ${RESULTS_DIR}`);
  const entries = await loadJsonFiles(RESULTS_DIR);
  console.log(`[ingest] loaded ${entries.length} total entries.`);

  await ingestLocatorMemory(entries);
  await ingestFailureMemory(entries);

  console.log("[ingest] ingestion completed successfully.");
}

main().catch((err) => {
  console.error("[ingest] fatal error during backfill:", err);
  process.exit(1);
});