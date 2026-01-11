import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId] - Get a single sub-area
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; subAreaId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subAreaId } = await params;

    const subArea = await prisma.subArea.findUnique({
      where: { id: subAreaId },
      include: {
        _count: {
          select: { questions: true },
        },
        scoreRanges: {
          orderBy: { minScore: 'asc' },
        },
        questions: {
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                displayOrder: true,
              },
            },
          },
        },
      },
    });

    if (!subArea) {
      return NextResponse.json({ error: 'Sub-area not found' }, { status: 404 });
    }

    return NextResponse.json({ subArea });
  } catch (error) {
    console.error('Error fetching sub-area:', error);
    return NextResponse.json({ error: 'Failed to fetch sub-area' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId] - Update a sub-area
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; subAreaId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, subAreaId } = await params;
    const body = await request.json();
    const { name, description, colorHex, isActive, questionIds } = body;

    const existingSubArea = await prisma.subArea.findUnique({
      where: { id: subAreaId },
    });

    if (!existingSubArea) {
      return NextResponse.json({ error: 'Sub-area not found' }, { status: 404 });
    }

    // If name changed, update slug
    let slug = existingSubArea.slug;
    if (name && name.trim() !== existingSubArea.name) {
      const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      slug = baseSlug;
      let counter = 1;
      while (
        await prisma.subArea.findFirst({
          where: {
            resilienceAreaId: areaId,
            slug,
            id: { not: subAreaId },
          },
        })
      ) {
        slug = `${baseSlug}_${counter}`;
        counter++;
      }
    }

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

    // Use a transaction if we're also updating question assignments
    const subArea = await prisma.$transaction(async (tx) => {
      // Update sub-area fields
      const updated = await tx.subArea.update({
        where: { id: subAreaId },
        data: {
          name: name?.trim() || existingSubArea.name,
          slug,
          description: description !== undefined ? (description?.trim() || null) : existingSubArea.description,
          colorHex: colorHex !== undefined ? (colorHex || null) : existingSubArea.colorHex,
          isActive: isActive !== undefined ? isActive : existingSubArea.isActive,
        },
      });

      // Update question assignments if provided
      if (Array.isArray(questionIds)) {
        // Delete existing assignments
        await tx.questionSubArea.deleteMany({
          where: { subAreaId },
        });

        // Create new assignments
        if (questionIds.length > 0) {
          await tx.questionSubArea.createMany({
            data: questionIds.map((questionId: string) => ({
              questionId,
              subAreaId,
            })),
          });
        }
      }

      return updated;
    });

    await logAuditEvent({
      eventType: 'sub_area_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'sub_area',
      targetId: subAreaId,
      eventDescription: `Updated sub-area "${subArea.name}"`,
      eventData: { areaId, subAreaId, questionCount: questionIds?.length },
    });

    return NextResponse.json({ subArea });
  } catch (error) {
    console.error('Error updating sub-area:', error);
    return NextResponse.json({ error: 'Failed to update sub-area' }, { status: 500 });
  }
}

// DELETE /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId] - Delete a sub-area
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; subAreaId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, subAreaId } = await params;

    const subArea = await prisma.subArea.findUnique({
      where: { id: subAreaId },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!subArea) {
      return NextResponse.json({ error: 'Sub-area not found' }, { status: 404 });
    }

    // If has question assignments, just deactivate
    if (subArea._count.questions > 0) {
      await prisma.subArea.update({
        where: { id: subAreaId },
        data: { isActive: false },
      });

      await logAuditEvent({
        eventType: 'sub_area_deactivated',
        eventCategory: 'configuration',
        actorType: 'admin',
        actorId: admin.id,
        targetType: 'sub_area',
        targetId: subAreaId,
        eventDescription: `Deactivated sub-area "${subArea.name}" (has question assignments)`,
        eventData: { areaId, subAreaId, questionCount: subArea._count.questions },
      });

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: 'Sub-area deactivated (has question assignments)',
      });
    }

    // Hard delete if no assignments
    await prisma.subArea.delete({
      where: { id: subAreaId },
    });

    await logAuditEvent({
      eventType: 'sub_area_deleted',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'sub_area',
      targetId: subAreaId,
      eventDescription: `Deleted sub-area "${subArea.name}"`,
      eventData: { areaId, subAreaId },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error deleting sub-area:', error);
    return NextResponse.json({ error: 'Failed to delete sub-area' }, { status: 500 });
  }
}
