'use client';

import { Card, CardContent } from '@/components/ui/card';
import { LikertScale, getScaleForType } from './LikertScale';

interface QuestionCardProps {
  question: {
    id: string;
    questionText: string;
    questionType: string;
    helpText?: string | null;
  };
  questionNumber: number;
  totalQuestions: number;
  selectedValue?: number;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedValue,
  onSelect,
  disabled = false,
}: QuestionCardProps) {
  const scale = getScaleForType(question.questionType);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Question number badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
              {questionNumber}
            </span>
            <span className="text-xs text-slate-500">
              of {totalQuestions}
            </span>
          </div>

          {/* Question text */}
          <p className="text-lg text-slate-900 leading-relaxed">
            {question.questionText}
          </p>

          {/* Help text if available */}
          {question.helpText && (
            <p className="text-sm text-slate-500 italic">
              {question.helpText}
            </p>
          )}

          {/* Likert scale */}
          <div className="pt-2">
            <LikertScale
              scale={scale}
              selectedValue={selectedValue}
              onSelect={onSelect}
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
