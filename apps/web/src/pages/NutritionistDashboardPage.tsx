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
    return <p className="p-4 text-center text-sm text-slate-500">Cargando…</p>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader title="Mis pacientes" actions={<LogoutButton />} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-2 rounded border border-slate-200 bg-white p-4">
            {patients.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no tenés pacientes asignados.</p>
            ) : (
              <ul className="space-y-2">
                {patients.map((patient) => (
                  <li
                    key={patient.id}
                    className="flex flex-col gap-2 border-b border-slate-100 py-2 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{patient.full_name}</p>
                      <p className="text-slate-500">{patient.email}</p>
                      <p className="text-xs text-slate-400">
                        Último log: {patient.last_log_date ?? 'sin registros'}
                      </p>
                    </div>
                    <Link to={`/nutritionist/patients/${patient.id}`} className="text-slate-900 underline">
                      Ver detalle
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
            <h2 className="font-medium text-slate-900">Buscar pacientes</h2>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre o email"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-base"
              />
              <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
                Buscar
              </button>
            </form>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {results &&
              (results.length === 0 ? (
                <p className="text-sm text-slate-500">Sin resultados.</p>
              ) : (
                <ul className="space-y-2">
                  {results.map((result) => (
                    <li
                      key={result.id}
                      className="flex flex-col gap-2 border-b border-slate-100 py-2 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{result.full_name}</p>
                        <p className="text-slate-500">{result.email}</p>
                        <p className="text-xs text-slate-400">
                          {result.holder ? `Asignado a ${result.holder.full_name}` : 'Sin nutrióloga asignada'}
                        </p>
                      </div>
                      {!result.holder && (
                        <button
                          type="button"
                          onClick={() => handleAssign(result.id)}
                          className="self-start rounded bg-slate-900 px-3 py-1 text-white sm:self-auto"
                        >
                          Asignarme
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        </div>
      </div>
    </main>
  );
}
