import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

export function HomePage() {
  const { user } = useAuth();

  if (user?.role === 'PATIENT') {
    return <Navigate to="/patient" replace />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <p className="text-slate-600">Tu panel todavía no está disponible en esta versión.</p>
    </main>
  );
}
