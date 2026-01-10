import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/demographics/[questionId] - Get a single question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;

    const question = await prisma.demographicQuestion.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error fetching demographic question:', error);
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
  }
}

// PUT /api/v1/platform/demographics/[questionId] - Update a question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;
    const body = await request.json();
    const { questionText, questionType, isRequired, helpText, isActive, options } = body;

    const existingQuestion = await prisma.demographicQuestion.findUnique({
      where: { id: questionId },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Update question and options in a transaction
    const question = await prisma.$transaction(async (tx) => {
      // Update the question
      const q = await tx.demographicQuestion.update({
        where: { id: questionId },
        data: {
          questionText: questionText?.trim() || existingQuestion.questionText,
          questionType: questionType || existingQuestion.questionType,
          isRequired: isRequired ?? existingQuestion.isRequired,
          helpText: helpText !== undefined ? (helpText?.trim() || null) : existingQuestion.helpText,
          isActive: isActive ?? existingQuestion.isActive,
        },
      });

      // Update options if provided
      if (options && Array.isArray(options)) {
        // Get existing option IDs
        const existingOptions = await tx.demographicOption.findMany({
          where: { questionId },
        });
        const existingOptionIds = existingOptions.map((o) => o.id);
        const newOptionIds = options.filter((o: { id?: string }) => o.id).map((o: { id: string }) => o.id);

        // Delete removed options
        const toDelete = existingOptionIds.filter((id) => !newOptionIds.includes(id));
        if (toDelete.length > 0) {
          await tx.demographicOption.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        // Update or create options
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.id) {
            // Update existing
            await tx.demographicOption.update({
              where: { id: opt.id },
              data: {
                value: opt.value,
                label: opt.label,
                displayOrder: i + 1,
                isActive: opt.isActive ?? true,
              },
            });
          } else {
            // Create new
            await tx.demographicOption.create({
              data: {
                questionId,
                value: opt.value,
                label: opt.label,
                displayOrder: i + 1,
                isActive: true,
              },
            });
          }
        }
      }

      return tx.demographicQuestion.findUnique({
        where: { id: questionId },
        include: {
          options: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    });

    await logAuditEvent({
      eventType: 'demographic_question_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'demographic_question',
      targetId: questionId,
      eventDescription: `Updated demographic question "${question!.questionText}"`,
      eventData: { questionId },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error updating demographic question:', error);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

// DELETE /api/v1/platform/demographics/[questionId] - Delete a question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await params;

    const question = await prisma.demographicQuestion.findUnique({
      where: { id: questionId },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // If has responses, soft delete
    if (question._count.responses > 0) {
      await prisma.demographicQuestion.update({
        where: { id: questionId },
        data: { isActive: false },
      });

      await logAuditEvent({
        eventType: 'demographic_question_deactivated',
        eventCategory: 'configuration',
        actorType: 'admin',
        actorId: admin.id,
        targetType: 'demographic_question',
        targetId: questionId,
        eventDescription: `Deactivated demographic question "${question.questionText}" (has responses)`,
        eventData: { questionId, responseCount: question._count.responses },
      });

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: 'Question deactivated (has existing responses)',
      });
    }

    // Hard delete if no responses
    await prisma.$transaction([
      prisma.demographicOption.deleteMany({ where: { questionId } }),
      prisma.demographicQuestion.delete({ where: { id: questionId } }),
    ]);

    await logAuditEvent({
      eventType: 'demographic_question_deleted',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'demographic_question',
      targetId: questionId,
      eventDescription: `Deleted demographic question "${question.questionText}"`,
      eventData: { questionId },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error deleting demographic question:', error);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
