import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  role: 'PATIENT' | 'NUTRITIONIST' | 'ADMIN';
}

export interface RefreshTokenPayload {
  sub: string;
}

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return secret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getAccessSecret()) as jwt.JwtPayload & AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getRefreshSecret()) as jwt.JwtPayload & RefreshTokenPayload;
}
