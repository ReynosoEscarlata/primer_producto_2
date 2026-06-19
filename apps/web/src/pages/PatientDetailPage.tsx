import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiJson, ApiError } from '../lib/api.js';
import type { PatientDetail } from '../lib/types.js';
import { HistoryChart } from '../components/HistoryChart.js';
import { PageHeader } from '../components/PageHeader.js';

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    apiJson<PatientDetail>(`/nutritionists/patients/${patientId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el paciente'));
  }, [patientId]);

  async function handleUnassign() {
    if (!patientId) return;
    try {
      await apiJson(`/nutritionists/me/patients/${patientId}`, { method: 'DELETE' });
      navigate('/nutritionist', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desasignar al paciente');
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center px-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm text-gray-600">Cargando detalles del paciente...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title={`👤 ${detail.profile.full_name}`}
          actions={
            <button
              type="button"
              onClick={handleUnassign}
              className="rounded-lg px-4 py-2 font-semibold text-red-600 transition-all duration-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Desasignar
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 lg:col-span-1">
            <h3 className="mb-4 text-lg font-bold text-black border-b border-gray-200 pb-3">Información</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Email:</span>
                <p className="font-semibold text-black">{detail.profile.email}</p>
              </div>
              <div>
                <span className="text-gray-600">📏 Altura:</span>
                <p className="font-semibold text-black">{detail.profile.height ?? '—'} m</p>
              </div>
              <div>
                <span className="text-gray-600">⚖️ Peso:</span>
                <p className="font-semibold text-black">{detail.profile.weight ?? '—'} kg</p>
              </div>
            </div>
          </section>

          <div className="space-y-6 lg:col-span-2">
            <HistoryChart logs={detail.daily_logs} />

            <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10">
              <div className="border-b border-gray-200 pb-3 mb-4">
                <h2 className="text-lg font-bold text-black">😊 Estado de ánimo (30 días)</h2>
                <p className="mt-1 text-sm text-gray-600">{detail.mood_entries.length} entrada{detail.mood_entries.length !== 1 ? 's' : ''}</p>
              </div>
              {detail.mood_entries.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-gray-600">Sin registros de estado de ánimo.</p>
                </div>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {detail.mood_entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                        {entry.value}/10
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{new Date(entry.occurred_at).toLocaleString()}</p>
                        {entry.note && <p className="text-xs text-gray-600 mt-0.5 italic">"{entry.note}"</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
