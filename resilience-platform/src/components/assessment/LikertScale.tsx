'use client';

import { cn } from '@/lib/utils';

interface LikertOption {
  value: number;
  label: string;
}

interface LikertScaleProps {
  scale: LikertOption[];
  selectedValue?: number;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

export function LikertScale({
  scale,
  selectedValue,
  onSelect,
  disabled = false,
}: LikertScaleProps) {
  return (
    <div className="space-y-3">
      {/* Desktop: horizontal layout */}
      <div className="hidden sm:flex gap-2 justify-between">
        {scale.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            disabled={disabled}
            className={cn(
              'flex-1 px-3 py-4 rounded-lg border-2 transition-all duration-200',
              'hover:border-blue-400 hover:bg-blue-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              selectedValue === value
                ? 'border-blue-600 bg-blue-100 text-blue-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700',
              disabled && 'opacity-50 cursor-not-allowed hover:border-slate-200 hover:bg-white'
            )}
          >
            <div className="text-center">
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-slate-500 mt-1 leading-tight">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Mobile: vertical layout */}
      <div className="sm:hidden space-y-2">
        {scale.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            disabled={disabled}
            className={cn(
              'w-full px-4 py-3 rounded-lg border-2 transition-all duration-200',
              'flex items-center gap-4',
              'hover:border-blue-400 hover:bg-blue-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              selectedValue === value
                ? 'border-blue-600 bg-blue-100 text-blue-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700',
              disabled && 'opacity-50 cursor-not-allowed hover:border-slate-200 hover:bg-white'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-lg">
              {value}
            </div>
            <div className="text-left text-sm">{label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Default Likert scales
export const LIKERT_5_SCALE: LikertOption[] = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

export const LIKERT_7_SCALE: LikertOption[] = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Somewhat Disagree' },
  { value: 4, label: 'Neutral' },
  { value: 5, label: 'Somewhat Agree' },
  { value: 6, label: 'Agree' },
  { value: 7, label: 'Strongly Agree' },
];

export function getScaleForType(type: string): LikertOption[] {
  switch (type) {
    case 'likert_7':
      return LIKERT_7_SCALE;
    case 'likert_5':
    default:
      return LIKERT_5_SCALE;
  }
}
