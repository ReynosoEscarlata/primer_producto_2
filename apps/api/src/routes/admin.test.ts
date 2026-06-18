import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';
import { hashPassword } from '../lib/password.js';

const createdEmails: string[] = [];

function uniqueEmail(label: string): string {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  createdEmails.push(email);
  return email;
}

afterEach(async () => {
  if (createdEmails.length === 0) return;
  const users = await prisma.user.findMany({ where: { email: { in: createdEmails } } });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.patientNutritionist.deleteMany({
      where: { OR: [{ patientId: { in: userIds } }, { nutritionistId: { in: userIds } }] },
    });
    await prisma.dailyLog.deleteMany({ where: { patientId: { in: userIds } } });
    await prisma.moodEntry.deleteMany({ where: { patientId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  createdEmails.length = 0;
});

function adminToken(): string {
  return signAccessToken({ sub: 'admin-test-id', role: 'ADMIN' });
}

async function createPatient(app: FastifyInstance, label: string) {
  const email = uniqueEmail(label);
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'abcdef123', full_name: `Paciente ${label}` },
  });
  return { email, userId: response.json().id as string };
}

async function createNutritionist(label: string, isActive = true) {
  const email = uniqueEmail(label);
  const passwordHash = await hashPassword('abcdef123');
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName: `Dra. ${label}`, role: 'NUTRITIONIST', isActive },
  });
  return { email, userId: user.id };
}

describe('GET /admin/nutritionists', () => {
  it('lista nutriólogas con is_active', async () => {
    const nutritionist = await createNutritionist('list');

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/admin/nutritionists?q=${encodeURIComponent(nutritionist.email)}`,
      headers: { authorization: `Bearer ${adminToken()}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: nutritionist.userId, full_name: 'Dra. list', email: nutritionist.email, is_active: true },
    ]);
  });
});

