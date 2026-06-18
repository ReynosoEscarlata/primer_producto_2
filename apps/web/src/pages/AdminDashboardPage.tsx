import { useEffect, useState, type FormEvent } from 'react';
import { apiJson, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth-context.js';
import type { AdminPatientSummary, AdminUser, AdminUserSummary } from '../lib/types.js';

function UserRow({
  user,
  onToggleActive,
  onSave,
  extra,
}: {
  user: AdminUserSummary;
  onToggleActive: (id: string, isActive: boolean) => void;
  onSave: (id: string, fullName: string, email: string) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave(user.id, fullName, email);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    }
  }

  return (
    <li className="space-y-1 border-b border-slate-100 py-2 text-sm last:border-0">
      {isEditing ? (
        <div className="space-y-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} className="rounded bg-slate-900 px-2 py-1 text-white">
              Guardar
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-slate-600 underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">{user.full_name}</p>
            <p className="text-slate-500">{user.email}</p>
            <p className="text-xs text-slate-400">{user.is_active ? 'Activo' : 'Desactivado'}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsEditing(true)} className="text-slate-900 underline">
                Editar
              </button>
              <button
                type="button"
                onClick={() => onToggleActive(user.id, !user.is_active)}
                className="text-slate-900 underline"
              >
                {user.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
            {extra}
          </div>
        </div>
      )}
    </li>
  );
}

export function AdminDashboardPage() {
  const { logout } = useAuth();
  const [nutritionists, setNutritionists] = useState<AdminUserSummary[] | null>(null);
  const [patients, setPatients] = useState<AdminPatientSummary[] | null>(null);
  const [nutriQuery, setNutriQuery] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [reassigningPatientId, setReassigningPatientId] = useState<string | null>(null);
  const [selectedNutritionistId, setSelectedNutritionistId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createRole, setCreateRole] = useState<'PATIENT' | 'NUTRITIONIST'>('NUTRITIONIST');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');

  function loadNutritionists(q = '') {
    apiJson<AdminUserSummary[]>(`/admin/nutritionists?q=${encodeURIComponent(q)}`).then(setNutritionists);
  }

  function loadPatients(q = '') {
    apiJson<AdminPatientSummary[]>(`/admin/patients?q=${encodeURIComponent(q)}`).then(setPatients);
  }

  useEffect(() => {
    loadNutritionists();
    loadPatients();
  }, []);

  async function handleToggleActive(id: string, isActive: boolean) {
    await apiJson(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
    loadNutritionists(nutriQuery);
    loadPatients(patientQuery);
  }

  async function handleSaveUser(id: string, fullName: string, email: string) {
    await apiJson<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ full_name: fullName, email }),
    });
    loadNutritionists(nutriQuery);
    loadPatients(patientQuery);
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);
    try {
      await apiJson('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          full_name: createFullName,
          role: createRole,
        }),
      });
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      loadNutritionists(nutriQuery);
      loadPatients(patientQuery);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario');
    }
  }

  async function handleReassign(patientId: string) {
    if (!selectedNutritionistId) return;
    await apiJson(`/admin/patients/${patientId}/assign-nutritionist`, {
      method: 'POST',
      body: JSON.stringify({ nutritionist_id: selectedNutritionistId }),
    });
    setReassigningPatientId(null);
    setSelectedNutritionistId('');
    loadPatients(patientQuery);
  }

  if (!nutritionists || !patients) {
    return <p className="p-4 text-center text-sm text-slate-500">Cargando…</p>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Admin</h1>
        <button type="button" onClick={() => logout()} className="text-sm text-slate-600 underline">
          Cerrar sesión
        </button>
      </header>

      <section className="space-y-3 rounded border border-slate-200 p-4">
        <h2 className="font-medium text-slate-900">Crear usuario</h2>
        <form onSubmit={handleCreateUser} className="space-y-2">
          <select
            value={createRole}
            onChange={(e) => setCreateRole(e.target.value as 'PATIENT' | 'NUTRITIONIST')}
            className="w-full rounded border border-slate-300 px-2 py-2"
          >
            <option value="NUTRITIONIST">Nutrióloga</option>
            <option value="PATIENT">Paciente</option>
          </select>
          <input
            type="text"
            required
            placeholder="Nombre completo"
            value={createFullName}
            onChange={(e) => setCreateFullName(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-2"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-2"
          />
          <input
            type="password"
            required
            minLength={6}
            pattern="[a-zA-Z0-9]+"
            placeholder="Contraseña"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-2"
          />
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button type="submit" className="w-full rounded bg-slate-900 py-2 text-white">
            Crear
          </button>
        </form>
      </section>

      <section className="space-y-2 rounded border border-slate-200 p-4">
        <h2 className="font-medium text-slate-900">Nutriólogas</h2>
        <div className="flex gap-2">
          <input
            value={nutriQuery}
            onChange={(e) => setNutriQuery(e.target.value)}
            placeholder="Buscar"
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button type="button" onClick={() => loadNutritionists(nutriQuery)} className="rounded bg-slate-900 px-3 text-sm text-white">
            Buscar
          </button>
        </div>
        <ul>
          {nutritionists.map((nutritionist) => (
            <UserRow
              key={nutritionist.id}
              user={nutritionist}
              onToggleActive={handleToggleActive}
              onSave={handleSaveUser}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded border border-slate-200 p-4">
        <h2 className="font-medium text-slate-900">Pacientes</h2>
        <div className="flex gap-2">
          <input
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
            placeholder="Buscar"
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button type="button" onClick={() => loadPatients(patientQuery)} className="rounded bg-slate-900 px-3 text-sm text-white">
            Buscar
          </button>
        </div>
        <ul>
          {patients.map((patient) => (
            <UserRow
              key={patient.id}
              user={patient}
              onToggleActive={handleToggleActive}
              onSave={handleSaveUser}
              extra={
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {patient.holder ? `Asignado a ${patient.holder.full_name}` : 'Sin nutrióloga'}
                  </p>
                  {reassigningPatientId === patient.id ? (
                    <div className="flex gap-1">
                      <select
                        value={selectedNutritionistId}
                        onChange={(e) => setSelectedNutritionistId(e.target.value)}
                        className="rounded border border-slate-300 text-xs"
                      >
                        <option value="">Elegir…</option>
                        {nutritionists.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleReassign(patient.id)}
                        className="text-slate-900 underline"
                      >
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReassigningPatientId(patient.id)}
                      className="text-slate-900 underline"
                    >
                      Reasignar
                    </button>
                  )}
                </div>
              }
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
