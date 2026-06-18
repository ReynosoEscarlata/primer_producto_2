import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from '@nutri-habits/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, REFRESH_TOKEN_TTL_MS } from '../lib/jwt.js';
import { sha256 } from '../lib/hash.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../lib/cookies.js';
import { sendError } from '../lib/errors.js';
import { requireAuth } from '../lib/authenticate.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 422, parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    const { email, password, full_name, birth_date, height, weight } = parsed.data;

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
        role: 'PATIENT',
        birthDate: birth_date ? new Date(birth_date) : undefined,
        height,
        weight,
      },
    });

    return reply.code(201).send({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 401, 'Credenciales inválidas');
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return sendError(reply, 401, 'Credenciales inválidas');
    }

    if (!user.isActive) {
      return sendError(reply, 403, 'Cuenta desactivada');
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    setRefreshCookie(reply, refreshToken);
    return reply.code(200).send({ access_token: accessToken });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const cookieToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!cookieToken) {
      return sendError(reply, 401, 'Falta la cookie de refresh');
    }

    let payload;
    try {
      payload = verifyRefreshToken(cookieToken);
    } catch {
      return sendError(reply, 401, 'Refresh token inválido o expirado');
    }

    const tokenHash = sha256(cookieToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return sendError(reply, 401, 'Refresh token inválido o revocado');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return sendError(reply, 401, 'Refresh token inválido o revocado');
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    return reply.code(200).send({ access_token: accessToken });
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const cookieToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!cookieToken) {
      return sendError(reply, 401, 'Falta la cookie de refresh');
    }

    const tokenHash = sha256(cookieToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      return sendError(reply, 401, 'Refresh token inválido');
    }

    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    clearRefreshCookie(reply);
    return reply.code(200).send({ success: true });
  });
}
