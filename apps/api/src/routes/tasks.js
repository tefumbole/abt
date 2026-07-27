import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { sendTextMessage, sendDocumentMessage, formatPhoneNumber } from '../services/wasenderWhatsAppService.js';
import { footer as brandFooter, statusBlock } from '../utils/whatsappMessageFormat.js';

const router = Router();

const APP_BASE = process.env.APP_BASE_URL || process.env.APP_URL || 'https://alpha-bridge.net';

const BRAND_FOOTER = brandFooter().trimStart();
const DIVIDER = '━━━━━━━━━━━━━━━━';

const DEFAULT_TEMPLATE = `${statusBlock('📋', 'New Task Assignment')}Hello *{name}*,

You have been assigned a new task:

◾ *Task:* {subject}
◾ *Priority:* {priority}
◾ *Start:* {start_date}{start_time}
◾ *Deadline:* {deadline}{deadline_time}

{description}
{login_credentials}
👉 Open this link to *Accept* or *Reject* your task:
{login_link}
${brandFooter()}`;

function personalize(template, vars) {
  let result = template || '';
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value ?? '');
  }
  return result;
}

/**
 * For freshly-created guest assignees, build a credentials block telling them
 * their temporary username (phone) and password ("system"). Returns '' for
 * users who already have their own account.
 */
function buildCredentialsBlock(row) {
  if (!row?.assignee_must_change) return '';
  const username = row.assignee_username || (row.assignee_phone || '').replace(/\D/g, '');
  return `\n🔐 *A temporary login has been created for you:*
◾ *Username:* ${username}
◾ *Password:* system

_Please log in and set your own username, password, email and address._\n`;
}

