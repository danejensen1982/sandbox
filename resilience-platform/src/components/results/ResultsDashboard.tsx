'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RadarChart } from './RadarChart';
import { ScoreBar, ScoreCard } from './ScoreBar';
import type { ScoringResult } from '@/lib/scoring/engine';

interface ResultsDashboardProps {
  results: ScoringResult;
  completedAt: string;
  onDownloadPdf?: () => void;
  isGeneratingPdf?: boolean;
}

export function ResultsDashboard({
  results,
  completedAt,
  onDownloadPdf,
  isGeneratingPdf = false,
}: ResultsDashboardProps) {
  const radarData = results.areaScores.map((area) => ({
    name: area.areaName,
    score: Math.round(area.score),
    fullMark: 100,
  }));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Your Resilience Assessment Results
          </h1>
          <p className="text-slate-600 mt-1">Completed on {formatDate(completedAt)}</p>
        </div>
        {onDownloadPdf && (
          <Button onClick={onDownloadPdf} disabled={isGeneratingPdf} variant="outline">
            {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Report'}
          </Button>
        )}
      </div>

      {/* Overall Score Card */}
      <Card className="border-2" style={{ borderColor: results.overallLevel.color }}>
        <CardHeader className="text-center pb-2">
          <CardDescription className="text-sm uppercase tracking-wide">
            Overall Resilience Score
          </CardDescription>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div
              className="text-6xl font-bold"
              style={{ color: results.overallLevel.color }}
            >
              {Math.round(results.overallScore)}
            </div>
            <div className="text-left">
              <div
                className="text-xl font-semibold"
                style={{ color: results.overallLevel.color }}
              >
                {results.overallLevel.name}
              </div>
              <div className="text-sm text-slate-500">out of 100</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScoreBar
            score={Math.round(results.overallScore)}
            color={results.overallLevel.color}
          />
          {results.overallFeedback.summary && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-slate-700 leading-relaxed">
                {results.overallFeedback.summary}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Your Resilience Profile</CardTitle>
          <CardDescription>
            A visual representation of your scores across all resilience areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadarChart data={radarData} color="#3B82F6" />
        </CardContent>
      </Card>

      {/* Individual Area Scores */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Detailed Results by Area
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {results.areaScores.map((area) => (
            <ScoreCard
              key={area.areaId}
              title={area.areaName}
              score={Math.round(area.score)}
              level={area.level}
              description={area.feedback.summary}
            />
          ))}
        </div>
      </div>

      {/* Detailed Feedback Sections */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Personalized Insights
        </h2>

        {results.areaScores.map((area) => (
          <Card key={area.areaId}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: area.level.color }}
                />
                <CardTitle className="text-lg">{area.areaName}</CardTitle>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: area.level.color }}
                >
                  {area.level.name}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {area.feedback.strengths && (
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Strengths</h4>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: area.feedback.strengths.replace(/\n/g, '<br />'),
                      }}
                    />
                  </div>
                </div>
              )}

              {area.feedback.growthAreas && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Areas for Growth</h4>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: area.feedback.growthAreas.replace(/\n/g, '<br />'),
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {area.feedback.recommendations && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Recommendations</h4>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: area.feedback.recommendations.replace(/\n/g, '<br />'),
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall Recommendations */}
      {(results.overallFeedback.strengths || results.overallFeedback.recommendations) && (
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle>Overall Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.overallFeedback.strengths && (
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Key Strengths</h4>
                <div className="prose prose-sm prose-slate max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: results.overallFeedback.strengths.replace(/\n/g, '<br />'),
                    }}
                  />
                </div>
              </div>
            )}

            {results.overallFeedback.recommendations && (
              <>
                {results.overallFeedback.strengths && <Separator />}
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Next Steps</h4>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: results.overallFeedback.recommendations.replace(/\n/g, '<br />'),
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