describe('GET /admin/patients', () => {
  it('incluye el holder cuando el paciente está asignado', async () => {
    const app = await buildApp();
    const patient = await createPatient(app, 'admin-list');
    const nutritionist = await createNutritionist('admin-list-holder');
    await prisma.patientNutritionist.create({
      data: { patientId: patient.userId, nutritionistId: nutritionist.userId },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/admin/patients?q=${encodeURIComponent(patient.email)}`,
      headers: { authorization: `Bearer ${adminToken()}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body[0]).toMatchObject({
      id: patient.userId,
      is_active: true,
      holder: { id: nutritionist.userId, full_name: 'Dra. admin-list-holder', email: nutritionist.email },
    });
  });
});

describe('POST /admin/users', () => {
  it('crea una nutrióloga', async () => {
    const app = await buildApp();
    const email = uniqueEmail('create-nutri');

    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { email, password: 'abcdef123', full_name: 'Dra. Nueva', role: 'NUTRITIONIST' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: expect.any(String), email, full_name: 'Dra. Nueva', role: 'NUTRITIONIST' });
  });

  it('crea un paciente con campos opcionales', async () => {
    const app = await buildApp();
    const email = uniqueEmail('create-patient');

    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { email, password: 'abcdef123', full_name: 'Paciente Nuevo', role: 'PATIENT', height: 1.7 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().role).toBe('PATIENT');
  });

  it('rechaza role = ADMIN con 422', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { email: uniqueEmail('create-admin'), password: 'abcdef123', full_name: 'X', role: 'ADMIN' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rechaza un email duplicado con 422', async () => {
    const app = await buildApp();
    const email = uniqueEmail('create-dup');
    await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { email, password: 'abcdef123', full_name: 'X', role: 'NUTRITIONIST' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { email, password: 'abcdef123', full_name: 'Y', role: 'NUTRITIONIST' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rechaza height negativo con 422', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: {
        email: uniqueEmail('create-badheight'),
        password: 'abcdef123',
        full_name: 'X',
        role: 'PATIENT',
        height: -1,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('devuelve 403 para un rol que no es ADMIN', async () => {
    const app = await buildApp();
    const fakeNutritionistToken = signAccessToken({ sub: 'whatever', role: 'NUTRITIONIST' });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${fakeNutritionistToken}` },
      payload: { email: uniqueEmail('forbidden'), password: 'abcdef123', full_name: 'X', role: 'PATIENT' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('PATCH /admin/users/:id', () => {
  it('actualiza full_name y email', async () => {
    const nutritionist = await createNutritionist('edit');
    const app = await buildApp();
    const newEmail = uniqueEmail('edit-new');

    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${nutritionist.userId}`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { full_name: 'Dra. Editada', email: newEmail },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: nutritionist.userId,
      email: newEmail,
      full_name: 'Dra. Editada',
      role: 'NUTRITIONIST',
    });
  });

  it('devuelve 404 si el id no existe', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/users/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { full_name: 'X' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /admin/users/:id/status', () => {
  it('desactiva una cuenta', async () => {
    const nutritionist = await createNutritionist('status');
    const app = await buildApp();

    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${nutritionist.userId}/status`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { is_active: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: nutritionist.userId, is_active: false });
  });

  it('devuelve 404 si el id no existe', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/users/00000000-0000-0000-0000-000000000000/status',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { is_active: false },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('POST /admin/patients/:patientId/assign-nutritionist', () => {
  it('asigna y reemplaza la relación activa anterior', async () => {
    const app = await buildApp();
    const patient = await createPatient(app, 'reassign');
    const nutritionistA = await createNutritionist('reassign-a');
    const nutritionistB = await createNutritionist('reassign-b');

    await app.inject({
      method: 'POST',
      url: `/admin/patients/${patient.userId}/assign-nutritionist`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: nutritionistA.userId },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/admin/patients/${patient.userId}/assign-nutritionist`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: nutritionistB.userId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ patient_id: patient.userId, nutritionist_id: nutritionistB.userId });

    const relations = await prisma.patientNutritionist.findMany({ where: { patientId: patient.userId } });
    const active = relations.filter((r) => r.endedAt === null);
    expect(active).toHaveLength(1);
    expect(active[0]?.nutritionistId).toBe(nutritionistB.userId);
  });

  it('devuelve 404 si patientId no existe', async () => {
    const nutritionist = await createNutritionist('reassign-404-target');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/admin/patients/00000000-0000-0000-0000-000000000000/assign-nutritionist',
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: nutritionist.userId },
    });

    expect(response.statusCode).toBe(404);
  });

  it('devuelve 422 si patientId no es un paciente', async () => {
    const nutritionistTarget = await createNutritionist('reassign-422-target');
    const nutritionist = await createNutritionist('reassign-422');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: `/admin/patients/${nutritionistTarget.userId}/assign-nutritionist`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: nutritionist.userId },
    });

    expect(response.statusCode).toBe(422);
  });

  it('devuelve 404 si nutritionist_id no existe', async () => {
    const app = await buildApp();
    const patient = await createPatient(app, 'reassign-nutri-404');

    const response = await app.inject({
      method: 'POST',
      url: `/admin/patients/${patient.userId}/assign-nutritionist`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('devuelve 422 si nutritionist_id no es una nutrióloga', async () => {
    const app = await buildApp();
    const patient = await createPatient(app, 'reassign-notnutri');
    const otherPatient = await createPatient(app, 'reassign-notnutri-target');

    const response = await app.inject({
      method: 'POST',
      url: `/admin/patients/${patient.userId}/assign-nutritionist`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: otherPatient.userId },
    });

    expect(response.statusCode).toBe(422);
  });

  it('devuelve 422 si la nutrióloga está desactivada', async () => {
    const app = await buildApp();
    const patient = await createPatient(app, 'reassign-inactive');
    const inactiveNutritionist = await createNutritionist('reassign-inactive-target', false);

    const response = await app.inject({
      method: 'POST',
      url: `/admin/patients/${patient.userId}/assign-nutritionist`,
      headers: { authorization: `Bearer ${adminToken()}` },
      payload: { nutritionist_id: inactiveNutritionist.userId },
    });

    expect(response.statusCode).toBe(422);
  });
});
