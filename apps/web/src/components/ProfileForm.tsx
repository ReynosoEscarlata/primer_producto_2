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
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/20">
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-black">👤 Tu Perfil</h2>
        <p className="mt-1 text-sm text-gray-600">Actualiza tu información personal</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="profile_full_name" className="block text-sm font-semibold text-gray-900">
            Nombre completo
          </label>
          <input
            id="profile_full_name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Tu nombre completo"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="profile_email" className="block text-sm font-semibold text-gray-900">
            Email
          </label>
          <input
            id="profile_email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="tu@email.com"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="profile_birth_date" className="block text-sm font-semibold text-gray-900">
            📅 Fecha de nacimiento
          </label>
          <input
            id="profile_birth_date"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="profile_height" className="block text-sm font-semibold text-gray-900">
            📏 Altura (m)
          </label>
          <input
            id="profile_height"
            type="number"
            min={0}
            step={0.01}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="1.70"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="profile_weight" className="block text-sm font-semibold text-gray-900">
            ⚖️ Peso (kg)
          </label>
          <input
            id="profile_weight"
            type="number"
            min={0}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-black transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="70"
          />
        </div>
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
        {isSubmitting ? 'Guardando…' : '💾 Guardar cambios'}
      </button>
    </form>
  );
}
