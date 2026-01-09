import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/feedback - Get feedback content for an area
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

    // Get all score ranges for this area
    const scoreRanges = await prisma.scoreRange.findMany({
      where: { resilienceAreaId: areaId },
      select: { id: true },
    });

    const scoreRangeIds = scoreRanges.map((r) => r.id);

    // Get feedback content for these score ranges
    const feedbackContent = await prisma.feedbackContent.findMany({
      where: { scoreRangeId: { in: scoreRangeIds } },
      orderBy: [{ scoreRangeId: 'asc' }, { displayOrder: 'asc' }],
    });

    return NextResponse.json({ feedbackContent });
  } catch (error) {
    console.error('Error fetching feedback content:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback content' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId]/feedback - Update feedback content for an area
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
    const { feedbackContent } = body;

    if (!feedbackContent || !Array.isArray(feedbackContent)) {
      return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 });
    }

    // Validate area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Get valid score range IDs for this area
    const scoreRanges = await prisma.scoreRange.findMany({
      where: { resilienceAreaId: areaId },
      select: { id: true },
    });
    const validRangeIds = new Set(scoreRanges.map((r) => r.id));

    // Update feedback in a transaction
    await prisma.$transaction(async (tx) => {
      for (const feedback of feedbackContent) {
        // Skip empty content
        if (!feedback.contentBody?.trim()) {
          // If it exists, delete it
          if (!feedback.id.startsWith('new-')) {
            await tx.feedbackContent.delete({
              where: { id: feedback.id },
            }).catch(() => {
              // Ignore if doesn't exist
            });
          }
          continue;
        }

        // Validate score range belongs to this area
        if (!validRangeIds.has(feedback.scoreRangeId)) {
          continue;
        }

        if (feedback.id.startsWith('new-')) {
          // Check if content for this type already exists
          const existing = await tx.feedbackContent.findFirst({
            where: {
              scoreRangeId: feedback.scoreRangeId,
              contentType: feedback.contentType,
            },
          });

          if (existing) {
            // Update existing
            await tx.feedbackContent.update({
              where: { id: existing.id },
              data: {
                contentBody: feedback.contentBody.trim(),
                contentTitle: feedback.contentTitle?.trim() || null,
              },
            });
          } else {
            // Create new
            await tx.feedbackContent.create({
              data: {
                scoreRangeId: feedback.scoreRangeId,
                contentType: feedback.contentType,
                contentTitle: feedback.contentTitle?.trim() || null,
                contentBody: feedback.contentBody.trim(),
              },
            });
          }
        } else {
          // Update existing
          await tx.feedbackContent.update({
            where: { id: feedback.id },
            data: {
              contentBody: feedback.contentBody.trim(),
              contentTitle: feedback.contentTitle?.trim() || null,
            },
          });
        }
      }
    });

    await logAuditEvent({
      eventType: 'feedback_content_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: areaId,
      eventDescription: `Updated feedback content for area "${area.name}"`,
      eventData: { areaName: area.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating feedback content:', error);
    return NextResponse.json({ error: 'Failed to update feedback content' }, { status: 500 });
  }
}
