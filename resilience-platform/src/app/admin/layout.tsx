import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedAdmin, logoutAdmin } from '@/lib/auth/admin';
import { Button } from '@/components/ui/button';

async function handleLogout() {
  'use server';
  await logoutAdmin();
  redirect('/admin/login');
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if on login page
  // The layout will still render, but we skip auth check for login page
  // This is handled by the page itself

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="font-bold text-xl text-slate-900">
                Resilience Admin
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link
                  href="/admin"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/cohorts"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Cohorts
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <form action={handleLogout}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
