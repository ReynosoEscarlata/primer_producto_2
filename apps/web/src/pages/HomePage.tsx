import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

export function HomePage() {
  const { user } = useAuth();

  if (user?.role === 'PATIENT') {
    return <Navigate to="/patient" replace />;
  }

  if (user?.role === 'NUTRITIONIST') {
    return <Navigate to="/nutritionist" replace />;
  }

  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-blue-50 to-white p-4 text-center">
      <div className="max-w-md">
        <div className="mb-6 text-5xl">⏳</div>
        <h1 className="text-2xl font-bold text-black mb-3">Tu panel se está preparando</h1>
        <p className="text-gray-600">Tu panel de control personalizado estará disponible en esta versión próximamente.</p>
      </div>
    </main>
  );
}
