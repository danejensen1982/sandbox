import Link from 'next/link';
import prisma from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function ContentManagementPage() {
  const areas = await prisma.resilienceArea.findMany({
    orderBy: { displayOrder: 'asc' },
    include: {
      _count: {
        select: { questions: true, scoreRanges: true },
      },
      questions: {
        orderBy: { displayOrder: 'asc' },
        take: 3,
        select: { id: true, questionText: true, isReverseScored: true },
      },
      scoreRanges: {
        orderBy: { minScore: 'asc' },
        select: { id: true, levelName: true, minScore: true, maxScore: true, colorHex: true },
      },
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Content Management</h1>
          <p className="text-slate-600 mt-1">
            Manage resilience areas, questions, and feedback content
          </p>
        </div>
      </div>

      {/* Resilience Areas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Resilience Areas</h2>
        <div className="grid gap-4">
          {areas.map((area) => (
            <Card key={area.id} className="overflow-hidden">
              <div className="flex">
                {/* Color Bar */}
                <div
                  className="w-2 shrink-0"
                  style={{ backgroundColor: area.colorHex || '#94A3B8' }}
                />
                <div className="flex-1">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{area.name}</CardTitle>
                        <Badge variant={area.isActive ? 'default' : 'secondary'}>
                          {area.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/platform/content/areas/${area.id}`}>
                          <Button variant="outline" size="sm">Edit Area</Button>
                        </Link>
                        <Link href={`/platform/content/areas/${area.id}/questions`}>
                          <Button variant="outline" size="sm">
                            Questions ({area._count.questions})
                          </Button>
                        </Link>
                        <Link href={`/platform/content/areas/${area.id}/scoring`}>
                          <Button variant="outline" size="sm">
                            Scoring ({area._count.scoreRanges})
                          </Button>
                        </Link>
                        <Link href={`/platform/content/areas/${area.id}/feedback`}>
                          <Button variant="outline" size="sm">Feedback</Button>
                        </Link>
                      </div>
                    </div>
                    <CardDescription>{area.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Score Ranges */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Score Levels</h4>
                        <div className="flex flex-wrap gap-2">
                          {area.scoreRanges.map((range) => (
                            <div
                              key={range.id}
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: range.colorHex || '#94A3B8' }}
                            >
                              {range.levelName} ({Number(range.minScore)}-{Number(range.maxScore)})
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sample Questions */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                          Sample Questions
                        </h4>
                        <ul className="space-y-1">
                          {area.questions.map((q) => (
                            <li key={q.id} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-slate-400">&bull;</span>
                              <span className="truncate">{q.questionText}</span>
                              {q.isReverseScored && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Reverse
                                </Badge>
                              )}
                            </li>
                          ))}
                          {area._count.questions > 3 && (
                            <li className="text-sm text-slate-400">
                              +{area._count.questions - 3} more questions
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Overall Feedback */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Overall Feedback Content</CardTitle>
              <CardDescription>
                Feedback displayed based on overall assessment scores
              </CardDescription>
            </div>
            <Link href="/platform/content/overall-feedback">
              <Button variant="outline">Manage Overall Feedback</Button>
            </Link>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
