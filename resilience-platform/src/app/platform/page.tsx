import Link from 'next/link';
import prisma from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function PlatformDashboardPage() {
  // Get platform statistics
  const [
    areasCount,
    questionsCount,
    organizationsCount,
    cohortsCount,
    adminUsersCount,
    completedAssessments,
  ] = await Promise.all([
    prisma.resilienceArea.count(),
    prisma.question.count(),
    prisma.organization.count(),
    prisma.cohort.count(),
    prisma.adminUser.count(),
    prisma.assessmentSession.count({ where: { isComplete: true } }),
  ]);

  const stats = [
    { label: 'Resilience Areas', value: areasCount, href: '/platform/content' },
    { label: 'Questions', value: questionsCount, href: '/platform/content' },
    { label: 'Organizations', value: organizationsCount, href: '/platform/organizations' },
    { label: 'Cohorts', value: cohortsCount, href: '/platform/organizations' },
    { label: 'Admin Users', value: adminUsersCount, href: '/platform/users' },
    { label: 'Completed Assessments', value: completedAssessments, href: '#' },
  ];

  const quickActions = [
    { label: 'Manage Content', description: 'Edit questions, scoring, and feedback', href: '/platform/content' },
    { label: 'Add Organization', description: 'Create a new client organization', href: '/platform/organizations/new' },
    { label: 'Add Admin User', description: 'Create a new admin account', href: '/platform/users/new' },
    { label: 'View Audit Logs', description: 'Review system activity', href: '/platform/audit' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Platform Dashboard</h1>
        <p className="text-slate-600 mt-1">
          Manage platform configuration, content, and users
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-slate-400 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className="h-full hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{action.label}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">
                    Go &rarr;
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity Preview */}
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Platform health and configuration status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm font-medium text-green-800">
                  All {areasCount} resilience areas configured
                </span>
              </div>
              <Link href="/platform/content">
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm font-medium text-green-800">
                  {questionsCount} questions across all areas
                </span>
              </div>
              <Link href="/platform/content">
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-blue-800">
                  {organizationsCount} organization{organizationsCount !== 1 ? 's' : ''} active
                </span>
              </div>
              <Link href="/platform/organizations">
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
