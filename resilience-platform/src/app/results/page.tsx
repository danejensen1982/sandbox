'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResultsDashboard } from '@/components/results/ResultsDashboard';
import type { ScoringResult } from '@/lib/scoring/engine';

interface ResultsData {
  results: ScoringResult;
  completedAt: string;
  cohortName: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      router.push('/assess');
      return;
    }

    const loadResults = async () => {
      try {
        const response = await fetch('/api/v1/assessment/results', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load results');
          setStatus('error');
          return;
        }

        setResultsData(data);
        setStatus('ready');
      } catch {
        setError('Failed to load results. Please try again.');
        setStatus('error');
      }
    };

    loadResults();
  }, [token, router]);

  const handleDownloadPdf = async () => {
    if (!dashboardRef.current) return;

    setIsGeneratingPdf(true);

    try {
      // Dynamically import jspdf and html2canvas for client-side PDF generation
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const element = dashboardRef.current;

      // Create canvas from the dashboard
      // Use onclone to convert unsupported CSS color functions (lab, oklch, etc.) to rgb
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Convert all elements with unsupported color functions to computed rgb values
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const computedStyle = window.getComputedStyle(htmlEl);

            // Get the computed color values (browser converts to rgb)
            const bgColor = computedStyle.backgroundColor;
            const textColor = computedStyle.color;
            const borderColor = computedStyle.borderColor;

            // Apply the computed rgb values directly
            if (bgColor) htmlEl.style.backgroundColor = bgColor;
            if (textColor) htmlEl.style.color = textColor;
            if (borderColor) htmlEl.style.borderColor = borderColor;
          });
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download the PDF
      pdf.save('resilience-assessment-results.pdf');

      // Log audit event
      if (token) {
        fetch('/api/v1/assessment/results/pdf-downloaded', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {
          // Ignore errors from audit logging
        });
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4" />
            <p className="text-slate-600">Loading your results...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-slate-900">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/assess')} variant="outline" className="w-full">
              Enter Code Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!resultsData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-5xl mx-auto" ref={dashboardRef}>
        <ResultsDashboard
          results={resultsData.results}
          completedAt={resultsData.completedAt}
          onDownloadPdf={handleDownloadPdf}
          isGeneratingPdf={isGeneratingPdf}
        />
      </div>

      {/* Return to assessment link */}
      <div className="max-w-5xl mx-auto mt-8 text-center">
        <p className="text-sm text-slate-500">
          Want to take the assessment again?{' '}
          <button
            onClick={() => router.push('/assess')}
            className="text-blue-600 hover:underline"
          >
            Enter your code
          </button>
        </p>
      </div>
    </div>
  );
}
