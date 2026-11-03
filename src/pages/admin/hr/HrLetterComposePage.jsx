import React, { useEffect, useState } from 'react';
import { Send, Download, Eye, Loader2 } from 'lucide-react';
import { hrLetterService } from '@/services/hrLetterService';
import { generateHrLetterPdf } from '@/utils/hrLetterPdf';
import SearchSelect from '@/components/erp/SearchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function HrLetterComposePage({ letterType, title, subtitle }) {
  const { toast } = useToast();
  const [people, setPeople] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [personKey, setPersonKey] = useState('');

  const pickedPerson = people.find((p) => `${p.kind}:${p.id}` === personKey);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [extras, setExtras] = useState({
    leave_start: '', leave_end: '', leave_reason: '',
    permission_date: '', permission_reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [lastRef, setLastRef] = useState('');

  const load = async () => {
    try {
      const [p, t, h] = await Promise.all([
        hrLetterService.listPeople(),
        hrLetterService.listTemplates(letterType),
        hrLetterService.history(letterType),
      ]);
      setPeople(p.data || []);
      setTemplates(t.data || []);
      setHistory(h.data || []);
      if ((t.data || []).length && !templateId) {
        setTemplateId(t.data[0].id);
      }
    } catch (e) {
      toast({ title: 'Could not load letter data', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => { load(); }, [letterType]);

  const buildExtras = () => {
    if (letterType === 'leave_of_absence') {
      return { leave_start: extras.leave_start, leave_end: extras.leave_end, leave_reason: extras.leave_reason };
    }
    if (letterType === 'permission') {
      return { permission_date: extras.permission_date, permission_reason: extras.permission_reason };
    }
    return {};
  };

  const preview = async () => {
    if (!pickedPerson) return toast({ title: 'Select a recipient', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await hrLetterService.preview({
        template_id: templateId,
        staff_profile_id: pickedPerson.kind === 'staff' ? pickedPerson.id : undefined,
        user_id: pickedPerson.kind === 'user' ? pickedPerson.id : undefined,
        extras: buildExtras(),
      });
      setSubject(res.data.subject);
      setBody(res.data.body);
      toast({ title: 'Preview ready', description: 'You can edit the letter before sending.' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!pickedPerson || !subject || !body) {
      return toast({ title: 'Complete the letter', description: 'Select a recipient and generate or edit subject/body.', variant: 'destructive' });
    }
    setLoading(true);
    try {
      const res = await hrLetterService.send({
        template_id: templateId || null,
        staff_profile_id: pickedPerson.kind === 'staff' ? pickedPerson.id : undefined,
        user_id: pickedPerson.kind === 'user' ? pickedPerson.id : undefined,
        letter_type: letterType,
        subject,
        body,
        extras: buildExtras(),
        send_whatsapp: true,
      });
      setLastRef(res.reference_code);
      toast({
        title: 'Letter sent',
        description: res.whatsapp_sent ? 'Saved and sent via WhatsApp.' : 'Saved (WhatsApp not sent — check phone).',
      });
      load();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!subject || !body) return toast({ title: 'Generate preview first', variant: 'destructive' });
    const [first, ...rest] = String(pickedPerson?.label || 'Recipient').split(/\s+/);
    generateHrLetterPdf({
      subject,
      body,
      staff: { first_name: first, last_name: rest.join(' '), phone: pickedPerson?.phone },
      referenceCode: lastRef,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#003D82]">{title}</h1>
        <p className="text-gray-500">{subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Compose letter</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select recipient</Label>
              <SearchSelect
                className="mt-1"
                value={personKey}
                onChange={setPersonKey}
                placeholder="Search staff or user…"
                emptyLabel="No staff or users found"
                options={people.map((p) => ({
                  value: `${p.kind}:${p.id}`,
                  label: p.label,
                  hint: p.hint || p.phone || '',
                }))}
              />
              <p className="text-xs text-slate-500 mt-1">
                Same as Beyond letters: search HR staff or system users, then send on WhatsApp.
              </p>
            </div>
            <div>
              <Label>Template</Label>
              <SearchSelect
                className="mt-1"
                value={templateId}
                onChange={setTemplateId}
                placeholder="Search template…"
                allowClear={false}
                options={templates.map((t) => ({
                  value: t.id,
                  label: t.name,
                  hint: t.is_default ? 'default' : '',
                }))}
              />
            </div>

            {letterType === 'leave_of_absence' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Leave start</Label><Input type="date" value={extras.leave_start} onChange={(e) => setExtras({ ...extras, leave_start: e.target.value })} /></div>
                <div><Label>Leave end</Label><Input type="date" value={extras.leave_end} onChange={(e) => setExtras({ ...extras, leave_end: e.target.value })} /></div>
                <div className="col-span-2"><Label>Reason</Label><Input value={extras.leave_reason} onChange={(e) => setExtras({ ...extras, leave_reason: e.target.value })} /></div>
              </div>
            )}

            {letterType === 'permission' && (
              <div className="space-y-3">
                <div><Label>Permission date</Label><Input type="date" value={extras.permission_date} onChange={(e) => setExtras({ ...extras, permission_date: e.target.value })} /></div>
                <div><Label>Reason</Label><Input value={extras.permission_reason} onChange={(e) => setExtras({ ...extras, permission_reason: e.target.value })} /></div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={preview} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                Preview / Fill
              </Button>
              <Button className="bg-[#003D82]" onClick={send} disabled={loading}>
                <Send className="w-4 h-4 mr-1" /> Send to staff
              </Button>
              <Button variant="secondary" onClick={downloadPdf}><Download className="w-4 h-4 mr-1" /> PDF</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Edit letter content</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><Label>Body</Label><Textarea rows={16} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" /></div>
            <p className="text-xs text-gray-500">
              Placeholders: {'{STAFF_NAME}'}, {'{STAFF_CODE}'}, {'{POSITION}'}, {'{HIRE_DATE}'}, {'{DATE}'}, {'{COMPANY}'}
            </p>
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent letters</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.slice(0, 8).map((h) => (
              <div key={h.id} className="flex justify-between text-sm border-b py-2">
                <span>{h.first_name} {h.last_name} — {h.subject}</span>
                <span className="text-gray-500">{h.reference_code} · {h.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function HrLeaveLetterPage() {
  return (
    <HrLetterComposePage
      letterType="leave_of_absence"
      title="Leave of Absence"
      subtitle="Generate and send leave of absence letters to staff."
    />
  );
}

export function HrPermissionLetterPage() {
  return (
    <HrLetterComposePage
      letterType="permission"
      title="Permission"
      subtitle="Authorise staff permission / absence for a specific date."
    />
  );
}

export function HrEmploymentLetterPage() {
  return (
    <HrLetterComposePage
      letterType="employment_letter"
      title="Employment Letter"
      subtitle="Issue official employment confirmation letters."
    />
  );
}

export function HrAttestationLetterPage() {
  return (
    <HrLetterComposePage
      letterType="attestation_of_work"
      title="Attestation of Work"
      subtitle="Certify that a staff member has worked with Alpha Bridge."
    />
  );
}
