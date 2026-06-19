import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { ApiError } from '../lib/api.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-blue-50 to-white p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-3xl font-bold text-transparent">
            NutriHabits
          </h1>
          <p className="mt-2 text-sm text-gray-600">Monitorea tus hábitos saludables</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-gray-100 bg-white px-6 py-8 shadow-lg shadow-blue-100/20 sm:px-8"
        >
          <h2 className="text-center text-2xl font-bold text-black">Iniciar sesión</h2>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="tu@email.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-900">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-2.5 font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>

          <div className="border-t border-gray-100 pt-4 text-center">
            <p className="text-sm text-gray-600">
              ¿No tenés cuenta?{' '}
              <Link
                to="/register"
                className="font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                Registrate aquí
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
