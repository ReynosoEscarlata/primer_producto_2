import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import type { DecodedAccessToken } from '../lib/jwt.js';

interface ProtectedRouteProps {
  allow: Array<DecodedAccessToken['role']>;
}

export function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto animate-spin"></div>
          </div>
          <p className="text-sm text-gray-600">Verificando acceso...</p>
        </div>
      </main>
    );
  }

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
