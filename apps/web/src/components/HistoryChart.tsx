import type { DailyLog } from '../lib/types.js';

interface MiniBarChartProps {
  label: string;
  dates: string[];
  values: number[];
  max: number;
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function MiniBarChart({ label, dates, values, max }: MiniBarChartProps) {
  const width = 300;
  const height = 48;
  const barWidth = values.length > 0 ? width / values.length : width;
  const lastValue = values[values.length - 1];

  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="text-sm font-semibold text-slate-900">Último: {lastValue}</span>
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full sm:h-16 lg:h-20"
        preserveAspectRatio="none"
      >
        {values.map((value, index) => {
          const barHeight = max > 0 ? (value / max) * height : 0;
          return (
            <rect
              key={index}
              x={index * barWidth + 1}
              y={height - barHeight}
              width={Math.max(barWidth - 2, 1)}
              height={barHeight}
              className="fill-slate-700"
            />
          );
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-600">
        {dates.map((date, index) => (
          <li key={date}>
            {formatShortDate(date)}: <span className="font-medium text-slate-900">{values[index]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HistoryChartProps {
  logs: DailyLog[];
}

export function HistoryChart({ logs }: HistoryChartProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Todavía no hay logs en los últimos 30 días.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">Historial (30 días)</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniBarChart
          label="Agua (ml)"
          dates={logs.map((l) => l.date)}
          values={logs.map((l) => l.water_ml)}
          max={10000}
        />
        <MiniBarChart
          label="Ejercicio (min)"
          dates={logs.map((l) => l.date)}
          values={logs.map((l) => l.exercise_minutes)}
          max={1440}
        />
        <MiniBarChart
          label="Sueño (hs)"
          dates={logs.map((l) => l.date)}
          values={logs.map((l) => l.sleep_hours)}
          max={24}
        />
      </div>
    </div>
  );
}
