import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { assignPatientSchema } from '@nutri-habits/shared';
import { prisma } from '../lib/prisma.js';
import { sendError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../lib/authenticate.js';
import { toIsoDate } from '../lib/date.js';
import { serializeProfile } from '../lib/serialize.js';
import { getDailyLogsForPatient, getMoodEntriesForPatient } from '../lib/patient-history.js';

const NUTRITIONIST_ONLY = [requireAuth, requireRole('NUTRITIONIST')];

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function nutritionistRoutes(app: FastifyInstance) {
  app.get('/nutritionists/me/patients', { preHandler: NUTRITIONIST_ONLY }, async (request, reply) => {
    const relations = await prisma.patientNutritionist.findMany({
      where: { nutritionistId: request.user!.sub, endedAt: null },
      include: { patient: true },
    });

    const results = await Promise.all(
      relations.map(async (relation) => {
        const lastLog = await prisma.dailyLog.findFirst({
          where: { patientId: relation.patientId },
          orderBy: { date: 'desc' },
        });
        return {
          id: relation.patient.id,
          full_name: relation.patient.fullName,
          email: relation.patient.email,
          last_log_date: lastLog ? toIsoDate(lastLog.date) : null,
        };
      }),
    );

    return reply.code(200).send(results);
  });

  app.get('/nutritionists/patients/search', { preHandler: NUTRITIONIST_ONLY }, async (request, reply) => {
    const query = (request.query as { q?: string }).q ?? '';

    const patients = await prisma.user.findMany({
      where: {
        role: 'PATIENT',
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    const results = await Promise.all(
      patients.map(async (patient) => {
        const activeRelation = await prisma.patientNutritionist.findFirst({
          where: { patientId: patient.id, endedAt: null },
          include: { nutritionist: true },
        });
        return {
          id: patient.id,
          full_name: patient.fullName,
          email: patient.email,
          holder: activeRelation
            ? { full_name: activeRelation.nutritionist.fullName, email: activeRelation.nutritionist.email }
            : null,
        };
      }),
    );

    return reply.code(200).send(results);
  });

  app.get('/nutritionists/patients/:patientId', { preHandler: NUTRITIONIST_ONLY }, async (request, reply) => {
    const { patientId } = request.params as { patientId: string };

    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    if (!patient) {
      return sendError(reply, 404, 'patientId no existe');
    }
    if (patient.role !== 'PATIENT') {
      return sendError(reply, 422, 'patientId no corresponde a un paciente');
    }

    const activeRelation = await prisma.patientNutritionist.findFirst({
      where: { patientId, nutritionistId: request.user!.sub, endedAt: null },
    });
    if (!activeRelation) {
      return sendError(reply, 403, 'Este paciente no está asignado a tu cuenta');
    }

    const [dailyLogs, moodEntries] = await Promise.all([
      getDailyLogsForPatient(patientId),
      getMoodEntriesForPatient(patientId),
    ]);

    return reply.code(200).send({
      profile: serializeProfile(patient),
      daily_logs: dailyLogs,
      mood_entries: moodEntries,
    });
  });

  app.post('/nutritionists/me/patients', { preHandler: NUTRITIONIST_ONLY }, async (request, reply) => {
    const parsed = assignPatientSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const { patient_id } = parsed.data;

    const patient = await prisma.user.findUnique({ where: { id: patient_id } });
    if (!patient) {
      return sendError(reply, 404, 'patient_id no existe');
    }
    if (patient.role !== 'PATIENT') {
      return sendError(reply, 422, 'patient_id no corresponde a un paciente');
    }

    const existingActive = await prisma.patientNutritionist.findFirst({
      where: { patientId: patient_id, endedAt: null },
    });
    if (existingActive) {
      return sendError(reply, 422, 'El paciente ya tiene una nutrióloga activa asignada');
    }

    try {
      const relation = await prisma.patientNutritionist.create({
        data: { patientId: patient_id, nutritionistId: request.user!.sub },
      });

      return reply.code(201).send({
        patient_id: relation.patientId,
        nutritionist_id: relation.nutritionistId,
        started_at: relation.startedAt.toISOString(),
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return sendError(reply, 422, 'El paciente ya tiene una nutrióloga activa asignada');
      }
      throw err;
    }
  });

  app.delete('/nutritionists/me/patients/:patientId', { preHandler: NUTRITIONIST_ONLY }, async (request, reply) => {
    const { patientId } = request.params as { patientId: string };

    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    if (!patient) {
      return sendError(reply, 404, 'patientId no existe');
    }

    const activeRelation = await prisma.patientNutritionist.findFirst({
      where: { patientId, endedAt: null },
    });
    if (!activeRelation) {
      return sendError(reply, 422, 'El paciente no tiene ninguna nutrióloga activa asignada');
    }

    if (activeRelation.nutritionistId !== request.user!.sub) {
      return sendError(reply, 403, 'Este paciente está asignado a otra nutrióloga');
    }

    const updated = await prisma.patientNutritionist.update({
      where: { id: activeRelation.id },
      data: { endedAt: new Date() },
    });

    return reply.code(200).send({ patient_id: updated.patientId, ended_at: updated.endedAt!.toISOString() });
  });
}
