import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/questions/[questionId] - Get a question with sub-areas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; questionId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, questionId } = await params;

    const question = await prisma.question.findFirst({
      where: { id: questionId, resilienceAreaId: areaId },
      include: {
        subAreas: {
          include: {
            subArea: {
              select: {
                id: true,
                name: true,
                slug: true,
                colorHex: true,
              },
            },
          },
        },
      },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId]/questions/[questionId] - Update a question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; questionId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, questionId } = await params;
    const body = await request.json();
    const { questionText, helpText, weight, isReverseScored, isActive, displayOrder, subAreaIds } = body;

    if (!questionText?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    // Check question exists
    const existingQuestion = await prisma.question.findFirst({
      where: { id: questionId, resilienceAreaId: areaId },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Update the question and sub-area assignments in a transaction
    const question = await prisma.$transaction(async (tx) => {
      // Update the question
      const updatedQuestion = await tx.question.update({
        where: { id: questionId },
        data: {
          questionText: questionText.trim(),
          helpText: helpText?.trim() || null,
          weight: weight ?? existingQuestion.weight,
          isReverseScored: isReverseScored ?? existingQuestion.isReverseScored,
          isActive: isActive ?? existingQuestion.isActive,
          displayOrder: displayOrder ?? existingQuestion.displayOrder,
        },
      });

      // Update sub-area assignments if provided
      if (Array.isArray(subAreaIds)) {
        // Delete existing assignments
        await tx.questionSubArea.deleteMany({
          where: { questionId },
        });

        // Create new assignments
        if (subAreaIds.length > 0) {
          await tx.questionSubArea.createMany({
            data: subAreaIds.map((subAreaId: string) => ({
              questionId,
              subAreaId,
            })),
          });
        }
      }

      // Fetch the updated question with sub-areas
      return tx.question.findUnique({
        where: { id: questionId },
        include: {
          subAreas: {
            include: {
              subArea: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  colorHex: true,
                },
              },
            },
          },
        },
      });
    });

    await logAuditEvent({
      eventType: 'question_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'question',
      targetId: questionId,
      eventDescription: `Updated question`,
      eventData: { areaId, questionText: questionText.substring(0, 50), subAreaIds },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

// DELETE /api/v1/platform/areas/[areaId]/questions/[questionId] - Delete a question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; questionId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, questionId } = await params;

    // Check question exists
    const existingQuestion = await prisma.question.findFirst({
      where: { id: questionId, resilienceAreaId: areaId },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Check if question has responses
    const responsesCount = await prisma.response.count({
      where: { questionId },
    });

    if (responsesCount > 0) {
      // Soft delete - just deactivate
      await prisma.question.update({
        where: { id: questionId },
        data: { isActive: false },
      });

      await logAuditEvent({
        eventType: 'question_deactivated',
        eventCategory: 'configuration',
        actorType: 'admin',
        actorId: admin.id,
        targetType: 'question',
        targetId: questionId,
        eventDescription: `Deactivated question (has ${responsesCount} responses)`,
        eventData: { areaId, responsesCount },
      });

      return NextResponse.json({
        success: true,
        message: 'Question deactivated (has existing responses)',
      });
    }

    // Hard delete if no responses
    await prisma.question.delete({
      where: { id: questionId },
    });

    await logAuditEvent({
      eventType: 'question_deleted',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'question',
      targetId: questionId,
      eventDescription: `Deleted question`,
      eventData: { areaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
