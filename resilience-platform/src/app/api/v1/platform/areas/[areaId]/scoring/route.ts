import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/scoring - Get score ranges for an area
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

    const scoreRanges = await prisma.scoreRange.findMany({
      where: { resilienceAreaId: areaId },
      orderBy: { minScore: 'asc' },
    });

    return NextResponse.json({ scoreRanges });
  } catch (error) {
    console.error('Error fetching score ranges:', error);
    return NextResponse.json({ error: 'Failed to fetch score ranges' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId]/scoring - Update score ranges for an area
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
    const { scoreRanges } = body;

    if (!scoreRanges || !Array.isArray(scoreRanges)) {
      return NextResponse.json({ error: 'Score ranges are required' }, { status: 400 });
    }

    // Validate area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Validate ranges
    for (const range of scoreRanges) {
      if (range.minScore >= range.maxScore) {
        return NextResponse.json(
          { error: `Invalid range: min must be less than max for ${range.levelName}` },
          { status: 400 }
        );
      }
      if (!range.levelName?.trim() || !range.levelCode?.trim()) {
        return NextResponse.json(
          { error: 'Level name and code are required for all ranges' },
          { status: 400 }
        );
      }
    }

    // Sort ranges by minScore
    const sortedRanges = [...scoreRanges].sort((a, b) => a.minScore - b.minScore);

    // Check for gaps/overlaps
    for (let i = 1; i < sortedRanges.length; i++) {
      if (sortedRanges[i].minScore !== sortedRanges[i - 1].maxScore) {
        return NextResponse.json(
          { error: 'Score ranges must be continuous without gaps or overlaps' },
          { status: 400 }
        );
      }
    }

    // Update ranges in a transaction
    await prisma.$transaction(async (tx) => {
      // Get existing ranges
      const existingRanges = await tx.scoreRange.findMany({
        where: { resilienceAreaId: areaId },
      });

      const existingIds = existingRanges.map((r) => r.id);
      const newIds = scoreRanges.filter((r: { id: string }) => !r.id.startsWith('new-')).map((r: { id: string }) => r.id);

      // Delete removed ranges
      const toDelete = existingIds.filter((id) => !newIds.includes(id));
      if (toDelete.length > 0) {
        await tx.scoreRange.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Update or create ranges
      for (const range of scoreRanges) {
        if (range.id.startsWith('new-')) {
          // Create new range
          await tx.scoreRange.create({
            data: {
              resilienceAreaId: areaId,
              minScore: range.minScore,
              maxScore: range.maxScore,
              levelName: range.levelName.trim(),
              levelCode: range.levelCode.trim(),
              colorHex: range.colorHex || null,
            },
          });
        } else {
          // Update existing range
          await tx.scoreRange.update({
            where: { id: range.id },
            data: {
              minScore: range.minScore,
              maxScore: range.maxScore,
              levelName: range.levelName.trim(),
              levelCode: range.levelCode.trim(),
              colorHex: range.colorHex || null,
            },
          });
        }
      }
    });

    await logAuditEvent({
      eventType: 'score_ranges_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: areaId,
      eventDescription: `Updated score ranges for area "${area.name}"`,
      eventData: { areaName: area.name, rangeCount: scoreRanges.length },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating score ranges:', error);
    return NextResponse.json({ error: 'Failed to update score ranges' }, { status: 500 });
  }
}
