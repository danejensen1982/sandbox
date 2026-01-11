'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ScoreRange {
  id: string;
  minScore: number;
  maxScore: number;
  levelName: string;
  levelCode: string;
  colorHex: string | null;
}

interface SubAreaInfo {
  id: string;
  name: string;
  slug: string;
  colorHex: string | null;
}

interface AreaInfo {
  id: string;
  name: string;
  slug: string;
}

export default function SubAreaScoringPage() {
  const params = useParams();
  const areaId = params.areaId as string;
  const subAreaId = params.subAreaId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [subArea, setSubArea] = useState<SubAreaInfo | null>(null);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      const [areaRes, subAreaRes, rangesRes] = await Promise.all([
        fetch(`/api/v1/platform/areas/${areaId}`),
        fetch(`/api/v1/platform/areas/${areaId}/sub-areas/${subAreaId}`),
        fetch(`/api/v1/platform/areas/${areaId}/sub-areas/${subAreaId}/scoring`),
      ]);

      if (areaRes.ok) {
        const areaData = await areaRes.json();
        setArea(areaData.area);
      }

      if (subAreaRes.ok) {
        const subAreaData = await subAreaRes.json();
        setSubArea(subAreaData.subArea);
      }

      if (rangesRes.ok) {
        const rangesData = await rangesRes.json();
        setScoreRanges(rangesData.scoreRanges.map((r: ScoreRange) => ({
          ...r,
          minScore: Number(r.minScore),
          maxScore: Number(r.maxScore),
        })));
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [areaId, subAreaId]);

  const updateRange = (index: number, field: keyof ScoreRange, value: string | number) => {
    const updated = [...scoreRanges];
    if (field === 'minScore' || field === 'maxScore') {
      updated[index] = { ...updated[index], [field]: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setScoreRanges(updated);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    // Validate ranges
    for (let i = 0; i < scoreRanges.length; i++) {
      const range = scoreRanges[i];
      if (range.minScore >= range.maxScore) {
        setError(`${range.levelName}: Min score must be less than max score`);
        setIsSaving(false);
        return;
      }
      if (!range.levelName.trim()) {
        setError(`Level ${i + 1}: Name is required`);
        setIsSaving(false);
        return;
      }
    }

    // Check for gaps or overlaps
    const sorted = [...scoreRanges].sort((a, b) => a.minScore - b.minScore);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minScore !== sorted[i - 1].maxScore) {
        setError('Score ranges must be continuous without gaps or overlaps');
        setIsSaving(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/v1/platform/areas/${areaId}/sub-areas/${subAreaId}/scoring`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreRanges }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess('Score levels saved successfully');
      loadData();
    } catch {
      setError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const addDefaultLevels = () => {
    setScoreRanges([
      { id: 'new-1', minScore: 0, maxScore: 25, levelName: 'Developing', levelCode: 'developing', colorHex: '#EF4444' },
      { id: 'new-2', minScore: 25, maxScore: 50, levelName: 'Emerging', levelCode: 'emerging', colorHex: '#F59E0B' },
      { id: 'new-3', minScore: 50, maxScore: 75, levelName: 'Strong', levelCode: 'strong', colorHex: '#10B981' },
      { id: 'new-4', minScore: 75, maxScore: 100, levelName: 'Exceptional', levelCode: 'exceptional', colorHex: '#3B82F6' },
    ]);
  };

  const addNewLevel = () => {
    const lastRange = scoreRanges[scoreRanges.length - 1];
    const newMin = lastRange ? lastRange.maxScore : 0;
    setScoreRanges([
      ...scoreRanges,
      {
        id: `new-${Date.now()}`,
        minScore: newMin,
        maxScore: Math.min(newMin + 20, 100),
        levelName: 'New Level',
        levelCode: 'new_level',
        colorHex: '#94A3B8',
      },
    ]);
  };

  const removeLevel = (index: number) => {
    if (scoreRanges.length <= 1) {
      setError('Must have at least one score level');
      return;
    }
    const updated = scoreRanges.filter((_, i) => i !== index);
    setScoreRanges(updated);
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
        <Link href={`/platform/content/areas/${areaId}/sub-areas`}>
          <Button variant="ghost" size="sm">&larr; Back to Sub-Areas</Button>
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-500">{area?.name}</p>
          <h1 className="text-3xl font-bold text-slate-900">
            {subArea?.name} - Score Levels
          </h1>
          <p className="text-slate-600 mt-1">
            Configure the score thresholds for this sub-area
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
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

      {/* Score Ranges */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Score Levels ({scoreRanges.length})</CardTitle>
              <CardDescription>
                Define the score ranges that determine sub-area levels. These are used for conditional feedback matching.
              </CardDescription>
            </div>
            {scoreRanges.length === 0 && (
              <Button variant="outline" onClick={addDefaultLevels}>
                Add Default Levels
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreRanges
            .sort((a, b) => a.minScore - b.minScore)
            .map((range, index) => (
              <div
                key={range.id}
                className="p-4 border rounded-lg space-y-4"
                style={{ borderLeftColor: range.colorHex || '#94A3B8', borderLeftWidth: '4px' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: range.colorHex || '#94A3B8' }}
                    />
                    <span className="font-medium">{range.levelName}</span>
                    <span className="text-slate-400 text-sm">
                      ({range.minScore} - {range.maxScore})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeLevel(index)}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Score</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={range.minScore}
                      onChange={(e) => updateRange(index, 'minScore', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Score</Label>
                    <Input
                      type="number"
                      min={0}
                      max={101}
                      value={range.maxScore}
                      onChange={(e) => updateRange(index, 'maxScore', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Level Name</Label>
                    <Input
                      value={range.levelName}
                      onChange={(e) => updateRange(index, 'levelName', e.target.value)}
                      placeholder="e.g., Developing"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Level Code</Label>
                    <Input
                      value={range.levelCode}
                      onChange={(e) => updateRange(index, 'levelCode', e.target.value)}
                      placeholder="e.g., developing"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={range.colorHex || '#94A3B8'}
                        onChange={(e) => updateRange(index, 'colorHex', e.target.value)}
                        className="w-12 h-9 p-1"
                      />
                      <Input
                        value={range.colorHex || ''}
                        onChange={(e) => updateRange(index, 'colorHex', e.target.value)}
                        placeholder="#HEX"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

          <Button variant="outline" onClick={addNewLevel} className="w-full">
            + Add Score Level
          </Button>
        </CardContent>
      </Card>

      {/* Visual Preview */}
      {scoreRanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>How the score levels will appear</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-8 rounded-lg overflow-hidden flex">
              {scoreRanges
                .sort((a, b) => a.minScore - b.minScore)
                .map((range) => (
                  <div
                    key={range.id}
                    className="flex items-center justify-center text-white text-xs font-medium"
                    style={{
                      backgroundColor: range.colorHex || '#94A3B8',
                      width: `${range.maxScore - range.minScore}%`,
                    }}
                  >
                    {range.levelName}
                  </div>
                ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Score Levels Work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            Score levels determine how a participant&apos;s score is categorized (e.g., &quot;Developing&quot;, &quot;Strong&quot;).
          </p>
          <p>
            These levels are used by <strong>Feedback Rules</strong> to display different feedback based on
            the combination of levels across sub-areas.
          </p>
          <p>
            For example, if a participant scores &quot;Strong&quot; in Optimism but &quot;Developing&quot; in Tools,
            you can configure specific feedback for that combination.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