function requireAdmin(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'director', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function requireTaskManager(req, res, next) {
  if (!req.user?.sub) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function loadAssignmentContext(pool, assignmentId) {
  const [rows] = await pool.query(
    `SELECT ta.*, t.id AS task_id, t.title, t.description, t.deadline, t.deadline_time,
            t.priority, t.start_date, t.start_time, t.created_by, t.notification_template,
            COALESCE(u.name, p.full_name) AS assignee_name,
            COALESCE(u.email, p.email) AS assignee_email,
            COALESCE(u.phone, p.phone) AS assignee_phone,
            COALESCE(u.address, p.address) AS assignee_address,
            u.username AS assignee_username,
            COALESCE(u.must_change_credentials, p.must_change_credentials, 0) AS assignee_must_change,
            COALESCE(cu.name, cp.full_name) AS creator_name,
            COALESCE(cu.phone, cp.phone) AS creator_phone
     FROM task_assignments ta
     JOIN tasks t ON t.id = ta.task_id
     LEFT JOIN users u ON u.id = ta.user_id
     LEFT JOIN profiles p ON p.id = ta.user_id
     LEFT JOIN users cu ON cu.id = t.created_by
     LEFT JOIN profiles cp ON cp.id = t.created_by
     WHERE ta.id = ?
     LIMIT 1`,
    [assignmentId]
  );
  return rows[0] || null;
}

function formatScheduleVars(row) {
  const fmtTime = (t) => (t ? ` at ${String(t).slice(0, 5)}` : '');
  return {
    start_date: row.start_date ? new Date(row.start_date).toLocaleDateString() : '',
    start_time: fmtTime(row.start_time),
    deadline: row.deadline ? new Date(row.deadline).toLocaleDateString() : '',
    deadline_time: fmtTime(row.deadline_time),
  };
}

async function searchAssignees(pool, query, category = 'all', perSource = 50) {
  const q = String(query || '').trim();
  const like = `%${q}%`;
  const cap = Number.isFinite(Number(perSource)) ? Math.max(1, Number(perSource)) : 50;
  const map = new Map();

  const add = (row) => {
    if (!row?.id || map.has(row.id)) return;
    map.set(row.id, {
      id: row.id,
      name: row.name || row.full_name || row.email || 'Unnamed',
      full_name: row.full_name || row.name || row.email || 'Unnamed',
      email: row.email || '',
      phone: row.phone || '',
      role: row.role || '',
      type: row.type || 'user',
    });
  };

  const profileFilter = q
    ? ` AND (LOWER(p.full_name) LIKE LOWER(?) OR LOWER(p.email) LIKE LOWER(?) OR p.phone LIKE ?)`
    : '';
  const profileParams = q ? [like, like, like] : [];

  if (category === 'all' || category === 'staff' || category === 'users') {
    const [profiles] = await pool.query(
      `SELECT p.id, p.full_name, p.email, p.phone, p.role, 'staff' AS type
       FROM profiles p
       WHERE COALESCE(p.status, 'active') = 'active'${profileFilter}
       ORDER BY p.full_name ASC
       LIMIT ${cap}`,
      profileParams
    );
    profiles.forEach((r) => add({ ...r, name: r.full_name }));

    const userFilter = q
      ? ` AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?) OR u.phone LIKE ?)`
      : '';
    const userParams = q ? [like, like, like] : [];
    const [users] = await pool.query(
      `SELECT u.id, u.name AS full_name, u.name, u.email, u.phone, u.role, 'staff' AS type
       FROM users u
       WHERE u.status = 'active'${userFilter}
       ORDER BY u.name ASC
       LIMIT ${cap}`,
      userParams
    );
    users.forEach(add);
  }

  if (category === 'all' || category === 'customers') {
    const custFilter = q
      ? ` AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?) OR u.phone LIKE ?)`
      : '';
    const custParams = q ? [like, like, like] : [];
    const [customerUsers] = await pool.query(
      `SELECT u.id, u.name AS full_name, u.name, u.email, u.phone, u.role, 'customer' AS type
       FROM users u
       WHERE u.status = 'active' AND LOWER(u.role) = 'customer'${custFilter}
       ORDER BY u.name ASC
       LIMIT ${cap}`,
      custParams
    );
    customerUsers.forEach(add);

    const custProfileFilter = q
      ? ` AND (LOWER(p.full_name) LIKE LOWER(?) OR LOWER(p.email) LIKE LOWER(?) OR p.phone LIKE ?)`
      : '';
    const custProfileParams = q ? [like, like, like] : [];
    const [customerProfiles] = await pool.query(
      `SELECT p.id, p.full_name, p.email, p.phone, p.role, 'customer' AS type
       FROM profiles p
       WHERE COALESCE(p.status, 'active') = 'active' AND LOWER(p.role) = 'customer'${custProfileFilter}
       ORDER BY p.full_name ASC
       LIMIT ${cap}`,
      custProfileParams
    );
    customerProfiles.forEach((r) => add({ ...r, name: r.full_name }));
  }

  if (category === 'all' || category === 'customers' || category === 'shareholders') {
    const shFilter = q
      ? ` AND (LOWER(s.full_name) LIKE LOWER(?) OR LOWER(s.name) LIKE LOWER(?) OR LOWER(s.email) LIKE LOWER(?) OR s.full_phone_number LIKE ? OR s.phone_number LIKE ? OR s.phone LIKE ?)`
      : '';
    const shParams = q ? [like, like, like, like, like, like] : [];
    const [shareholders] = await pool.query(
      `SELECT COALESCE(s.user_id, s.id) AS id,
              COALESCE(s.full_name, s.name) AS full_name,
              COALESCE(s.full_name, s.name) AS name,
              s.email,
              COALESCE(s.full_phone_number, s.phone_number, s.phone) AS phone,
              'shareholder' AS role,
              'shareholder' AS type
       FROM shareholders s
       WHERE COALESCE(s.user_id, s.id) IS NOT NULL${shFilter}
       ORDER BY s.full_name ASC
       LIMIT ${cap}`,
      shParams
    );
    shareholders.forEach(add);
  }

  if (category === 'all' || category === 'customers' || category === 'students') {
    const stFilter = q
      ? ` AND (LOWER(s.name) LIKE LOWER(?) OR LOWER(s.email) LIKE LOWER(?) OR s.phone LIKE ?)`
      : '';
    const stParams = q ? [like, like, like] : [];
    const [students] = await pool.query(
      `SELECT s.id, s.name AS full_name, s.name, s.email, s.phone, 'student' AS role, 'student' AS type
       FROM students s
       WHERE 1=1${stFilter}
       ORDER BY s.name ASC
       LIMIT ${cap}`,
      stParams
    );
    students.forEach(add);
  }

  return [...map.values()]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, cap);
}

router.get('/assignees/search', requireAuth, requireTaskManager, async (req, res) => {
  try {
    const pool = getPool();
    const data = await searchAssignees(pool, req.query.q || '', req.query.category || 'all');
    res.json({ data, error: null });
  } catch (err) {
    console.error('[tasks/assignees/search]', err);
    res.status(500).json({ data: [], error: err.message });
  }
});

// Returns the complete assignee list for a category (used by "Select everyone").
router.get('/assignees/all', requireAuth, requireTaskManager, async (req, res) => {
  try {
    const pool = getPool();
    const data = await searchAssignees(pool, '', req.query.category || 'all', 100000);
    res.json({ data, error: null });
  } catch (err) {
    console.error('[tasks/assignees/all]', err);
    res.status(500).json({ data: [], error: err.message });
  }
});

router.get('/invite/:token', optionalAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT ta.id AS assignment_id, ta.status AS assignment_status, ta.user_id,
              t.id AS task_id, t.title, t.deadline, t.priority,
              u.name AS assignee_name, u.email AS assignee_email, u.phone AS assignee_phone
       FROM task_assignments ta
       JOIN tasks t ON t.id = ta.task_id
       LEFT JOIN users u ON u.id = ta.user_id
       WHERE ta.invite_token = ?
       LIMIT 1`,
      [req.params.token]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Invalid or expired task invite link.' });
    }
    res.json({ invite: rows[0], loggedIn: Boolean(req.user) });
  } catch (err) {
    console.error('[tasks/invite]', err);
    res.status(500).json({ error: err.message });
  }
});

async function notifyAssignmentById(pool, assignmentId, messageTemplate, documentLinks) {
  const row = await loadAssignmentContext(pool, assignmentId);
  if (!row) {
    return { success: false, error: 'Assignment not found' };
  }

  const phone = formatPhoneNumber(row.assignee_phone);
  if (!phone) {
    return { success: false, error: 'Assignee has no valid phone number' };
  }

  const template = messageTemplate || row.notification_template || DEFAULT_TEMPLATE;
  const loginLink = `${APP_BASE}/task-invite/${row.invite_token}`;
  const docLinks = documentLinks || '';
  const descriptionText = personalize(row.description || '', {
    name: row.assignee_name,
    email: row.assignee_email,
    phone: row.assignee_phone,
    address: row.assignee_address,
  });

  const scheduleVars = formatScheduleVars(row);
  const text = personalize(template, {
    name: row.assignee_name || row.assignee_email,
    email: row.assignee_email || '',
    phone: row.assignee_phone || '',
    address: row.assignee_address || '',
    subject: row.title,
    task_title: row.title,
    description: descriptionText,
    task_message: descriptionText,
    deadline: scheduleVars.deadline,
    deadline_time: scheduleVars.deadline_time,
    priority: row.priority || 'Medium',
    start_date: scheduleVars.start_date,
    start_time: scheduleVars.start_time,
    login_link: loginLink,
    login_credentials: buildCredentialsBlock(row),
    document_links: docLinks,
  });

  const [docs] = await pool.query(
    `SELECT file_name, file_url FROM task_attachments WHERE task_id = ? AND attachment_type = 'source'`,
    [row.task_id]
  );

  const textResult = await sendTextMessage(phone, text);
  if (!textResult.success) {
    return { success: false, error: textResult.error || 'Failed to send message' };
  }

  for (const doc of docs || []) {
    if (!doc.file_url) continue;
    const docResult = await sendDocumentMessage(phone, doc.file_url, null, doc.file_name || 'task-document.pdf');
    if (!docResult.success) {
      return { success: false, error: docResult.error || 'Message sent but PDF delivery failed' };
    }
  }

  return { success: true, error: null };
}

/** SQL expression: deadline date + optional deadline_time (end of day if time omitted). */
function taskDueDatetimeSql(alias = 't') {
  return `CASE
    WHEN ${alias}.deadline_time IS NOT NULL AND TRIM(${alias}.deadline_time) != ''
    THEN STR_TO_DATE(CONCAT(DATE(${alias}.deadline), ' ', SUBSTRING(${alias}.deadline_time, 1, 5), ':00'), '%Y-%m-%d %H:%i:%s')
    ELSE STR_TO_DATE(CONCAT(DATE(${alias}.deadline), ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
  END`;
}

router.post('/sync-overdue', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    const dueExpr = taskDueDatetimeSql('t');

    const [markResult] = await pool.query(
      `UPDATE tasks t
       SET status = 'Overdue'
       WHERE t.status NOT IN ('Completed', 'Overdue', 'Scheduled')
         AND t.deadline IS NOT NULL
         AND ${dueExpr} < NOW()`
    );

    await pool.query(
      `UPDATE tasks t
       SET status = IF(
         EXISTS (
           SELECT 1 FROM task_assignments ta
           WHERE ta.task_id = t.id AND ta.status IN ('In Progress', 'Accepted')
         ),
         'In Progress',
         'Pending'
       )
       WHERE t.status = 'Overdue'
         AND t.deadline IS NOT NULL
         AND ${dueExpr} >= NOW()`
    );

    await pool.query(
      `UPDATE task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
       SET ta.status = 'Overdue'
       WHERE t.status = 'Overdue'
         AND ta.status NOT IN ('Completed', 'Overdue', 'Declined')`
    );

    await pool.query(
      `UPDATE task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
       SET ta.status = IF(ta.accepted_at IS NOT NULL, 'In Progress', 'Pending')
       WHERE ta.status = 'Overdue'
         AND t.status != 'Overdue'
         AND ta.status NOT IN ('Completed', 'Declined')`
    );

    res.json({
      success: true,
      markedOverdue: markResult.affectedRows || 0,
    });
  } catch (err) {
    console.error('[tasks/sync-overdue]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notify-assignment', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { assignmentId, messageTemplate, documentLinks } = req.body || {};
    if (!assignmentId) {
      return res.status(400).json({ success: false, error: 'assignmentId required' });
    }

    const pool = getPool();
    const result = await notifyAssignmentById(pool, assignmentId, messageTemplate, documentLinks);
    res.json(result);
  } catch (err) {
    console.error('[tasks/notify-assignment]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/send-now', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { taskId } = req.body || {};
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'taskId required' });
    }

    const pool = getPool();
    const [tasks] = await pool.query('SELECT id, notification_template FROM tasks WHERE id = ? LIMIT 1', [taskId]);
    if (!tasks.length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const [assignments] = await pool.query(
      'SELECT id FROM task_assignments WHERE task_id = ?',
      [taskId]
    );

    if (!assignments.length) {
      return res.status(400).json({ success: false, error: 'No assignees on this task' });
    }

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < assignments.length; i += 1) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }
      const result = await notifyAssignmentById(pool, assignments[i].id, tasks[0].notification_template, '');
      if (result.success) sent += 1;
      else {
        failed += 1;
        errors.push(result.error || 'Send failed');
      }
    }

    await pool.query(
      `UPDATE tasks SET status = 'Pending', is_scheduled = 0 WHERE id = ?`,
      [taskId]
    );
    await pool.query(
      `UPDATE task_notification_queue SET status = 'cancelled', last_error = 'Sent manually (send-now)' WHERE task_id = ? AND status = 'pending'`,
      [taskId]
    );

    if (sent > 0) {
      await notifyCcRecipientsForTask(pool, taskId);
    }

    res.json({
      success: sent > 0,
      sent,
      failed,
      error: errors[0] || null,
    });
  } catch (err) {
    console.error('[tasks/send-now]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/process-scheduled', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await runProcessScheduled();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[tasks/process-scheduled]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notify-accepted', requireAuth, requireTaskManager, async (req, res) => {
  try {
    const { assignmentId } = req.body || {};
    if (!assignmentId) {
      return res.status(400).json({ success: false, error: 'assignmentId required' });
    }

    const pool = getPool();
    const row = await loadAssignmentContext(pool, assignmentId);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    const assigneePhone = formatPhoneNumber(row.assignee_phone);
    const adminPhone = formatPhoneNumber(row.creator_phone);
    const assigneeName = row.assignee_name || row.assignee_email || 'Team Member';
    const taskTitle = row.title;
    const loginLink = `${APP_BASE}/my-tasks`;

    const results = { admin: null, assignee: null };

    if (adminPhone) {
      const adminText = `${statusBlock('📊', 'Task Accepted')}*${assigneeName}* has accepted the task:\n\n◾ *Task:* ${taskTitle}\n\n${BRAND_FOOTER}`;
      results.admin = await sendTextMessage(adminPhone, adminText);
    }

    if (assigneePhone) {
      const assigneeText = `${statusBlock('✅', 'Task Accepted')}Hello *${assigneeName}*,\n\nYou have accepted the task:\n\n◾ *Task:* ${taskTitle}\n◾ *Realization:* 0%\n\n👉 Update your progress here:\n${loginLink}\n\n${BRAND_FOOTER}`;
      results.assignee = await sendTextMessage(assigneePhone, assigneeText);
    }

    res.json({
      success: true,
      adminSent: Boolean(results.admin?.success),
      assigneeSent: Boolean(results.assignee?.success),
    });
  } catch (err) {
    console.error('[tasks/notify-accepted]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notify-completed', requireAuth, requireTaskManager, async (req, res) => {
  try {
    const { assignmentId } = req.body || {};
    if (!assignmentId) {
      return res.status(400).json({ success: false, error: 'assignmentId required' });
    }

    const pool = getPool();
    const row = await loadAssignmentContext(pool, assignmentId);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    const adminPhone = formatPhoneNumber(row.creator_phone);
    if (!adminPhone) {
      return res.json({ success: false, error: 'Task creator has no phone number' });
    }

    const assigneeName = row.assignee_name || row.assignee_email || 'Assignee';
    const text = `${statusBlock('✅', 'Task Completed')}*${assigneeName}* has completed their assignment:\n\n◾ *Task:* ${row.title}\n\n👉 Review it on your dashboard:\n${APP_BASE}/admin/tasks/dashboard\n\n${BRAND_FOOTER}`;
    const result = await sendTextMessage(adminPhone, text);
    res.json({ success: result.success, error: result.error || null });
  } catch (err) {
    console.error('[tasks/notify-completed]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notify-review', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { assignmentId, progress, comment, adminName } = req.body || {};
    if (!assignmentId) {
      return res.status(400).json({ success: false, error: 'assignmentId required' });
    }

    const pool = getPool();
    const row = await loadAssignmentContext(pool, assignmentId);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    const phone = formatPhoneNumber(row.assignee_phone);
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Assignee has no valid phone number' });
    }

    const assigneeName = row.assignee_name || row.assignee_email || 'Team Member';
    const reviewer = adminName || row.creator_name || 'Admin';
    const progressVal = progress ?? row.progress ?? 0;
    const statusLabel = progressVal >= 100 ? 'Completed' : 'Needs revision';
    const commentBlock = comment?.trim() ? `\n◾ *Comment:* ${comment.trim()}` : '';

    const text = `${statusBlock('📝', 'Task Review')}Hello *${assigneeName}*,\n\nYour task has been reviewed by *${reviewer}*:\n\n◾ *Task:* ${row.title}\n◾ *Status:* ${statusLabel}\n◾ *Realization:* ${progressVal}%${commentBlock}\n\n👉 Please address the feedback:\n${APP_BASE}/my-tasks\n\n${BRAND_FOOTER}`;

    const result = await sendTextMessage(phone, text);
    res.json({ success: result.success, error: result.error || null });
  } catch (err) {
    console.error('[tasks/notify-review]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatTimeRemaining(deadline, deadlineTime) {
  if (!deadline) return 'Deadline not set';
  const dateStr = String(deadline).slice(0, 10);
  const hasTime = deadlineTime && String(deadlineTime).trim();
  const timePart = hasTime ? String(deadlineTime).slice(0, 5) : '23:59';
  const due = new Date(`${dateStr}T${timePart}:00`);
  const now = new Date();
  const diffMs = due - now;
  if (diffMs <= 0) return 'Deadline has passed';
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const parts = [];
  if (days) parts.push(`${days} day(s)`);
  if (hours) parts.push(`${hours} hour(s)`);
  if (minutes) parts.push(`${minutes} minute(s)`);
  if (!days && !hours) parts.push(`${seconds} second(s)`);
  return parts.join(', ') || 'Less than a minute';
}

async function loadCcRecipients(pool, taskId) {
  const [rows] = await pool.query(
    `SELECT tc.user_id,
            COALESCE(u.phone, p.phone) AS phone,
            COALESCE(u.name, p.full_name) AS name
     FROM task_cc tc
     LEFT JOIN users u ON u.id = tc.user_id
     LEFT JOIN profiles p ON p.id = tc.user_id
     WHERE tc.task_id = ?`,
    [taskId]
  );
  return (rows || []).filter((r) => r.phone);
}

/** Send full task details to all CC recipients on a task. */
async function notifyCcRecipientsForTask(pool, taskId) {
  const [tasks] = await pool.query(
    `SELECT title, description, deadline, deadline_time, priority, start_date, start_time
     FROM tasks WHERE id = ? LIMIT 1`,
    [taskId]
  );
  if (!tasks.length) return { sent: 0 };
  const task = tasks[0];

  const [assigneeRows] = await pool.query(
    `SELECT COALESCE(u.name, p.full_name) AS name
     FROM task_assignments ta
     LEFT JOIN users u ON u.id = ta.user_id
     LEFT JOIN profiles p ON p.id = ta.user_id
     WHERE ta.task_id = ?`,
    [taskId]
  );
  const assigneeNames = (assigneeRows || []).map((r) => r.name).filter(Boolean).join(', ') || 'the assignee(s)';

  const ccList = await loadCcRecipients(pool, taskId);
  if (!ccList.length) return { sent: 0 };

  const scheduleVars = formatScheduleVars(task);
  const descriptionText = (task.description || '').trim();

  const [docs] = await pool.query(
    `SELECT file_name, file_url FROM task_attachments WHERE task_id = ? AND attachment_type = 'source'`,
    [taskId]
  );

  let sent = 0;
  for (let i = 0; i < ccList.length; i += 1) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
    const cc = ccList[i];
    const phone = formatPhoneNumber(cc.phone);
    if (!phone) continue;

    const text = `${statusBlock('📋', 'Task Cc Notification')}Hello *${cc.name || 'Team Member'}*,

You have been CC'd on a task assigned to *${assigneeNames}*:

◾ *Task:* ${task.title}
◾ *Priority:* ${task.priority || 'Medium'}
◾ *Start:* ${scheduleVars.start_date}${scheduleVars.start_time}
◾ *Deadline:* ${scheduleVars.deadline}${scheduleVars.deadline_time}
${descriptionText ? `\n${descriptionText}\n` : ''}
You will receive progress updates on this task.

👉 View tasks:
${APP_BASE}/my-tasks
${brandFooter()}`;

    const result = await sendTextMessage(phone, text);
    if (!result.success) continue;
    sent += 1;

    for (const doc of docs || []) {
      if (!doc.file_url) continue;
      await sendDocumentMessage(phone, doc.file_url, null, doc.file_name || 'task-document.pdf');
    }
  }

  return { sent };
}

router.post('/remove-my-assignments', requireAuth, async (req, res) => {
  try {
    const { assignmentIds = [] } = req.body || {};
    if (!assignmentIds.length) {
      return res.status(400).json({ success: false, error: 'No assignments selected' });
    }

    const pool = getPool();
    const userId = req.user.sub;
    const placeholders = assignmentIds.map(() => '?').join(',');

    const [rows] = await pool.query(
      `SELECT ta.id, ta.user_id, ta.task_id, t.title, t.created_by,
              COALESCE(cu.name, cp.full_name) AS creator_name,
              COALESCE(cu.phone, cp.phone) AS creator_phone,
              COALESCE(au.name, ap.full_name) AS assignee_name
       FROM task_assignments ta
       JOIN tasks t ON t.id = ta.task_id
       LEFT JOIN users cu ON cu.id = t.created_by
       LEFT JOIN profiles cp ON cp.id = t.created_by
       LEFT JOIN users au ON au.id = ta.user_id
       LEFT JOIN profiles ap ON ap.id = ta.user_id
       WHERE ta.id IN (${placeholders}) AND ta.user_id = ?`,
      [...assignmentIds, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'No matching assignments found' });
    }

    await pool.query(
      `DELETE FROM task_assignments WHERE id IN (${placeholders}) AND user_id = ?`,
      [...assignmentIds, userId]
    );

    for (const row of rows) {
      if (row.created_by && row.created_by !== userId && row.creator_phone) {
        const phone = formatPhoneNumber(row.creator_phone);
        if (!phone) continue;
        const text = `${statusBlock('🗑️', 'Task Removed By Assignee')}*${row.assignee_name || 'An assignee'}* removed the task from their list:\n\n◾ *Task:* ${row.title}\n\nThey are no longer tracking this assignment.\n\n${BRAND_FOOTER}`;
        await sendTextMessage(phone, text);
      }
    }

    res.json({ success: true, removed: rows.length });
  } catch (err) {
    console.error('[tasks/remove-my-assignments]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/respond-invite', requireAuth, async (req, res) => {
  try {
    const { token, action, signature } = req.body || {};
    if (!token || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, error: 'token and action (accept|decline) required' });
    }
    if (action === 'accept' && !signature) {
      return res.status(400).json({ success: false, error: 'Signature required to accept this task' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT ta.id, ta.user_id, ta.status, t.title
       FROM task_assignments ta
       JOIN tasks t ON t.id = ta.task_id
       WHERE ta.invite_token = ? LIMIT 1`,
      [token]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Invalid invite token' });
    }
    const assignment = rows[0];
    if (assignment.user_id !== req.user.sub) {
      return res.status(403).json({ success: false, error: 'This task is not assigned to you' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (action === 'accept') {
      // Idempotent: if the assignee already accepted, don't update or re-send the confirmation.
      const alreadyAccepted = String(assignment.status || '').toLowerCase() === 'accepted';
      if (alreadyAccepted) {
        return res.json({ success: true, action, taskTitle: assignment.title, alreadyAccepted: true });
      }
      await pool.query(
        `UPDATE task_assignments SET status = 'Accepted', accepted_at = ?, last_update_at = ?, acceptance_signature = ? WHERE id = ?`,
        [now, now, signature, assignment.id]
      );
      await notifyAssignmentAccepted(pool, assignment.id);
    } else {
      await pool.query(
        `UPDATE task_assignments SET status = 'Declined', declined_at = ?, last_update_at = ? WHERE id = ?`,
        [now, now, assignment.id]
      );
    }

    res.json({ success: true, action, taskTitle: assignment.title });
  } catch (err) {
    console.error('[tasks/respond-invite]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function notifyAssignmentAccepted(pool, assignmentId) {
  const row = await loadAssignmentContext(pool, assignmentId);
  if (!row) return;
  const adminPhone = formatPhoneNumber(row.creator_phone);
  const assigneePhone = formatPhoneNumber(row.assignee_phone);
  const assigneeName = row.assignee_name || 'Team Member';
  if (adminPhone) {
    await sendTextMessage(adminPhone, `${statusBlock('📊', 'Task Accepted')}*${assigneeName}* accepted:\n◾ *Task:* ${row.title}\n\n${BRAND_FOOTER}`);
  }
  if (assigneePhone) {
    await sendTextMessage(assigneePhone, `${statusBlock('✅', 'Task Accepted')}Hello *${assigneeName}*,\n\nYou accepted:\n◾ *Task:* ${row.title}\n\n👉 Update progress:\n${APP_BASE}/my-tasks\n\n${BRAND_FOOTER}`);
  }
}

router.post('/notify-progress', requireAuth, async (req, res) => {
  try {
    const { assignmentId, progress, status, comment } = req.body || {};
    if (!assignmentId) {
      return res.status(400).json({ success: false, error: 'assignmentId required' });
    }

    const pool = getPool();
    const row = await loadAssignmentContext(pool, assignmentId);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    const assigneeName = row.assignee_name || 'Assignee';
    const progressVal = progress ?? row.progress ?? 0;
    const statusLabel = status || row.status || 'In Progress';
    const commentBlock = comment?.trim() ? `\n◾ *Comment:* ${comment.trim()}` : '';
    const isCompletionRequest = progressVal >= 100 || statusLabel === 'Completed';

    const progressText = `${statusBlock('📈', 'Progress Report')}*${assigneeName}* updated task progress:\n\n◾ *Task:* ${row.title}\n◾ *Realization:* ${progressVal}%\n◾ *Status:* ${statusLabel}${commentBlock}\n\n${BRAND_FOOTER}`;

    const creatorPhone = formatPhoneNumber(row.creator_phone);
    if (creatorPhone) {
      await sendTextMessage(creatorPhone, progressText);
    }

    const ccList = await loadCcRecipients(pool, row.task_id);
    for (const cc of ccList) {
      const ccPhone = formatPhoneNumber(cc.phone);
      if (!ccPhone) continue;
      const ccText = `${statusBlock('📋', 'Task Cc — Progress Update')}Hello *${cc.name || 'CC'}*,\n\nYou are CC on a task assigned to *${assigneeName}*:\n\n◾ *Task:* ${row.title}\n◾ *Realization:* ${progressVal}%\n◾ *Status:* ${statusLabel}${commentBlock}\n\n${BRAND_FOOTER}`;
      await sendTextMessage(ccPhone, ccText);
    }

    const assigneePhone = formatPhoneNumber(row.assignee_phone);
    if (isCompletionRequest && assigneePhone) {
      await sendTextMessage(
        assigneePhone,
        `${statusBlock('✅', 'Completion Submitted')}Hello *${assigneeName}*,\n\nYour completion request for *${row.title}* has been submitted.\n\nThe assigner will review and affirm completion of the task.\n\n${BRAND_FOOTER}`
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[tasks/notify-progress]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/process-reminders', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await runProcessReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[tasks/process-reminders]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin-update', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      taskId,
      title,
      description,
      priority,
      deadline,
      deadline_time,
      assigneeIds = [],
      adminComment = '',
      notifyNewAssignees = true,
      scheduleTimes = [],
    } = req.body || {};

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'taskId required' });
    }

    const pool = getPool();
    await pool.query(
      `UPDATE tasks SET title = ?, description = ?, priority = ?, deadline = ?, deadline_time = ? WHERE id = ?`,
      [title, description, priority, deadline, deadline_time || null, taskId]
    );

    const [current] = await pool.query('SELECT user_id, id FROM task_assignments WHERE task_id = ?', [taskId]);
    const currentIds = (current || []).map((r) => r.user_id);
    const toRemove = current.filter((r) => !assigneeIds.includes(r.user_id));
    const toAdd = assigneeIds.filter((id) => !currentIds.includes(id));

    if (toRemove.length) {
      const removeIds = toRemove.map((r) => r.id);
      await pool.query(
        `DELETE FROM task_assignments WHERE id IN (${removeIds.map(() => '?').join(',')})`,
        removeIds
      );
    }

    const [taskRow] = await pool.query('SELECT notification_template FROM tasks WHERE id = ?', [taskId]);
    const template = taskRow[0]?.notification_template || DEFAULT_TEMPLATE;

    for (const userId of toAdd) {
      const assignmentId = randomUUID();
      const inviteToken = randomUUID();
      await pool.query(
        `INSERT INTO task_assignments (id, task_id, user_id, invite_token, status, progress, last_update_at)
         VALUES (?, ?, ?, ?, 'Pending', 0, NOW())`,
        [assignmentId, taskId, userId, inviteToken]
      );
      if (notifyNewAssignees) {
        await notifyAssignmentById(pool, assignmentId, template, '');
      }
    }

    if (scheduleTimes.length) {
      const [assignments] = await pool.query('SELECT id FROM task_assignments WHERE task_id = ?', [taskId]);
      for (const assignment of assignments) {
        for (const scheduledAt of scheduleTimes) {
          if (!scheduledAt) continue;
          await pool.query(
            `INSERT INTO task_notification_queue (id, task_id, assignment_id, scheduled_at, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [randomUUID(), taskId, assignment.id, scheduledAt]
          );
        }
      }
      await pool.query(`UPDATE tasks SET is_scheduled = 1, status = 'Scheduled' WHERE id = ?`, [taskId]);
    }

    if (adminComment?.trim()) {
      const [assignments] = await pool.query('SELECT id FROM task_assignments WHERE task_id = ?', [taskId]);
      for (const a of assignments) {
        const ctx = await loadAssignmentContext(pool, a.id);
        if (!ctx) continue;
        const phone = formatPhoneNumber(ctx.assignee_phone);
        if (!phone) continue;
        const text = `${statusBlock('💬', 'Task Update')}Hello *${ctx.assignee_name || 'Team Member'}*,\n\nUpdate on *${title}*:\n\n${adminComment.trim()}\n\n👉 View task:\n${APP_BASE}/my-tasks\n\n${BRAND_FOOTER}`;
        await sendTextMessage(phone, text);
      }
    }

    res.json({ success: true, added: toAdd.length, removed: toRemove.length });
  } catch (err) {
    console.error('[tasks/admin-update]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/accept-assignment', requireAuth, async (req, res) => {
  try {
    const { assignmentId, signature } = req.body || {};
    if (!assignmentId) {
      return res.status(400).json({ success: false, error: 'assignmentId required' });
    }
    if (!signature) {
      return res.status(400).json({ success: false, error: 'Signature required to accept this task' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT ta.id, ta.user_id, ta.status, ta.task_id FROM task_assignments ta WHERE ta.id = ? LIMIT 1`,
      [assignmentId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    const assignment = rows[0];
    if (assignment.user_id !== req.user.sub) {
      return res.status(403).json({ success: false, error: 'This task is not assigned to you' });
    }

    const alreadyAccepted = String(assignment.status || '').toLowerCase() === 'accepted';
    if (alreadyAccepted) {
      return res.json({ success: true, alreadyAccepted: true });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      `UPDATE task_assignments SET status = 'Accepted', accepted_at = ?, last_update_at = ?, acceptance_signature = ? WHERE id = ?`,
      [now, now, signature, assignment.id]
    );
    await pool.query(
      `UPDATE tasks SET status = 'In Progress' WHERE id = ? AND status = 'Pending'`,
      [assignment.task_id]
    );
    await notifyAssignmentAccepted(pool, assignment.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[tasks/accept-assignment]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notify-cc', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { taskId } = req.body || {};
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'taskId required' });
    }

    const pool = getPool();
    const result = await notifyCcRecipientsForTask(pool, taskId);
    res.json({ success: true, sent: result.sent || 0 });
  } catch (err) {
    console.error('[tasks/notify-cc]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export async function runProcessScheduled() {
  const pool = getPool();
  const [due] = await pool.query(
    `SELECT q.*, t.title, t.description, t.deadline, t.priority, t.start_date, t.notification_template,
            u.name, u.email, u.phone, u.address, u.username AS assignee_username,
            COALESCE(u.must_change_credentials, 0) AS assignee_must_change, ta.invite_token
     FROM task_notification_queue q
     JOIN tasks t ON t.id = q.task_id
     JOIN task_assignments ta ON ta.id = q.assignment_id
     JOIN users u ON u.id = ta.user_id
     WHERE q.status = 'pending' AND q.scheduled_at <= UTC_TIMESTAMP()
     ORDER BY q.scheduled_at ASC
     LIMIT 50`
  );

  let sent = 0;
  let failed = 0;
  const ccNotifiedTasks = new Set();

  for (const row of due) {
    const phone = formatPhoneNumber(row.phone);
    if (!phone) {
      await pool.query(
        `UPDATE task_notification_queue SET status = 'failed', last_error = ? WHERE id = ?`,
        ['No valid phone', row.id]
      );
      failed++;
      continue;
    }

    const [docs] = await pool.query(
      `SELECT file_name, file_url FROM task_attachments WHERE task_id = ? AND attachment_type = 'source'`,
      [row.task_id]
    );
    const loginLink = `${APP_BASE}/task-invite/${row.invite_token}`;
    const template = row.notification_template || DEFAULT_TEMPLATE;
    const descriptionText = personalize(row.description || '', {
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
    });

    const scheduleVars = formatScheduleVars(row);
    const text = personalize(template, {
      name: row.name || row.email,
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      subject: row.title,
      task_title: row.title,
      description: descriptionText,
      task_message: descriptionText,
      deadline: scheduleVars.deadline,
      deadline_time: scheduleVars.deadline_time,
      priority: row.priority || 'Medium',
      start_date: scheduleVars.start_date,
      start_time: scheduleVars.start_time,
      login_link: loginLink,
      login_credentials: buildCredentialsBlock({
        assignee_must_change: row.assignee_must_change,
        assignee_username: row.assignee_username,
        assignee_phone: row.phone,
      }),
      document_links: '',
    });

    const textResult = await sendTextMessage(phone, text);
    let result = textResult;
    if (textResult.success) {
      for (const doc of docs || []) {
        if (!doc.file_url) continue;
        result = await sendDocumentMessage(phone, doc.file_url, null, doc.file_name || 'task-document.pdf');
        if (!result.success) break;
      }
    }

    if (result.success) {
      await pool.query(
        `UPDATE task_notification_queue SET status = 'sent', sent_at = UTC_TIMESTAMP() WHERE id = ?`,
        [row.id]
      );
      sent++;
      if (!ccNotifiedTasks.has(row.task_id)) {
        ccNotifiedTasks.add(row.task_id);
        await notifyCcRecipientsForTask(pool, row.task_id);
      }
    } else {
      await pool.query(
        `UPDATE task_notification_queue SET status = 'failed', last_error = ? WHERE id = ?`,
        [result.error || 'Send failed', row.id]
      );
      failed++;
    }
  }

  await pool.query(
    `UPDATE tasks t
     SET t.is_scheduled = 0, t.status = 'Pending'
     WHERE t.is_scheduled = 1
       AND NOT EXISTS (
         SELECT 1 FROM task_notification_queue q
         WHERE q.task_id = t.id AND q.status = 'pending'
       )`
  );

  return { processed: due.length, sent, failed };
}

export async function runProcessReminders() {
  const pool = getPool();
  const [due] = await pool.query(
    `SELECT tr.id, tr.task_id, tr.reminder_time, t.title, t.deadline, t.deadline_time, t.description, t.priority
     FROM task_reminders tr
     JOIN tasks t ON t.id = tr.task_id
     WHERE tr.is_sent = 0 AND tr.reminder_time <= UTC_TIMESTAMP()
     ORDER BY tr.reminder_time ASC
     LIMIT 50`
  );

  let sent = 0;
  for (const reminder of due || []) {
    const [assignments] = await pool.query(
      `SELECT ta.id FROM task_assignments ta WHERE ta.task_id = ? AND ta.status NOT IN ('Declined', 'Completed')`,
      [reminder.task_id]
    );

    const remaining = formatTimeRemaining(reminder.deadline, reminder.deadline_time);
    const deadlineStr = reminder.deadline ? new Date(reminder.deadline).toLocaleDateString() : '';
    const deadlineTime = reminder.deadline_time ? ` at ${String(reminder.deadline_time).slice(0, 5)}` : '';

    for (const assignment of assignments) {
      const ctx = await loadAssignmentContext(pool, assignment.id);
      if (!ctx) continue;
      const phone = formatPhoneNumber(ctx.assignee_phone);
      if (!phone) continue;
      const text = `${statusBlock('⏰', 'Reminder')}Hello *${ctx.assignee_name || 'Team Member'}*,\n\nReminder for your assigned task:\n\n◾ *Task:* ${reminder.title}\n◾ *Deadline:* ${deadlineStr}${deadlineTime}\n◾ *Time remaining:* ${remaining}\n\n👉 Open task:\n${APP_BASE}/my-tasks\n\n${BRAND_FOOTER}`;
      const result = await sendTextMessage(phone, text);
      if (result.success) sent += 1;
    }

    await pool.query(`UPDATE task_reminders SET is_sent = 1 WHERE id = ?`, [reminder.id]);
  }

  return { processed: due?.length || 0, sent };
}

export default router;
