import { sendWhatsAppMessage } from './wasenderapiService';
import {
  personalizeTaskContent,
  buildTaskInviteUrl,
  DEFAULT_TASK_NOTIFICATION_TEMPLATE,
} from '@/utils/taskPersonalization';
import { buildStatusMessage } from '@/utils/whatsappMessageFormat';

const useMysql = import.meta.env.VITE_DATA_BACKEND === 'mysql';
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'alpha_supabase_auth';

function getToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

async function notifyViaApi(path, body) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { success: Boolean(json.success), error: json.error };
}

async function notifyAssignmentViaApi(assignmentId, messageTemplate, documentLinks) {
  return notifyViaApi('/tasks/notify-assignment', { assignmentId, messageTemplate, documentLinks });
}

export async function sendTaskAssignmentNotification({
  assigneePhone,
  assigneeName,
  assigneeEmail,
  taskTitle,
  taskDescription,
  deadline,
  priority,
  startDate,
  startTime,
  deadlineTime,
  inviteToken,
  messageTemplate,
  documentLinks,
  assignmentId,
}) {
  if (useMysql && assignmentId) {
    return notifyAssignmentViaApi(assignmentId, messageTemplate, documentLinks);
  }

  if (!assigneePhone) return { success: false, error: 'No phone number provided' };

  const loginLink = inviteToken ? buildTaskInviteUrl(inviteToken) : `${window.location.origin}/login`;
  const template = messageTemplate || DEFAULT_TASK_NOTIFICATION_TEMPLATE;
  const message = personalizeTaskContent(template, {
    name: assigneeName || assigneeEmail || 'Team Member',
    email: assigneeEmail || '',
    phone: assigneePhone || '',
    subject: taskTitle,
    task_title: taskTitle,
    description: personalizeTaskContent(taskDescription || '', {
      name: assigneeName || '',
      email: assigneeEmail || '',
      phone: assigneePhone || '',
    }),
    task_message: personalizeTaskContent(taskDescription || '', {
      name: assigneeName || '',
      email: assigneeEmail || '',
      phone: assigneePhone || '',
    }),
    deadline: deadline ? new Date(deadline).toLocaleDateString() : '',
    deadline_time: deadlineTime ? ` at ${String(deadlineTime).slice(0, 5)}` : '',
    priority: priority || '',
    start_date: startDate ? new Date(startDate).toLocaleDateString() : '',
    start_time: startTime ? ` at ${String(startTime).slice(0, 5)}` : '',
    login_link: loginLink,
    document_links: documentLinks || '',
  });

  return sendWhatsAppMessage(assigneePhone, message);
}

export const sendTaskReminderNotification = async (assigneePhone, assigneeName, taskTitle, deadline) => {
  if (!assigneePhone) return { success: false, error: 'No phone number provided' };

  const message = buildStatusMessage({
    emoji: '⏰',
    title: 'Reminder',
    name: assigneeName,
    body: 'This is a reminder for your pending task:\n',
    bullets: [
      ['Task', taskTitle],
      ['Deadline', new Date(deadline).toLocaleDateString()],
    ],
    extra: 'Please update your progress on the dashboard.',
  });

  return sendWhatsAppMessage(assigneePhone, message);
};

export const sendAdminTaskAcceptedNotification = async (adminPhone, assigneeName, taskTitle) => {
  if (!adminPhone) return { success: false, error: 'No phone number provided' };

  const message = buildStatusMessage({
    emoji: '📊',
    title: 'Task Accepted',
    body: `*${assigneeName}* has *accepted* the task:\n`,
    bullets: [['Task', taskTitle]],
  });

  return sendWhatsAppMessage(adminPhone, message);
};

export const sendAdminTaskCompletedNotification = async (adminPhone, assigneeName, taskTitle) => {
  if (!adminPhone) return { success: false, error: 'No phone number provided' };

  const message = buildStatusMessage({
    emoji: '✅',
    title: 'Task Completed',
    body: `*${assigneeName}* has completed their assignment for:\n`,
    bullets: [['Task', taskTitle]],
  });

  return sendWhatsAppMessage(adminPhone, message);
};

export async function sendTaskAcceptedNotifications(assignmentId) {
  if (useMysql && assignmentId) {
    return notifyViaApi('/tasks/notify-accepted', { assignmentId });
  }
  return { success: true };
}

export async function sendTaskCompletedNotifications(assignmentId) {
  if (useMysql && assignmentId) {
    return notifyViaApi('/tasks/notify-completed', { assignmentId });
  }
  return { success: true };
}

export async function sendTaskReviewNotification({ assignmentId, progress, comment, adminName }) {
  if (useMysql && assignmentId) {
    return notifyViaApi('/tasks/notify-review', { assignmentId, progress, comment, adminName });
  }

  return { success: true };
}

export async function processScheduledTaskNotifications() {
  if (!useMysql) return { success: true, processed: 0 };

  const token = getToken();
  const res = await fetch(`${API_BASE}/tasks/process-scheduled`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json().catch(() => ({ success: false }));
}

export async function processTaskReminders() {
  if (!useMysql) return { success: true, processed: 0 };

  const token = getToken();
  const res = await fetch(`${API_BASE}/tasks/process-reminders`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json().catch(() => ({ success: false }));
}
