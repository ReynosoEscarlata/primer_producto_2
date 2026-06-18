import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';
import { sendError } from './errors.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    return sendError(reply, 401, 'Falta el access token');
  }

  try {
    request.user = verifyAccessToken(token);
  } catch {
    return sendError(reply, 401, 'Access token inválido o expirado');
  }
}

export function requireRole(role: AccessTokenPayload['role']) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (request.user?.role !== role) {
      return sendError(reply, 403, 'No tenés permiso para acceder a este recurso');
    }
  };
}
