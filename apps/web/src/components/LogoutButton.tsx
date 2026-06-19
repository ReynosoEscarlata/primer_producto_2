import { useAuth } from '../lib/auth-context.js';

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-300 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Cerrar sesión
    </button>
  );
}
