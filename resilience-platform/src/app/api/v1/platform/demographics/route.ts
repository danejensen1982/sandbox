import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/demographics - List all demographic questions
export async function GET() {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questions = await prisma.demographicQuestion.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching demographic questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST /api/v1/platform/demographics - Create a new demographic question
export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { questionText, questionType = 'select', isRequired = true, helpText, options = [] } = body;

    if (!questionText?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    // Generate slug from question text
    const slug = questionText
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    // Check if slug exists and make unique if needed
    let finalSlug = slug;
    let counter = 1;
    while (await prisma.demographicQuestion.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}_${counter}`;
      counter++;
    }

    // Get highest display order
    const maxOrder = await prisma.demographicQuestion.aggregate({
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder || 0) + 1;

    // Create question with options in a transaction
    const question = await prisma.$transaction(async (tx) => {
      const q = await tx.demographicQuestion.create({
        data: {
          slug: finalSlug,
          questionText: questionText.trim(),
          questionType,
          isRequired,
          helpText: helpText?.trim() || null,
          displayOrder: nextOrder,
          isActive: true,
        },
      });

      // Create options if provided
      if (options.length > 0) {
        await tx.demographicOption.createMany({
          data: options.map((opt: { value: string; label: string }, index: number) => ({
            questionId: q.id,
            value: opt.value,
            label: opt.label,
            displayOrder: index + 1,
            isActive: true,
          })),
        });
      }

      return tx.demographicQuestion.findUnique({
        where: { id: q.id },
        include: {
          options: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    });

    await logAuditEvent({
      eventType: 'demographic_question_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'demographic_question',
      targetId: question!.id,
      eventDescription: `Created demographic question "${questionText}"`,
      eventData: { questionText, questionType, optionCount: options.length },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error('Error creating demographic question:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}

// PATCH /api/v1/platform/demographics - Reorder demographic questions
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
    }

    // Update display order for each question in a transaction
    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.demographicQuestion.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    await logAuditEvent({
      eventType: 'demographic_questions_reordered',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'demographic_question',
      targetId: 'bulk',
      eventDescription: 'Reordered demographic questions',
      eventData: { orderedIds },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering demographic questions:', error);
    return NextResponse.json({ error: 'Failed to reorder questions' }, { status: 500 });
  }
}
