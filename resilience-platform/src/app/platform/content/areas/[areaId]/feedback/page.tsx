'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScoreRange {
  id: string;
  minScore: number;
  maxScore: number;
  levelName: string;
  levelCode: string;
  colorHex: string | null;
}

interface FeedbackContent {
  id: string;
  scoreRangeId: string;
  contentType: string;
  contentTitle: string | null;
  contentBody: string;
}

interface AreaInfo {
  id: string;
  name: string;
  slug: string;
}

const CONTENT_TYPES = [
  { key: 'summary', label: 'Summary', description: 'Brief overview for this score level' },
  { key: 'strengths', label: 'Strengths', description: 'Highlight what the person is doing well' },
  { key: 'growth_areas', label: 'Growth Areas', description: 'Areas that could be improved' },
  { key: 'recommendations', label: 'Recommendations', description: 'Actionable suggestions' },
];

export default function FeedbackManagementPage() {
  const params = useParams();
  const areaId = params.areaId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [feedbackContent, setFeedbackContent] = useState<FeedbackContent[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('');

  const loadData = async () => {
    try {
      const [areaRes, rangesRes, feedbackRes] = await Promise.all([
        fetch(`/api/v1/platform/areas/${areaId}`),
        fetch(`/api/v1/platform/areas/${areaId}/scoring`),
        fetch(`/api/v1/platform/areas/${areaId}/feedback`),
      ]);

      if (areaRes.ok) {
        const areaData = await areaRes.json();
        setArea(areaData.area);
      }

      if (rangesRes.ok) {
        const rangesData = await rangesRes.json();
        const ranges = rangesData.scoreRanges.map((r: ScoreRange) => ({
          ...r,
          minScore: Number(r.minScore),
          maxScore: Number(r.maxScore),
        }));
        setScoreRanges(ranges);
        if (ranges.length > 0 && !activeTab) {
          setActiveTab(ranges[0].id);
        }
      }

      if (feedbackRes.ok) {
        const feedbackData = await feedbackRes.json();
        setFeedbackContent(feedbackData.feedbackContent);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [areaId]);

  const getFeedbackForRange = (rangeId: string, contentType: string) => {
    return feedbackContent.find(
      (f) => f.scoreRangeId === rangeId && f.contentType === contentType
    );
  };

  const updateFeedback = (rangeId: string, contentType: string, body: string) => {
    const existing = feedbackContent.find(
      (f) => f.scoreRangeId === rangeId && f.contentType === contentType
    );

    if (existing) {
      setFeedbackContent(
        feedbackContent.map((f) =>
          f.id === existing.id ? { ...f, contentBody: body } : f
        )
      );
    } else {
      setFeedbackContent([
        ...feedbackContent,
        {
          id: `new-${rangeId}-${contentType}`,
          scoreRangeId: rangeId,
          contentType,
          contentTitle: null,
          contentBody: body,
        },
      ]);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/platform/areas/${areaId}/feedback`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackContent }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess('Feedback content saved successfully');
      loadData();
    } catch {
      setError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/platform/content">
          <Button variant="ghost" size="sm">&larr; Back to Content</Button>
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {area?.name} - Feedback Content
          </h1>
          <p className="text-slate-600 mt-1">
            Write personalized feedback for each score level. Supports markdown.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {scoreRanges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">
              No score levels configured yet. Please set up score levels first.
            </p>
            <Link href={`/platform/content/areas/${areaId}/scoring`}>
              <Button>Configure Score Levels</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {scoreRanges
              .sort((a, b) => a.minScore - b.minScore)
              .map((range) => (
                <TabsTrigger
                  key={range.id}
                  value={range.id}
                  className="gap-2"
                >
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: range.colorHex || '#94A3B8' }}
                  />
                  {range.levelName}
                </TabsTrigger>
              ))}
          </TabsList>

          {scoreRanges.map((range) => (
            <TabsContent key={range.id} value={range.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: range.colorHex || '#94A3B8' }}
                    />
                    <CardTitle>{range.levelName}</CardTitle>
                    <span className="text-slate-400 text-sm">
                      (Score: {range.minScore} - {range.maxScore})
                    </span>
                  </div>
                  <CardDescription>
                    Feedback shown to users who score in the {range.levelName} range for {area?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {CONTENT_TYPES.map((type) => {
                    const feedback = getFeedbackForRange(range.id, type.key);
                    return (
                      <div key={type.key} className="space-y-2">
                        <div>
                          <Label className="text-base font-medium">{type.label}</Label>
                          <p className="text-sm text-slate-500">{type.description}</p>
                        </div>
                        <Textarea
                          value={feedback?.contentBody || ''}
                          onChange={(e) => updateFeedback(range.id, type.key, e.target.value)}
                          rows={4}
                          placeholder={`Enter ${type.label.toLowerCase()} content for ${range.levelName} level...`}
                          className="font-mono text-sm"
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
