import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import type { DecodedAccessToken } from '../lib/jwt.js';

interface ProtectedRouteProps {
  allow: Array<DecodedAccessToken['role']>;
}

export function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="p-4 text-center text-sm text-slate-500">Cargando…</p>;
  }

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
