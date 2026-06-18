import { useState, type FormEvent } from 'react';
import { apiJson, ApiError } from '../lib/api.js';
import type { Profile } from '../lib/types.js';

interface ProfileFormProps {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}

export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email);
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '');
  const [height, setHeight] = useState(profile.height?.toString() ?? '');
  const [weight, setWeight] = useState(profile.weight?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await apiJson<Profile>('/patients/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          email,
          birth_date: birthDate || undefined,
          height: height ? Number(height) : undefined,
          weight: weight ? Number(weight) : undefined,
        }),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el perfil');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 p-4">
      <h2 className="font-medium text-slate-900">Perfil</h2>

      <div className="space-y-1">
        <label htmlFor="profile_full_name" className="block text-sm text-slate-700">
          Nombre completo
        </label>
        <input
          id="profile_full_name"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="profile_email" className="block text-sm text-slate-700">
          Email
        </label>
        <input
          id="profile_email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="profile_birth_date" className="block text-sm text-slate-700">
          Fecha de nacimiento
        </label>
        <input
          id="profile_birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="profile_height" className="block text-sm text-slate-700">
          Altura (m)
        </label>
        <input
          id="profile_height"
          type="number"
          min={0}
          step={0.01}
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="profile_weight" className="block text-sm text-slate-700">
          Peso (kg)
        </label>
        <input
          id="profile_weight"
          type="number"
          min={0}
          step={0.1}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50"
      >
        Guardar perfil
      </button>
    </form>
  );
}
