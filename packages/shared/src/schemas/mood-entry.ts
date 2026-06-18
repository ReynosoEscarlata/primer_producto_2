import { z } from 'zod';

export const createMoodEntrySchema = z
  .object({
    value: z.number().int('value debe ser un entero').min(1).max(10),
    note: z.string().optional(),
  })
  .strict();

export type CreateMoodEntryInput = z.infer<typeof createMoodEntrySchema>;
