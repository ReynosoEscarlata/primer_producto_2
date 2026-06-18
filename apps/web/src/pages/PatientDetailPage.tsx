import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiJson, ApiError } from '../lib/api.js';
import type { PatientDetail } from '../lib/types.js';
import { HistoryChart } from '../components/HistoryChart.js';

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
    return <p className="p-4 text-center text-sm text-red-600">{error}</p>;
  }

  if (!detail) {
    return <p className="p-4 text-center text-sm text-slate-500">Cargando…</p>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{detail.profile.full_name}</h1>
        <button type="button" onClick={handleUnassign} className="text-sm text-red-600 underline">
          Desasignar
        </button>
      </header>

      <section className="space-y-1 rounded border border-slate-200 p-4 text-sm">
        <p>
          <span className="text-slate-500">Email:</span> {detail.profile.email}
        </p>
        <p>
          <span className="text-slate-500">Altura:</span> {detail.profile.height ?? '—'} m
        </p>
        <p>
          <span className="text-slate-500">Peso:</span> {detail.profile.weight ?? '—'} kg
        </p>
      </section>

      <HistoryChart logs={detail.daily_logs} />

      <section className="space-y-2 rounded border border-slate-200 p-4">
        <h2 className="font-medium text-slate-900">Estado de ánimo (30 días)</h2>
        {detail.mood_entries.length === 0 ? (
          <p className="text-sm text-slate-500">Sin registros.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-600">
            {detail.mood_entries.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.occurred_at).toLocaleString()} — {entry.value}/10
                {entry.note ? ` (${entry.note})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
