'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

interface DemographicOption {
  id?: string;
  value: string;
  label: string;
  displayOrder: number;
  isActive?: boolean;
}

interface DemographicQuestion {
  id: string;
  slug: string;
  questionText: string;
  questionType: string;
  isRequired: boolean;
  isActive: boolean;
  helpText: string | null;
  displayOrder: number;
  options: DemographicOption[];
  _count?: {
    responses: number;
  };
}

export default function DemographicsManagementPage() {
  const [questions, setQuestions] = useState<DemographicQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Add/Edit question dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DemographicQuestion | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [helpText, setHelpText] = useState('');
  const [options, setOptions] = useState<DemographicOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');

  // Delete confirmation
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [deleteQuestionText, setDeleteQuestionText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reordering
  const [isReordering, setIsReordering] = useState(false);

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/v1/platform/demographics');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setQuestions(data.questions || []);
    } catch {
      setError('Failed to load demographic questions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const openAddDialog = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setIsRequired(true);
    setHelpText('');
    setOptions([
      { value: '', label: '', displayOrder: 1 },
    ]);
    setDialogError('');
    setShowDialog(true);
  };

  const openEditDialog = (question: DemographicQuestion) => {
    setEditingQuestion(question);
    setQuestionText(question.questionText);
    setIsRequired(question.isRequired);
    setHelpText(question.helpText || '');
    setOptions(
      question.options.length > 0
        ? question.options.map((o, i) => ({ ...o, displayOrder: i + 1 }))
        : [{ value: '', label: '', displayOrder: 1 }]
    );
    setDialogError('');
    setShowDialog(true);
  };

  const handleAddOption = () => {
    setOptions([
      ...options,
      { value: '', label: '', displayOrder: options.length + 1 },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, field: 'value' | 'label', value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    // Auto-generate value from label if value is empty
    if (field === 'label' && !newOptions[index].value) {
      newOptions[index].value = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    setOptions(newOptions);
  };

  const handleSaveQuestion = async () => {
    if (!questionText.trim()) {
      setDialogError('Question text is required');
      return;
    }

    const validOptions = options.filter((o) => o.label.trim() && o.value.trim());
    if (validOptions.length === 0) {
      setDialogError('At least one option is required');
      return;
    }

    setIsSaving(true);
    setDialogError('');

    try {
      const url = editingQuestion
        ? `/api/v1/platform/demographics/${editingQuestion.id}`
        : '/api/v1/platform/demographics';

      const method = editingQuestion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionText.trim(),
          questionType: 'select',
          isRequired,
          helpText: helpText.trim() || null,
          options: validOptions.map((o, i) => ({
            id: o.id,
            value: o.value,
            label: o.label,
            displayOrder: i + 1,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setDialogError(data.error || 'Failed to save question');
        return;
      }

      setShowDialog(false);
      fetchQuestions();
    } catch {
      setDialogError('Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestionId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/platform/demographics/${deleteQuestionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete question');
        return;
      }

      setDeleteQuestionId(null);
      fetchQuestions();
    } catch {
      setError('Failed to delete question');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex((q) => q.id === questionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(currentIndex, 1);
    newQuestions.splice(newIndex, 0, movedQuestion);
    setQuestions(newQuestions);

    setIsReordering(true);
    try {
      const response = await fetch('/api/v1/platform/demographics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: newQuestions.map((q) => q.id),
        }),
      });

      if (!response.ok) {
        fetchQuestions();
        setError('Failed to reorder questions');
      }
    } catch {
      fetchQuestions();
      setError('Failed to reorder questions');
    } finally {
      setIsReordering(false);
    }
  };

  const handleToggleActive = async (question: DemographicQuestion) => {
    try {
      const response = await fetch(`/api/v1/platform/demographics/${question.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !question.isActive,
        }),
      });

      if (response.ok) {
        fetchQuestions();
      }
    } catch {
      setError('Failed to update question');
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
          <div className="flex items-center gap-4 mb-2">
            <Link href="/platform/content">
              <Button variant="ghost" size="sm">&larr; Back to Content</Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Demographic Questions</h1>
          <p className="text-slate-600 mt-1">
            Configure questions to capture respondent demographics before the assessment.
            Responses can be used for segmentation and analytics.
          </p>
        </div>
        <Button onClick={openAddDialog}>+ Add Question</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <Card key={question.id} className={!question.isActive ? 'opacity-60' : ''}>
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
                      onClick={() => handleMoveQuestion(question.id, 'up')}
                    >
                      <span className="text-xs">▲</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      disabled={index === questions.length - 1 || isReordering}
                      onClick={() => handleMoveQuestion(question.id, 'down')}
                    >
                      <span className="text-xs">▼</span>
                    </Button>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{question.questionText}</CardTitle>
                    {question.helpText && (
                      <CardDescription className="mt-1">{question.helpText}</CardDescription>
                    )}
                  </div>
                  <Badge variant={question.isActive ? 'default' : 'secondary'}>
                    {question.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {question.isRequired && (
                    <Badge variant="outline">Required</Badge>
                  )}
                  {question._count && question._count.responses > 0 && (
                    <Badge variant="outline" className="text-slate-500">
                      {question._count.responses} responses
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Switch
                    checked={question.isActive}
                    onCheckedChange={() => handleToggleActive(question)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(question)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDeleteQuestionId(question.id);
                      setDeleteQuestionText(question.questionText);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <Badge key={option.id || option.value} variant="secondary">
                    {option.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {questions.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-slate-500 mb-4">
              No demographic questions configured yet. Add questions to collect
              respondent information before the assessment.
            </p>
            <Button onClick={openAddDialog}>Add Your First Question</Button>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit Question' : 'Add Demographic Question'}
            </DialogTitle>
            <DialogDescription>
              Configure a dropdown question for demographic data collection.
              Respondents will always have the option to decline answering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {dialogError && (
              <Alert variant="destructive">
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="questionText">Question Text *</Label>
              <Input
                id="questionText"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g., What is your age range?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="helpText">Help Text (optional)</Label>
              <Input
                id="helpText"
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Additional context for the question"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isRequired"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
              <Label htmlFor="isRequired">
                Mark as required (respondents can still choose &quot;Prefer not to say&quot;)
              </Label>
            </div>

            <div className="space-y-3">
              <Label>Answer Options</Label>
              <p className="text-sm text-slate-500">
                A &quot;Prefer not to say&quot; option will be automatically added.
              </p>

              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Display label"
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value (auto)"
                    value={option.value}
                    onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                    className="w-40"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOption(index)}
                    disabled={options.length <= 1}
                    className="text-red-600"
                  >
                    Remove
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
              >
                + Add Option
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuestion}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : editingQuestion ? 'Save Changes' : 'Create Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteQuestionId} onOpenChange={() => setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteQuestionText}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete this demographic question and all its options.
              If the question has existing responses, it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
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
