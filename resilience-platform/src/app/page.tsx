import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="font-bold text-xl text-slate-900">Resilience Platform</div>
            <div className="flex items-center gap-4">
              <Link href="/assess">
                <Button variant="ghost">Take Assessment</Button>
              </Link>
              <Link href="/admin/login">
                <Button variant="outline">Admin Login</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Discover Your Personal Resilience
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            A comprehensive self-assessment tool designed for leaders to understand
            and develop their resilience across seven key dimensions.
          </p>
          <div className="mt-8">
            <Link href="/assess">
              <Button size="lg" className="px-8">
                Start Your Assessment
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7 Resilience Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Explore emotional, physical, mental, social, spiritual, professional,
                and financial dimensions of resilience.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personalized Results</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive detailed insights, strengths analysis, and actionable
                recommendations tailored to your unique profile.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Secure & Private</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Your responses are encrypted and protected. Access your results
                anytime using your unique code.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 mb-16">
          <h2 className="text-2xl font-semibold text-slate-900 text-center mb-8">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, title: 'Get Your Code', desc: 'Receive a unique access code from your organization' },
              { step: 2, title: 'Take Assessment', desc: 'Answer questions across 7 resilience areas' },
              { step: 3, title: 'View Results', desc: 'See your personalized resilience profile' },
              { step: 4, title: 'Track Progress', desc: 'Return anytime to review or retake' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-blue-600">{item.step}</span>
                </div>
                <h3 className="font-medium text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-slate-600 mb-4">Ready to discover your resilience profile?</p>
          <Link href="/assess">
            <Button size="lg" variant="outline" className="px-8">
              Enter Assessment Code
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          <p>Resilience Assessment Platform - Empowering Leaders Through Self-Discovery</p>
        </div>
      </footer>
    </div>
  );
}
