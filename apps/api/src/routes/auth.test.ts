import { describe, it, expect, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { signRefreshToken } from '../lib/jwt.js';

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
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  createdEmails.length = 0;
});

describe('POST /auth/register', () => {
  it('creates a PATIENT and never returns password_hash', async () => {
    const app = await buildApp();
    const email = uniqueEmail('register-ok');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({ id: expect.any(String), email, full_name: 'Ana Pérez', role: 'PATIENT' });
    expect(body.password_hash).toBeUndefined();
  });

  it('rejects a duplicate email with 422', async () => {
    const app = await buildApp();
    const email = uniqueEmail('register-dup');
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Otra Persona' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects a password that fails the format rule with 422', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: uniqueEmail('register-badpw'), password: 'abc!!', full_name: 'Ana Pérez' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects a negative height with 422', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: uniqueEmail('register-badheight'),
        password: 'abcdef123',
        full_name: 'Ana Pérez',
        height: -1.5,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects a malformed birth_date with 422', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: uniqueEmail('register-baddate'),
        password: 'abcdef123',
        full_name: 'Ana Pérez',
        birth_date: '12-04-1995',
      },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('POST /auth/login', () => {
  it('returns an access_token and sets the refresh cookie', async () => {
    const app = await buildApp();
    const email = uniqueEmail('login-ok');
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'abcdef123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ access_token: expect.any(String) });
    expect(response.cookies.find((c) => c.name === 'refresh_token')).toBeDefined();
  });

  it('returns 401 for a wrong password', async () => {
    const app = await buildApp();
    const email = uniqueEmail('login-wrongpw');
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrongpassword' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 for an email that does not exist', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody-here@example.com', password: 'abcdef123' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 403 for a deactivated account', async () => {
    const app = await buildApp();
    const email = uniqueEmail('login-inactive');
    const passwordHash = await hashPassword('abcdef123');
    await prisma.user.create({
      data: { email, passwordHash, fullName: 'Inactivo', role: 'PATIENT', isActive: false },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'abcdef123' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('POST /auth/refresh', () => {
  it('issues a new access_token given a valid refresh cookie', async () => {
    const app = await buildApp();
    const email = uniqueEmail('refresh-ok');
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'abcdef123' },
    });
    const refreshCookie = loginResponse.cookies.find((c) => c.name === 'refresh_token')!.value;

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: refreshCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ access_token: expect.any(String) });
  });

  it('returns 401 when the refresh cookie is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'POST', url: '/auth/refresh' });
    expect(response.statusCode).toBe(401);
  });

  it('returns 401 for a refresh token that was never persisted', async () => {
    const app = await buildApp();
    const forged = signRefreshToken({ sub: 'non-existent-user-id' });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: forged },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so it can no longer be used to refresh', async () => {
    const app = await buildApp();
    const email = uniqueEmail('logout-ok');
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'abcdef123' },
    });
    const accessToken = loginResponse.json().access_token as string;
    const refreshCookie = loginResponse.cookies.find((c) => c.name === 'refresh_token')!.value;

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
      cookies: { refresh_token: refreshCookie },
    });
    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.json()).toEqual({ success: true });

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: refreshCookie },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  it('returns 401 without a Bearer access token', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { refresh_token: 'whatever' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when the refresh cookie is missing', async () => {
    const app = await buildApp();
    const email = uniqueEmail('logout-nocookie');
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'abcdef123', full_name: 'Ana Pérez' },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'abcdef123' },
    });
    const accessToken = loginResponse.json().access_token as string;

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(401);
  });
});
