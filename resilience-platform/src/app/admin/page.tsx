import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function AdminDashboard() {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    redirect('/admin/login');
  }

  // Get stats for the admin's organization
  const orgFilter = admin.role === 'platform_owner' ? {} : { organizationId: admin.organizationId! };

  const [cohortCount, codeCount, completedCount] = await Promise.all([
    prisma.cohort.count({
      where: { ...orgFilter, isActive: true },
    }),
    prisma.assessmentCode.count({
      where: { cohort: orgFilter },
    }),
    prisma.assessmentSession.count({
      where: {
        isComplete: true,
        assessmentCode: { cohort: orgFilter },
      },
    }),
  ]);

  // Get recent cohorts
  const recentCohorts = await prisma.cohort.findMany({
    where: { ...orgFilter, isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      organization: { select: { name: true } },
      _count: {
        select: {
          assessmentCodes: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">
          Welcome back, {admin.firstName || admin.email}
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Cohorts</CardDescription>
            <CardTitle className="text-3xl">{cohortCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/admin/cohorts">
              <Button variant="link" className="p-0 h-auto">
                View all cohorts
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Codes Generated</CardDescription>
            <CardTitle className="text-3xl">{codeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-slate-500">
              Assessment access codes
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed Assessments</CardDescription>
            <CardTitle className="text-3xl">{completedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-slate-500">
              Total completions
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cohorts */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Cohorts</CardTitle>
              <CardDescription>Your most recently created cohorts</CardDescription>
            </div>
            <Link href="/admin/cohorts/new">
              <Button>Create Cohort</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentCohorts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No cohorts yet. Create your first cohort to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentCohorts.map((cohort) => (
                <div
                  key={cohort.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-slate-900">{cohort.name}</h3>
                    <p className="text-sm text-slate-500">
                      {cohort.organization.name} &bull; {cohort._count.assessmentCodes} codes
                    </p>
                  </div>
                  <Link href={`/admin/cohorts/${cohort.id}`}>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/cohorts/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                Create New Cohort
              </Button>
            </Link>
            <Link href="/admin/cohorts" className="block">
              <Button variant="outline" className="w-full justify-start">
                Generate Assessment Codes
              </Button>
            </Link>
            <Link href="/admin/cohorts" className="block">
              <Button variant="outline" className="w-full justify-start">
                View Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Learn how to manage cohorts, generate codes, and view analytics.
            </p>
            <Button variant="outline">View Documentation</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
