/**
 * embeddings.ts
 * Wrapper around local Ollama embedding model using nomic-embed-text.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

export type TaskType = "search_document" | "search_query";

export interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

/**
 * Prepends Nomic task prefixes for high retrieval accuracy.
 */
function formatInput(text: string, taskType: TaskType = "search_document"): string {
  const trimmed = text.trim();
  // Avoid double-prefixing if caller already added it
  if (trimmed.startsWith("search_document:") || trimmed.startsWith("search_query:")) {
    return trimmed;
  }
  return `${taskType}: ${trimmed}`;
}

/**
 * Get an embedding vector for a single piece of text.
 */
export async function embedText(
  text: string, 
  taskType: TaskType = "search_document"
): Promise<number[]> {
  const formattedText = formatInput(text, taskType);

  const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: formattedText,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama embedding request failed (${res.status}): ${body || res.statusText}`
    );
  }

  const data = (await res.json()) as OllamaEmbedResponse;
  if (!data.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
    throw new Error("Ollama response missing 'embeddings' array");
  }

  const embedding = data.embeddings[0];
  if (!embedding) {
    throw new Error("Ollama response missing embedding vector");
  }

  return embedding;
}

/**
 * Batch embedding leveraging Ollama's native multi-input batch API.
 */
export async function embedBatch(
  texts: string[],
  taskType: TaskType = "search_document"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const formattedTexts = texts.map((t) => formatInput(t, taskType));

  const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: formattedTexts,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama batch embedding request failed (${res.status}): ${body || res.statusText}`
    );
  }

  const data = (await res.json()) as OllamaEmbedResponse;
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error("Mismatch in batch response size from Ollama embed endpoint");
  }

  return data.embeddings;
}

/**
 * Builds a stable, embeddable text signature for a form field.
 */
export function fieldSignature(field: {
  label?: string;
  name?: string;
  placeholder?: string;
  tag?: string;
  type?: string;
}): string {
  return [
    field.label && `label: ${field.label}`,
    field.name && `name: ${field.name}`,
    field.placeholder && `placeholder: ${field.placeholder}`,
    field.tag && `tag: ${field.tag}`,
    field.type && `type: ${field.type}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

/**
 * Builds a stable, embeddable text signature for a failure event.
 */
export function failureSignature(failure: {
  errorMessage?: string;
  attemptedSelector?: string;
  domSummary?: string;
}): string {
  return [
    failure.errorMessage && `error: ${failure.errorMessage}`,
    failure.attemptedSelector && `selector: ${failure.attemptedSelector}`,
    failure.domSummary && `dom: ${failure.domSummary}`,
  ]
    .filter(Boolean)
    .join(" | ");
}