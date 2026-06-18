import { z } from 'zod';
import { isoDateSchema } from './common.js';

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(1).optional(),
    birth_date: isoDateSchema.optional(),
    email: z.string().email().optional(),
    height: z.number().positive().optional(),
    weight: z.number().positive().optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
