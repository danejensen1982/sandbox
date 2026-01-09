'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProgressIndicator } from '@/components/assessment/ProgressIndicator';
import { QuestionCard } from '@/components/assessment/QuestionCard';

interface Area {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  questionCount: number;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  helpText: string | null;
}

interface SessionState {
  sessionId: string;
  areas: Area[];
  currentAreaIndex: number;
  responses: Record<string, number>;
}

function AssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const startNew = searchParams.get('new') === 'true';

  const [status, setStatus] = useState<'loading' | 'intro' | 'questions' | 'submitting' | 'error'>('loading');
  const [error, setError] = useState('');
  const [session, setSession] = useState<SessionState | null>(null);
  const [currentArea, setCurrentArea] = useState<Area | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load session and areas
  useEffect(() => {
    if (!token) {
      router.push('/assess');
      return;
    }

    const loadSession = async () => {
      try {
        const response = await fetch('/api/v1/assessment/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ startNew }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load assessment');
          setStatus('error');
          return;
        }

        setSession({
          sessionId: data.sessionId,
          areas: data.areas,
          currentAreaIndex: data.currentProgress?.areaIndex || 0,
          responses: data.existingResponses || {},
        });

        // If already complete, redirect to results
        if (data.isComplete) {
          router.push(`/results?token=${token}`);
          return;
        }

        setStatus('intro');
      } catch {
        setError('Failed to load assessment. Please try again.');
        setStatus('error');
      }
    };

    loadSession();
  }, [token, startNew, router]);

  // Load questions for current area
  const loadAreaQuestions = useCallback(async () => {
    if (!session || !token) return;

    const area = session.areas[session.currentAreaIndex];
    setCurrentArea(area);

    try {
      const response = await fetch(`/api/v1/assessment/areas/${area.id}/questions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load questions');
        setStatus('error');
        return;
      }

      setQuestions(data.questions);

      // Restore any existing responses for this area
      const existingResponses: Record<string, number> = {};
      for (const q of data.questions) {
        if (session.responses[q.id]) {
          existingResponses[q.id] = session.responses[q.id];
        }
      }
      setResponses(existingResponses);

      setStatus('questions');
    } catch {
      setError('Failed to load questions. Please try again.');
      setStatus('error');
    }
  }, [session, token]);

  const handleStartArea = () => {
    loadAreaQuestions();
  };

  const handleResponse = (questionId: string, value: number) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitArea = async () => {
    if (!session || !token || !currentArea) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/assessment/areas/${currentArea.id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responses }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save responses');
        return;
      }

      // Check if assessment is complete
      if (data.isComplete) {
        // Calculate scores and redirect to results
        await fetch('/api/v1/assessment/complete', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        router.push(`/results?token=${token}`);
        return;
      }

      // Move to next area
      setSession((prev) =>
        prev
          ? {
              ...prev,
              currentAreaIndex: prev.currentAreaIndex + 1,
              responses: { ...prev.responses, ...responses },
            }
          : null
      );
      setResponses({});
      setStatus('intro');
    } catch {
      setError('Failed to save responses. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if all questions are answered
  const allQuestionsAnswered = questions.length > 0 && questions.every((q) => responses[q.id] !== undefined);
  const isLastArea = session ? session.currentAreaIndex === session.areas.length - 1 : false;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4" />
            <p className="text-slate-600">Loading assessment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-slate-900">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/assess')} variant="outline" className="w-full">
              Start Over
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'intro' && session) {
    const area = session.areas[session.currentAreaIndex];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <ProgressIndicator
            areas={session.areas.map((a, i) => ({
              id: a.id,
              name: a.name,
              isComplete: i < session.currentAreaIndex,
              isCurrent: i === session.currentAreaIndex,
            }))}
            currentIndex={session.currentAreaIndex}
          />

          <Card className="mt-8">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">
                  {session.currentAreaIndex + 1}
                </span>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">{area.name}</CardTitle>
              {area.description && (
                <CardDescription className="text-base text-slate-600 mt-2">
                  {area.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-slate-500">
                This section contains {area.questionCount} questions.
                <br />
                Please answer honestly for the most accurate results.
              </p>

              <Button onClick={handleStartArea} size="lg" className="px-8">
                Begin Section
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Questions view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {session && (
          <ProgressIndicator
            areas={session.areas.map((a, i) => ({
              id: a.id,
              name: a.name,
              isComplete: i < session.currentAreaIndex,
              isCurrent: i === session.currentAreaIndex,
            }))}
            currentIndex={session.currentAreaIndex}
          />
        )}

        {currentArea && (
          <div className="mt-4 mb-6">
            <h2 className="text-xl font-semibold text-slate-900">{currentArea.name}</h2>
            {currentArea.description && (
              <p className="text-slate-600 mt-1">{currentArea.description}</p>
            )}
          </div>
        )}

        <div className="space-y-6">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              questionNumber={index + 1}
              totalQuestions={questions.length}
              selectedValue={responses[question.id]}
              onSelect={(value) => handleResponse(question.id, value)}
              disabled={isSubmitting}
            />
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-8 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            {Object.keys(responses).length} of {questions.length} answered
          </div>

          <Button
            onClick={handleSubmitArea}
            disabled={!allQuestionsAnswered || isSubmitting}
            size="lg"
          >
            {isSubmitting
              ? 'Saving...'
              : isLastArea
                ? 'Complete Assessment'
                : 'Continue to Next Section'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4" />
          <p className="text-slate-600">Loading assessment...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AssessmentContent />
    </Suspense>
  );
}
