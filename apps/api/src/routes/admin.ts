import type { FastifyInstance } from 'fastify';
import {
  adminCreateUserSchema,
  adminUpdateStatusSchema,
  adminAssignNutritionistSchema,
  updateProfileSchema,
} from '@nutri-habits/shared';
import { prisma } from '../lib/prisma.js';
import { sendError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../lib/authenticate.js';
import { hashPassword } from '../lib/password.js';
import { serializeAdminUser, serializeAdminUserSummary } from '../lib/serialize.js';

const ADMIN_ONLY = [requireAuth, requireRole('ADMIN')];

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/nutritionists', { preHandler: ADMIN_ONLY }, async (request, reply) => {
    const query = (request.query as { q?: string }).q ?? '';

    const nutritionists = await prisma.user.findMany({
      where: {
        role: 'NUTRITIONIST',
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    return reply.code(200).send(nutritionists.map(serializeAdminUserSummary));
  });

  app.get('/admin/patients', { preHandler: ADMIN_ONLY }, async (request, reply) => {
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
          ...serializeAdminUserSummary(patient),
          holder: activeRelation
            ? {
                id: activeRelation.nutritionist.id,
                full_name: activeRelation.nutritionist.fullName,
                email: activeRelation.nutritionist.email,
              }
            : null,
        };
      }),
    );

    return reply.code(200).send(results);
  });

  app.post('/admin/users', { preHandler: ADMIN_ONLY }, async (request, reply) => {
    const parsed = adminCreateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const { email, password, full_name, role, birth_date, height, weight } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(reply, 422, 'email ya registrado');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: full_name,
        role,
        birthDate: birth_date ? new Date(birth_date) : undefined,
        height,
        weight,
      },
    });

    return reply.code(201).send(serializeAdminUser(user));
  });

  app.patch('/admin/users/:id', { preHandler: ADMIN_ONLY }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return sendError(reply, 404, 'id no existe');
    }

    const { full_name, birth_date, email, height, weight } = parsed.data;

    if (email) {
      const emailOwner = await prisma.user.findUnique({ where: { email } });
      if (emailOwner && emailOwner.id !== id) {
        return sendError(reply, 422, 'email ya está en uso');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: full_name,
        birthDate: birth_date ? new Date(birth_date) : undefined,
        email,
        height,
        weight,
      },
    });

    return reply.code(200).send(serializeAdminUser(updated));
  });

  app.patch('/admin/users/:id/status', { preHandler: ADMIN_ONLY }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = adminUpdateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return sendError(reply, 404, 'id no existe');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: parsed.data.is_active },
    });

    return reply.code(200).send({ id: updated.id, is_active: updated.isActive });
  });

  app.post('/admin/patients/:patientId/assign-nutritionist', { preHandler: ADMIN_ONLY }, async (request, reply) => {
    const { patientId } = request.params as { patientId: string };

    const parsed = adminAssignNutritionistSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const { nutritionist_id } = parsed.data;

    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    if (!patient) {
      return sendError(reply, 404, 'patientId no existe');
    }
    if (patient.role !== 'PATIENT') {
      return sendError(reply, 422, 'patientId no corresponde a un paciente');
    }

    const nutritionist = await prisma.user.findUnique({ where: { id: nutritionist_id } });
    if (!nutritionist) {
      return sendError(reply, 404, 'nutritionist_id no existe');
    }
    if (nutritionist.role !== 'NUTRITIONIST') {
      return sendError(reply, 422, 'nutritionist_id no corresponde a una nutrióloga');
    }
    if (!nutritionist.isActive) {
      return sendError(reply, 422, 'nutritionist_id corresponde a una cuenta desactivada');
    }

    const relation = await prisma.$transaction(async (tx) => {
      await tx.patientNutritionist.updateMany({
        where: { patientId, endedAt: null },
        data: { endedAt: new Date() },
      });

      return tx.patientNutritionist.create({
        data: { patientId, nutritionistId: nutritionist_id },
      });
    });

    return reply.code(200).send({
      patient_id: relation.patientId,
      nutritionist_id: relation.nutritionistId,
      started_at: relation.startedAt.toISOString(),
    });
  });
}
