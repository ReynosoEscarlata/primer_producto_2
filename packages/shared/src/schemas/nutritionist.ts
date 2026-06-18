import { z } from 'zod';

export const assignPatientSchema = z
  .object({
    patient_id: z.string().uuid(),
  })
  .strict();

export type AssignPatientInput = z.infer<typeof assignPatientSchema>;
