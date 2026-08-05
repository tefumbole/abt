import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErpSettings, saveErpSettings } from '@/services/erpService';

const DEFAULTS = {
  mail_from_name: '',
  mail_from_address: '',
  mail_host: '',
  mail_port: '587',
  mail_encryption: 'tls',
  mail_username: '',
  mail_driver: 'smtp',
};

export default function MailSettingsPanel({ onOpenEnv }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    (async () => {
      try {
        const s = (await getErpSettings()) || {};
        setForm({
          mail_from_name: s.mail_from_name ?? DEFAULTS.mail_from_name,
          mail_from_address: s.mail_from_address ?? DEFAULTS.mail_from_address,
          mail_host: s.mail_host ?? DEFAULTS.mail_host,
          mail_port: s.mail_port != null && s.mail_port !== '' ? String(s.mail_port) : DEFAULTS.mail_port,
          mail_encryption: s.mail_encryption ?? DEFAULTS.mail_encryption,
          mail_username: s.mail_username ?? DEFAULTS.mail_username,
          mail_driver: s.mail_driver ?? DEFAULTS.mail_driver,
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await saveErpSettings({
        mail_from_name: form.mail_from_name.trim(),
        mail_from_address: form.mail_from_address.trim(),
        mail_host: form.mail_host.trim(),
        mail_port: form.mail_port === '' ? null : Number(form.mail_port),
        mail_encryption: form.mail_encryption,
        mail_username: form.mail_username.trim(),
        mail_driver: form.mail_driver,
      });
      toast.success('Mail settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>;
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-[#003D82]">Mail Setting</CardTitle>
          <CardDescription>Outbound mail identity and SMTP server used for system emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mail_from_name">From name</Label>
              <Input
                id="mail_from_name"
                value={form.mail_from_name}
                onChange={(e) => setField('mail_from_name', e.target.value)}
                placeholder="Alpha Bridge"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail_from_address">From address</Label>
              <Input
                id="mail_from_address"
                type="email"
                value={form.mail_from_address}
                onChange={(e) => setField('mail_from_address', e.target.value)}
                placeholder="no-reply@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Mail driver</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.mail_driver}
                onChange={(e) => setField('mail_driver', e.target.value)}
              >
                <option value="smtp">SMTP</option>
                <option value="sendmail">Sendmail</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail_host">SMTP host</Label>
              <Input
                id="mail_host"
                value={form.mail_host}
                onChange={(e) => setField('mail_host', e.target.value)}
                placeholder="smtp.hostinger.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail_port">SMTP port</Label>
              <Input
                id="mail_port"
                type="number"
                min="0"
                value={form.mail_port}
                onChange={(e) => setField('mail_port', e.target.value)}
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label>Encryption</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.mail_encryption}
                onChange={(e) => setField('mail_encryption', e.target.value)}
              >
                <option value="none">None</option>
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mail_username">SMTP username</Label>
              <Input
                id="mail_username"
                value={form.mail_username}
                onChange={(e) => setField('mail_username', e.target.value)}
                placeholder="no-reply@example.com"
              />
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <KeyRound className="h-4 w-4" /> SMTP password is not stored here
            </p>
            <p className="mt-1 text-xs">
              For security the password stays in the API environment file as <code>SMTP_PASS</code>. Update it under
              .env Settings and restart the API.
            </p>
            {onOpenEnv ? (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onOpenEnv}>
                Open .env Settings
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="bg-[#003D82]">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save mail settings
      </Button>
    </form>
  );
}
