import { z } from 'zod';
import { isoDateSchema } from './common.js';
import { passwordSchema } from './auth.js';

export const adminCreateUserSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    full_name: z.string().min(1),
    role: z.enum(['PATIENT', 'NUTRITIONIST']),
    birth_date: isoDateSchema.optional(),
    height: z.number().positive().optional(),
    weight: z.number().positive().optional(),
  })
  .strict();

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateStatusSchema = z
  .object({
    is_active: z.boolean(),
  })
  .strict();

export type AdminUpdateStatusInput = z.infer<typeof adminUpdateStatusSchema>;

export const adminAssignNutritionistSchema = z
  .object({
    nutritionist_id: z.string().uuid(),
  })
  .strict();

export type AdminAssignNutritionistInput = z.infer<typeof adminAssignNutritionistSchema>;
