import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth/assessment-code';
import prisma from '@/lib/db';

// GET /api/v1/assessment/demographics - Get demographic questions
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { valid, session } = await getSessionFromToken(token);

    if (!valid || !session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Get active demographic questions with options
    const questions = await prisma.demographicQuestion.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            value: true,
            label: true,
          },
        },
      },
    });

    // Get existing demographic responses for this session
    const existingResponses = await prisma.demographicResponse.findMany({
      where: { assessmentSessionId: session.id },
    });

    const responsesMap: Record<string, string | null> = {};
    existingResponses.forEach((r) => {
      responsesMap[r.questionId] = r.optionId || r.textValue || null;
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        slug: q.slug,
        questionText: q.questionText,
        questionType: q.questionType,
        isRequired: q.isRequired,
        helpText: q.helpText,
        options: q.options,
      })),
      existingResponses: responsesMap,
      demographicsCompleted: session.demographicsCompleted,
    });
  } catch (error) {
    console.error('Error fetching demographic questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST /api/v1/assessment/demographics - Submit demographic responses
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { valid, session } = await getSessionFromToken(token);

    if (!valid || !session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const body = await request.json();
    const { responses } = body;

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Responses object is required' }, { status: 400 });
    }

    // Get all active questions to validate
    const questions = await prisma.demographicQuestion.findMany({
      where: { isActive: true },
      include: {
        options: { where: { isActive: true } },
      },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Validate required questions
    for (const question of questions) {
      if (question.isRequired) {
        const response = responses[question.id];
        // Allow explicit null/undefined for "prefer not to answer" on required questions
        // But if response is provided, it must be valid
        if (response !== undefined && response !== null && response !== '') {
          // Validate the response is a valid option
          if (question.questionType === 'select') {
            const validOption = question.options.some((o) => o.id === response);
            if (!validOption) {
              return NextResponse.json(
                { error: `Invalid option for question: ${question.questionText}` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // Save responses in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing responses for this session
      await tx.demographicResponse.deleteMany({
        where: { assessmentSessionId: session.id },
      });

      // Create new responses
      const responseData = Object.entries(responses)
        .filter(([questionId]) => questionMap.has(questionId))
        .map(([questionId, value]) => {
          const question = questionMap.get(questionId)!;

          // Handle "prefer not to say" - represented as null or empty string
          if (value === null || value === '' || value === 'prefer_not_to_say') {
            return {
              assessmentSessionId: session.id,
              questionId,
              optionId: null,
              textValue: null,
            };
          }

          if (question.questionType === 'text') {
            return {
              assessmentSessionId: session.id,
              questionId,
              optionId: null,
              textValue: String(value),
            };
          }

          // For select/multiselect, value is the option ID
          return {
            assessmentSessionId: session.id,
            questionId,
            optionId: String(value),
            textValue: null,
          };
        });

      if (responseData.length > 0) {
        await tx.demographicResponse.createMany({ data: responseData });
      }

      // Mark demographics as completed
      await tx.assessmentSession.update({
        where: { id: session.id },
        data: { demographicsCompleted: true },
      });
    });

    return NextResponse.json({ success: true, demographicsCompleted: true });
  } catch (error) {
    console.error('Error saving demographic responses:', error);
    return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 });
  }
}
