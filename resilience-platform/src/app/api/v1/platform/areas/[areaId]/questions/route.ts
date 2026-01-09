import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/questions - List questions for an area
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId } = await params;

    const questions = await prisma.question.findMany({
      where: { resilienceAreaId: areaId },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST /api/v1/platform/areas/[areaId]/questions - Create a new question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId } = await params;
    const body = await request.json();
    const { questionText, helpText, weight, isReverseScored, isActive } = body;

    if (!questionText?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    // Check area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Get the next display order
    const lastQuestion = await prisma.question.findFirst({
      where: { resilienceAreaId: areaId },
      orderBy: { displayOrder: 'desc' },
    });

    const nextDisplayOrder = (lastQuestion?.displayOrder || 0) + 1;

    // Create the question
    const question = await prisma.question.create({
      data: {
        resilienceAreaId: areaId,
        questionText: questionText.trim(),
        questionType: 'likert_5',
        displayOrder: nextDisplayOrder,
        isReverseScored: isReverseScored || false,
        weight: weight || 1,
        helpText: helpText?.trim() || null,
        isActive: isActive ?? true,
      },
    });

    await logAuditEvent({
      eventType: 'question_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'question',
      targetId: question.id,
      eventDescription: `Created question for area "${area.name}"`,
      eventData: { areaId, questionText: questionText.substring(0, 50) },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}
