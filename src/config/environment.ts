import dotenv from 'dotenv';
dotenv.config();

export type Environment = {
  baseUrl: string;
  headless: boolean;
  ollamaModel: string;
  ollamaTemperature: number;
  ollamaBaseUrl: string;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.toLowerCase().trim();
  return v !== 'false' && v !== '0' && v !== 'no';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Invalid numeric environment variable value: ${value}`);
  return n;
}

export const environment: Environment = {
  baseUrl: process.env.BASE_URL ?? 'https://example.com',
  headless: parseBool(process.env.HEADLESS, true),
  ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b',
  ollamaTemperature: parseNumber(process.env.OLLAMA_TEMPERATURE, 0),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
};

export default environment;
