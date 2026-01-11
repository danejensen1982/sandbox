import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/feedback-rules/[ruleId] - Get a feedback rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; ruleId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleId } = await params;

    const feedbackRule = await prisma.areaFeedbackRule.findUnique({
      where: { id: ruleId },
      include: {
        conditions: {
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

    if (!feedbackRule) {
      return NextResponse.json({ error: 'Feedback rule not found' }, { status: 404 });
    }

    return NextResponse.json({ feedbackRule });
  } catch (error) {
    console.error('Error fetching feedback rule:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback rule' }, { status: 500 });
  }
}

// PUT /api/v1/platform/areas/[areaId]/feedback-rules/[ruleId] - Update a feedback rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; ruleId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, ruleId } = await params;
    const body = await request.json();
    const { name, feedbackContent, conditions, isActive } = body;

    // Verify rule exists
    const existingRule = await prisma.areaFeedbackRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Feedback rule not found' }, { status: 404 });
    }

    // Update rule and conditions in a transaction
    const feedbackRule = await prisma.$transaction(async (tx) => {
      // Update the rule
      await tx.areaFeedbackRule.update({
        where: { id: ruleId },
        data: {
          name: name?.trim() || existingRule.name,
          feedbackContent: feedbackContent?.trim() || existingRule.feedbackContent,
          isActive: isActive !== undefined ? isActive : existingRule.isActive,
        },
      });

      // Update conditions if provided
      if (conditions && Array.isArray(conditions)) {
        // Delete existing conditions
        await tx.areaFeedbackCondition.deleteMany({
          where: { ruleId },
        });

        // Create new conditions
        for (const condition of conditions) {
          await tx.areaFeedbackCondition.create({
            data: {
              ruleId,
              subAreaId: condition.subAreaId,
              levelCodes: condition.levelCodes || [],
            },
          });
        }
      }

      // Return updated rule with conditions
      return tx.areaFeedbackRule.findUnique({
        where: { id: ruleId },
        include: {
          conditions: {
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
      eventType: 'feedback_rule_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'feedback_rule',
      targetId: ruleId,
      eventDescription: `Updated feedback rule "${feedbackRule?.name}"`,
      eventData: { areaId, ruleId },
    });

    return NextResponse.json({ feedbackRule });
  } catch (error) {
    console.error('Error updating feedback rule:', error);
    return NextResponse.json({ error: 'Failed to update feedback rule' }, { status: 500 });
  }
}

// DELETE /api/v1/platform/areas/[areaId]/feedback-rules/[ruleId] - Delete a feedback rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string; ruleId: string }> }
) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { areaId, ruleId } = await params;

    const existingRule = await prisma.areaFeedbackRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Feedback rule not found' }, { status: 404 });
    }

    // Delete the rule (conditions cascade delete)
    await prisma.areaFeedbackRule.delete({
      where: { id: ruleId },
    });

    await logAuditEvent({
      eventType: 'feedback_rule_deleted',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'feedback_rule',
      targetId: ruleId,
      eventDescription: `Deleted feedback rule "${existingRule.name}"`,
      eventData: { areaId, ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback rule:', error);
    return NextResponse.json({ error: 'Failed to delete feedback rule' }, { status: 500 });
  }
}
