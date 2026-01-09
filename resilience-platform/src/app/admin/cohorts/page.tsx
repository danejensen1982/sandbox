import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import prisma from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function CohortsPage() {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    redirect('/admin/login');
  }

  // Get cohorts for the admin's organization
  const orgFilter = admin.role === 'platform_owner' ? {} : { organizationId: admin.organizationId! };

  const cohorts = await prisma.cohort.findMany({
    where: orgFilter,
    orderBy: { createdAt: 'desc' },
    include: {
      organization: { select: { name: true } },
      _count: {
        select: {
          assessmentCodes: true,
        },
      },
      assessmentCodes: {
        select: {
          assessmentSessions: {
            where: { isComplete: true },
            select: { id: true },
          },
        },
      },
    },
  });

  // Calculate completion stats
  const cohortsWithStats = cohorts.map((cohort) => {
    const totalCodes = cohort._count.assessmentCodes;
    const completedSessions = cohort.assessmentCodes.reduce(
      (sum, code) => sum + code.assessmentSessions.length,
      0
    );
    return {
      ...cohort,
      totalCodes,
      completedSessions,
      completionRate: totalCodes > 0 ? Math.round((completedSessions / totalCodes) * 100) : 0,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cohorts</h1>
          <p className="text-slate-600 mt-1">Manage your assessment cohorts</p>
        </div>
        <Link href="/admin/cohorts/new">
          <Button>Create Cohort</Button>
        </Link>
      </div>

      {/* Cohorts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Cohorts</CardTitle>
          <CardDescription>
            {cohortsWithStats.length} cohort{cohortsWithStats.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohortsWithStats.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-4">No cohorts yet.</p>
              <Link href="/admin/cohorts/new">
                <Button>Create Your First Cohort</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {admin.role === 'platform_owner' && <TableHead>Organization</TableHead>}
                  <TableHead>Codes</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retakes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortsWithStats.map((cohort) => (
                  <TableRow key={cohort.id}>
                    <TableCell className="font-medium">{cohort.name}</TableCell>
                    {admin.role === 'platform_owner' && (
                      <TableCell>{cohort.organization.name}</TableCell>
                    )}
                    <TableCell>{cohort.totalCodes}</TableCell>
                    <TableCell>
                      {cohort.completedSessions}
                      <span className="text-slate-400 ml-1">
                        ({cohort.completionRate}%)
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cohort.isActive ? 'default' : 'secondary'}>
                        {cohort.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cohort.allowRetakes ? (
                        <Badge variant="outline">Allowed</Badge>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/cohorts/${cohort.id}`}>
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </Link>
                        <Link href={`/admin/cohorts/${cohort.id}/analytics`}>
                          <Button variant="ghost" size="sm">
                            Analytics
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
