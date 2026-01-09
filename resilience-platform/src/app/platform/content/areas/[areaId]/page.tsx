'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ResilienceArea {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconName: string | null;
  colorHex: string | null;
  displayOrder: number;
  isActive: boolean;
}

export default function EditAreaPage() {
  const router = useRouter();
  const params = useParams();
  const areaId = params.areaId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [iconName, setIconName] = useState('');
  const [colorHex, setColorHex] = useState('#3B82F6');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const loadArea = async () => {
      try {
        const response = await fetch(`/api/v1/platform/areas/${areaId}`);
        if (response.ok) {
          const data = await response.json();
          const area: ResilienceArea = data.area;
          setName(area.name);
          setSlug(area.slug);
          setDescription(area.description || '');
          setIconName(area.iconName || '');
          setColorHex(area.colorHex || '#3B82F6');
          setDisplayOrder(area.displayOrder);
          setIsActive(area.isActive);
        } else {
          setError('Failed to load area');
        }
      } catch {
        setError('Failed to load area');
      } finally {
        setIsLoading(false);
      }
    };

    loadArea();
  }, [areaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/platform/areas/${areaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description,
          iconName,
          colorHex,
          displayOrder,
          isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update area');
        return;
      }

      setSuccess('Area updated successfully');
    } catch {
      setError('Failed to update area');
    } finally {
      setIsSubmitting(false);
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
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/platform/content">
          <Button variant="ghost" size="sm">&larr; Back to Content</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Resilience Area</CardTitle>
          <CardDescription>
            Update the configuration for this resilience area
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Area Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500">URL-friendly identifier</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iconName">Icon Name</Label>
                <Input
                  id="iconName"
                  value={iconName}
                  onChange={(e) => setIconName(e.target.value)}
                  placeholder="e.g., heart"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorHex">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="colorHex"
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min={1}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-sm text-slate-500">
                  Include this area in assessments
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link href="/platform/content">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link href={`/platform/content/areas/${areaId}/questions`}>
          <Button variant="outline">Manage Questions</Button>
        </Link>
        <Link href={`/platform/content/areas/${areaId}/feedback`}>
          <Button variant="outline">Manage Feedback</Button>
        </Link>
      </div>
    </div>
  );
}
