import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiJson, ApiError } from '../lib/api.js';
import type { NutritionistPatientListItem, PatientSearchResult } from '../lib/types.js';
import { PageHeader } from '../components/PageHeader.js';
import { LogoutButton } from '../components/LogoutButton.js';

export function NutritionistDashboardPage() {
  const [patients, setPatients] = useState<NutritionistPatientListItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadPatients() {
    apiJson<NutritionistPatientListItem[]>('/nutritionists/me/patients').then(setPatients);
  }

  useEffect(() => {
    loadPatients();
  }, []);

  async function runSearch() {
    setError(null);
    try {
      const found = await apiJson<PatientSearchResult[]>(
        `/nutritionists/patients/search?q=${encodeURIComponent(query)}`,
      );
      setResults(found);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo buscar');
    }
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    runSearch();
  }

  async function handleAssign(patientId: string) {
    setError(null);
    try {
      await apiJson('/nutritionists/me/patients', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId }),
      });
      loadPatients();
      runSearch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar el paciente');
    }
  }

  if (!patients) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm text-gray-600">Cargando tus pacientes...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader title="👥 Mis pacientes" actions={<LogoutButton />} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/20">
              <div className="border-b border-gray-200 pb-3">
                <h2 className="text-lg font-bold text-black">Pacientes asignados</h2>
                <p className="mt-1 text-sm text-gray-600">{patients.length} paciente{patients.length !== 1 ? 's' : ''}</p>
              </div>
              {patients.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-3xl mb-2">👤</p>
                    <p className="text-sm text-gray-600">Todavía no tenés pacientes asignados.</p>
                    <p className="text-xs text-gray-500 mt-1">Busca pacientes en la sección derecha.</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                  {patients.map((patient) => (
                    <li
                      key={patient.id}
                      className="flex flex-col gap-3 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-black">{patient.full_name}</p>
                        <p className="text-sm text-gray-600">{patient.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          📊 Último log: <span className="font-medium">{patient.last_log_date ?? 'sin registros'}</span>
                        </p>
                      </div>
                      <Link
                        to={`/nutritionist/patients/${patient.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/30"
                      >
                        Ver detalles →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/20 h-fit">
            <div className="border-b border-gray-200 pb-3 mb-4">
              <h2 className="text-lg font-bold text-black">🔍 Buscar pacientes</h2>
            </div>
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre o email"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/30"
                >
                  🔍
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              )}

              {results && (
                <div className="border-t border-gray-200 pt-3">
                  {results.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-3">Sin resultados.</p>
                  ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {results.map((result) => (
                        <li
                          key={result.id}
                          className="flex flex-col gap-2 border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-all"
                        >
                          <div>
                            <p className="font-semibold text-black text-sm">{result.full_name}</p>
                            <p className="text-xs text-gray-600">{result.email}</p>
                          </div>
                          {result.holder ? (
                            <p className="text-xs text-gray-500">
                              ✓ Asignado a {result.holder.full_name}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAssign(result.id)}
                              className="w-full rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:bg-blue-700"
                            >
                              + Asignarme
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
