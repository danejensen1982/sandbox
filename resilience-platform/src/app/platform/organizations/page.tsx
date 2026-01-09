import Link from 'next/link';
import prisma from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function OrganizationsPage() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          cohorts: true,
          adminUsers: true,
        },
      },
      cohorts: {
        select: {
          _count: {
            select: { assessmentCodes: true },
          },
        },
      },
    },
  });

  const orgsWithStats = organizations.map((org) => {
    const totalCodes = org.cohorts.reduce(
      (sum, cohort) => sum + cohort._count.assessmentCodes,
      0
    );
    return {
      ...org,
      totalCodes,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-600 mt-1">Manage client organizations</p>
        </div>
        <Link href="/platform/organizations/new">
          <Button>Add Organization</Button>
        </Link>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>
            {orgsWithStats.length} organization{orgsWithStats.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgsWithStats.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No organizations yet.</p>
              <Link href="/platform/organizations/new">
                <Button className="mt-4">Create First Organization</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Cohorts</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead>Codes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgsWithStats.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-slate-500">{org.slug}</TableCell>
                    <TableCell>{org._count.cohorts}</TableCell>
                    <TableCell>{org._count.adminUsers}</TableCell>
                    <TableCell>{org.totalCodes}</TableCell>
                    <TableCell>
                      <Badge variant={org.isActive ? 'default' : 'secondary'}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/platform/organizations/${org.id}`}>
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
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
