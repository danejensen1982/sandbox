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
