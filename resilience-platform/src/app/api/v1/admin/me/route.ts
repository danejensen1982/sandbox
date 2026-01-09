import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';

// GET /api/v1/admin/me - Get current admin user info
export async function GET() {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        organizationId: admin.organizationId,
      },
    });
  } catch (error) {
    console.error('Error fetching admin info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin info' },
      { status: 500 }
    );
  }
}
