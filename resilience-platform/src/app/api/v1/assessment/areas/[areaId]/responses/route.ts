import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth/assessment-code';
import prisma from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const { areaId } = await params;

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token and get session
    const { valid, session } = await getSessionFromToken(token);

    if (!valid || !session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { responses } = body as { responses: Record<string, number> };

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Invalid responses format' }, { status: 400 });
    }

    // Get questions for this area to validate
    const questions = await prisma.question.findMany({
      where: {
        resilienceAreaId: areaId,
        isActive: true,
      },
      select: { id: true, questionType: true },
    });

    const questionIds = new Set(questions.map((q) => q.id));
    const questionTypeMap = new Map(questions.map((q) => [q.id, q.questionType]));

    // Validate responses
    for (const [questionId, value] of Object.entries(responses)) {
      if (!questionIds.has(questionId)) {
        return NextResponse.json(
          { error: `Invalid question ID: ${questionId}` },
          { status: 400 }
        );
      }

      const questionType = questionTypeMap.get(questionId);
      const maxValue = questionType === 'likert_7' ? 7 : 5;

      if (typeof value !== 'number' || value < 1 || value > maxValue) {
        return NextResponse.json(
          { error: `Invalid response value for question ${questionId}` },
          { status: 400 }
        );
      }
    }

    // Save responses (upsert to handle resuming)
    await prisma.$transaction(
      Object.entries(responses).map(([questionId, value]) =>
        prisma.response.upsert({
          where: {
            assessmentSessionId_questionId: {
              assessmentSessionId: session.id,
              questionId,
            },
          },
          update: {
            responseValue: value,
          },
          create: {
            assessmentSessionId: session.id,
            questionId,
            responseValue: value,
          },
        })
      )
    );

    // Get all areas to determine if this is the last one
    const areas = await prisma.resilienceArea.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const currentAreaIndex = areas.findIndex((a) => a.id === areaId);
    const isLastArea = currentAreaIndex === areas.length - 1;

    // Update session progress
    await prisma.assessmentSession.update({
      where: { id: session.id },
      data: {
        currentAreaIndex: isLastArea ? currentAreaIndex : currentAreaIndex + 1,
      },
    });

    return NextResponse.json({
      saved: true,
      nextAreaId: isLastArea ? null : areas[currentAreaIndex + 1]?.id,
      isComplete: isLastArea,
    });
  } catch (error) {
    console.error('Error saving responses:', error);
    return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 });
  }
}
