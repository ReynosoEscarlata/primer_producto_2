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
  const colors = [
    'rgb(59, 130, 246)',
    'rgb(99, 102, 241)',
    'rgb(139, 92, 246)',
  ];
  const colorIndex = Math.floor(Math.random() * colors.length);
  const barColor = colors[colorIndex];

  return (
    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-gray-200 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-bold text-black">{label}</span>
        <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">{lastValue}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full sm:h-16 lg:h-20 mb-3"
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
              fill={barColor}
              opacity="0.8"
              rx="2"
            />
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
        {dates.slice(-7).map((date, index) => (
          <li key={date} className="flex items-center gap-1">
            <span className="text-gray-500">{formatShortDate(date)}</span>
            <span className="font-bold text-black">{values[dates.length - 7 + index]}</span>
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
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-4xl mb-2">📊</p>
            <p className="text-sm text-gray-600">Todavía no hay logs en los últimos 30 días.</p>
            <p className="text-xs text-gray-500 mt-1">¡Comienza a registrar tus hábitos hoy!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-md shadow-blue-100/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/20">
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-black">📈 Historial (30 días)</h2>
        <p className="mt-1 text-sm text-gray-600">Tu progreso de los últimos 30 días</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniBarChart
          label="💧 Agua (ml)"
          dates={logs.map((l) => l.date)}
          values={logs.map((l) => l.water_ml)}
          max={10000}
        />
        <MiniBarChart
          label="🏃 Ejercicio (min)"
          dates={logs.map((l) => l.date)}
          values={logs.map((l) => l.exercise_minutes)}
          max={1440}
        />
        <MiniBarChart
          label="😴 Sueño (hs)"
          dates={logs.map((l) => l.date)}
          values={logs.map((l) => l.sleep_hours)}
          max={24}
        />
      </div>
    </div>
  );
}
