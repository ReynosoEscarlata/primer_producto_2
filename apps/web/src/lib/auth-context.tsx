import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiJson, refreshAccessToken } from './api.js';
import { setAccessToken, subscribeAccessToken, getAccessToken } from './token-store.js';
import { decodeAccessToken, type DecodedAccessToken } from './jwt.js';

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  birth_date?: string;
  height?: number;
  weight?: number;
}

interface AuthContextValue {
  user: DecodedAccessToken | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => subscribeAccessToken(setToken), []);

  useEffect(() => {
    // Al cargar la app, intenta reobtener un access_token usando la cookie httpOnly
    // (el access token nunca se persiste, así que se pierde al recargar la página).
    refreshAccessToken().finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiJson<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.access_token);
  };

  const register = async (input: RegisterInput) => {
    await apiJson('/auth/register', { method: 'POST', body: JSON.stringify(input) });
    await login(input.email, input.password);
  };

  const logout = async () => {
    try {
      await apiJson('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
    }
  };

  const user = token ? decodeAccessToken(token) : null;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
