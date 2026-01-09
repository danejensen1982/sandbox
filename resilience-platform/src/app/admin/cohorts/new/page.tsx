'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Organization {
  id: string;
  name: string;
}

export default function NewCohortPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [allowRetakes, setAllowRetakes] = useState(false);
  const [maxRetakes, setMaxRetakes] = useState(3);
  const [retakeCooldownDays, setRetakeCooldownDays] = useState(30);
  const [accessStartDate, setAccessStartDate] = useState('');
  const [accessEndDate, setAccessEndDate] = useState('');

  // New organization dialog state
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgError, setNewOrgError] = useState('');

  // Load organizations
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const orgsResponse = await fetch('/api/v1/admin/organizations');
        if (orgsResponse.ok) {
          const orgsData = await orgsResponse.json();
          setOrganizations(orgsData.organizations || []);
        }
      } catch {
        // Ignore errors, use default state
      } finally {
        setIsLoadingOrgs(false);
      }
    };

    loadOrganizations();
  }, []);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;

    setIsCreatingOrg(true);
    setNewOrgError('');

    try {
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setNewOrgError(data.error || 'Failed to create organization');
        return;
      }

      // Add the new organization to the list and select it
      setOrganizations((prev) => [...prev, data.organization].sort((a, b) => a.name.localeCompare(b.name)));
      setOrganizationId(data.organization.id);
      setShowNewOrgDialog(false);
      setNewOrgName('');
    } catch {
      setNewOrgError('Failed to create organization. Please try again.');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleOrganizationChange = (value: string) => {
    if (value === 'new') {
      setShowNewOrgDialog(true);
    } else {
      setOrganizationId(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/admin/cohorts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          organizationId: organizationId || undefined,
          allowRetakes,
          maxRetakes: allowRetakes ? maxRetakes : 0,
          retakeCooldownDays: allowRetakes ? retakeCooldownDays : 0,
          accessStartDate: accessStartDate || null,
          accessEndDate: accessEndDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create cohort');
        return;
      }

      // Redirect to the new cohort page
      router.push(`/admin/cohorts/${data.cohort.id}`);
    } catch {
      setError('Failed to create cohort. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/cohorts">
          <Button variant="ghost" size="sm">
            &larr; Back to Cohorts
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Cohort</CardTitle>
          <CardDescription>
            Set up a new cohort to organize and manage assessment participants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Organization Selection */}
            <div className="space-y-2">
              <Label htmlFor="organization">Organization *</Label>
              <Select value={organizationId} onValueChange={handleOrganizationChange} disabled={isLoadingOrgs}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingOrgs ? "Loading organizations..." : "Select an organization"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new" className="text-primary font-medium">
                    + Add new organization
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cohort Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Cohort Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Leadership Cohort 2025"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this cohort..."
                rows={3}
              />
            </div>

            {/* Access Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessStartDate">Access Start Date</Label>
                <Input
                  id="accessStartDate"
                  type="date"
                  value={accessStartDate}
                  onChange={(e) => setAccessStartDate(e.target.value)}
                />
                <p className="text-xs text-slate-500">Leave empty for immediate access</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessEndDate">Access End Date</Label>
                <Input
                  id="accessEndDate"
                  type="date"
                  value={accessEndDate}
                  onChange={(e) => setAccessEndDate(e.target.value)}
                />
                <p className="text-xs text-slate-500">Leave empty for no expiration</p>
              </div>
            </div>

            {/* Retake Settings */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allowRetakes">Allow Retakes</Label>
                  <p className="text-sm text-slate-500">
                    Let participants retake the assessment
                  </p>
                </div>
                <Switch
                  id="allowRetakes"
                  checked={allowRetakes}
                  onCheckedChange={setAllowRetakes}
                />
              </div>

              {allowRetakes && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="maxRetakes">Maximum Retakes</Label>
                    <Input
                      id="maxRetakes"
                      type="number"
                      min={0}
                      value={maxRetakes}
                      onChange={(e) => setMaxRetakes(parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">0 = unlimited</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retakeCooldownDays">Cooldown Period (days)</Label>
                    <Input
                      id="retakeCooldownDays"
                      type="number"
                      min={0}
                      value={retakeCooldownDays}
                      onChange={(e) => setRetakeCooldownDays(parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">Days between retakes</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting || !name.trim() || !organizationId}>
                {isSubmitting ? 'Creating...' : 'Create Cohort'}
              </Button>
              <Link href="/admin/cohorts">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* New Organization Dialog */}
      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Add a new organization to the platform. You can then create cohorts for this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {newOrgError && (
              <Alert variant="destructive">
                <AlertDescription>{newOrgError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="newOrgName">Organization Name</Label>
              <Input
                id="newOrgName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g., Acme Corporation"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewOrgDialog(false);
                setNewOrgName('');
                setNewOrgError('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrganization}
              disabled={isCreatingOrg || !newOrgName.trim()}
            >
              {isCreatingOrg ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
