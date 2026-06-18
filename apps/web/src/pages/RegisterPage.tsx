import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { ApiError } from '../lib/api.js';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ email, password, full_name: fullName });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar el registro');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-xl font-semibold text-slate-900">Crear cuenta</h1>

        <div className="space-y-1">
          <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
            Nombre completo
          </label>
          <input
            id="full_name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-base"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-base"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            pattern="[a-zA-Z0-9]+"
            title="Mínimo 6 caracteres, solo letras y números"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-base"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <p className="text-center text-sm text-slate-600">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-slate-900 underline">
            Iniciá sesión
          </Link>
        </p>
      </form>
    </main>
  );
}
