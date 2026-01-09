'use client';

import { cn } from '@/lib/utils';

interface ScoreBarProps {
  score: number;
  color: string;
  label?: string;
  showPercentage?: boolean;
}

export function ScoreBar({ score, color, label, showPercentage = true }: ScoreBarProps) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-semibold text-slate-900">{score}%</span>
          )}
        </div>
      )}
      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

interface ScoreCardProps {
  title: string;
  score: number;
  level: {
    name: string;
    color: string;
  };
  description?: string;
}

export function ScoreCard({ title, score, level, description }: ScoreCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <div
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            'text-white'
          )}
          style={{ backgroundColor: level.color }}
        >
          {level.name}
        </div>
      </div>
      <ScoreBar score={score} color={level.color} />
      {description && (
        <p className="mt-4 text-sm text-slate-600 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
