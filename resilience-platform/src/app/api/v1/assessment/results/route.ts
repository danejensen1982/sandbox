import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth/assessment-code';
import { getStoredResults } from '@/lib/scoring/engine';
import { AuditEvents } from '@/lib/audit/logger';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token and get session
    const { valid, payload, session } = await getSessionFromToken(token);

    if (!valid || !payload || !session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Find the most recent completed session for this code
    let completedSession = session;

    if (!session.isComplete) {
      // Try to find a completed session for this code
      const latestCompleted = await prisma.assessmentSession.findFirst({
        where: {
          assessmentCodeId: payload.codeId,
          isComplete: true,
        },
        orderBy: { completedAt: 'desc' },
      });

      if (!latestCompleted) {
        return NextResponse.json(
          { error: 'No completed assessment found. Please complete the assessment first.' },
          { status: 404 }
        );
      }

      completedSession = latestCompleted;
    }

    // Get results
    const results = await getStoredResults(completedSession.id);

    if (!results) {
      return NextResponse.json(
        { error: 'Results not available. Please complete the assessment.' },
        { status: 404 }
      );
    }

    // Get cohort name
    const cohort = await prisma.cohort.findUnique({
      where: { id: payload.cohortId },
      select: { name: true },
    });

    // Log audit event
    await AuditEvents.resultsViewed(payload.codeId, completedSession.id);

    return NextResponse.json({
      results,
      completedAt: completedSession.completedAt?.toISOString(),
      cohortName: cohort?.name || 'Assessment',
    });
  } catch (error) {
    console.error('Error getting results:', error);
    return NextResponse.json({ error: 'Failed to get results' }, { status: 500 });
  }
}
