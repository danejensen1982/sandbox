import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdmin } from '@/lib/auth/admin';
import { Button } from '@/components/ui/button';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAuthenticatedAdmin();

  // Only platform owners can access this section
  if (!admin || admin.role !== 'platform_owner') {
    redirect('/admin/login');
  }

  const navItems = [
    { href: '/platform', label: 'Dashboard' },
    { href: '/platform/content', label: 'Content' },
    { href: '/platform/organizations', label: 'Organizations' },
    { href: '/platform/users', label: 'Admin Users' },
    { href: '/platform/audit', label: 'Audit Logs' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/platform" className="font-bold text-lg">
                Platform Admin
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                {admin.email}
              </span>
              <Link href="/admin">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-900">
                  Back to Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-slate-800 px-4 py-2">
        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700 text-xs"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
