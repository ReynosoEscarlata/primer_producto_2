import type { FastifyInstance } from 'fastify';
import {
  createDailyLogSchema,
  updateDailyLogSchema,
  createMoodEntrySchema,
  updateProfileSchema,
  isoDateSchema,
} from '@nutri-habits/shared';
import { prisma } from '../lib/prisma.js';
import { sendError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../lib/authenticate.js';
import { isFutureDate, isSameUtcCalendarDay } from '../lib/date.js';
import { serializeDailyLog, serializeMoodEntry, serializeProfile } from '../lib/serialize.js';
import { getDailyLogsForPatient, getMoodEntriesForPatient } from '../lib/patient-history.js';

const PATIENT_ONLY = [requireAuth, requireRole('PATIENT')];

export async function patientRoutes(app: FastifyInstance) {
  app.post('/patients/me/daily-logs', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    const parsed = createDailyLogSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const { date, water_ml, exercise_minutes, sleep_hours } = parsed.data;

    if (isFutureDate(date)) {
      return sendError(reply, 422, 'date no puede ser una fecha futura');
    }

    const patientId = request.user!.sub;
    const existing = await prisma.dailyLog.findUnique({ where: { patientId_date: { patientId, date: new Date(date) } } });
    if (existing) {
      return sendError(reply, 422, 'Ya existe un log para esa fecha, usá PATCH para editarlo');
    }

    const log = await prisma.dailyLog.create({
      data: {
        patientId,
        date: new Date(date),
        waterMl: water_ml,
        exerciseMinutes: exercise_minutes,
        sleepHours: sleep_hours,
      },
    });

    return reply.code(201).send(serializeDailyLog(log));
  });

  app.patch('/patients/me/daily-logs/:date', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    const dateParam = (request.params as { date: string }).date;
    const dateParsed = isoDateSchema.safeParse(dateParam);
    if (!dateParsed.success) {
      return sendError(reply, 422, 'date inválida');
    }

    const bodyParsed = updateDailyLogSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return sendError(reply, 422, bodyParsed.error.issues[0]?.message ?? 'Body inválido');
    }

    const patientId = request.user!.sub;
    const existing = await prisma.dailyLog.findUnique({
      where: { patientId_date: { patientId, date: new Date(dateParsed.data) } },
    });
    if (!existing) {
      return sendError(reply, 404, 'No existe un log para esa fecha');
    }

    if (!isSameUtcCalendarDay(existing.createdAt, new Date())) {
      return sendError(reply, 422, 'La ventana de edición de este log ya venció');
    }

    const { water_ml, exercise_minutes, sleep_hours } = bodyParsed.data;
    const updated = await prisma.dailyLog.update({
      where: { id: existing.id },
      data: { waterMl: water_ml, exerciseMinutes: exercise_minutes, sleepHours: sleep_hours },
    });

    return reply.code(200).send(serializeDailyLog(updated));
  });

  app.get('/patients/me/daily-logs', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    return reply.code(200).send(await getDailyLogsForPatient(request.user!.sub));
  });

  app.post('/patients/me/mood-entries', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    const parsed = createMoodEntrySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }

    const entry = await prisma.moodEntry.create({
      data: {
        patientId: request.user!.sub,
        occurredAt: new Date(),
        value: parsed.data.value,
        note: parsed.data.note,
      },
    });

    return reply.code(201).send(serializeMoodEntry(entry));
  });

  app.get('/patients/me/mood-entries', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    return reply.code(200).send(await getMoodEntriesForPatient(request.user!.sub));
  });

  app.get('/patients/me/profile', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.sub } });
    return reply.code(200).send(serializeProfile(user));
  });

  app.patch('/patients/me/profile', { preHandler: PATIENT_ONLY }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const { full_name, birth_date, email, height, weight } = parsed.data;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== request.user!.sub) {
        return sendError(reply, 422, 'email ya está en uso');
      }
    }

    const updated = await prisma.user.update({
      where: { id: request.user!.sub },
      data: {
        fullName: full_name,
        birthDate: birth_date ? new Date(birth_date) : undefined,
        email,
        height,
        weight,
      },
    });

    return reply.code(200).send(serializeProfile(updated));
  });
}
