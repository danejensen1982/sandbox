import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth/assessment-code';
import { calculateScores, storeScores } from '@/lib/scoring/engine';
import { AuditEvents } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
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

    // Check if already completed
    if (session.isComplete) {
      return NextResponse.json({
        success: true,
        alreadyComplete: true,
      });
    }

    // Calculate scores
    const scores = await calculateScores(session.id);

    // Store scores
    await storeScores(session.id, scores);

    // Log audit event
    await AuditEvents.assessmentCompleted(
      payload.codeId,
      session.id,
      payload.cohortId
    );

    return NextResponse.json({
      success: true,
      resultsAvailable: true,
    });
  } catch (error) {
    console.error('Error completing assessment:', error);
    return NextResponse.json({ error: 'Failed to complete assessment' }, { status: 500 });
  }
}
