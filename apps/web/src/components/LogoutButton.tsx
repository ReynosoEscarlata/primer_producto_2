import { useAuth } from '../lib/auth-context.js';

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button type="button" onClick={() => logout()} className="text-sm text-slate-600 underline">
      Cerrar sesión
    </button>
  );
}
