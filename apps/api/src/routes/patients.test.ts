import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';

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
    await prisma.dailyLog.deleteMany({ where: { patientId: { in: userIds } } });
    await prisma.moodEntry.deleteMany({ where: { patientId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  createdEmails.length = 0;
});

async function registerPatient(app: FastifyInstance, label: string) {
  const email = uniqueEmail(label);
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'abcdef123', full_name: `Paciente ${label}` },
  });
  const userId = response.json().id as string;
  const accessToken = signAccessToken({ sub: userId, role: 'PATIENT' });
  return { email, userId, accessToken };
}

describe('POST /patients/me/daily-logs', () => {
  it('creates a daily log and returns it without an id', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-create');

    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { date: '2026-01-10', water_ml: 2000, exercise_minutes: 30, sleep_hours: 7.5 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      date: '2026-01-10',
      water_ml: 2000,
      exercise_minutes: 30,
      sleep_hours: 7.5,
    });
  });

  it('rejects a future date with 422', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-future');
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 5);

    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        date: future.toISOString().slice(0, 10),
        water_ml: 2000,
        exercise_minutes: 30,
        sleep_hours: 7.5,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects a duplicate date with 422', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-dup');
    const payload = { date: '2026-01-11', water_ml: 2000, exercise_minutes: 30, sleep_hours: 7.5 };

    await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects sleep_hours out of range with 422', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-badrange');

    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { date: '2026-01-12', water_ml: 2000, exercise_minutes: 30, sleep_hours: 25 },
    });

    expect(response.statusCode).toBe(422);
  });

  it('returns 403 for a non-PATIENT role', async () => {
    const app = await buildApp();
    const fakeNutritionistToken = signAccessToken({ sub: 'whatever-id', role: 'NUTRITIONIST' });

    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${fakeNutritionistToken}` },
      payload: { date: '2026-01-12', water_ml: 2000, exercise_minutes: 30, sleep_hours: 7 },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('PATCH /patients/me/daily-logs/:date', () => {
  it('edits a log created the same UTC calendar day', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-edit-ok');
    const today = new Date().toISOString().slice(0, 10);

    await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { date: today, water_ml: 2000, exercise_minutes: 30, sleep_hours: 7.5 },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/patients/me/daily-logs/${today}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { water_ml: 2200, exercise_minutes: 45, sleep_hours: 8 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      date: today,
      water_ml: 2200,
      exercise_minutes: 45,
      sleep_hours: 8,
    });
  });

  it('returns 404 for a date with no existing log', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-edit-404');

    const response = await app.inject({
      method: 'PATCH',
      url: '/patients/me/daily-logs/2026-01-01',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { water_ml: 2200, exercise_minutes: 45, sleep_hours: 8 },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 422 once the edit window (same UTC day) has passed', async () => {
    const app = await buildApp();
    const { accessToken, userId } = await registerPatient(app, 'log-edit-expired');
    const date = '2026-01-05';

    const log = await prisma.dailyLog.create({
      data: { patientId: userId, date: new Date(date), waterMl: 1000, exerciseMinutes: 10, sleepHours: 6 },
    });
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await prisma.dailyLog.update({ where: { id: log.id }, data: { createdAt: yesterday } });

    const response = await app.inject({
      method: 'PATCH',
      url: `/patients/me/daily-logs/${date}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { water_ml: 2200, exercise_minutes: 45, sleep_hours: 8 },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('GET /patients/me/daily-logs', () => {
  it('returns only the last 30 days for the authenticated patient', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'log-history');
    const today = new Date().toISOString().slice(0, 10);

    await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { date: today, water_ml: 1500, exercise_minutes: 20, sleep_hours: 6.5 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { date: today, water_ml: 1500, exercise_minutes: 20, sleep_hours: 6.5 },
    ]);
  });
});

describe('POST /patients/me/mood-entries', () => {
  it('creates a mood entry within the valid scale', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'mood-ok');

    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/mood-entries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { value: 7, note: 'buen día' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.value).toBe(7);
    expect(body.note).toBe('buen día');
    expect(body.occurred_at).toBeDefined();
  });

  it('rejects a value outside 1-10 with 422', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'mood-badrange');

    const response = await app.inject({
      method: 'POST',
      url: '/patients/me/mood-entries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { value: 11 },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('GET /patients/me/profile', () => {
  it('returns the profile without password_hash', async () => {
    const app = await buildApp();
    const { accessToken, email } = await registerPatient(app, 'profile-get');

    const response = await app.inject({
      method: 'GET',
      url: '/patients/me/profile',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.email).toBe(email);
    expect(body.password_hash).toBeUndefined();
  });
});

describe('PATCH /patients/me/profile', () => {
  it('updates full_name and height', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'profile-edit');

    const response = await app.inject({
      method: 'PATCH',
      url: '/patients/me/profile',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { full_name: 'Nuevo Nombre', height: 1.7 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.full_name).toBe('Nuevo Nombre');
    expect(body.height).toBe(1.7);
  });

  it('rejects a duplicate email with 422', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'profile-dup-a');
    const { email: emailB } = await registerPatient(app, 'profile-dup-b');

    const response = await app.inject({
      method: 'PATCH',
      url: '/patients/me/profile',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: emailB },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects a negative height with 422', async () => {
    const app = await buildApp();
    const { accessToken } = await registerPatient(app, 'profile-badheight');

    const response = await app.inject({
      method: 'PATCH',
      url: '/patients/me/profile',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { height: -1 },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('Aislamiento entre pacientes (criterio de aceptación no negociable)', () => {
  it('un paciente no puede leer ni editar el daily log de otro paciente', async () => {
    const app = await buildApp();
    const patientA = await registerPatient(app, 'isolation-a');
    const patientB = await registerPatient(app, 'isolation-b');
    const sharedDate = new Date().toISOString().slice(0, 10);

    const createA = await app.inject({
      method: 'POST',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${patientA.accessToken}` },
      payload: { date: sharedDate, water_ml: 3000, exercise_minutes: 60, sleep_hours: 9 },
    });
    expect(createA.statusCode).toBe(201);

    // B nunca ve el log de A en su propio historial.
    const historyB = await app.inject({
      method: 'GET',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${patientB.accessToken}` },
    });
    expect(historyB.json()).toEqual([]);

    // B no puede editar el log de A usando la misma fecha — para B, esa fecha no existe.
    const editAttemptB = await app.inject({
      method: 'PATCH',
      url: `/patients/me/daily-logs/${sharedDate}`,
      headers: { authorization: `Bearer ${patientB.accessToken}` },
      payload: { water_ml: 1, exercise_minutes: 1, sleep_hours: 1 },
    });
    expect(editAttemptB.statusCode).toBe(404);

    // El log de A sigue intacto.
    const historyA = await app.inject({
      method: 'GET',
      url: '/patients/me/daily-logs',
      headers: { authorization: `Bearer ${patientA.accessToken}` },
    });
    expect(historyA.json()).toEqual([
      { date: sharedDate, water_ml: 3000, exercise_minutes: 60, sleep_hours: 9 },
    ]);

    // B tampoco puede leer el perfil de A: el endpoint siempre responde por el id del propio token.
    const profileB = await app.inject({
      method: 'GET',
      url: '/patients/me/profile',
      headers: { authorization: `Bearer ${patientB.accessToken}` },
    });
    expect(profileB.json().email).toBe(patientB.email);
    expect(profileB.json().email).not.toBe(patientA.email);
  });
});
