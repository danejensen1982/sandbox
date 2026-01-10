'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ResilienceArea {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  colorHex: string | null;
  isActive: boolean;
  displayOrder: number;
  _count: {
    questions: number;
    scoreRanges: number;
  };
  questions?: Array<{
    id: string;
    questionText: string;
    isReverseScored: boolean;
  }>;
  scoreRanges?: Array<{
    id: string;
    levelName: string;
    minScore: number;
    maxScore: number;
    colorHex: string | null;
  }>;
}

export default function ContentManagementPage() {
  const [areas, setAreas] = useState<ResilienceArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Add area dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDescription, setNewAreaDescription] = useState('');
  const [newAreaColor, setNewAreaColor] = useState('#00B189');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete confirmation state
  const [deleteAreaId, setDeleteAreaId] = useState<string | null>(null);
  const [deleteAreaName, setDeleteAreaName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reordering state
  const [isReordering, setIsReordering] = useState(false);

  const fetchAreas = async () => {
    try {
      const response = await fetch('/api/v1/platform/areas');
      if (!response.ok) throw new Error('Failed to fetch areas');
      const data = await response.json();

      // Fetch full details for each area (including questions and score ranges for display)
      const areasWithDetails = await Promise.all(
        data.areas.map(async (area: ResilienceArea) => {
          const detailsRes = await fetch(`/api/v1/platform/areas/${area.id}/questions`);
          const scoringRes = await fetch(`/api/v1/platform/areas/${area.id}/scoring`);

          let questions: ResilienceArea['questions'] = [];
          let scoreRanges: ResilienceArea['scoreRanges'] = [];

          if (detailsRes.ok) {
            const qData = await detailsRes.json();
            questions = qData.questions?.slice(0, 3) || [];
          }
          if (scoringRes.ok) {
            const sData = await scoringRes.json();
            scoreRanges = sData.scoreRanges || [];
          }

          return { ...area, questions, scoreRanges };
        })
      );

      setAreas(areasWithDetails);
    } catch {
      setError('Failed to load areas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;

    setIsCreating(true);
    setCreateError('');

    try {
      const response = await fetch('/api/v1/platform/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAreaName.trim(),
          description: newAreaDescription.trim(),
          colorHex: newAreaColor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || 'Failed to create area');
        return;
      }

      setShowAddDialog(false);
      setNewAreaName('');
      setNewAreaDescription('');
      setNewAreaColor('#00B189');
      fetchAreas();
    } catch {
      setCreateError('Failed to create area');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteArea = async () => {
    if (!deleteAreaId) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/platform/areas/${deleteAreaId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete area');
        return;
      }

      setDeleteAreaId(null);
      fetchAreas();
    } catch {
      setError('Failed to delete area');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveArea = async (areaId: string, direction: 'up' | 'down') => {
    const currentIndex = areas.findIndex((a) => a.id === areaId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= areas.length) return;

    // Reorder locally first for immediate feedback
    const newAreas = [...areas];
    const [movedArea] = newAreas.splice(currentIndex, 1);
    newAreas.splice(newIndex, 0, movedArea);
    setAreas(newAreas);

    // Send to server
    setIsReordering(true);
    try {
      const response = await fetch('/api/v1/platform/areas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: newAreas.map((a) => a.id),
        }),
      });

      if (!response.ok) {
        // Revert on error
        fetchAreas();
        setError('Failed to reorder areas');
      }
    } catch {
      fetchAreas();
      setError('Failed to reorder areas');
    } finally {
      setIsReordering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

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
        <Button onClick={() => setShowAddDialog(true)}>
          + Add New Area
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resilience Areas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Resilience Areas</h2>
        <div className="grid gap-4">
          {areas.map((area, index) => (
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
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            disabled={index === 0 || isReordering}
                            onClick={() => handleMoveArea(area.id, 'up')}
                          >
                            <span className="text-xs">▲</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            disabled={index === areas.length - 1 || isReordering}
                            onClick={() => handleMoveArea(area.id, 'down')}
                          >
                            <span className="text-xs">▼</span>
                          </Button>
                        </div>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteAreaId(area.id);
                            setDeleteAreaName(area.name);
                          }}
                        >
                          Delete
                        </Button>
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
                          {area.scoreRanges?.map((range) => (
                            <div
                              key={range.id}
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: range.colorHex || '#94A3B8' }}
                            >
                              {range.levelName} ({Number(range.minScore)}-{Number(range.maxScore)})
                            </div>
                          ))}
                          {(!area.scoreRanges || area.scoreRanges.length === 0) && (
                            <span className="text-sm text-slate-400">No score levels defined</span>
                          )}
                        </div>
                      </div>

                      {/* Sample Questions */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                          Sample Questions
                        </h4>
                        <ul className="space-y-1">
                          {area.questions?.map((q) => (
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
                          {(!area.questions || area.questions.length === 0) && (
                            <li className="text-sm text-slate-400">No questions yet</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </div>
            </Card>
          ))}

          {areas.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-slate-500 mb-4">No resilience areas defined yet.</p>
              <Button onClick={() => setShowAddDialog(true)}>
                Create Your First Area
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Demographics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Demographic Questions</CardTitle>
              <CardDescription>
                Collect respondent information before the assessment for segmentation and analytics
              </CardDescription>
            </div>
            <Link href="/platform/content/demographics">
              <Button variant="outline">Manage Demographics</Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

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

      {/* Add Area Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Resilience Area</DialogTitle>
            <DialogDescription>
              Create a new area to include in the assessment. You can add questions and scoring later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="areaName">Area Name *</Label>
              <Input
                id="areaName"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="e.g., Emotional Resilience"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaDescription">Description</Label>
              <Textarea
                id="areaDescription"
                value={newAreaDescription}
                onChange={(e) => setNewAreaDescription(e.target.value)}
                placeholder="Brief description of this resilience area..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaColor">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="areaColor"
                  type="color"
                  value={newAreaColor}
                  onChange={(e) => setNewAreaColor(e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={newAreaColor}
                  onChange={(e) => setNewAreaColor(e.target.value)}
                  placeholder="#00B189"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setNewAreaName('');
                setNewAreaDescription('');
                setNewAreaColor('#00B189');
                setCreateError('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateArea}
              disabled={isCreating || !newAreaName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Area'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAreaId} onOpenChange={() => setDeleteAreaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteAreaName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this resilience area and all its questions, score ranges, and feedback content.
              If the area has existing assessment responses, it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArea}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
