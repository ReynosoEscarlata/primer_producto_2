import { prisma } from './prisma.js';
import { thirtyDaysAgo } from './date.js';
import { serializeDailyLog, serializeMoodEntry } from './serialize.js';

export async function getDailyLogsForPatient(patientId: string) {
  const logs = await prisma.dailyLog.findMany({
    where: { patientId, date: { gte: thirtyDaysAgo() } },
    orderBy: { date: 'asc' },
  });
  return logs.map(serializeDailyLog);
}

export async function getMoodEntriesForPatient(patientId: string) {
  const entries = await prisma.moodEntry.findMany({
    where: { patientId, occurredAt: { gte: thirtyDaysAgo() } },
    orderBy: { occurredAt: 'asc' },
  });
  return entries.map(serializeMoodEntry);
}
