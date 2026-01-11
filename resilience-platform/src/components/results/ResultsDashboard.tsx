'use client';

import { useState } from 'react';
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
  const [linkCopied, setLinkCopied] = useState(false);

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
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
        <div className="flex gap-2">
          <Button onClick={handleCopyLink} variant="outline">
            {linkCopied ? 'Link Copied!' : 'Copy Link to Results'}
          </Button>
          {onDownloadPdf && (
            <Button onClick={onDownloadPdf} disabled={isGeneratingPdf} variant="outline">
              {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Report'}
            </Button>
          )}
        </div>
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
            <Card key={area.areaId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{area.areaName}</CardTitle>
                  <div
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: area.level.color }}
                  >
                    {area.level.name}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-bold" style={{ color: area.level.color }}>
                    {Math.round(area.score)}
                  </span>
                  <span className="text-sm text-slate-500">/ 100</span>
                </div>
              </CardHeader>
              <CardContent>
                <ScoreBar score={Math.round(area.score)} color={area.level.color} />

                {/* Sub-area scores */}
                {area.subAreaScores && area.subAreaScores.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-sm font-medium text-slate-700">Sub-area Breakdown</h5>
                    {area.subAreaScores.map((subArea) => (
                      <div key={subArea.subAreaId} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{subArea.subAreaName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{Math.round(subArea.score)}</span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: subArea.colorHex ? `${subArea.colorHex}20` : '#e2e8f0',
                              color: subArea.colorHex || '#475569',
                            }}
                          >
                            {subArea.levelName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conditional feedback */}
                {area.conditionalFeedback && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <div
                      className="prose prose-sm prose-slate max-w-none"
                      dangerouslySetInnerHTML={{ __html: area.conditionalFeedback }}
                    />
                  </div>
                )}

                {/* Summary feedback (fallback if no conditional) */}
                {!area.conditionalFeedback && area.feedback.summary && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">{area.feedback.summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
