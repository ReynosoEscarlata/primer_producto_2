import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api.js';
import { useAuth } from '../lib/auth-context.js';
import type { DailyLog, MoodEntry, Profile } from '../lib/types.js';
import { DailyLogForm } from '../components/DailyLogForm.js';
import { HistoryChart } from '../components/HistoryChart.js';
import { MoodEntryForm } from '../components/MoodEntryForm.js';
import { ProfileForm } from '../components/ProfileForm.js';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PatientDashboardPage() {
  const { logout } = useAuth();
  const [logs, setLogs] = useState<DailyLog[] | null>(null);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    apiJson<DailyLog[]>('/patients/me/daily-logs').then(setLogs);
    apiJson<MoodEntry[]>('/patients/me/mood-entries').then(setMoodEntries);
    apiJson<Profile>('/patients/me/profile').then(setProfile);
  }, []);

  if (!logs || !moodEntries || !profile) {
    return <p className="p-4 text-center text-sm text-slate-500">Cargando…</p>;
  }

  const todayLog = logs.find((log) => log.date === todayIsoDate()) ?? null;

  function handleLogSaved(log: DailyLog) {
    setLogs((prev) => {
      const rest = (prev ?? []).filter((entry) => entry.date !== log.date);
      return [...rest, log].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Hola, {profile.full_name}</h1>
        <button onClick={() => logout()} className="text-sm text-slate-600 underline">
          Cerrar sesión
        </button>
      </header>

      <DailyLogForm todayLog={todayLog} onSaved={handleLogSaved} />
      <HistoryChart logs={logs} />
      <MoodEntryForm
        entries={moodEntries}
        onCreated={(entry) => setMoodEntries((prev) => [...(prev ?? []), entry])}
      />
      <ProfileForm profile={profile} onSaved={setProfile} />
    </main>
  );
}
