import { z } from 'zod';

export interface InputField {
  id: string;
  name?: string;
  placeholder?: string;
}

export type InputFieldList = InputField[];

export const flightFieldDecisionSchema = z.object({
  originInputSelector: z.string().min(1),
  destinationInputSelector: z.string().min(1),
  requiredFields: z.array(z.enum(['origin', 'destination', 'flightNumber'])).min(2),
  optionalFields: z.array(z.enum(['origin', 'destination', 'flightNumber'])),
  reasoning: z.string().min(1),
}).strict();

export type ValidatedFlightFieldDecision = z.infer<typeof flightFieldDecisionSchema>;
