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
    <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/20">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-black">Estado de ánimo</h2>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Escala {value}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="mood_value" className="block text-sm font-semibold text-gray-900">
              😊 ¿Cómo estás hoy?
            </label>
            <span className="text-2xl font-bold text-blue-600">{value}</span>
          </div>
          <input
            id="mood_value"
            type="range"
            min={1}
            max={10}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full h-2 bg-gradient-to-r from-red-400 to-green-400 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Mal</span>
            <span>Excelente</span>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="mood_note" className="block text-sm font-semibold text-gray-900">
            📝 Nota (opcional)
          </label>
          <input
            id="mood_note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Comparte cómo te sientes..."
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
          {isSubmitting ? 'Registrando…' : '✔ Registrar'}
        </button>
      </form>

      {entries.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <p className="mb-3 text-sm font-semibold text-gray-900">Últimas notas ({entries.length})</p>
          <ul className="space-y-2 max-h-32 overflow-y-auto">
            {entries
              .slice(-5)
              .reverse()
              .map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-100 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{entry.value}/10</span>
                    <span className="text-gray-500">{new Date(entry.occurred_at).toLocaleDateString()}</span>
                  </div>
                  {entry.note && <p className="mt-1 text-gray-700">{entry.note}</p>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
