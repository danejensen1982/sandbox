import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// POST /api/v1/admin/cohorts - Create a new cohort
export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      organizationId,
      allowRetakes = false,
      maxRetakes = 0,
      retakeCooldownDays = 0,
      accessStartDate,
      accessEndDate,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Cohort name is required' }, { status: 400 });
    }

    // Determine organization ID
    let targetOrgId: string;

    if (admin.role === 'platform_owner') {
      // Platform owners can create cohorts for any org
      if (!organizationId) {
        return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
      }
      targetOrgId = organizationId;
    } else {
      // Org admins can only create cohorts for their own org
      if (!admin.organizationId) {
        return NextResponse.json({ error: 'Admin not associated with an organization' }, { status: 400 });
      }
      targetOrgId = admin.organizationId;
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: targetOrgId },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Create the cohort
    const cohort = await prisma.cohort.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        organizationId: targetOrgId,
        allowRetakes,
        maxRetakes: allowRetakes ? maxRetakes : 0,
        retakeCooldownDays: allowRetakes ? retakeCooldownDays : 0,
        accessStartDate: accessStartDate ? new Date(accessStartDate) : null,
        accessEndDate: accessEndDate ? new Date(accessEndDate) : null,
      },
    });

    // Log audit event
    await logAuditEvent({
      eventType: 'cohort_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'cohort',
      targetId: cohort.id,
      eventDescription: `Created cohort "${cohort.name}" for organization "${org.name}"`,
      eventData: {
        cohortName: cohort.name,
        organizationId: targetOrgId,
        allowRetakes,
      },
    });

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        name: cohort.name,
        description: cohort.description,
      },
    });
  } catch (error) {
    console.error('Error creating cohort:', error);
    return NextResponse.json(
      { error: 'Failed to create cohort' },
      { status: 500 }
    );
  }
}

// GET /api/v1/admin/cohorts - List cohorts
export async function GET() {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Filter by organization for non-platform owners
    const orgFilter = admin.role === 'platform_owner' ? {} : { organizationId: admin.organizationId! };

    const cohorts = await prisma.cohort.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
        _count: {
          select: { assessmentCodes: true },
        },
      },
    });

    return NextResponse.json({ cohorts });
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cohorts' },
      { status: 500 }
    );
  }
}
