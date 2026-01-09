'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DirectLinkPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<'loading' | 'error' | 'choice'>('loading');
  const [error, setError] = useState('');
  const [sessionData, setSessionData] = useState<{
    sessionToken: string;
    canRetake: boolean;
    previousAttempts: number;
    cohortName: string;
  } | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch('/api/v1/auth/assessment/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid or expired link.');
          setStatus('error');
          return;
        }

        if (data.hasCompletedSession && data.canRetake) {
          // Show choice dialog
          setSessionData({
            sessionToken: data.sessionToken,
            canRetake: true,
            previousAttempts: data.previousAttempts || 1,
            cohortName: data.cohortName,
          });
          setStatus('choice');
        } else if (data.hasCompletedSession) {
          // Redirect to results
          router.replace(`/results?token=${data.sessionToken}`);
        } else {
          // Start or resume assessment
          router.replace(`/assessment?token=${data.sessionToken}`);
        }
      } catch {
        setError('Something went wrong. Please try again.');
        setStatus('error');
      }
    };

    validateToken();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4" />
            <p className="text-slate-600">Validating your access...</p>
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
            <CardTitle className="text-2xl font-bold text-slate-900">
              Access Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => router.push('/assess')}
              variant="outline"
              className="w-full"
            >
              Enter Code Manually
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Choice dialog for users who can retake
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-slate-600">
            You&apos;ve completed this assessment before. What would you like to do?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500 text-center">
            Previous attempts: {sessionData?.previousAttempts}
          </p>

          <Button
            onClick={() => router.push(`/results?token=${sessionData?.sessionToken}`)}
            className="w-full"
          >
            View Previous Results
          </Button>

          <Button
            onClick={() => router.push(`/assessment?token=${sessionData?.sessionToken}&new=true`)}
            variant="outline"
            className="w-full"
          >
            Start New Assessment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
