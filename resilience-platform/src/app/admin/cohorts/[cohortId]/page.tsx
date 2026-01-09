'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  allowRetakes: boolean;
  maxRetakes: number;
  isActive: boolean;
  organization: { name: string };
}

interface AssessmentCode {
  id: string;
  code: string;
  status: string;
  timesUsed: number;
  createdAt: string;
  expiresAt: string | null;
}

interface Stats {
  totalCodes: number;
  usedCodes: number;
  completedAssessments: number;
}

export default function CohortDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cohortId = params.cohortId as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [codes, setCodes] = useState<AssessmentCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Code generation
  const [generateCount, setGenerateCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<Array<{ code: string; link: string }>>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const loadCohort = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/admin/cohorts/${cohortId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load cohort');
        return;
      }

      setCohort(data.cohort);
      setCodes(data.codes);
      setStats(data.stats);
    } catch {
      setError('Failed to load cohort');
    } finally {
      setIsLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    loadCohort();
  }, [loadCohort]);

  const handleGenerateCodes = async () => {
    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch(`/api/v1/admin/cohorts/${cohortId}/codes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: generateCount }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate codes');
        return;
      }

      setGeneratedCodes(data.codes);
      loadCohort(); // Refresh the list
    } catch {
      setError('Failed to generate codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCodesAsCsv = () => {
    const csv = [
      'Code,Link',
      ...generatedCodes.map((c) => `${c.code},${c.link}`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-codes-${cohort?.name || 'cohort'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'started':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (error && !cohort) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!cohort) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin/cohorts" className="text-slate-500 hover:text-slate-700">
              Cohorts
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900">{cohort.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{cohort.name}</h1>
          {cohort.description && (
            <p className="text-slate-600 mt-1">{cohort.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/cohorts/${cohortId}/analytics`}>
            <Button variant="outline">View Analytics</Button>
          </Link>
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>Generate Codes</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Assessment Codes</DialogTitle>
                <DialogDescription>
                  Create unique access codes for this cohort
                </DialogDescription>
              </DialogHeader>

              {generatedCodes.length > 0 ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Successfully generated {generatedCodes.length} codes!
                    </AlertDescription>
                  </Alert>
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedCodes.map((code) => (
                          <TableRow key={code.code}>
                            <TableCell className="font-mono">{code.code}</TableCell>
                            <TableCell className="text-xs truncate max-w-[200px]">
                              {code.link}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={downloadCodesAsCsv} className="flex-1">
                      Download CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGeneratedCodes([]);
                        setShowGenerateDialog(false);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="count">Number of codes</Label>
                    <Input
                      id="count"
                      type="number"
                      min={1}
                      max={500}
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    onClick={handleGenerateCodes}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? 'Generating...' : `Generate ${generateCount} Codes`}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Codes</CardDescription>
              <CardTitle className="text-2xl">{stats.totalCodes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Codes Used</CardDescription>
              <CardTitle className="text-2xl">{stats.usedCodes}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl">{stats.completedAssessments}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-500">Status</Label>
              <p>
                <Badge variant={cohort.isActive ? 'default' : 'secondary'}>
                  {cohort.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </p>
            </div>
            <div>
              <Label className="text-slate-500">Retakes</Label>
              <p>
                {cohort.allowRetakes
                  ? `Allowed${cohort.maxRetakes > 0 ? ` (max ${cohort.maxRetakes})` : ''}`
                  : 'Not allowed'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Codes List */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Codes</CardTitle>
          <CardDescription>
            {codes.length} code{codes.length !== 1 ? 's' : ''} in this cohort
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No codes generated yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono">{code.code}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(code.status)}>
                        {code.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{code.timesUsed}</TableCell>
                    <TableCell>
                      {new Date(code.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {code.expiresAt
                        ? new Date(code.expiresAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
