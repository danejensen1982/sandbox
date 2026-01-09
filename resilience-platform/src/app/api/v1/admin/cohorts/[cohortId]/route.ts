import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin, hasOrgAccess } from '@/lib/auth/admin';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { cohortId } = await params;
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get cohort with organization check
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        organization: { select: { name: true } },
      },
    });

    if (!cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Check access
    if (!hasOrgAccess(admin, cohort.organizationId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get codes
    const codes = await prisma.assessmentCode.findMany({
      where: { cohortId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        status: true,
        timesUsed: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    // Get stats
    const [totalCodes, usedCodes, completedAssessments] = await Promise.all([
      prisma.assessmentCode.count({ where: { cohortId } }),
      prisma.assessmentCode.count({
        where: { cohortId, status: { not: 'unused' } },
      }),
      prisma.assessmentSession.count({
        where: {
          isComplete: true,
          assessmentCode: { cohortId },
        },
      }),
    ]);

    return NextResponse.json({
      cohort: {
        id: cohort.id,
        name: cohort.name,
        description: cohort.description,
        allowRetakes: cohort.allowRetakes,
        maxRetakes: cohort.maxRetakes,
        isActive: cohort.isActive,
        organization: cohort.organization,
      },
      codes,
      stats: {
        totalCodes,
        usedCodes,
        completedAssessments,
      },
    });
  } catch (error) {
    console.error('Error getting cohort:', error);
    return NextResponse.json({ error: 'Failed to get cohort' }, { status: 500 });
  }
}
