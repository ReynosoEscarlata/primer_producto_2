export interface DecodedAccessToken {
  sub: string;
  role: 'PATIENT' | 'NUTRITIONIST' | 'ADMIN';
}

// El front nunca verifica la firma del JWT (no tiene el secret, ni tendría sentido
// hacerlo en el cliente) — solo decodifica el payload para saber qué rol mostrar.
export function decodeAccessToken(token: string): DecodedAccessToken | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as DecodedAccessToken;
  } catch {
    return null;
  }
}
