import { z } from 'zod';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'No es una fecha válida');
