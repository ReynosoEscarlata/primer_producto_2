import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { apiJson, ApiError } from '../lib/api.js';
import type { AdminPatientSummary, AdminUser, AdminUserSummary } from '../lib/types.js';
import { PageHeader } from '../components/PageHeader.js';
import { LogoutButton } from '../components/LogoutButton.js';

function UserRow({
  user,
  onToggleActive,
  onSave,
  extra,
}: {
  user: AdminUserSummary;
  onToggleActive: (id: string, isActive: boolean) => void;
  onSave: (id: string, fullName: string, email: string) => Promise<void>;
  extra?: ReactNode;
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
    <li className="border-b border-gray-100 py-3 last:border-0">
      {isEditing ? (
        <div className="space-y-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="font-semibold text-black">{user.full_name}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
            <p className={`text-xs ${user.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {user.is_active ? '✓ Activo' : '✗ Desactivado'}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onToggleActive(user.id, !user.is_active)}
                className={`font-medium ${user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
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
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm text-gray-600">Cargando panel de administración...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeader title="⚙️ Panel de Administración" actions={<LogoutButton />} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 md:col-span-2 lg:col-span-1">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-lg font-bold text-black">👤 Crear usuario</h2>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <select
                aria-label="Rol del nuevo usuario"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as 'PATIENT' | 'NUTRITIONIST')}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="NUTRITIONIST">👨‍⚕️ Nutrióloga</option>
                <option value="PATIENT">🏥 Paciente</option>
              </select>
              <input
                type="text"
                required
                placeholder="Nombre completo"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="password"
                required
                minLength={6}
                pattern="[a-zA-Z0-9]+"
                placeholder="Contraseña"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700">{createError}</p>
                </div>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-2.5 font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/30"
              >
                ✔ Crear usuario
              </button>
            </form>
          </section>

          <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-lg font-bold text-black">👨‍⚕️ Nutriólogas</h2>
              <p className="mt-1 text-sm text-gray-600">{nutritionists.length} nutrióloga{nutritionists.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-2">
              <input
                value={nutriQuery}
                onChange={(e) => setNutriQuery(e.target.value)}
                placeholder="Buscar"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => loadNutritionists(nutriQuery)}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2 font-semibold text-white"
              >
                🔍
              </button>
            </div>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
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

          <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10">
            <div className="border-b border-gray-200 pb-3">
              <h2 className="text-lg font-bold text-black">🏥 Pacientes</h2>
              <p className="mt-1 text-sm text-gray-600">{patients.length} paciente{patients.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-2">
              <input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Buscar"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => loadPatients(patientQuery)}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2 font-semibold text-white"
              >
                🔍
              </button>
            </div>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {patients.map((patient) => (
                <UserRow
                  key={patient.id}
                  user={patient}
                  onToggleActive={handleToggleActive}
                  onSave={handleSaveUser}
                  extra={
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-gray-500 mb-1">
                        {patient.holder ? `👤 ${patient.holder.full_name}` : '⚠️ Sin nutrióloga'}
                      </p>
                      {reassigningPatientId === patient.id ? (
                        <div className="flex gap-1">
                          <select
                            aria-label="Nueva nutrióloga para este paciente"
                            value={selectedNutritionistId}
                            onChange={(e) => setSelectedNutritionistId(e.target.value)}
                            className="rounded-lg border border-gray-200 bg-gray-50 text-xs px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                            className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                          >
                            ✔
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReassigningPatientId(patient.id)}
                          className="font-medium text-blue-600 transition-colors hover:text-blue-700"
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
        </div>
      </div>
    </main>
  );
}
