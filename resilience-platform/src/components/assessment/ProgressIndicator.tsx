'use client';

import { cn } from '@/lib/utils';

interface AreaProgress {
  id: string;
  name: string;
  isComplete: boolean;
  isCurrent: boolean;
}

interface ProgressIndicatorProps {
  areas: AreaProgress[];
  currentIndex: number;
}

export function ProgressIndicator({ areas, currentIndex }: ProgressIndicatorProps) {
  return (
    <div className="w-full mb-8">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${((currentIndex + 1) / areas.length) * 100}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between">
          {areas.map((area, index) => (
            <div
              key={area.id}
              className={cn(
                'w-4 h-4 rounded-full border-2 transition-all duration-300',
                area.isComplete
                  ? 'bg-blue-600 border-blue-600'
                  : area.isCurrent
                    ? 'bg-white border-blue-600 ring-4 ring-blue-100'
                    : 'bg-white border-slate-300'
              )}
            />
          ))}
        </div>
      </div>

      {/* Area names - only visible on larger screens */}
      <div className="hidden md:flex justify-between mt-4 text-xs">
        {areas.map((area, index) => (
          <div
            key={area.id}
            className={cn(
              'text-center max-w-[100px] transition-colors',
              area.isCurrent
                ? 'text-blue-600 font-medium'
                : area.isComplete
                  ? 'text-slate-600'
                  : 'text-slate-400'
            )}
          >
            {area.name}
          </div>
        ))}
      </div>

      {/* Current area indicator for mobile */}
      <div className="md:hidden mt-4 text-center">
        <span className="text-sm text-slate-500">
          Area {currentIndex + 1} of {areas.length}:
        </span>
        <span className="text-sm font-medium text-slate-900 ml-1">
          {areas[currentIndex]?.name}
        </span>
      </div>
    </div>
  );
}
