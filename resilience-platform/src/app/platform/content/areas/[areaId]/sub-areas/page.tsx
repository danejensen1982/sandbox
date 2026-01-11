'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SubArea {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  colorHex: string | null;
  isActive: boolean;
  _count: {
    questions: number;
  };
  scoreRanges: Array<{
    id: string;
    levelName: string;
    levelCode: string;
    minScore: number;
    maxScore: number;
    colorHex: string | null;
  }>;
  questions?: Array<{
    question: {
      id: string;
      questionText: string;
      displayOrder: number;
    };
  }>;
}

interface AreaInfo {
  id: string;
  name: string;
  slug: string;
}

interface AreaQuestion {
  id: string;
  questionText: string;
  displayOrder: number;
  isActive: boolean;
}

export default function SubAreasManagementPage() {
  const params = useParams();
  const areaId = params.areaId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [subAreas, setSubAreas] = useState<SubArea[]>([]);
  const [areaQuestions, setAreaQuestions] = useState<AreaQuestion[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubArea, setEditingSubArea] = useState<SubArea | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Form state for editing
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColorHex, setFormColorHex] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Reordering state
  const [isReordering, setIsReordering] = useState(false);

  const loadData = async () => {
    try {
      const [areaRes, subAreasRes] = await Promise.all([
        fetch(`/api/v1/platform/areas/${areaId}`),
        fetch(`/api/v1/platform/areas/${areaId}/sub-areas`),
      ]);

      if (areaRes.ok) {
        const areaData = await areaRes.json();
        setArea(areaData.area);
      }

      if (subAreasRes.ok) {
        const subAreasData = await subAreasRes.json();
        setSubAreas(subAreasData.subAreas);
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

  const openEditDialog = async (subArea: SubArea | null) => {
    setEditDialogOpen(true);
    setIsLoadingQuestions(true);
    setError('');

    try {
      // Fetch all questions for the area
      const questionsRes = await fetch(`/api/v1/platform/areas/${areaId}/questions`);
      if (questionsRes.ok) {
        const questionsData = await questionsRes.json();
        setAreaQuestions(questionsData.questions || []);
      }

      if (subArea) {
        // Fetch full sub-area details including question assignments
        const subAreaRes = await fetch(`/api/v1/platform/areas/${areaId}/sub-areas/${subArea.id}`);
        if (subAreaRes.ok) {
          const subAreaData = await subAreaRes.json();
          const fullSubArea = subAreaData.subArea;

          setEditingSubArea(fullSubArea);
          setFormName(fullSubArea.name);
          setFormDescription(fullSubArea.description || '');
          setFormColorHex(fullSubArea.colorHex || '');
          setFormIsActive(fullSubArea.isActive);

          // Set selected question IDs from the sub-area's assignments
          const assignedIds = new Set<string>(
            (fullSubArea.questions || []).map((q: { question: { id: string } }) => q.question.id)
          );
          setSelectedQuestionIds(assignedIds);
        }
      } else {
        setEditingSubArea(null);
        setFormName('');
        setFormDescription('');
        setFormColorHex('');
        setFormIsActive(true);
        setSelectedQuestionIds(new Set());
      }
    } catch {
      setError('Failed to load questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSaveSubArea = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const url = editingSubArea
        ? `/api/v1/platform/areas/${areaId}/sub-areas/${editingSubArea.id}`
        : `/api/v1/platform/areas/${areaId}/sub-areas`;

      const response = await fetch(url, {
        method: editingSubArea ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          colorHex: formColorHex || null,
          isActive: formIsActive,
          questionIds: Array.from(selectedQuestionIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save sub-area');
        return;
      }

      setSuccess(editingSubArea ? 'Sub-area updated' : 'Sub-area created');
      setEditDialogOpen(false);
      loadData();
    } catch {
      setError('Failed to save sub-area');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubArea = async (subAreaId: string) => {
    if (!confirm('Are you sure you want to delete this sub-area?')) return;

    try {
      const response = await fetch(
        `/api/v1/platform/areas/${areaId}/sub-areas/${subAreaId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        setError('Failed to delete sub-area');
        return;
      }

      const data = await response.json();
      if (data.deactivated) {
        setSuccess('Sub-area deactivated (has question assignments)');
      } else {
        setSuccess('Sub-area deleted');
      }
      loadData();
    } catch {
      setError('Failed to delete sub-area');
    }
  };

  const handleMoveSubArea = async (subAreaId: string, direction: 'up' | 'down') => {
    const currentIndex = subAreas.findIndex((s) => s.id === subAreaId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= subAreas.length) return;

    // Reorder locally first for immediate feedback
    const newSubAreas = [...subAreas];
    const [movedSubArea] = newSubAreas.splice(currentIndex, 1);
    newSubAreas.splice(newIndex, 0, movedSubArea);
    setSubAreas(newSubAreas);

    // Send to server
    setIsReordering(true);
    setError('');

    try {
      const response = await fetch(`/api/v1/platform/areas/${areaId}/sub-areas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: newSubAreas.map((s) => s.id),
        }),
      });

      if (!response.ok) {
        // Revert on error
        loadData();
        setError('Failed to reorder sub-areas');
      }
    } catch {
      loadData();
      setError('Failed to reorder sub-areas');
    } finally {
      setIsReordering(false);
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
            {area?.name} - Sub-Areas
          </h1>
          <p className="text-slate-600 mt-1">
            Define scoring dimensions within this resilience area
          </p>
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditDialog(null)}>Add Sub-Area</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSubArea ? 'Edit Sub-Area' : 'Add New Sub-Area'}
              </DialogTitle>
              <DialogDescription>
                {editingSubArea
                  ? 'Update the sub-area details and assign questions'
                  : 'Create a new sub-area for granular scoring'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subAreaName">Name *</Label>
                <Input
                  id="subAreaName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Optimism"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subAreaDescription">Description</Label>
                <Textarea
                  id="subAreaDescription"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of this sub-area..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="colorHex">Color (Hex)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="colorHex"
                      value={formColorHex}
                      onChange={(e) => setFormColorHex(e.target.value)}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                    {formColorHex && (
                      <div
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: formColorHex }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isActiveSubArea">Active</Label>
                  <div className="pt-2">
                    <Switch
                      id="isActiveSubArea"
                      checked={formIsActive}
                      onCheckedChange={setFormIsActive}
                    />
                  </div>
                </div>
              </div>

              {/* Question Assignment Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Assign Questions</Label>
                  <span className="text-xs text-slate-500">
                    {selectedQuestionIds.size} of {areaQuestions.length} selected
                  </span>
                </div>
                {isLoadingQuestions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900" />
                  </div>
                ) : areaQuestions.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg">
                    <p className="text-sm">No questions in this area yet.</p>
                    <p className="text-xs mt-1">Add questions to the area first.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {areaQuestions
                      .filter((q) => q.isActive)
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((question) => (
                        <label
                          key={question.id}
                          className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                            checked={selectedQuestionIds.has(question.id)}
                            onChange={() => toggleQuestionSelection(question.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-slate-700 line-clamp-2">
                              {question.questionText}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5 block">
                              Question {question.displayOrder}
                            </span>
                          </div>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveSubArea} disabled={isSubmitting || !formName.trim()}>
                  {isSubmitting ? 'Saving...' : editingSubArea ? 'Save Changes' : 'Add Sub-Area'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

      {/* Sub-Areas List */}
      <Card>
        <CardHeader>
          <CardTitle>Sub-Areas ({subAreas.length})</CardTitle>
          <CardDescription>
            Sub-areas are used to calculate separate scores within an area.
            Questions can be assigned to multiple sub-areas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subAreas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No sub-areas defined yet.</p>
              <p className="text-sm mt-1">
                Sub-areas enable granular scoring within this area.
              </p>
              <Button className="mt-4" onClick={() => openEditDialog(null)}>
                Add First Sub-Area
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {subAreas.map((subArea, index) => (
                <div
                  key={subArea.id}
                  className={`p-4 border rounded-lg ${!subArea.isActive ? 'bg-slate-50 opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        disabled={index === 0 || isReordering}
                        onClick={() => handleMoveSubArea(subArea.id, 'up')}
                      >
                        <span className="text-xs">&#9650;</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        disabled={index === subAreas.length - 1 || isReordering}
                        onClick={() => handleMoveSubArea(subArea.id, 'down')}
                      >
                        <span className="text-xs">&#9660;</span>
                      </Button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {subArea.colorHex && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: subArea.colorHex }}
                          />
                        )}
                        <span className="font-medium text-slate-900">
                          {subArea.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {subArea._count.questions} questions
                        </Badge>
                        {subArea.scoreRanges.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {subArea.scoreRanges.length} score ranges
                          </Badge>
                        )}
                        {!subArea.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {subArea.description && (
                        <p className="text-sm text-slate-500 mt-1">
                          {subArea.description}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Slug: {subArea.slug}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link href={`/platform/content/areas/${areaId}/sub-areas/${subArea.id}/scoring`}>
                        <Button variant="ghost" size="sm">
                          Scoring
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(subArea)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteSubArea(subArea.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link href={`/platform/content/areas/${areaId}/questions`}>
          <Button variant="outline">Manage Questions</Button>
        </Link>
        <Link href={`/platform/content/areas/${areaId}/feedback-rules`}>
          <Button variant="outline">Feedback Rules</Button>
        </Link>
      </div>
    </div>
  );
}
