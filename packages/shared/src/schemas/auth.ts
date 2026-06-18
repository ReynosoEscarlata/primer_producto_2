import { z } from 'zod';

const PASSWORD_REGEX = /^[a-zA-Z0-9]+$/;

export const passwordSchema = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .regex(PASSWORD_REGEX, 'La contraseña solo puede contener letras y números');

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'birth_date debe tener formato YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'birth_date no es una fecha válida');

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    full_name: z.string().min(1),
    birth_date: birthDateSchema.optional(),
    height: z.number().positive().optional(),
    weight: z.number().positive().optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
