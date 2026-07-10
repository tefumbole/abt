import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Loader2, Save, Settings } from 'lucide-react';
import announcementsApiClient from '@/lib/announcementsApiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AnnouncementSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: 'Alpha Bridge',
    defaultHeader: 'Alpha Bridge',
    serialPrefix: 'ABT/ANN',
    nextSerial: 1,
    serialPadding: 6,
    timezone: 'Africa/Douala',
    timezoneOffset: '+01:00',
  });

  useEffect(() => {
    announcementsApiClient
      .fetch('/announcements/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setForm((prev) => ({ ...prev, ...data.settings }));
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await announcementsApiClient.fetch('/announcements/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.settings) setForm((prev) => ({ ...prev, ...data.settings }));
      toast.success('Announcement settings saved.');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Announcement Settings | Admin</title></Helmet>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#003D82]">
            <Settings className="w-8 h-8" /> Announcement Settings
          </h1>
          <p className="text-muted-foreground mt-1">Serial numbers, default header, and timezone for bulk WhatsApp.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Matches New Vision Travel announcements module defaults.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div>
                <Label>Default Message Header</Label>
                <Input value={form.defaultHeader} onChange={(e) => setForm({ ...form, defaultHeader: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Serial Prefix</Label>
                  <Input value={form.serialPrefix} onChange={(e) => setForm({ ...form, serialPrefix: e.target.value })} />
                </div>
                <div>
                  <Label>Next Serial Number</Label>
                  <Input type="number" min={1} value={form.nextSerial} onChange={(e) => setForm({ ...form, nextSerial: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Serial Padding (digits)</Label>
                  <Input type="number" min={1} max={10} value={form.serialPadding} onChange={(e) => setForm({ ...form, serialPadding: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Timezone Offset</Label>
                  <Input value={form.timezoneOffset} onChange={(e) => setForm({ ...form, timezoneOffset: e.target.value })} placeholder="+01:00" />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AnnouncementSettingsPage;
