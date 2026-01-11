import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas/[areaId]/feedback-rules - List feedback rules
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

    const feedbackRules = await prisma.areaFeedbackRule.findMany({
      where: { resilienceAreaId: areaId },
      orderBy: { priority: 'asc' },
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

    return NextResponse.json({ feedbackRules });
  } catch (error) {
    console.error('Error fetching feedback rules:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback rules' }, { status: 500 });
  }
}

// POST /api/v1/platform/areas/[areaId]/feedback-rules - Create a new feedback rule
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
    const { name, feedbackContent, conditions, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!feedbackContent?.trim()) {
      return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 });
    }

    // Verify area exists
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Get the next priority (highest + 1)
    const lastRule = await prisma.areaFeedbackRule.findFirst({
      where: { resilienceAreaId: areaId },
      orderBy: { priority: 'desc' },
    });

    const nextPriority = (lastRule?.priority || 0) + 1;

    // Create the rule with conditions
    const feedbackRule = await prisma.$transaction(async (tx) => {
      const rule = await tx.areaFeedbackRule.create({
        data: {
          resilienceAreaId: areaId,
          name: name.trim(),
          feedbackContent: feedbackContent.trim(),
          priority: nextPriority,
          isActive: isActive ?? true,
        },
      });

      // Create conditions if provided
      if (conditions && Array.isArray(conditions)) {
        for (const condition of conditions) {
          await tx.areaFeedbackCondition.create({
            data: {
              ruleId: rule.id,
              subAreaId: condition.subAreaId,
              levelCodes: condition.levelCodes || [],
            },
          });
        }
      }

      // Return with conditions included
      return tx.areaFeedbackRule.findUnique({
        where: { id: rule.id },
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
      eventType: 'feedback_rule_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'feedback_rule',
      targetId: feedbackRule?.id || '',
      eventDescription: `Created feedback rule "${name}" for area "${area.name}"`,
      eventData: { areaId, ruleName: name },
    });

    return NextResponse.json({ feedbackRule }, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback rule:', error);
    return NextResponse.json({ error: 'Failed to create feedback rule' }, { status: 500 });
  }
}

// PATCH /api/v1/platform/areas/[areaId]/feedback-rules - Reorder feedback rules
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

    // Update priorities
    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.areaFeedbackRule.update({
          where: { id },
          data: { priority: index + 1 },
        })
      )
    );

    await logAuditEvent({
      eventType: 'feedback_rules_reordered',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: areaId,
      eventDescription: `Reordered feedback rules in area "${area.name}"`,
      eventData: { areaId, ruleCount: orderedIds.length },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering feedback rules:', error);
    return NextResponse.json({ error: 'Failed to reorder feedback rules' }, { status: 500 });
  }
}
