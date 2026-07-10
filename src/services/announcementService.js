import { supabase } from '@/lib/customSupabaseClient';
import {
  formatPhoneNumber,
  isWasenderConfigured,
  sendDocumentMessage,
  sendImageMessage,
  sendTextMessage,
  uploadBuffer,
} from '@/services/wasenderapiService';
import {
  allocateSerialReference,
  getAnnouncementSettings,
} from '@/services/announcementSettingsService';
import { fetchShareholders, fetchStudents, fetchSystemUsers } from '@/services/recipientService';

const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'Alpha Bridge';
const SEND_DELAY_MS = 6000;
const STORAGE_BUCKET = 'announcement-attachments';

function truthy(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureJsonArray(value, fallback = []) {
  const parsed = parseJson(value, fallback);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') {
    try {
      const nested = JSON.parse(parsed);
      return Array.isArray(nested) ? nested : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function parseScheduleTimestamp(value, offsetOverride = null) {
  if (!value) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;

  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? NaN : t;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  const offset = offsetOverride || '+01:00';
  const t = new Date(`${withSeconds}${offset}`).getTime();
  return Number.isNaN(t) ? NaN : t;
}

export function normalizeScheduleTime(value, offsetOverride = null) {
  const ts = parseScheduleTimestamp(value, offsetOverride);
  if (Number.isNaN(ts)) return String(value || '').trim();
  return new Date(ts).toISOString();
}

/** MySQL DATETIME in UTC — use for task reminders and scheduled sends */
export function normalizeScheduleTimeForDb(value, offsetOverride = null) {
  const ts = parseScheduleTimestamp(value, offsetOverride);
  if (Number.isNaN(ts)) return String(value || '').trim().replace('T', ' ').slice(0, 19);
  return new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
}

function stripHtml(text) {
  return (text || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

export function personalize(text, data) {
  if (!text) return '';
  const tokens = {
    '{name}': data.name || '',
    '[name]': data.name || '',
    '{email}': data.email || '',
    '[email]': data.email || '',
    '{phone}': data.phone || data.phone_number || '',
    '{phone_number}': data.phone || data.phone_number || '',
    '[phone_number]': data.phone || data.phone_number || '',
    '{address}': data.address || '',
    '[address]': data.address || '',
    '{date}': data.date || new Date().toLocaleDateString('en-GB'),
    '{institution_name}': data.institution_name || COMPANY_NAME,
    '[CustomerName]': data.name || '',
    '{reference}': data.reference || '',
  };
  let result = text;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(key).join(value);
  }
  return result.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function mimeForFilename(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] || 'application/octet-stream';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapAnnouncement(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    header: row.header,
    body: row.body,
    footer: row.footer,
    category: row.category,
    peopleType: row.people_type,
    to: row.recipient_ids,
    recipientsJson: JSON.stringify(row.recipients_json || []),
    reference: row.reference,
    status: row.status,
    whatsapp_status: row.whatsapp_status,
    schedulesJson: JSON.stringify(ensureJsonArray(row.schedules_json, [])),
    scheduledAt: row.scheduled_at,
    attachmentsJson: JSON.stringify(ensureJsonArray(row.attachments_json, [])),
    attachment: row.attachment,
    isSent: row.is_sent,
    isActive: row.is_active,
    sentCount: row.sent_count,
    sendResultsJson: row.send_results_json ? JSON.stringify(row.send_results_json) : null,
    createdBy: row.created_by,
    created_at: row.created_at,
  };
}

function buildMessage(announcement, recipient) {
  const data = {
    ...recipient,
    institution_name: COMPANY_NAME,
    reference: announcement.reference,
    date: new Date().toLocaleDateString('en-GB'),
  };
  const parts = [];
  if (announcement.reference) parts.push(`Ref: ${announcement.reference}`);
  if (announcement.header) parts.push(personalize(announcement.header, data));
  if (announcement.subject) parts.push(`*${personalize(announcement.subject, data)}*`);
  if (announcement.body) parts.push(personalize(announcement.body, data));
  if (announcement.footer) parts.push(personalize(announcement.footer, data));
  return parts.filter(Boolean).join('\n\n');
}

async function getBookingCustomers() {
  const [shareholders, students] = await Promise.all([fetchShareholders(), fetchStudents()]);
  const map = new Map();

  [...shareholders, ...students].forEach((row) => {
    const key = row.email || row.phone || row.id;
    if (!key) return;
    map.set(key, {
      id: row.id || key,
      name: row.name || row.full_name || 'Customer',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      recipient_type: 'customers',
    });
  });

  const { data: registrations } = await supabase
    .from('registrations')
    .select('id, client_name, client_email, client_phone')
    .limit(500);

  (registrations || []).forEach((r) => {
    const key = r.client_email || r.client_phone || r.id;
    if (!key || map.has(key)) return;
    map.set(key, {
      id: r.id,
      name: r.client_name || 'Customer',
      email: r.client_email || '',
      phone: r.client_phone || '',
      recipient_type: 'customers',
    });
  });

  return [...map.values()];
}

export async function searchRecipients(category, query = '', all = false) {
  const q = (query || '').trim().toLowerCase();

  if (category === 'customers' || category === 'customer') {
    const rows = await getBookingCustomers();
    if (all) return rows;
    if (!q) return rows.slice(0, 50);
    return rows
      .filter((r) => [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(q)))
      .slice(0, 50);
  }

  if (category === 'users' || category === 'user') {
    const staff = await fetchSystemUsers();
    const rows = staff.map((u) => ({
      id: u.id,
      name: u.name || u.full_name || u.email,
      email: u.email || '',
      phone: u.phone || '',
      address: u.address || '',
      recipient_type: 'users',
      recipient_id: u.id,
      role: u.role,
    }));
    if (all) return rows;
    if (!q) return rows.slice(0, 50);
    return rows
      .filter((r) => [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(q)))
      .slice(0, 50);
  }

  return [];
}

async function getRecipientsFromAnnouncement(announcement) {
  const parsed = parseJson(announcement.recipientsJson || announcement.recipients_json, []);
  if (Array.isArray(parsed) && parsed.length) return parsed;
  return [];
}

async function saveAttachments(files = []) {
  const saved = [];
  for (const file of files) {
    if (!file) continue;
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const renamed = file instanceof File
      ? new File([file], filename, { type: file.type || 'application/octet-stream' })
      : file;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, renamed, {
      upsert: false,
    });
    if (!error) saved.push(data?.path || data?.Key || filename);
  }
  return saved;
}

async function sendAttachmentFile(toPhone, filename, caption) {
  const mime = mimeForFilename(filename);
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(filename);

  let buffer;
  if (error) {
    const publicRes = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
    const publicUrl = publicRes?.data?.publicUrl;
    if (!publicUrl || publicUrl.includes('localhost') || publicUrl.startsWith('/api/')) {
      throw new Error(error.message || 'Download failed');
    }
    if (mime.startsWith('image/')) return sendImageMessage(toPhone, publicUrl, caption);
    return sendDocumentMessage(toPhone, publicUrl, caption, filename);
  }

  buffer = await data.arrayBuffer();
  const upload = await uploadBuffer(new Uint8Array(buffer), mime, filename);
  if (!upload.success || !upload.public_url) {
    throw new Error(upload.error || 'Failed to upload attachment to WhatsApp');
  }

  if (mime.startsWith('image/')) {
    return sendImageMessage(toPhone, upload.public_url, caption);
  }
  return sendDocumentMessage(toPhone, upload.public_url, caption, filename);
}

async function dispatchMessages(announcement, recipients) {
  if (!isWasenderConfigured()) throw new Error('WhatsApp is not configured');

  const attachmentList = parseJson(announcement.attachmentsJson || announcement.attachments_json, []);
  if (announcement.attachment && !attachmentList.includes(announcement.attachment)) {
    attachmentList.unshift(announcement.attachment);
  }

  let sent = 0;
  const failed = [];
  const total = recipients.length;

  for (let i = 0; i < recipients.length; i += 1) {
    const recipient = recipients[i];
    const phone = recipient.phone || recipient.phone_number;
    if (!phone?.trim()) {
      failed.push({ name: recipient.name, phone: '', error: 'Missing phone number' });
      continue;
    }

    try {
      const formatted = formatPhoneNumber(phone);
      const text = buildMessage(announcement, recipient);
      const textResult = await sendTextMessage(formatted, text, 'announcement');
      if (!textResult.success) throw new Error(textResult.error || 'Text send failed');

      for (const filename of attachmentList) {
        if (!filename) continue;
        await sleep(3000);
        const attachResult = await sendAttachmentFile(formatted, filename, announcement.subject || 'Attachment');
        if (!attachResult.success) throw new Error(attachResult.error || 'Attachment send failed');
      }
      sent += 1;
    } catch (err) {
      failed.push({ name: recipient.name, phone, error: err.message });
    }

    if (i < recipients.length - 1) await sleep(SEND_DELAY_MS);
  }

  return { sent, failed: failed.length, total, skipped: 0, failed_recipients: failed };
}

export async function listAnnouncements({ status } = {}) {
  await processScheduledAnnouncements();

  let query = supabase.from('announcements').select('*').eq('is_active', 1).order('created_at', { ascending: false });

  if (status === 'scheduled') {
    query = query.eq('status', 'scheduled');
  } else if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let items = (data || []).map(mapAnnouncement);

  if (status === 'scheduled') {
    items = items.filter(
      (a) =>
        a.status === 'scheduled' ||
        ensureJsonArray(a.schedulesJson).some((s) => s.status === 'pending')
    );
  }

  return items;
}

export async function previewAnnouncementPayload(body, files = []) {
  const recipients = parseJson(body.recipients, []);
  if (!recipients.length) throw new Error('Select at least one recipient to preview');

  const attachmentFiles = files.filter((f) => f instanceof File);
  const attachmentName = attachmentFiles[0]?.name || null;

  const previews = recipients.map((recipient) => {
    const data = {
      ...recipient,
      institution_name: COMPANY_NAME,
      date: new Date().toLocaleDateString('en-GB'),
    };
    const headerPlain = personalize(body.header_html || body.header || '', data);
    const bodyPlain = personalize(body.body_html || body.body || '', data);
    return {
      name: recipient.name || '',
      email: recipient.email || null,
      phone: recipient.phone || recipient.phone_number || null,
      address: recipient.address || null,
      personalized_message: [headerPlain, bodyPlain].filter(Boolean).join('\n\n'),
      body_html: bodyPlain,
      header_html: headerPlain,
    };
  });

  return {
    title: body.title || body.subject,
    subject: body.title || body.subject,
    attachment_name: attachmentName,
    recipients: previews,
  };
}

export async function createAnnouncementFromRequest(body, files = [], userId = null) {
  const settings = await getAnnouncementSettings();
  const recipients = parseJson(body.recipients, []);
  const scheduleTimes = parseJson(body.schedules, Array.isArray(body.schedules) ? body.schedules : []);
  const scheduledAt = body.scheduled_at || scheduleTimes[0] || '';
  const sendNow = truthy(body.send_now);
  const scheduleForLater = truthy(body.schedule_for_later) || Boolean(scheduledAt && !sendNow);

  const attachmentFiles = (files || []).filter((f) => f instanceof File);
  const savedAttachments = await saveAttachments(attachmentFiles);

  let status = 'draft';
  if (sendNow) status = 'sent';
  else if (scheduleForLater) status = 'scheduled';

  const reference = await allocateSerialReference();
  const defaultHeader = settings.defaultHeader || settings.companyName || COMPANY_NAME;
  const tzOffset = settings.timezoneOffset || '+01:00';

  const record = {
    name: body.title || body.name || 'WhatsApp Announcement',
    subject: body.title || body.subject || '',
    header: stripHtml(body.header_html || body.header || defaultHeader),
    body: stripHtml(body.body_html || body.body || ''),
    footer: stripHtml(body.footer || ''),
    category: body.category || 'general',
    people_type: body.audience_type || body.peopleType || 'customers',
    recipient_ids: recipients.map((r) => r.recipient_id || r.id || r.email).filter(Boolean).join(','),
    recipients_json: recipients,
    reference,
    status,
    whatsapp_status: sendNow ? 'pending' : scheduleForLater ? 'scheduled' : 'draft',
    schedules_json: scheduleTimes
      .filter(Boolean)
      .map((t) => ({ scheduled_at: normalizeScheduleTime(t, tzOffset), status: 'pending' })),
    scheduled_at: scheduledAt ? normalizeScheduleTime(scheduledAt, tzOffset) : null,
    attachments_json: savedAttachments,
    attachment: savedAttachments[0] || '',
    is_sent: false,
    is_active: true,
    sent_count: 0,
    created_by: userId || null,
  };

  const { data: inserted, error } = await supabase.from('announcements').insert(record).select().single();
  if (error) throw error;

  const announcement = mapAnnouncement(inserted);
  let results = null;

  if (sendNow) {
    results = await dispatchMessages(announcement, recipients);
    await supabase
      .from('announcements')
      .update({
        is_sent: true,
        status: 'sent',
        whatsapp_status: results.failed ? 'partial' : 'sent',
        sent_count: results.sent,
        send_results_json: results,
        updated_at: new Date().toISOString(),
      })
      .eq('id', announcement.id);
  }

  return { announcement, results };
}

export async function sendAnnouncement(id) {
  const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Announcement not found');

  const announcement = mapAnnouncement(data);
  const recipients = await getRecipientsFromAnnouncement(announcement);
  if (!recipients.length) throw new Error('No recipients found');

  const results = await dispatchMessages(announcement, recipients);

  await supabase
    .from('announcements')
    .update({
      is_sent: true,
      status: 'sent',
      whatsapp_status: results.failed ? 'partial' : 'sent',
      sent_count: results.sent,
      send_results_json: results,
      schedules_json: ensureJsonArray(announcement.schedulesJson).map((s) => ({
        ...s,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return results;
}

export async function processScheduledAnnouncements() {
  const { data: items, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', 1)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const settings = await getAnnouncementSettings();
  const tzOffset = settings.timezoneOffset || '+01:00';
  const now = Date.now();
  let processed = 0;

  for (const row of items || []) {
    if (row.is_sent && row.status === 'sent') continue;

    let schedules = ensureJsonArray(row.schedules_json, []);
    if (!schedules.length && row.scheduled_at) {
      schedules = [{ scheduled_at: row.scheduled_at, status: 'pending' }];
    }

    let changed = false;
    let sentThisRun = 0;

    for (let i = 0; i < schedules.length; i += 1) {
      const slot = schedules[i];
      if (slot.status !== 'pending' || !slot.scheduled_at) continue;

      const dueAt = parseScheduleTimestamp(slot.scheduled_at, tzOffset);
      if (Number.isNaN(dueAt) || dueAt > now) continue;

      try {
        const announcement = mapAnnouncement(row);
        const recipients = await getRecipientsFromAnnouncement(announcement);
        const results = await dispatchMessages(announcement, recipients);
        schedules[i] = {
          ...slot,
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent: results.sent,
          failed: results.failed,
        };
        processed += 1;
        sentThisRun += 1;
        changed = true;
      } catch (err) {
        schedules[i] = { ...slot, status: 'failed', error: err.message, failed_at: new Date().toISOString() };
        changed = true;
      }
    }

    if (!changed) continue;

    const pendingLeft = schedules.some((s) => s.status === 'pending');
    const allDone = schedules.every((s) => s.status === 'sent' || s.status === 'failed');

    await supabase
      .from('announcements')
      .update({
        schedules_json: schedules,
        status: pendingLeft ? 'scheduled' : allDone ? 'sent' : row.status,
        is_sent: !pendingLeft && schedules.every((s) => s.status === 'sent'),
        whatsapp_status: sentThisRun > 0 ? 'sent' : row.whatsapp_status,
        sent_count: (row.sent_count || 0) + sentThisRun,
        scheduled_at: schedules.find((s) => s.status === 'pending')?.scheduled_at || schedules[0]?.scheduled_at || row.scheduled_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  return { processed };
}

export async function bulkDeleteAnnouncements(ids = []) {
  for (const id of ids) {
    await supabase
      .from('announcements')
      .update({ is_active: false, status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', id);
  }
  return { deleted: ids.length };
}

export async function deleteAnnouncement(id) {
  await bulkDeleteAnnouncements([id]);
  return { success: true };
}

export async function listAnnouncementTemplates(search = '') {
  const { data, error } = await supabase.from('announcement_templates').select('*').order('name');
  if (error) throw error;

  let items = (data || []).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    subject: t.subject,
    header_html: t.header_html,
    body_html: t.body_html,
  }));

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (t) => (t.name || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q)
    );
  }

  return items;
}

export async function createAnnouncementTemplate(payload) {
  const { data, error } = await supabase
    .from('announcement_templates')
    .insert({
      name: payload.name,
      category: payload.category || 'general',
      subject: payload.subject || '',
      header_html: payload.header_html || COMPANY_NAME,
      body_html: payload.body_html || '',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAnnouncementTemplate(id) {
  const { error } = await supabase.from('announcement_templates').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

export { getBookingCustomers, buildMessage };
