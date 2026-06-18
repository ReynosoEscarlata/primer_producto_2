import { toIsoDate } from './date.js';

export function toNumberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function serializeDailyLog(log: {
  date: Date;
  waterMl: number;
  exerciseMinutes: number;
  sleepHours: unknown;
}) {
  return {
    date: toIsoDate(log.date),
    water_ml: log.waterMl,
    exercise_minutes: log.exerciseMinutes,
    sleep_hours: toNumberOrNull(log.sleepHours),
  };
}

export function serializeMoodEntry(entry: { id: string; occurredAt: Date; value: number; note: string | null }) {
  return {
    id: entry.id,
    occurred_at: entry.occurredAt.toISOString(),
    value: entry.value,
    note: entry.note,
  };
}

export function serializeProfile(user: {
  id: string;
  email: string;
  fullName: string;
  birthDate: Date | null;
  height: unknown;
  weight: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    birth_date: user.birthDate ? toIsoDate(user.birthDate) : null,
    height: toNumberOrNull(user.height),
    weight: toNumberOrNull(user.weight),
  };
}

export function serializeAdminUser(user: { id: string; email: string; fullName: string; role: string }) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
  };
}

export function serializeAdminUserSummary(user: { id: string; email: string; fullName: string; isActive: boolean }) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    is_active: user.isActive,
  };
}
