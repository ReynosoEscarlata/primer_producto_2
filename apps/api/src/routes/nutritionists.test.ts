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

async function createPatient(app: FastifyInstance, label: string) {
  const email = uniqueEmail(label);
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'abcdef123', full_name: `Paciente ${label}` },
  });
  const userId = response.json().id as string;
  return { email, userId };
}

async function createNutritionist(label: string) {
  const email = uniqueEmail(label);
  const passwordHash = await hashPassword('abcdef123');
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName: `Dra. ${label}`, role: 'NUTRITIONIST' },
  });
  const accessToken = signAccessToken({ sub: user.id, role: 'NUTRITIONIST' });
  return { email, userId: user.id, accessToken };
}

describe('POST /nutritionists/me/patients', () => {
  it('asigna un paciente libre', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('assign-ok');
    const patient = await createPatient(app, 'assign-ok');

    const response = await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ patient_id: patient.userId, nutritionist_id: nutritionist.userId });
  });

  it('devuelve 404 si patient_id no existe', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('assign-404');

    const response = await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('devuelve 422 si patient_id ya tiene una nutrióloga activa', async () => {
    const app = await buildApp();
    const nutritionistA = await createNutritionist('assign-dup-a');
    const nutritionistB = await createNutritionist('assign-dup-b');
    const patient = await createPatient(app, 'assign-dup');

    await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionistA.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionistB.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    expect(response.statusCode).toBe(422);
  });

  it('devuelve 422 si patient_id no es un paciente', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('assign-notpatient');
    const otherNutritionist = await createNutritionist('assign-notpatient-target');

    const response = await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: otherNutritionist.userId },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('GET /nutritionists/me/patients', () => {
  it('lista solo los pacientes con relación activa', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('list-ok');
    const patient = await createPatient(app, 'list-ok');

    await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: patient.userId, full_name: 'Paciente list-ok', email: patient.email, last_log_date: null },
    ]);
  });
});

describe('GET /nutritionists/patients/search', () => {
  it('expone el holder de un paciente ya asignado y null para uno libre', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('search-holder');
    const assignedPatient = await createPatient(app, 'search-assigned');
    const freePatient = await createPatient(app, 'search-free');

    await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: assignedPatient.userId },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/nutritionists/patients/search?q=search-',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ id: string; holder: unknown }>;
    const assignedResult = body.find((p) => p.id === assignedPatient.userId);
    const freeResult = body.find((p) => p.id === freePatient.userId);
    expect(assignedResult?.holder).toEqual({ full_name: 'Dra. search-holder', email: nutritionist.email });
    expect(freeResult?.holder).toBeNull();
  });
});

describe('GET /nutritionists/patients/:patientId', () => {
  it('devuelve perfil + historial de un paciente asignado', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('detail-ok');
    const patient = await createPatient(app, 'detail-ok');
    await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/nutritionists/patients/${patient.userId}`,
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profile.email).toBe(patient.email);
    expect(body.daily_logs).toEqual([]);
    expect(body.mood_entries).toEqual([]);
  });

  it('devuelve 403 si el paciente no está asignado a esta nutrióloga', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('detail-403');
    const patient = await createPatient(app, 'detail-403');

    const response = await app.inject({
      method: 'GET',
      url: `/nutritionists/patients/${patient.userId}`,
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('devuelve 404 si patientId no existe', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('detail-404');

    const response = await app.inject({
      method: 'GET',
      url: '/nutritionists/patients/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('devuelve 422 si patientId no es un paciente', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('detail-422');
    const otherNutritionist = await createNutritionist('detail-422-target');

    const response = await app.inject({
      method: 'GET',
      url: `/nutritionists/patients/${otherNutritionist.userId}`,
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('DELETE /nutritionists/me/patients/:patientId', () => {
  it('desasigna un paciente propio', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('unassign-ok');
    const patient = await createPatient(app, 'unassign-ok');
    await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/nutritionists/me/patients/${patient.userId}`,
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ patient_id: patient.userId });
  });

  it('devuelve 403 si el paciente está asignado a otra nutrióloga', async () => {
    const app = await buildApp();
    const owner = await createNutritionist('unassign-403-owner');
    const intruder = await createNutritionist('unassign-403-intruder');
    const patient = await createPatient(app, 'unassign-403');
    await app.inject({
      method: 'POST',
      url: '/nutritionists/me/patients',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { patient_id: patient.userId },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/nutritionists/me/patients/${patient.userId}`,
      headers: { authorization: `Bearer ${intruder.accessToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('devuelve 422 si el paciente no tiene ninguna nutrióloga asignada', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('unassign-422');
    const patient = await createPatient(app, 'unassign-422');

    const response = await app.inject({
      method: 'DELETE',
      url: `/nutritionists/me/patients/${patient.userId}`,
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(422);
  });

  it('devuelve 404 si patientId no existe', async () => {
    const app = await buildApp();
    const nutritionist = await createNutritionist('unassign-404');

    const response = await app.inject({
      method: 'DELETE',
      url: '/nutritionists/me/patients/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${nutritionist.accessToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
