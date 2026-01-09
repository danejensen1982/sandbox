'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface AreaData {
  name: string;
  score: number;
  fullMark: number;
}

interface RadarChartProps {
  data: AreaData[];
  color?: string;
}

export function RadarChart({ data, color = '#3B82F6' }: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke="#E2E8F0" />
        <PolarAngleAxis
          dataKey="name"
          tick={{ fill: '#64748B', fontSize: 12 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#94A3B8', fontSize: 10 }}
          tickCount={5}
          axisLine={false}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke={color}
          fill={color}
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-slate-200">
                  <p className="font-medium text-slate-900">{data.name}</p>
                  <p className="text-sm text-slate-600">
                    Score: <span className="font-semibold">{data.score}%</span>
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
