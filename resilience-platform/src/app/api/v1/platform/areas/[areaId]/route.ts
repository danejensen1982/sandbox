import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId] - Get a single resilience area
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

    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    return NextResponse.json({ area });
  } catch (error) {
    console.error('Error fetching area:', error);
    return NextResponse.json({ error: 'Failed to fetch area' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId] - Update a resilience area
export async function PUT(
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
    const { name, slug, description, iconName, colorHex, displayOrder, isActive } = body;

    // Validate required fields
    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check if area exists
    const existingArea = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!existingArea) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Check for slug uniqueness (excluding current area)
    const slugExists = await prisma.resilienceArea.findFirst({
      where: {
        slug: slug.trim(),
        NOT: { id: areaId },
      },
    });

    if (slugExists) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
    }

    // Update the area
    const area = await prisma.resilienceArea.update({
      where: { id: areaId },
      data: {
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        iconName: iconName?.trim() || null,
        colorHex: colorHex || null,
        displayOrder: displayOrder || existingArea.displayOrder,
        isActive: isActive ?? existingArea.isActive,
      },
    });

    await logAuditEvent({
      eventType: 'resilience_area_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: area.id,
      eventDescription: `Updated resilience area "${area.name}"`,
      eventData: { areaName: area.name },
    });

    return NextResponse.json({ area });
  } catch (error) {
    console.error('Error updating area:', error);
    return NextResponse.json({ error: 'Failed to update area' }, { status: 500 });
  }
}

// DELETE /api/v1/platform/areas/[areaId] - Delete a resilience area
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId } = await params;

    // Check if area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
      include: {
        _count: {
          select: { questions: true },
        },
        questions: {
          include: {
            _count: {
              select: { responses: true },
            },
          },
        },
      },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Check if any questions have responses
    const hasResponses = area.questions.some((q) => q._count.responses > 0);

    if (hasResponses) {
      // Soft delete - just mark as inactive
      await prisma.resilienceArea.update({
        where: { id: areaId },
        data: { isActive: false },
      });

      await logAuditEvent({
        eventType: 'resilience_area_deactivated',
        eventCategory: 'configuration',
        actorType: 'admin',
        actorId: admin.id,
        targetType: 'resilience_area',
        targetId: area.id,
        eventDescription: `Deactivated resilience area "${area.name}" (has existing responses)`,
        eventData: { areaName: area.name },
      });

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: 'Area deactivated (has existing assessment responses)'
      });
    }

    // Hard delete - remove the area and all related data
    await prisma.$transaction([
      // Delete feedback content for score ranges
      prisma.feedbackContent.deleteMany({
        where: { scoreRange: { resilienceAreaId: areaId } },
      }),
      // Delete score ranges
      prisma.scoreRange.deleteMany({
        where: { resilienceAreaId: areaId },
      }),
      // Delete questions
      prisma.question.deleteMany({
        where: { resilienceAreaId: areaId },
      }),
      // Delete the area
      prisma.resilienceArea.delete({
        where: { id: areaId },
      }),
    ]);

    await logAuditEvent({
      eventType: 'resilience_area_deleted',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: areaId,
      eventDescription: `Deleted resilience area "${area.name}"`,
      eventData: { areaName: area.name },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error deleting area:', error);
    return NextResponse.json({ error: 'Failed to delete area' }, { status: 500 });
  }
}
