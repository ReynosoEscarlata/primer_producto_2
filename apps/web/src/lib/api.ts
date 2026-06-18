import { getAccessToken, setAccessToken } from './token-store.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function rawFetch(path: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
}

// Sin rotación de refresh token (ADR-001): esta llamada no cambia la cookie,
// solo pide un access_token nuevo.
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!response.ok) {
      setAccessToken(null);
      return false;
    }
    const data = (await response.json()) as { access_token: string };
    setAccessToken(data.access_token);
    return true;
  } catch {
    // API inalcanzable (sin red, servidor caído, etc.) — se trata igual que "no hay sesión".
    setAccessToken(null);
    return false;
  }
}

async function apiFetch(path: string, options: RequestInit): Promise<Response> {
  const response = await rawFetch(path, options);
  if (response.status === 401 && path !== '/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return rawFetch(path, options);
    }
  }
  return response;
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? 'Error inesperado';
    throw new ApiError(response.status, message);
  }

  return body as T;
}
