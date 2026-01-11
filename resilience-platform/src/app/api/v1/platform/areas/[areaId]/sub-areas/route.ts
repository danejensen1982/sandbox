import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/sub-areas - List sub-areas for an area
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

    const subAreas = await prisma.subArea.findMany({
      where: { resilienceAreaId: areaId },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { questions: true },
        },
        scoreRanges: {
          orderBy: { minScore: 'asc' },
        },
      },
    });

    return NextResponse.json({ subAreas });
  } catch (error) {
    console.error('Error fetching sub-areas:', error);
    return NextResponse.json({ error: 'Failed to fetch sub-areas' }, { status: 500 });
  }
}

// POST /api/v1/platform/areas/[areaId]/sub-areas - Create a new sub-area
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
    const { name, description, colorHex, questionIds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Check for existing slug and make unique if needed
    let slug = baseSlug;
    let counter = 1;
    while (
      await prisma.subArea.findUnique({
        where: { resilienceAreaId_slug: { resilienceAreaId: areaId, slug } },
      })
    ) {
      slug = `${baseSlug}_${counter}`;
      counter++;
    }

    // Get the next display order
    const lastSubArea = await prisma.subArea.findFirst({
      where: { resilienceAreaId: areaId },
      orderBy: { displayOrder: 'desc' },
    });

    const nextDisplayOrder = (lastSubArea?.displayOrder || 0) + 1;

    // Validate questionIds if provided
    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (questionIds.some((id: string) => !UUID_REGEX.test(id))) {
        return NextResponse.json({ error: 'Invalid question ID format' }, { status: 400 });
      }

      // Verify all questions belong to this area
      const validCount = await prisma.question.count({
        where: { id: { in: questionIds }, resilienceAreaId: areaId },
      });
      if (validCount !== questionIds.length) {
        return NextResponse.json({ error: 'Some questions do not belong to this area' }, { status: 400 });
      }
    }

    // Create the sub-area and question assignments in a transaction
    const subArea = await prisma.$transaction(async (tx) => {
      // Create the sub-area
      const created = await tx.subArea.create({
        data: {
          resilienceAreaId: areaId,
          slug,
          name: name.trim(),
          description: description?.trim() || null,
          colorHex: colorHex || null,
          displayOrder: nextDisplayOrder,
        },
      });

      // Create question assignments if provided
      if (Array.isArray(questionIds) && questionIds.length > 0) {
        await tx.questionSubArea.createMany({
          data: questionIds.map((questionId: string) => ({
            questionId,
            subAreaId: created.id,
          })),
        });
      }

      return created;
    });

    await logAuditEvent({
      eventType: 'sub_area_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'sub_area',
      targetId: subArea.id,
      eventDescription: `Created sub-area "${subArea.name}" in area "${area.name}"`,
      eventData: { areaId, subAreaId: subArea.id, name: subArea.name, questionCount: questionIds?.length },
    });

    return NextResponse.json({ subArea });
  } catch (error) {
    console.error('Error creating sub-area:', error);
    return NextResponse.json({ error: 'Failed to create sub-area' }, { status: 500 });
  }
}

// PATCH /api/v1/platform/areas/[areaId]/sub-areas - Reorder sub-areas
export async function PATCH(
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
    const { orderedIds } = body;

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
    }

    // Verify area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Update display order using two-pass to avoid unique constraint issues
    await prisma.$transaction(async (tx) => {
      // First pass: set to temporary high values
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.subArea.update({
          where: { id: orderedIds[i] },
          data: { displayOrder: 10000 + i },
        });
      }
      // Second pass: set to final values
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.subArea.update({
          where: { id: orderedIds[i] },
          data: { displayOrder: i + 1 },
        });
      }
    });

    await logAuditEvent({
      eventType: 'sub_areas_reordered',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: areaId,
      eventDescription: `Reordered sub-areas in area "${area.name}"`,
      eventData: { areaId, subAreaCount: orderedIds.length },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering sub-areas:', error);
    return NextResponse.json({ error: 'Failed to reorder sub-areas' }, { status: 500 });
  }
}
