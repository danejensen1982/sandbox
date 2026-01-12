import { NextRequest, NextResponse } from 'next/server';
import { validateAssessmentCode, startAssessmentSession } from '@/lib/auth/assessment-code';
import { createAssessmentToken } from '@/lib/auth/jwt';
import { hash } from '@/lib/auth/encryption';
import { AuditEvents } from '@/lib/audit/logger';
import { headers } from 'next/headers';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, token, forceNewSession } = body;

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

    // Handle retake request
    if (forceNewSession && hasCompletedSession) {
      // Check if retakes are allowed
      if (!cohort?.allowRetakes) {
        return NextResponse.json(
          { error: 'Retaking this assessment is not allowed' },
          { status: 403 }
        );
      }

      // Check for retake restrictions
      if (validation.error) {
        return NextResponse.json(
          { error: validation.error },
          { status: 403 }
        );
      }

      // Create a brand new session for retake
      const { session, token: sessionToken } = await startNewRetakeSession(
        validation.code.id,
        userAgent,
        ipAddress
      );

      await AuditEvents.assessmentStarted(
        validation.code.id,
        session!.id,
        validation.code.cohortId
      );

      return NextResponse.json({
        valid: true,
        sessionToken,
        isRetake: true,
        cohortName: cohort?.name || 'Unknown',
      });
    }

    if (hasCompletedSession && !cohort?.allowRetakes) {
      // User has completed and cannot retake - give them access to results
      // Create token for the completed session directly (don't create new session)
      const sessionToken = await createAssessmentToken({
        codeId: validation.code.id,
        sessionId: validation.completedSession!.id,
        cohortId: validation.code.cohortId,
      });

      return NextResponse.json({
        valid: true,
        sessionToken,
        hasCompletedSession: true,
        canRetake: false,
        cohortName: cohort?.name || 'Unknown',
      });
    }

    if (hasCompletedSession && validation.error) {
      // User completed but has a retake restriction (cooldown, max attempts)
      // Create token for the completed session directly (don't create new session)
      const sessionToken = await createAssessmentToken({
        codeId: validation.code.id,
        sessionId: validation.completedSession!.id,
        cohortId: validation.code.cohortId,
      });

      return NextResponse.json({
        valid: true,
        sessionToken,
        hasCompletedSession: true,
        canRetake: false,
        retakeError: validation.error,
        cohortName: cohort?.name || 'Unknown',
      });
    }

    // User has completed but CAN retake - show them the choice
    if (hasCompletedSession && cohort?.allowRetakes && !validation.error) {
      // Create token for the completed session directly (don't create new session)
      const sessionToken = await createAssessmentToken({
        codeId: validation.code.id,
        sessionId: validation.completedSession!.id,
        cohortId: validation.code.cohortId,
      });

      return NextResponse.json({
        valid: true,
        sessionToken,
        hasCompletedSession: true,
        canRetake: true,
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

/**
 * Start a completely new session for a retake (bypasses existing session check)
 */
async function startNewRetakeSession(
  assessmentCodeId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{
  session: Awaited<ReturnType<typeof prisma.assessmentSession.create>>;
  token: string;
}> {
  // Get the latest attempt number
  const lastSession = await prisma.assessmentSession.findFirst({
    where: { assessmentCodeId },
    orderBy: { attemptNumber: 'desc' },
  });

  const attemptNumber = (lastSession?.attemptNumber || 0) + 1;

  // Create new session
  const session = await prisma.assessmentSession.create({
    data: {
      assessmentCodeId,
      attemptNumber,
      userAgent,
      ipAddressHash: ipAddress ? hash(ipAddress) : null,
    },
  });

  // Update assessment code access timestamps
  await prisma.assessmentCode.update({
    where: { id: assessmentCodeId },
    data: {
      lastAccessedAt: new Date(),
      status: 'started',
    },
  });

  // Get cohort for token
  const assessmentCode = await prisma.assessmentCode.findUnique({
    where: { id: assessmentCodeId },
    select: { cohortId: true },
  });

  // Create JWT token
  const token = await createAssessmentToken({
    codeId: assessmentCodeId,
    sessionId: session.id,
    cohortId: assessmentCode!.cohortId,
  });

  return { session, token };
}
