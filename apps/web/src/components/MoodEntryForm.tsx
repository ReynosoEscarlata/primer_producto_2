import { useState, type FormEvent } from 'react';
import { apiJson, ApiError } from '../lib/api.js';
import type { MoodEntry } from '../lib/types.js';

interface MoodEntryFormProps {
  entries: MoodEntry[];
  onCreated: (entry: MoodEntry) => void;
}

export function MoodEntryForm({ entries, onCreated }: MoodEntryFormProps) {
  const [value, setValue] = useState(5);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const entry = await apiJson<MoodEntry>('/patients/me/mood-entries', {
        method: 'POST',
        body: JSON.stringify({ value, note: note || undefined }),
      });
      onCreated(entry);
      setNote('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el estado de ánimo');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">Estado de ánimo</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="mood_value" className="block text-sm text-slate-700">
            Escala 1 (mal) a 10 (excelente): {value}
          </label>
          <input
            id="mood_value"
            type="range"
            min={1}
            max={10}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="mood_note" className="block text-sm text-slate-700">
            Nota (opcional)
          </label>
          <input
            id="mood_note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-base"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50"
        >
          Registrar
        </button>
      </form>

      {entries.length > 0 && (
        <ul className="space-y-1 text-sm text-slate-600">
          {entries
            .slice(-5)
            .reverse()
            .map((entry) => (
              <li key={entry.id}>
                {new Date(entry.occurred_at).toLocaleString()} — {entry.value}/10
                {entry.note ? ` (${entry.note})` : ''}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
