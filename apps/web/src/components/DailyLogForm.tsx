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
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 p-4">
      <h2 className="font-medium text-slate-900">Hábitos de hoy</h2>

      <div className="space-y-1">
        <label htmlFor="water_ml" className="block text-sm text-slate-700">
          Agua (ml) — 0 a 10000
        </label>
        <input
          id="water_ml"
          type="number"
          min={0}
          max={10000}
          required
          value={waterMl}
          onChange={(e) => setWaterMl(Number(e.target.value))}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="exercise_minutes" className="block text-sm text-slate-700">
          Ejercicio (minutos) — 0 a 1440
        </label>
        <input
          id="exercise_minutes"
          type="number"
          min={0}
          max={1440}
          required
          value={exerciseMinutes}
          onChange={(e) => setExerciseMinutes(Number(e.target.value))}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="sleep_hours" className="block text-sm text-slate-700">
          Sueño (horas) — 0 a 24
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
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50"
      >
        {todayLog ? 'Actualizar log de hoy' : 'Guardar log de hoy'}
      </button>
    </form>
  );
}
