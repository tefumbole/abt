import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
	Megaphone, Plus, Send, Trash2, Search, Paperclip, Save, Calendar, Users, Eye, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import announcementsApiClient from '@/lib/announcementsApiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';

const CATEGORIES = [
	{ value: 'general', label: 'General' },
	{ value: 'travel', label: 'Travel Updates' },
	{ value: 'promotions', label: 'Promotions' },
	{ value: 'finance', label: 'Finance' },
	{ value: 'events', label: 'Events' },
	{ value: 'emergency', label: 'Emergency' },
];

const RECIPIENT_TABS = [
	{ value: 'customers', label: 'Customers', selectAllLabel: 'All Customers' },
	{ value: 'users', label: 'System Users', selectAllLabel: 'All Users' },
	{ value: 'custom', label: 'Custom Phone', selectAllLabel: '' },
];

const PLACEHOLDERS = ['{name}', '{email}', '{phone}', '{address}', '{date}', '{institution_name}', '{reference}'];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatScheduleTime(value) {
	if (!value) return '—';
	const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseSchedulesJson(item) {
	try {
		const raw = item?.schedulesJson || '[]';
		let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (typeof parsed === 'string') parsed = JSON.parse(parsed);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function ScheduleTimesCell({ item }) {
	const schedules = parseSchedulesJson(item);
	if (schedules.length) {
		return (
			<div className="space-y-1.5">
				{schedules.map((s, index) => (
					<div key={`${s.scheduled_at}-${index}`} className="text-sm leading-snug">
						<span className="font-medium">{formatScheduleTime(s.scheduled_at)}</span>
						<span className="text-muted-foreground ml-1 capitalize">({s.status || 'pending'})</span>
					</div>
				))}
			</div>
		);
	}
	return formatScheduleTime(item.scheduledAt);
}

const AnnouncementsManagementPage = ({ mode: modeProp }) => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const bodyRef = useRef(null);
	const fileInputRef = useRef(null);

	const location = useLocation();
	const mode = modeProp || (location.pathname.includes('/list') ? 'list' : location.pathname.includes('/scheduled') ? 'scheduled' : location.pathname.includes('/templates') ? 'templates' : 'compose');

	const pageTitles = {
		compose: { title: 'Compose Announcement', desc: 'Create and send WhatsApp messages to customers and staff.' },
		list: { title: 'All Announcements', desc: 'View and manage sent or draft announcements.' },
		scheduled: { title: 'Scheduled Announcements', desc: 'Announcements queued to send at a future time.' },
		templates: { title: 'Announcement Templates', desc: 'Saved message templates from compose and previous announcements.' },
	};
	const pageMeta = pageTitles[mode] || pageTitles.compose;
	const [announcements, setAnnouncements] = useState([]);
	const [scheduled, setScheduled] = useState([]);
	const [templates, setTemplates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [selectedIds, setSelectedIds] = useState([]);
	const [sendResults, setSendResults] = useState(null);
	const [preview, setPreview] = useState(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
	const [templateName, setTemplateName] = useState('');
	const [templateKey, setTemplateKey] = useState('blank');

	const [category, setCategory] = useState('general');
	const [title, setTitle] = useState('');
	const [headerHtml, setHeaderHtml] = useState('Alpha Bridge');
	const [bodyHtml, setBodyHtml] = useState('Dear {name},');
	const [attachments, setAttachments] = useState([]);
	const [recipientTab, setRecipientTab] = useState('customers');
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState([]);
	const [recipients, setRecipients] = useState([]);
	const [scheduleLater, setScheduleLater] = useState(false);
	const [scheduleTimes, setScheduleTimes] = useState(['']);
	const [selectingAll, setSelectingAll] = useState(false);
	const [customName, setCustomName] = useState('');
	const [customEmail, setCustomEmail] = useState('');
	const [customPhone, setCustomPhone] = useState('');

	const activeTab = RECIPIENT_TABS.find((t) => t.value === recipientTab);
	const missingPhone = useMemo(() => recipients.filter((r) => !r.phone?.trim()), [recipients]);

	const loadLists = useCallback(async () => {
		try {
			setLoading(true);
			const [allRes, schedRes, tmplRes] = await Promise.all([
				announcementsApiClient.fetch('/announcements'),
				announcementsApiClient.fetch('/announcements?status=scheduled'),
				announcementsApiClient.fetch('/announcements/templates'),
			]);
			const allData = await allRes.json();
			const schedData = await schedRes.json();
			const tmplData = await tmplRes.json();
			setAnnouncements((allData.items || []).filter((a) => a.status !== 'scheduled'));
			setScheduled(schedData.items || []);
			setTemplates(tmplData.items || []);
		} catch {
			toast.error('Failed to load announcements');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { loadLists(); }, [loadLists]);

	useEffect(() => {
		const incoming = location.state?.template;
		if (mode !== 'compose' || !incoming) return;
		setTitle(incoming.subject || '');
		setHeaderHtml(incoming.header_html || 'Alpha Bridge');
		setBodyHtml(incoming.body_html || 'Dear {name},');
		setCategory(incoming.category || 'general');
		setTemplateKey('blank');
		toast.success('Template loaded into compose form.');
		window.history.replaceState({}, document.title);
	}, [mode, location.state]);

	useEffect(() => {
		if (mode !== 'scheduled') return undefined;
		const tick = () => {
			announcementsApiClient.fetch('/announcements/process-scheduled', { method: 'POST' })
				.then(() => loadLists())
				.catch(() => {});
		};
		tick();
		const timer = setInterval(tick, 15_000);
		return () => clearInterval(timer);
	}, [mode, loadLists]);
	useEffect(() => {
		announcementsApiClient.fetch('/announcements/settings')
			.then((res) => res.json())
			.then((data) => {
				if (data.settings?.defaultHeader) setHeaderHtml(data.settings.defaultHeader);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		if (recipientTab === 'custom') {
			setSearchResults([]);
			return;
		}
		const timer = setTimeout(async () => {
			try {
				const res = await announcementsApiClient.fetch(
					`/announcements/recipients/search?category=${encodeURIComponent(recipientTab)}&query=${encodeURIComponent(searchQuery.trim())}`
				);
				const data = await res.json();
				setSearchResults(data.items || []);
			} catch {
				setSearchResults([]);
			}
		}, searchQuery.trim() ? 250 : 0);
		return () => clearTimeout(timer);
	}, [recipientTab, searchQuery]);

	function resetForm() {
		setTemplateKey('blank');
		setCategory('general');
		setTitle('');
		setHeaderHtml('Alpha Bridge');
		setBodyHtml('Dear {name}');
		setAttachments([]);
		setRecipients([]);
		setScheduleLater(false);
		setScheduleTimes(['']);
		setPreview(null);
		setCustomName('');
		setCustomEmail('');
		setCustomPhone('');
		setSearchQuery('');
		setSearchResults([]);
	}

	function toScheduleIso(localDatetime) {
		if (!localDatetime) return '';
		const date = new Date(localDatetime);
		if (Number.isNaN(date.getTime())) return localDatetime;
		return date.toISOString();
	}

	function buildPayload(extra = {}) {
		const payload = new FormData();
		payload.append('title', title.trim() || 'WhatsApp Announcement');
		payload.append('category', category);
		payload.append('header_html', headerHtml.trim());
		payload.append('body_html', bodyHtml);
		payload.append('audience_type', recipientTab === 'custom' ? 'custom' : recipientTab);
		payload.append('recipients', JSON.stringify(recipients.map((r) => ({
			name: r.name,
			email: r.email,
			phone: r.phone,
			address: r.address,
			recipient_type: r.recipient_type || recipientTab,
			recipient_id: r.recipient_id || r.id,
		}))));
		payload.append('createdBy', user?.id || '');
		if (scheduleLater) {
			const times = scheduleTimes.filter((t) => t.trim()).map(toScheduleIso);
			if (times.length) {
				payload.append('schedules', JSON.stringify(times));
				payload.append('scheduled_at', times[0]);
				payload.append('schedule_for_later', '1');
			}
		}
		attachments.forEach((file) => payload.append('attachments[]', file));
		Object.entries(extra).forEach(([key, value]) => payload.append(key, value ? '1' : '0'));
		return payload;
	}

	function addRecipient(row) {
		setRecipients((prev) => {
			const exists = row.recipient_id || row.id
				? prev.some((r) => (r.recipient_id || r.id) === (row.recipient_id || row.id))
				: prev.some((r) => r.name === row.name && r.phone === row.phone);
			if (exists) return prev;
			return [...prev, row];
		});
		setSearchQuery('');
	}

	async function selectAllInCategory() {
		if (recipientTab === 'custom') return;
		setSelectingAll(true);
		try {
			const res = await announcementsApiClient.fetch(
				`/announcements/recipients/search?category=${encodeURIComponent(recipientTab)}&all=1`
			);
			const data = await res.json();
			const rows = data.items || [];
			if (!rows.length) return toast.error(`No ${activeTab?.label.toLowerCase()} found.`);
			setRecipients((prev) => {
				const next = [...prev];
				rows.forEach((row) => {
					const exists = row.id
						? next.some((r) => (r.recipient_id || r.id) === row.id)
						: next.some((r) => r.name === row.name && r.phone === row.phone);
					if (!exists) next.push({ ...row, recipient_id: row.id });
				});
				return next;
			});
			toast.success(`Added ${rows.length} recipient(s).`);
		} catch {
			toast.error('Unable to load recipients');
		} finally {
			setSelectingAll(false);
		}
	}

	function addCustomRecipient() {
		if (!customName.trim()) return toast.error('Enter a name for the custom recipient.');
		addRecipient({ name: customName.trim(), email: customEmail.trim(), phone: customPhone.trim(), recipient_type: 'custom' });
		setCustomName('');
		setCustomEmail('');
		setCustomPhone('');
	}

	function addAttachments(files) {
		const incoming = Array.from(files);
		const valid = incoming.filter((file) => {
			if (file.size > MAX_ATTACHMENT_BYTES) {
				toast.error(`${file.name} exceeds 10MB and was skipped.`);
				return false;
			}
			return true;
		});
		if (!valid.length) return;
		setAttachments((prev) => {
			const next = [...prev];
			valid.forEach((file) => {
				if (!next.some((f) => f.name === file.name && f.size === file.size)) next.push(file);
			});
			return next;
		});
	}

	function insertPlaceholder(token) {
		const el = bodyRef.current;
		if (!el) {
			setBodyHtml((prev) => prev + token);
			return;
		}
		const start = el.selectionStart ?? bodyHtml.length;
		const end = el.selectionEnd ?? bodyHtml.length;
		const next = bodyHtml.slice(0, start) + token + bodyHtml.slice(end);
		setBodyHtml(next);
	}

	function applyTemplate(key) {
		setTemplateKey(key);
		if (key === 'blank') {
			setTitle('');
			setBodyHtml('Dear {name}');
			setCategory('general');
			setHeaderHtml('Alpha Bridge');
			return;
		}
		const tmpl = templates.find((item) => String(item.id) === key);
		if (tmpl) {
			setTitle(tmpl.subject || '');
			setHeaderHtml(tmpl.header_html || 'Alpha Bridge');
			setBodyHtml(tmpl.body_html || 'Dear {name}');
			setCategory(tmpl.category || 'general');
			toast.success(`Template "${tmpl.name}" loaded.`);
		}
	}

	async function handlePreview() {
		if (!bodyHtml.trim()) return toast.error('Message body is required.');
		if (!recipients.length) return toast.error('Select at least one recipient.');
		if (missingPhone.length) return toast.error('All recipients must have a phone number.');
		setBusy(true);
		try {
			const res = await announcementsApiClient.fetch('/announcements/preview', { method: 'POST', body: buildPayload() });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			setPreview(data.preview);
			setPreviewOpen(true);
		} catch (err) {
			toast.error(err.message || 'Unable to preview');
		} finally {
			setBusy(false);
		}
	}

	async function handleSendNow() {
		if (!bodyHtml.trim()) return toast.error('Message body is required.');
		if (!recipients.length) return toast.error('Select at least one recipient.');
		if (missingPhone.length) return toast.error('All recipients must have a phone number.');
		if (scheduleLater && !scheduleTimes.some((t) => t.trim())) return toast.error('Add at least one schedule time.');

		setBusy(true);
		setSendResults(null);
		try {
			const payload = scheduleLater ? buildPayload({ schedule_for_later: '1' }) : buildPayload({ send_now: '1' });
			const res = await announcementsApiClient.fetch('/announcements', { method: 'POST', body: payload });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);

			if (scheduleLater) {
				toast.success(data.announcement?.reference ? `Scheduled. Ref: ${data.announcement.reference}` : 'Announcement scheduled.');
			} else if (data.results) {
				setSendResults(data.results);
				toast.success(`Sent ${data.results.sent} of ${data.results.total}. Failed: ${data.results.failed}`);
			} else {
				toast.success('Announcement processed.');
			}
			resetForm();
			loadLists();
		} catch (err) {
			toast.error(err.message || 'Send failed');
		} finally {
			setBusy(false);
		}
	}

	async function handleDeleteTemplate(id) {
		if (!window.confirm('Delete this template?')) return;
		setBusy(true);
		try {
			const res = await announcementsApiClient.fetch(`/announcements/templates/${id}`, { method: 'DELETE' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			toast.success('Template deleted.');
			loadLists();
		} catch (err) {
			toast.error(err.message || 'Unable to delete template');
		} finally {
			setBusy(false);
		}
	}

	function useTemplateInCompose(tmpl) {
		navigate('/admin/announcements/compose', {
			state: {
				template: {
					subject: tmpl.subject,
					header_html: tmpl.header_html,
					body_html: tmpl.body_html,
					category: tmpl.category,
				},
			},
		});
	}

	async function handleSaveTemplate() {
		if (!templateName.trim()) return toast.error('Enter a template name.');
		if (!bodyHtml.trim()) return toast.error('Message body is required.');
		setBusy(true);
		try {
			const res = await announcementsApiClient.fetch('/announcements/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: templateName.trim(),
					category,
					subject: title.trim(),
					header_html: headerHtml.trim(),
					body_html: bodyHtml,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			toast.success(`Template "${templateName.trim()}" saved.`);
			setSaveTemplateOpen(false);
			setTemplateName('');
			loadLists();
		} catch (err) {
			toast.error(err.message || 'Unable to save template');
		} finally {
			setBusy(false);
		}
	}

	async function resend(id) {
		setBusy(true);
		try {
			const res = await announcementsApiClient.fetch(`/announcements/${id}/send`, { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);
			setSendResults(data.results);
			toast.success(`Sent ${data.results.sent} of ${data.results.total}`);
			loadLists();
		} catch (err) {
			toast.error(err.message || 'Send failed');
		} finally {
			setBusy(false);
		}
	}

	async function deleteSelected() {
		if (!selectedIds.length) return;
		if (!confirm(`Delete ${selectedIds.length} announcement(s)?`)) return;
		try {
			await announcementsApiClient.fetch('/announcements/bulk-delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: selectedIds }),
			});
			toast.success(`${selectedIds.length} announcement(s) deleted.`);
			setSelectedIds([]);
			loadLists();
		} catch {
			toast.error('Unable to delete announcements');
		}
	}

	const templateOptions = useMemo(() => [
		{ value: 'blank', label: 'Blank Message' },
		...templates.map((item) => ({ value: String(item.id), label: `${item.name}${item.subject ? ` — ${item.subject}` : ''}` })),
	], [templates]);

	const allSelected = announcements.length > 0 && selectedIds.length === announcements.length;

	return (
		<>
			<Helmet><title>Announcements | Admin</title></Helmet>
			<div className="space-y-6">
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
						<div>
							<h1 className="text-3xl font-bold flex items-center gap-2 text-primary">
								<Megaphone className="w-8 h-8" /> {pageMeta.title}
							</h1>
							<p className="text-muted-foreground mt-1">{pageMeta.desc}</p>
						</div>
						{mode === 'compose' && (
						<div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 shadow-sm">
							<Users className="h-5 w-5 text-primary" />
							<div>
								<div className="text-xs text-muted-foreground">Selected Recipients</div>
								<div className="text-lg font-bold text-primary">{recipients.length}</div>
							</div>
						</div>
						)}
					</div>

					{sendResults && (
						<Card className="mb-6 border-emerald-200 bg-emerald-50/40">
							<CardContent className="p-4">
								<div className="text-sm font-semibold mb-1">Send Summary</div>
								<div className="text-sm">Total: {sendResults.total} · Sent: {sendResults.sent} · Failed: {sendResults.failed}</div>
								{sendResults.failed_recipients?.length > 0 && (
									<ul className="mt-3 space-y-2 text-sm">
										{sendResults.failed_recipients.map((item, index) => (
											<li key={`${item.name}-${index}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
												<strong>{item.name}</strong>{item.phone ? ` (${item.phone})` : ''}: {item.error}
											</li>
										))}
									</ul>
								)}
								<button type="button" className="mt-3 text-sm text-muted-foreground underline" onClick={() => setSendResults(null)}>Dismiss</button>
							</CardContent>
						</Card>
					)}

					{mode === 'compose' && (
						<>
							<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
								<Card>
									<CardHeader>
										<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
											<CardTitle>Message Content</CardTitle>
											<div className="w-full sm:max-w-xs">
												<Label>Template</Label>
												<Select value={templateKey} onValueChange={applyTemplate}>
													<SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
													<SelectContent>
														{templateOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
													</SelectContent>
												</Select>
											</div>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Category</Label>
												<Select value={category} onValueChange={setCategory}>
													<SelectTrigger><SelectValue /></SelectTrigger>
													<SelectContent>
														{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label>Subject</Label>
												<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Internal tracking title" />
											</div>
										</div>
										<div className="space-y-2">
											<Label>Header (WhatsApp opening line)</Label>
											<Input value={headerHtml} onChange={(e) => setHeaderHtml(e.target.value)} />
										</div>
										<div className="space-y-2">
											<Label>Message Body *</Label>
											<div className="mb-2 flex flex-wrap gap-2">
												{PLACEHOLDERS.map((token) => (
													<button key={token} type="button" onClick={() => insertPlaceholder(token)} className="rounded-lg border bg-slate-50 px-2 py-1 text-xs font-medium hover:bg-slate-100">{token}</button>
												))}
											</div>
											<Textarea ref={bodyRef} rows={10} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="font-mono text-sm" />
										</div>
										<div className="space-y-2">
											<Label>Attachments (max 10MB each)</Label>
											<div className="rounded-2xl border-2 border-dashed bg-slate-50/60 px-6 py-6 text-center">
												<Paperclip className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
												{attachments.length > 0 && (
													<ul className="mb-3 space-y-1 text-sm text-left">
														{attachments.map((file, index) => (
															<li key={`${file.name}-${index}`} className="flex justify-between rounded-lg bg-white px-3 py-2">
																<span className="truncate">{file.name}</span>
																<button type="button" className="text-xs text-rose-600" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
															</li>
														))}
													</ul>
												)}
												<input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addAttachments(e.target.files); e.target.value = ''; }} />
												<Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>Browse Files</Button>
											</div>
										</div>
									</CardContent>
								</Card>

								<div className="space-y-6">
									<Card>
										<CardHeader><CardTitle>Sending Options</CardTitle></CardHeader>
										<CardContent className="space-y-4">
											<div className="rounded-xl bg-primary/5 px-4 py-3 text-sm">
												<label className="flex items-center gap-2 font-medium"><Checkbox checked disabled /> Send via WhatsApp</label>
												<p className="mt-1 pl-6 text-xs text-muted-foreground">Messages are sent one recipient every 6 seconds.</p>
											</div>
											<label className="flex items-center gap-2 text-sm">
												<Checkbox checked={scheduleLater} onCheckedChange={setScheduleLater} />
												<Calendar className="h-4 w-4" /> Schedule for later
											</label>
											{scheduleLater && scheduleTimes.map((time, index) => (
												<div key={`sched-${index}`} className="flex gap-2">
													<Input type="datetime-local" value={time} onChange={(e) => setScheduleTimes((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))} />
													{scheduleTimes.length > 1 && (
														<Button type="button" variant="ghost" className="text-rose-600" onClick={() => setScheduleTimes((prev) => prev.filter((_, i) => i !== index))}>Remove</Button>
													)}
												</div>
											))}
											{scheduleLater && (
												<Button type="button" variant="link" className="px-0" onClick={() => setScheduleTimes((prev) => [...prev, ''])}>+ Add another schedule</Button>
											)}
											<div className="flex flex-col gap-2 pt-2">
												<Button type="button" variant="outline" onClick={handlePreview} disabled={busy}><Eye className="w-4 h-4 mr-2" /> Preview</Button>
												<Button type="button" variant="outline" onClick={() => { setTemplateName(title.trim()); setSaveTemplateOpen(true); }} disabled={busy}><Save className="w-4 h-4 mr-2" /> Save Template</Button>
												<Button type="button" onClick={handleSendNow} disabled={busy} className="bg-primary">
													{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
													{scheduleLater ? 'Schedule Send' : 'Send Now'}
												</Button>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardHeader><CardTitle>Select Recipients</CardTitle></CardHeader>
										<CardContent className="space-y-3">
											<div className="flex flex-wrap gap-2">
												{RECIPIENT_TABS.map((t) => (
													<button key={t.value} type="button" onClick={() => { setRecipientTab(t.value); setSearchQuery(''); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${recipientTab === t.value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>{t.label}</button>
												))}
											</div>
											{recipientTab !== 'custom' && (
												<div className="flex gap-2">
													<div className="relative flex-1">
														<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
														<Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, email, phone…" className="pl-9" />
													</div>
													{activeTab?.selectAllLabel && (
														<Button type="button" variant="outline" onClick={selectAllInCategory} disabled={selectingAll}>{selectingAll ? 'Loading…' : activeTab.selectAllLabel}</Button>
													)}
												</div>
											)}
											{recipientTab === 'custom' ? (
												<div className="space-y-2 rounded-xl border border-dashed p-3">
													<Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Name *" />
													<Input value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} placeholder="Email" />
													<Input value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="Phone *" />
													<Button type="button" variant="link" className="px-0" onClick={addCustomRecipient}>+ Add recipient</Button>
												</div>
											) : (
												<div className="max-h-48 overflow-auto rounded-xl border">
													{searchResults.length === 0 ? (
														<div className="px-3 py-6 text-center text-sm text-muted-foreground">No results</div>
													) : searchResults.map((item) => (
														<button key={`${item.id}-${item.name}`} type="button" onClick={() => addRecipient({ ...item, recipient_id: item.id })} className="block w-full border-b px-3 py-2.5 text-left text-sm hover:bg-slate-50">
															<div className="font-semibold">{item.name}</div>
															<div className="text-xs text-muted-foreground">{[item.email, item.phone].filter(Boolean).join(' · ') || '—'}</div>
														</button>
													))}
												</div>
											)}
											{recipients.length > 0 && (
												<div className="flex flex-wrap gap-2">
													{recipients.map((item, index) => (
														<span key={`${item.name}-${index}`} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${item.phone ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-800'}`}>
															{item.name}{item.phone ? ` (${item.phone})` : ' (no phone)'}
															<button type="button" onClick={() => setRecipients((prev) => prev.filter((_, i) => i !== index))} className="text-red-500">×</button>
														</span>
													))}
												</div>
											)}
											{missingPhone.length > 0 && (
												<div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
													{missingPhone.length} recipient(s) have no phone number.
												</div>
											)}
										</CardContent>
									</Card>
								</div>
							</div>
						</>
					)}

					{mode === 'list' && (
							<Card>
								<CardContent className="p-0">
									{selectedIds.length > 0 && (
										<div className="flex items-center justify-between border-b px-4 py-3 bg-slate-50">
											<span className="text-sm">{selectedIds.length} selected</span>
											<Button variant="destructive" size="sm" onClick={deleteSelected}>Delete Selected</Button>
										</div>
									)}
									{loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="w-10">
														<Checkbox checked={allSelected} onCheckedChange={() => setSelectedIds(allSelected ? [] : announcements.map((a) => a.id))} />
													</TableHead>
													<TableHead>Reference</TableHead>
													<TableHead>Title</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>WhatsApp</TableHead>
													<TableHead>Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{announcements.map((item) => (
													<TableRow key={item.id}>
														<TableCell><Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => setSelectedIds((prev) => prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id])} /></TableCell>
														<TableCell className="font-mono text-xs">{item.reference || '—'}</TableCell>
														<TableCell className="font-medium">{item.name || item.subject}</TableCell>
														<TableCell><Badge variant="outline">{item.status || (item.isSent ? 'sent' : 'draft')}</Badge></TableCell>
														<TableCell className="capitalize text-sm">{item.whatsapp_status || '—'}</TableCell>
														<TableCell>
															{!item.isSent && item.status !== 'sent' && (
																<Button size="sm" variant="outline" className="mr-2" onClick={() => resend(item.id)} disabled={busy}><Send className="w-3 h-3 mr-1" /> Send</Button>
															)}
															<Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { await announcementsApiClient.fetch(`/announcements/${item.id}`, { method: 'DELETE' }); loadLists(); }}><Trash2 className="w-3 h-3" /></Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
					)}

					{mode === 'scheduled' && (
							<Card>
								<CardContent className="p-4">
									<div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
										Scheduled announcements send automatically at the chosen time. Use <strong>Send</strong> if a scheduled time has passed.
									</div>
									{loading ? (
										<div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
									) : scheduled.length === 0 ? (
										<div className="p-8 text-center text-muted-foreground">No scheduled announcements yet. Schedule one from Compose.</div>
									) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Reference</TableHead>
												<TableHead>Title</TableHead>
												<TableHead>Scheduled Time</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{scheduled.map((item) => (
												<TableRow key={item.id}>
													<TableCell className="font-mono text-xs">{item.reference || '—'}</TableCell>
													<TableCell>{item.name || item.subject}</TableCell>
													<TableCell><ScheduleTimesCell item={item} /></TableCell>
													<TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
													<TableCell>
														<Button size="sm" onClick={() => resend(item.id)} disabled={busy}><Send className="w-3 h-3 mr-1" /> Send Now</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
									)}
								</CardContent>
							</Card>
					)}

					{mode === 'templates' && (
							<Card>
								<CardHeader>
									<CardTitle>Saved Templates</CardTitle>
									<CardDescription>Templates saved during announcement creation. Use one in Compose or delete it.</CardDescription>
								</CardHeader>
								<CardContent className="p-0">
									{loading ? (
										<div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
									) : templates.length === 0 ? (
										<div className="p-8 text-center text-muted-foreground">No templates saved yet. Save a template from Compose before sending.</div>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Name</TableHead>
													<TableHead>Category</TableHead>
													<TableHead>Subject</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{templates.map((tmpl) => (
													<TableRow key={tmpl.id}>
														<TableCell className="font-medium">{tmpl.name}</TableCell>
														<TableCell><Badge variant="outline">{tmpl.category || 'general'}</Badge></TableCell>
														<TableCell>{tmpl.subject || '—'}</TableCell>
														<TableCell className="text-right space-x-2">
															<Button size="sm" variant="outline" onClick={() => useTemplateInCompose(tmpl)} disabled={busy}>Use in Compose</Button>
															<Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteTemplate(tmpl.id)} disabled={busy}><Trash2 className="w-3 h-3" /></Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
					)}
			</div>

			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader><DialogTitle>Message Preview</DialogTitle></DialogHeader>
					{preview?.recipients?.map((item, index) => (
						<div key={`${item.name}-${index}`} className="rounded-xl border p-4 mb-3">
							<div className="font-semibold text-primary">{item.name} {item.phone && <span className="text-xs text-muted-foreground">({item.phone})</span>}</div>
							<div className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{item.personalized_message}</div>
						</div>
					))}
					<DialogFooter><Button onClick={() => setPreviewOpen(false)}>Close</Button></DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
				<DialogContent>
					<DialogHeader><DialogTitle>Save Template</DialogTitle></DialogHeader>
					<div className="space-y-2">
						<Label>Template Name *</Label>
						<Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} autoFocus />
					</div>
					<DialogFooter className="mt-4">
						<Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancel</Button>
						<Button onClick={handleSaveTemplate} disabled={busy}>Save Template</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};

export default AnnouncementsManagementPage;
