import { z } from 'zod';
import { isoDateSchema } from './common.js';

const dailyLogValuesSchema = z.object({
  water_ml: z.number().int('water_ml debe ser un entero').min(0).max(10000),
  exercise_minutes: z.number().int('exercise_minutes debe ser un entero').min(0).max(1440),
  sleep_hours: z.number().min(0).max(24),
});

export const createDailyLogSchema = dailyLogValuesSchema.extend({ date: isoDateSchema }).strict();
export type CreateDailyLogInput = z.infer<typeof createDailyLogSchema>;

export const updateDailyLogSchema = dailyLogValuesSchema.strict();
export type UpdateDailyLogInput = z.infer<typeof updateDailyLogSchema>;
