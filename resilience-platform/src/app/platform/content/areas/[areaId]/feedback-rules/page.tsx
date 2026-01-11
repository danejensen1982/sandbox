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
import { Checkbox } from '@/components/ui/checkbox';
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
  name: string;
  slug: string;
  colorHex: string | null;
  scoreRanges: Array<{
    id: string;
    levelName: string;
    levelCode: string;
  }>;
}

interface FeedbackCondition {
  id?: string;
  subAreaId: string;
  levelCodes: string[];
  subArea: {
    id: string;
    name: string;
    slug: string;
    colorHex: string | null;
  };
}

interface FeedbackRule {
  id: string;
  name: string;
  feedbackContent: string;
  priority: number;
  isActive: boolean;
  conditions: FeedbackCondition[];
}

interface AreaInfo {
  id: string;
  name: string;
  slug: string;
}

export default function FeedbackRulesPage() {
  const params = useParams();
  const areaId = params.areaId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [subAreas, setSubAreas] = useState<SubArea[]>([]);
  const [rules, setRules] = useState<FeedbackRule[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FeedbackRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formConditions, setFormConditions] = useState<Record<string, string[]>>({});

  // Reordering state
  const [isReordering, setIsReordering] = useState(false);

  const loadData = async () => {
    try {
      const [areaRes, subAreasRes, rulesRes] = await Promise.all([
        fetch(`/api/v1/platform/areas/${areaId}`),
        fetch(`/api/v1/platform/areas/${areaId}/sub-areas`),
        fetch(`/api/v1/platform/areas/${areaId}/feedback-rules`),
      ]);

      if (areaRes.ok) {
        const areaData = await areaRes.json();
        setArea(areaData.area);
      }

      if (subAreasRes.ok) {
        const subAreasData = await subAreasRes.json();
        setSubAreas(subAreasData.subAreas.filter((sa: SubArea & { isActive: boolean }) => sa.isActive));
      }

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.feedbackRules);
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

  const openEditDialog = (rule: FeedbackRule | null) => {
    if (rule) {
      setEditingRule(rule);
      setFormName(rule.name);
      setFormContent(rule.feedbackContent);
      setFormIsActive(rule.isActive);
      // Convert conditions to record format
      const conditionsMap: Record<string, string[]> = {};
      rule.conditions.forEach((c) => {
        conditionsMap[c.subAreaId] = c.levelCodes;
      });
      setFormConditions(conditionsMap);
    } else {
      setEditingRule(null);
      setFormName('');
      setFormContent('');
      setFormIsActive(true);
      setFormConditions({});
    }
    setEditDialogOpen(true);
  };

  const toggleLevelCode = (subAreaId: string, levelCode: string) => {
    setFormConditions((prev) => {
      const currentCodes = prev[subAreaId] || [];
      if (currentCodes.includes(levelCode)) {
        const newCodes = currentCodes.filter((c) => c !== levelCode);
        if (newCodes.length === 0) {
          const { [subAreaId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [subAreaId]: newCodes };
      } else {
        return { ...prev, [subAreaId]: [...currentCodes, levelCode] };
      }
    });
  };

  const setAllLevels = (subAreaId: string, subArea: SubArea) => {
    const allCodes = subArea.scoreRanges.map((sr) => sr.levelCode);
    setFormConditions((prev) => ({ ...prev, [subAreaId]: allCodes }));
  };

  const clearLevels = (subAreaId: string) => {
    setFormConditions((prev) => {
      const { [subAreaId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveRule = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      // Build conditions array
      const conditions = Object.entries(formConditions)
        .filter(([, levelCodes]) => levelCodes.length > 0)
        .map(([subAreaId, levelCodes]) => ({
          subAreaId,
          levelCodes,
        }));

      const url = editingRule
        ? `/api/v1/platform/areas/${areaId}/feedback-rules/${editingRule.id}`
        : `/api/v1/platform/areas/${areaId}/feedback-rules`;

      const response = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          feedbackContent: formContent,
          isActive: formIsActive,
          conditions,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save feedback rule');
        return;
      }

      setSuccess(editingRule ? 'Feedback rule updated' : 'Feedback rule created');
      setEditDialogOpen(false);
      loadData();
    } catch {
      setError('Failed to save feedback rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this feedback rule?')) return;

    try {
      const response = await fetch(
        `/api/v1/platform/areas/${areaId}/feedback-rules/${ruleId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        setError('Failed to delete feedback rule');
        return;
      }

      setSuccess('Feedback rule deleted');
      loadData();
    } catch {
      setError('Failed to delete feedback rule');
    }
  };

  const handleMoveRule = async (ruleId: string, direction: 'up' | 'down') => {
    const currentIndex = rules.findIndex((r) => r.id === ruleId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= rules.length) return;

    // Reorder locally first
    const newRules = [...rules];
    const [movedRule] = newRules.splice(currentIndex, 1);
    newRules.splice(newIndex, 0, movedRule);
    setRules(newRules);

    // Send to server
    setIsReordering(true);
    setError('');

    try {
      const response = await fetch(`/api/v1/platform/areas/${areaId}/feedback-rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: newRules.map((r) => r.id),
        }),
      });

      if (!response.ok) {
        loadData();
        setError('Failed to reorder feedback rules');
      }
    } catch {
      loadData();
      setError('Failed to reorder feedback rules');
    } finally {
      setIsReordering(false);
    }
  };

  const formatConditionDisplay = (condition: FeedbackCondition) => {
    if (condition.levelCodes.length === 0) {
      return 'Any level';
    }
    return condition.levelCodes.join(', ');
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
            {area?.name} - Feedback Rules
          </h1>
          <p className="text-slate-600 mt-1">
            Configure conditional feedback based on sub-area score combinations
          </p>
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditDialog(null)} disabled={subAreas.length === 0}>
              Add Feedback Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Feedback Rule' : 'Add New Feedback Rule'}
              </DialogTitle>
              <DialogDescription>
                {editingRule
                  ? 'Update the feedback rule and conditions'
                  : 'Create a conditional feedback message based on sub-area scores'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name *</Label>
                <Input
                  id="ruleName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., High optimism, low tools"
                />
                <p className="text-xs text-slate-500">
                  An admin-friendly name to identify this rule
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedbackContent">Feedback Content *</Label>
                <Textarea
                  id="feedbackContent"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={6}
                  placeholder="<p>Your feedback HTML content here...</p>"
                />
                <p className="text-xs text-slate-500">
                  HTML content that will be displayed when this rule matches
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isActiveRule">Active</Label>
                <Switch
                  id="isActiveRule"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>

              {/* Conditions */}
              <div className="space-y-3">
                <Label>Match Conditions</Label>
                <p className="text-xs text-slate-500">
                  Select which sub-area levels must match for this feedback to show.
                  Leave empty for &quot;any level&quot; (wildcard).
                </p>

                {subAreas.length === 0 ? (
                  <div className="text-sm text-slate-500 p-3 border rounded-lg bg-slate-50">
                    No sub-areas defined.{' '}
                    <Link href={`/platform/content/areas/${areaId}/sub-areas`} className="text-blue-600 hover:underline">
                      Create sub-areas first
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {subAreas.map((subArea) => (
                      <div key={subArea.id} className="p-3 border rounded-lg bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {subArea.colorHex && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: subArea.colorHex }}
                              />
                            )}
                            <span className="font-medium">{subArea.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllLevels(subArea.id, subArea)}
                            >
                              All
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => clearLevels(subArea.id)}
                            >
                              None (Any)
                            </Button>
                          </div>
                        </div>
                        {subArea.scoreRanges.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No score ranges defined.{' '}
                            <Link
                              href={`/platform/content/areas/${areaId}/sub-areas/${subArea.id}/scoring`}
                              className="text-blue-600 hover:underline"
                            >
                              Add score ranges
                            </Link>
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {subArea.scoreRanges.map((sr) => (
                              <div key={sr.levelCode} className="flex items-center gap-1">
                                <Checkbox
                                  id={`${subArea.id}-${sr.levelCode}`}
                                  checked={formConditions[subArea.id]?.includes(sr.levelCode) || false}
                                  onCheckedChange={() => toggleLevelCode(subArea.id, sr.levelCode)}
                                />
                                <label
                                  htmlFor={`${subArea.id}-${sr.levelCode}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {sr.levelName}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        {!formConditions[subArea.id] || formConditions[subArea.id].length === 0 ? (
                          <p className="text-xs text-slate-400 mt-1">
                            Matches: Any level
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-1">
                            Matches: {formConditions[subArea.id].join(', ')}
                          </p>
                        )}
                      </div>
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
                <Button
                  onClick={handleSaveRule}
                  disabled={isSubmitting || !formName.trim() || !formContent.trim()}
                >
                  {isSubmitting ? 'Saving...' : editingRule ? 'Save Changes' : 'Add Rule'}
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

      {subAreas.length === 0 && (
        <Alert>
          <AlertDescription>
            You need to create sub-areas before adding feedback rules.{' '}
            <Link href={`/platform/content/areas/${areaId}/sub-areas`} className="underline">
              Create sub-areas
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Rules ({rules.length})</CardTitle>
          <CardDescription>
            Rules are evaluated in priority order. The first matching rule&apos;s feedback is shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No feedback rules defined yet.</p>
              {subAreas.length > 0 && (
                <Button className="mt-4" onClick={() => openEditDialog(null)}>
                  Add First Rule
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className={`p-4 border rounded-lg ${!rule.isActive ? 'bg-slate-50 opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        disabled={index === 0 || isReordering}
                        onClick={() => handleMoveRule(rule.id, 'up')}
                      >
                        <span className="text-xs">&#9650;</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        disabled={index === rules.length - 1 || isReordering}
                        onClick={() => handleMoveRule(rule.id, 'down')}
                      >
                        <span className="text-xs">&#9660;</span>
                      </Button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-400">
                          Priority {index + 1}
                        </span>
                        <span className="font-medium text-slate-900">{rule.name}</span>
                        {!rule.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {/* Conditions */}
                      {rule.conditions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {rule.conditions.map((condition) => (
                            <Badge
                              key={condition.subArea.id}
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: condition.subArea.colorHex || undefined,
                              }}
                            >
                              {condition.subArea.name}: {formatConditionDisplay(condition)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Preview of content */}
                      <div className="text-sm text-slate-600 mt-2 p-2 bg-slate-50 rounded max-h-20 overflow-hidden">
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: rule.feedbackContent.substring(0, 200) +
                              (rule.feedbackContent.length > 200 ? '...' : ''),
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteRule(rule.id)}
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

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Feedback Matching Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            1. After calculating sub-area scores, each score is mapped to a level (e.g., Developing, Strong).
          </p>
          <p>
            2. Rules are evaluated in priority order (lowest number first).
          </p>
          <p>
            3. For a rule to match, ALL conditions must be satisfied:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>If specific levels are selected, the participant&apos;s level must be one of them</li>
            <li>If no levels are selected (empty), any level matches (wildcard)</li>
          </ul>
          <p>
            4. The first fully matching rule&apos;s feedback content is displayed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
