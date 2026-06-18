import type { FastifyReply } from 'fastify';
import { REFRESH_TOKEN_TTL_MS } from './jwt.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/auth';

// SameSite=None + Secure es obligatorio en producción (front y back en subdominios
// distintos de Render), pero Secure bloquearía la cookie en desarrollo local sobre
// http://localhost — ver docs/ADR.md (ADR-001).
function cookieSecurityOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  };
}

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
    ...cookieSecurityOptions(),
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
    ...cookieSecurityOptions(),
  });
}
