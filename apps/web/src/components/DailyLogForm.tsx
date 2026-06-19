import { useState, type FormEvent } from 'react';
import { apiJson, ApiError } from '../lib/api.js';
import type { DailyLog } from '../lib/types.js';

interface DailyLogFormProps {
  todayLog: DailyLog | null;
  onSaved: (log: DailyLog) => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyLogForm({ todayLog, onSaved }: DailyLogFormProps) {
  const [waterMl, setWaterMl] = useState(todayLog?.water_ml ?? 0);
  const [exerciseMinutes, setExerciseMinutes] = useState(todayLog?.exercise_minutes ?? 0);
  const [sleepHours, setSleepHours] = useState(todayLog?.sleep_hours ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body = {
        water_ml: waterMl,
        exercise_minutes: exerciseMinutes,
        sleep_hours: sleepHours,
      };
      const log = todayLog
        ? await apiJson<DailyLog>(`/patients/me/daily-logs/${todayLog.date}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await apiJson<DailyLog>('/patients/me/daily-logs', {
            method: 'POST',
            body: JSON.stringify({ ...body, date: todayIsoDate() }),
          });
      onSaved(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el log');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/20">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-black">Hábitos de hoy</h2>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Diario</span>
      </div>

      <div className="space-y-2">
        <label htmlFor="water_ml" className="block text-sm font-semibold text-gray-900">
          💧 Agua (ml)
        </label>
        <input
          id="water_ml"
          type="number"
          min={0}
          max={10000}
          required
          value={waterMl}
          onChange={(e) => setWaterMl(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="0 - 10000 ml"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="exercise_minutes" className="block text-sm font-semibold text-gray-900">
          🏃 Ejercicio (minutos)
        </label>
        <input
          id="exercise_minutes"
          type="number"
          min={0}
          max={1440}
          required
          value={exerciseMinutes}
          onChange={(e) => setExerciseMinutes(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="0 - 1440 minutos"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="sleep_hours" className="block text-sm font-semibold text-gray-900">
          😴 Sueño (horas)
        </label>
        <input
          id="sleep_hours"
          type="number"
          min={0}
          max={24}
          step={0.5}
          required
          value={sleepHours}
          onChange={(e) => setSleepHours(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="0 - 24 horas"
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
        {isSubmitting ? 'Guardando…' : todayLog ? '📝 Actualizar' : '💾 Guardar'}
      </button>
    </form>
  );
}
