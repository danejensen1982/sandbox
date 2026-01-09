import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin, hasOrgAccess } from '@/lib/auth/admin';
import { generateAssessmentCodes } from '@/lib/auth/assessment-code';
import { AuditEvents } from '@/lib/audit/logger';
import prisma from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { cohortId } = await params;
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get cohort
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Check access
    if (!hasOrgAccess(admin, cohort.organizationId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse request
    const body = await request.json();
    const count = Math.min(Math.max(1, body.count || 10), 500); // 1-500 codes
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

    // Generate codes
    const codes = await generateAssessmentCodes(cohortId, count, { expiresAt });

    // Log audit event
    await AuditEvents.codesGenerated(admin.id, cohortId, count);

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Error generating codes:', error);
    return NextResponse.json({ error: 'Failed to generate codes' }, { status: 500 });
  }
}
