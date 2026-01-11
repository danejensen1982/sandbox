import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId]/scoring - Get score ranges
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

    const scoreRanges = await prisma.subAreaScoreRange.findMany({
      where: { subAreaId },
      orderBy: { minScore: 'asc' },
    });

    return NextResponse.json({ scoreRanges });
  } catch (error) {
    console.error('Error fetching sub-area score ranges:', error);
    return NextResponse.json({ error: 'Failed to fetch score ranges' }, { status: 500 });
  }
}

// POST /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId]/scoring - Create score range
export async function POST(
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
    const { minScore, maxScore, levelName, levelCode, colorHex } = body;

    if (minScore === undefined || maxScore === undefined) {
      return NextResponse.json({ error: 'minScore and maxScore are required' }, { status: 400 });
    }

    if (!levelName?.trim() || !levelCode?.trim()) {
      return NextResponse.json({ error: 'levelName and levelCode are required' }, { status: 400 });
    }

    // Verify sub-area exists
    const subArea = await prisma.subArea.findUnique({
      where: { id: subAreaId },
    });

    if (!subArea) {
      return NextResponse.json({ error: 'Sub-area not found' }, { status: 404 });
    }

    const scoreRange = await prisma.subAreaScoreRange.create({
      data: {
        subAreaId,
        minScore,
        maxScore,
        levelName: levelName.trim(),
        levelCode: levelCode.trim().toLowerCase(),
        colorHex: colorHex || null,
      },
    });

    await logAuditEvent({
      eventType: 'sub_area_score_range_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'sub_area_score_range',
      targetId: scoreRange.id,
      eventDescription: `Created score range "${scoreRange.levelName}" for sub-area "${subArea.name}"`,
      eventData: { areaId, subAreaId, levelName: scoreRange.levelName, minScore, maxScore },
    });

    return NextResponse.json({ scoreRange }, { status: 201 });
  } catch (error) {
    console.error('Error creating sub-area score range:', error);
    return NextResponse.json({ error: 'Failed to create score range' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId]/scoring - Bulk update score ranges
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
    const { scoreRanges } = body;

    if (!Array.isArray(scoreRanges)) {
      return NextResponse.json({ error: 'scoreRanges array is required' }, { status: 400 });
    }

    // Verify sub-area exists
    const subArea = await prisma.subArea.findUnique({
      where: { id: subAreaId },
    });

    if (!subArea) {
      return NextResponse.json({ error: 'Sub-area not found' }, { status: 404 });
    }

    // Delete existing ranges and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing ranges
      await tx.subAreaScoreRange.deleteMany({
        where: { subAreaId },
      });

      // Create new ranges
      for (const range of scoreRanges) {
        await tx.subAreaScoreRange.create({
          data: {
            subAreaId,
            minScore: range.minScore,
            maxScore: range.maxScore,
            levelName: range.levelName.trim(),
            levelCode: range.levelCode.trim().toLowerCase(),
            colorHex: range.colorHex || null,
          },
        });
      }
    });

    await logAuditEvent({
      eventType: 'sub_area_score_ranges_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'sub_area',
      targetId: subAreaId,
      eventDescription: `Updated score ranges for sub-area "${subArea.name}"`,
      eventData: { areaId, subAreaId, rangeCount: scoreRanges.length },
    });

    // Fetch updated ranges
    const updatedRanges = await prisma.subAreaScoreRange.findMany({
      where: { subAreaId },
      orderBy: { minScore: 'asc' },
    });

    return NextResponse.json({ scoreRanges: updatedRanges });
  } catch (error) {
    console.error('Error updating sub-area score ranges:', error);
    return NextResponse.json({ error: 'Failed to update score ranges' }, { status: 500 });
  }
}

// DELETE /api/v1/platform/areas/[areaId]/sub-areas/[subAreaId]/scoring - Delete all score ranges
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
    });

    if (!subArea) {
      return NextResponse.json({ error: 'Sub-area not found' }, { status: 404 });
    }

    await prisma.subAreaScoreRange.deleteMany({
      where: { subAreaId },
    });

    await logAuditEvent({
      eventType: 'sub_area_score_ranges_deleted',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'sub_area',
      targetId: subAreaId,
      eventDescription: `Deleted all score ranges for sub-area "${subArea.name}"`,
      eventData: { areaId, subAreaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-area score ranges:', error);
    return NextResponse.json({ error: 'Failed to delete score ranges' }, { status: 500 });
  }
}
