import { NextRequest, NextResponse } from 'next/server';
import { validateAssessmentCode, startAssessmentSession } from '@/lib/auth/assessment-code';
import { AuditEvents } from '@/lib/audit/logger';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, token } = body;

    // Get input (either code or token from direct link)
    const input = token || code;
    if (!input) {
      return NextResponse.json(
        { error: 'Assessment code is required' },
        { status: 400 }
      );
    }

    // Validate the code
    const validation = await validateAssessmentCode(input);

    if (!validation.valid || !validation.code) {
      return NextResponse.json(
        { error: validation.error || 'Invalid assessment code' },
        { status: 400 }
      );
    }

    // Get request metadata
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || undefined;
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      undefined;

    // Check if there's a completed session
    const hasCompletedSession = validation.completedSession?.isComplete;
    const cohort = validation.code.cohort;

    if (hasCompletedSession && !cohort?.allowRetakes) {
      // User has completed and cannot retake - give them access to results
      const session = await startAssessmentSession(
        validation.code.id,
        userAgent,
        ipAddress
      );

      return NextResponse.json({
        valid: true,
        sessionToken: session.token,
        hasCompletedSession: true,
        canRetake: false,
        cohortName: cohort?.name || 'Unknown',
      });
    }

    if (hasCompletedSession && validation.error) {
      // User completed but has a retake restriction (cooldown, max attempts)
      const session = await startAssessmentSession(
        validation.code.id,
        userAgent,
        ipAddress
      );

      return NextResponse.json({
        valid: true,
        sessionToken: session.token,
        hasCompletedSession: true,
        canRetake: false,
        retakeError: validation.error,
        cohortName: cohort?.name || 'Unknown',
      });
    }

    // Start or resume session
    const { session, token: sessionToken, isNew } = await startAssessmentSession(
      validation.code.id,
      userAgent,
      ipAddress
    );

    // Log audit event for new sessions
    if (isNew) {
      await AuditEvents.assessmentStarted(
        validation.code.id,
        session!.id,
        validation.code.cohortId
      );
    }

    return NextResponse.json({
      valid: true,
      sessionToken,
      hasCompletedSession: hasCompletedSession || false,
      canRetake: cohort?.allowRetakes || false,
      previousAttempts: validation.code.timesUsed,
      cohortName: cohort?.name || 'Unknown',
      isResuming: !isNew && !hasCompletedSession,
      currentProgress: session!.isComplete
        ? null
        : {
            areaIndex: session!.currentAreaIndex,
          },
    });
  } catch (error) {
    console.error('Error validating assessment code:', error);
    return NextResponse.json(
      { error: 'Failed to validate assessment code' },
      { status: 500 }
    );
  }
}
