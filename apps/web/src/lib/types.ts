export interface DailyLog {
  date: string;
  water_ml: number;
  exercise_minutes: number;
  sleep_hours: number;
}

export interface MoodEntry {
  id: string;
  occurred_at: string;
  value: number;
  note: string | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  birth_date: string | null;
  height: number | null;
  weight: number | null;
}

export interface NutritionistPatientListItem {
  id: string;
  full_name: string;
  email: string;
  last_log_date: string | null;
}

export interface PatientSearchResult {
  id: string;
  full_name: string;
  email: string;
  holder: { full_name: string; email: string } | null;
}

export interface PatientDetail {
  profile: Profile;
  daily_logs: DailyLog[];
  mood_entries: MoodEntry[];
}

export interface AdminUserSummary {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface AdminPatientSummary extends AdminUserSummary {
  holder: { id: string; full_name: string; email: string } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'PATIENT' | 'NUTRITIONIST';
}
