import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken, startAssessmentSession } from '@/lib/auth/assessment-code';
import prisma from '@/lib/db';

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

    // Check if starting a new attempt
    const body = await request.json().catch(() => ({}));
    const startNew = body.startNew === true;

    let currentSession = session;

    if (startNew && session.isComplete) {
      // Start a new session (retake)
      const userAgent = request.headers.get('user-agent') || undefined;
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        undefined;

      const { session: newSession } = await startAssessmentSession(
        payload.codeId,
        userAgent,
        ipAddress
      );
      currentSession = newSession!;
    }

    // Get all active resilience areas
    const areas = await prisma.resilienceArea.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: {
            questions: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    // Format areas for response
    const formattedAreas = areas.map((area) => ({
      id: area.id,
      slug: area.slug,
      name: area.name,
      description: area.description,
      questionCount: area._count.questions,
    }));

    // Get existing responses for this session
    const existingResponses = await prisma.response.findMany({
      where: { assessmentSessionId: currentSession.id },
    });

    const responsesMap: Record<string, number> = {};
    existingResponses.forEach((r) => {
      responsesMap[r.questionId] = r.responseValue;
    });

    // Check if there are any active demographic questions
    const demographicQuestionCount = await prisma.demographicQuestion.count({
      where: { isActive: true },
    });

    return NextResponse.json({
      sessionId: currentSession.id,
      areas: formattedAreas,
      currentProgress: {
        areaIndex: currentSession.currentAreaIndex,
      },
      existingResponses: responsesMap,
      isComplete: currentSession.isComplete,
      demographicsCompleted: currentSession.demographicsCompleted,
      hasDemographics: demographicQuestionCount > 0,
    });
  } catch (error) {
    console.error('Error starting assessment:', error);
    return NextResponse.json({ error: 'Failed to start assessment' }, { status: 500 });
  }
}
