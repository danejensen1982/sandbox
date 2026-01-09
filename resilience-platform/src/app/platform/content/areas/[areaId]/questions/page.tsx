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

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  displayOrder: number;
  isReverseScored: boolean;
  weight: number;
  helpText: string | null;
  isActive: boolean;
}

interface AreaInfo {
  id: string;
  name: string;
  slug: string;
}

export default function QuestionsManagementPage() {
  const params = useParams();
  const areaId = params.areaId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for editing
  const [formText, setFormText] = useState('');
  const [formHelpText, setFormHelpText] = useState('');
  const [formWeight, setFormWeight] = useState(1);
  const [formIsReverse, setFormIsReverse] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = async () => {
    try {
      const [areaRes, questionsRes] = await Promise.all([
        fetch(`/api/v1/platform/areas/${areaId}`),
        fetch(`/api/v1/platform/areas/${areaId}/questions`),
      ]);

      if (areaRes.ok) {
        const areaData = await areaRes.json();
        setArea(areaData.area);
      }

      if (questionsRes.ok) {
        const questionsData = await questionsRes.json();
        setQuestions(questionsData.questions);
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

  const openEditDialog = (question: Question | null) => {
    if (question) {
      setEditingQuestion(question);
      setFormText(question.questionText);
      setFormHelpText(question.helpText || '');
      setFormWeight(Number(question.weight));
      setFormIsReverse(question.isReverseScored);
      setFormIsActive(question.isActive);
    } else {
      setEditingQuestion(null);
      setFormText('');
      setFormHelpText('');
      setFormWeight(1);
      setFormIsReverse(false);
      setFormIsActive(true);
    }
    setEditDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const url = editingQuestion
        ? `/api/v1/platform/areas/${areaId}/questions/${editingQuestion.id}`
        : `/api/v1/platform/areas/${areaId}/questions`;

      const response = await fetch(url, {
        method: editingQuestion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: formText,
          helpText: formHelpText || null,
          weight: formWeight,
          isReverseScored: formIsReverse,
          isActive: formIsActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save question');
        return;
      }

      setSuccess(editingQuestion ? 'Question updated' : 'Question created');
      setEditDialogOpen(false);
      loadData();
    } catch {
      setError('Failed to save question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(
        `/api/v1/platform/areas/${areaId}/questions/${questionId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        setError('Failed to delete question');
        return;
      }

      setSuccess('Question deleted');
      loadData();
    } catch {
      setError('Failed to delete question');
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
            {area?.name} - Questions
          </h1>
          <p className="text-slate-600 mt-1">
            Manage assessment questions for this resilience area
          </p>
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditDialog(null)}>Add Question</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </DialogTitle>
              <DialogDescription>
                {editingQuestion
                  ? 'Update the question details below'
                  : 'Create a new question for this resilience area'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="questionText">Question Text *</Label>
                <Textarea
                  id="questionText"
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  rows={3}
                  placeholder="Enter the question text..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="helpText">Help Text</Label>
                <Textarea
                  id="helpText"
                  value={formHelpText}
                  onChange={(e) => setFormHelpText(e.target.value)}
                  rows={2}
                  placeholder="Optional clarification for respondents..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    type="number"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={formWeight}
                    onChange={(e) => setFormWeight(parseFloat(e.target.value) || 1)}
                  />
                  <p className="text-xs text-slate-500">Default: 1.0</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isReverse">Reverse Scored</Label>
                    <Switch
                      id="isReverse"
                      checked={formIsReverse}
                      onCheckedChange={setFormIsReverse}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isActiveQ">Active</Label>
                    <Switch
                      id="isActiveQ"
                      checked={formIsActive}
                      onCheckedChange={setFormIsActive}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveQuestion} disabled={isSubmitting || !formText.trim()}>
                  {isSubmitting ? 'Saving...' : editingQuestion ? 'Save Changes' : 'Add Question'}
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

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>Questions ({questions.length})</CardTitle>
          <CardDescription>
            Questions are displayed in order. Drag to reorder (coming soon).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No questions yet.</p>
              <Button className="mt-4" onClick={() => openEditDialog(null)}>
                Add First Question
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className={`p-4 border rounded-lg ${!question.isActive ? 'bg-slate-50 opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-400">
                          #{index + 1}
                        </span>
                        {question.isReverseScored && (
                          <Badge variant="outline" className="text-xs">
                            Reverse
                          </Badge>
                        )}
                        {Number(question.weight) !== 1 && (
                          <Badge variant="secondary" className="text-xs">
                            Weight: {Number(question.weight)}
                          </Badge>
                        )}
                        {!question.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-900">{question.questionText}</p>
                      {question.helpText && (
                        <p className="text-sm text-slate-500 mt-1">
                          Help: {question.helpText}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(question)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteQuestion(question.id)}
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
    </div>
  );
}
