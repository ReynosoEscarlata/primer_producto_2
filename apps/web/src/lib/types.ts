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
