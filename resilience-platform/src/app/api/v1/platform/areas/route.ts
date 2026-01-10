import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';

// GET /api/v1/platform/areas - List all resilience areas
export async function GET() {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const areas = await prisma.resilienceArea.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { questions: true, scoreRanges: true },
        },
      },
    });

    return NextResponse.json({ areas });
  } catch (error) {
    console.error('Error fetching areas:', error);
    return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 });
  }
}

// POST /api/v1/platform/areas - Create a new resilience area
export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, colorHex } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Check if slug already exists
    const existingArea = await prisma.resilienceArea.findUnique({
      where: { slug },
    });

    if (existingArea) {
      return NextResponse.json(
        { error: 'An area with a similar name already exists' },
        { status: 400 }
      );
    }

    // Get the highest display order
    const maxOrder = await prisma.resilienceArea.aggregate({
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder || 0) + 1;

    // Create the area
    const area = await prisma.resilienceArea.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        colorHex: colorHex || '#94A3B8',
        displayOrder: nextOrder,
        isActive: true,
      },
    });

    await logAuditEvent({
      eventType: 'resilience_area_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: area.id,
      eventDescription: `Created resilience area "${area.name}"`,
      eventData: { areaName: area.name, slug: area.slug },
    });

    return NextResponse.json({ area }, { status: 201 });
  } catch (error) {
    console.error('Error creating area:', error);
    return NextResponse.json({ error: 'Failed to create area' }, { status: 500 });
  }
}

// PATCH /api/v1/platform/areas - Reorder resilience areas
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== 'platform_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
    }

    // Update display order for each area in a transaction
    await prisma.$transaction(
      orderedIds.map((id: string, index: number) =>
        prisma.resilienceArea.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    await logAuditEvent({
      eventType: 'resilience_areas_reordered',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: admin.id,
      targetType: 'resilience_area',
      targetId: 'bulk',
      eventDescription: 'Reordered resilience areas',
      eventData: { orderedIds },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering areas:', error);
    return NextResponse.json({ error: 'Failed to reorder areas' }, { status: 500 });
  }
}
