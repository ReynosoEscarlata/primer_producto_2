import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api.js';
import type { DailyLog, MoodEntry, Profile } from '../lib/types.js';
import { DailyLogForm } from '../components/DailyLogForm.js';
import { HistoryChart } from '../components/HistoryChart.js';
import { MoodEntryForm } from '../components/MoodEntryForm.js';
import { ProfileForm } from '../components/ProfileForm.js';
import { PageHeader } from '../components/PageHeader.js';
import { LogoutButton } from '../components/LogoutButton.js';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PatientDashboardPage() {
  const [logs, setLogs] = useState<DailyLog[] | null>(null);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    apiJson<DailyLog[]>('/patients/me/daily-logs').then(setLogs);
    apiJson<MoodEntry[]>('/patients/me/mood-entries').then(setMoodEntries);
    apiJson<Profile>('/patients/me/profile').then(setProfile);
  }, []);

  if (!logs || !moodEntries || !profile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm text-gray-600">Cargando tu panel...</p>
        </div>
      </main>
    );
  }

  const todayLog = logs.find((log) => log.date === todayIsoDate()) ?? null;

  function handleLogSaved(log: DailyLog) {
    setLogs((prev) => {
      const rest = (prev ?? []).filter((entry) => entry.date !== log.date);
      return [...rest, log].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title={`¡Hola, ${profile.full_name}! 👋`}
          actions={<LogoutButton />}
        />

        <HistoryChart logs={logs} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DailyLogForm todayLog={todayLog} onSaved={handleLogSaved} />
          <MoodEntryForm
            entries={moodEntries}
            onCreated={(entry) => setMoodEntries((prev) => [...(prev ?? []), entry])}
          />
          <ProfileForm profile={profile} onSaved={setProfile} />
        </div>
      </div>
    </main>
  );
}
