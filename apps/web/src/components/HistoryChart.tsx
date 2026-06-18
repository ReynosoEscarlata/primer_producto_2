import type { DailyLog } from '../lib/types.js';

interface MiniBarChartProps {
  label: string;
  values: number[];
  max: number;
}

function MiniBarChart({ label, values, max }: MiniBarChartProps) {
  const width = 300;
  const height = 48;
  const barWidth = values.length > 0 ? width / values.length : width;

  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full" preserveAspectRatio="none">
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
    </div>
  );
}

interface HistoryChartProps {
  logs: DailyLog[];
}

export function HistoryChart({ logs }: HistoryChartProps) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay logs en los últimos 30 días.</p>;
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 p-4">
      <h2 className="font-medium text-slate-900">Historial (30 días)</h2>
      <MiniBarChart label="Agua (ml)" values={logs.map((l) => l.water_ml)} max={10000} />
      <MiniBarChart label="Ejercicio (min)" values={logs.map((l) => l.exercise_minutes)} max={1440} />
      <MiniBarChart label="Sueño (hs)" values={logs.map((l) => l.sleep_hours)} max={24} />
    </div>
  );
}
