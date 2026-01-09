import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth/assessment-code';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const { areaId } = await params;

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token
    const { valid } = await getSessionFromToken(token);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Get area details
    const area = await prisma.resilienceArea.findUnique({
      where: { id: areaId },
    });

    if (!area || !area.isActive) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Get questions for this area
    const questions = await prisma.question.findMany({
      where: {
        resilienceAreaId: areaId,
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        questionText: true,
        questionType: true,
        helpText: true,
      },
    });

    return NextResponse.json({
      area: {
        id: area.id,
        name: area.name,
        description: area.description,
      },
      questions,
    });
  } catch (error) {
    console.error('Error getting questions:', error);
    return NextResponse.json({ error: 'Failed to get questions' }, { status: 500 });
  }
}
