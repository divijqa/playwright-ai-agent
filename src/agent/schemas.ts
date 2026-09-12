import { z } from 'zod';

/**
 * Standard shape for DOM input elements passed into prompts and RAG methods.
 */
export interface InputField {
  tag?: string;
  id: string;
  name?: string;
  placeholder?: string;
  label?: string;
  type?: string;
  ariaLabel?: string;
  ariaPlaceholder?: string;
}

export type InputFieldList = InputField[];

/**
 * Zod schema enforcing the exact decision structure expected from the LLM.
 * Strictly validated before Playwright locator verification begins in validateLocators.ts.
 */
export const flightFieldDecisionSchema = z.object({
  originInputSelector: z.string().min(1, 'Origin selector cannot be empty'),
  destinationInputSelector: z.string().min(1, 'Destination selector cannot be empty'),
  requiredFields: z.array(z.string()).min(1, 'At least one required field must be specified'),
  optionalFields: z.array(z.string()),
  reasoning: z.string().min(1, 'Reasoning explanation is required'),
}).strict();

export type ValidatedFlightFieldDecision = z.infer<typeof flightFieldDecisionSchema>;