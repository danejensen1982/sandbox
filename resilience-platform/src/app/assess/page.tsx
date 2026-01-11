'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CompletedSessionInfo {
  sessionToken: string;
  canRetake: boolean;
  cohortName: string;
}

export default function AssessPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [completedSession, setCompletedSession] = useState<CompletedSessionInfo | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/auth/assessment/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid code. Please try again.');
        return;
      }

      if (data.hasCompletedSession) {
        // Show choice screen for completed assessments
        setCompletedSession({
          sessionToken: data.sessionToken,
          canRetake: data.canRetake,
          cohortName: data.cohortName,
        });
      } else {
        // Start or resume assessment
        router.push(`/assessment?token=${data.sessionToken}`);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewResults = () => {
    if (completedSession) {
      router.push(`/results?token=${completedSession.sessionToken}`);
    }
  };

  const handleRetakeAssessment = async () => {
    if (!completedSession) return;

    setIsLoading(true);
    setError('');
    try {
      // Call validate API with forceNewSession flag to create a new session
      const response = await fetch('/api/v1/auth/assessment/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          forceNewSession: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unable to start new assessment.');
        return;
      }

      router.push(`/assessment?token=${data.sessionToken}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format code as user types (RES-XXXX-XXXX)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Add dashes at appropriate positions
    if (value.length > 3) {
      value = value.slice(0, 3) + '-' + value.slice(3);
    }
    if (value.length > 8) {
      value = value.slice(0, 8) + '-' + value.slice(8);
    }

    // Limit to full code length
    if (value.length > 13) {
      value = value.slice(0, 13);
    }

    setCode(value);
  };

  // Show choice screen for completed assessments
  if (completedSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/third-factor-logo-dark.png"
                alt="Third Factor"
                width={180}
                height={50}
                className="h-12 w-auto"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold">
              Welcome Back
            </CardTitle>
            <CardDescription>
              You&apos;ve already completed this assessment. What would you like to do?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleViewResults}
              className="w-full"
              disabled={isLoading}
            >
              View Your Results
            </Button>

            {completedSession.canRetake ? (
              <Button
                onClick={handleRetakeAssessment}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : 'Retake Assessment'}
              </Button>
            ) : (
              <p className="text-sm text-slate-500 text-center">
                Retaking this assessment is not available.
              </p>
            )}

            <div className="pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                className="w-full text-slate-500"
                onClick={() => {
                  setCompletedSession(null);
                  setCode('');
                  setError('');
                }}
              >
                Use a Different Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/third-factor-logo-dark.png"
              alt="Third Factor"
              width={180}
              height={50}
              className="h-12 w-auto"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            Resilience Assessment
          </CardTitle>
          <CardDescription>
            Enter your assessment code to begin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="RES-XXXX-XXXX"
                value={code}
                onChange={handleCodeChange}
                className="text-center text-lg tracking-widest font-mono"
                disabled={isLoading}
                autoFocus
              />
              <p className="text-xs text-slate-500 text-center">
                Enter the code provided by your organization
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={code.length < 13 || isLoading}
            >
              {isLoading ? 'Validating...' : 'Start Assessment'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500 text-center">
              Don&apos;t have a code? Contact your organization administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
