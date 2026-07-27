import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendTextMessage, formatPhoneNumber } from '../services/wasenderWhatsAppService.js';
import { COMPANY_NAME as BRAND } from '../constants/branding.js';
import { buildStatusMessage } from '../utils/whatsappMessageFormat.js';

const router = Router();

router.use(requireAuth);

function requireHrAccess(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (['admin', 'super_admin', 'director', 'manager', 'secretary', 'finance'].includes(role)) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

function personalize(template, staff, extras = {}) {
  const name = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
  const vars = {
    '{STAFF_NAME}': name,
    '{EMPLOYEE_NAME}': name,
    '{STAFF_CODE}': staff.staff_code || '',
    '{EMPLOYEE_NUMBER}': staff.staff_code || '',
    '{POSITION}': staff.position || '',
    '{HIRE_DATE}': staff.hire_date ? String(staff.hire_date).slice(0, 10) : '',
    '{DEPARTMENT}': staff.department || '',
    '{CATEGORY}': staff.category_name || '',
    '{DATE}': new Date().toLocaleDateString('en-GB'),
    '{COMPANY}': BRAND,
    '{LEAVE_START}': extras.leave_start || '',
    '{LEAVE_END}': extras.leave_end || '',
    '{LEAVE_REASON}': extras.leave_reason || '',
    '{PERMISSION_DATE}': extras.permission_date || '',
    '{PERMISSION_REASON}': extras.permission_reason || '',
  };
  let subject = template.subject || '';
  let body = template.body || '';
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    subject = subject.replace(re, val);
    body = body.replace(re, val);
  }
  return { subject, body };
}

async function loadStaff(pool, id) {
  const [rows] = await pool.query(
    `SELECT sp.*, sc.name AS category_name FROM hr_staff_profiles sp
     JOIN hr_staff_categories sc ON sc.id = sp.category_id WHERE sp.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

router.get('/templates', requireHrAccess, async (req, res) => {
  let sql = `SELECT * FROM hr_letter_templates WHERE is_active = 1`;
  const params = [];
  if (req.query.letter_type) {
    sql += ` AND letter_type = ?`;
    params.push(req.query.letter_type);
  }
  sql += ` ORDER BY is_default DESC, name ASC`;
  const [rows] = await getPool().query(sql, params);
  res.json({ success: true, data: rows });
});

router.post('/templates', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  if (!b.letter_type || !b.name || !b.subject || !b.body) {
    return res.status(400).json({ error: 'letter_type, name, subject, and body are required' });
  }
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO hr_letter_templates (id, letter_type, name, subject, body, is_default, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, b.letter_type, b.name, b.subject, b.body, b.is_default ? 1 : 0]
  );
  res.json({ success: true, id });
});

router.put('/templates/:id', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_letter_templates SET name = COALESCE(?, name), subject = COALESCE(?, subject),
     body = COALESCE(?, body), letter_type = COALESCE(?, letter_type),
     is_default = COALESCE(?, is_default), is_active = COALESCE(?, is_active) WHERE id = ?`,
    [b.name, b.subject, b.body, b.letter_type, b.is_default, b.is_active, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/templates/:id', requireHrAccess, async (req, res) => {
  await getPool().query(`DELETE FROM hr_letter_templates WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

router.post('/preview', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const { template_id, staff_profile_id, extras = {}, subject, body } = req.body || {};
  const staff = await loadStaff(pool, staff_profile_id);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  let result = { subject: subject || '', body: body || '' };
  if (template_id && (!subject || !body)) {
    const [templates] = await pool.query(`SELECT * FROM hr_letter_templates WHERE id = ?`, [template_id]);
    if (!templates.length) return res.status(404).json({ error: 'Template not found' });
    result = personalize(templates[0], staff, extras);
    if (subject) result.subject = subject;
    if (body) result.body = body;
  }

  res.json({ success: true, data: { ...result, staff } });
});

router.post('/send', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const b = req.body || {};
  const staff = await loadStaff(pool, b.staff_profile_id);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  let subject = b.subject;
  let body = b.body;
  let letterType = b.letter_type;

  if (b.template_id && (!subject || !body)) {
    const [templates] = await pool.query(`SELECT * FROM hr_letter_templates WHERE id = ?`, [b.template_id]);
    if (templates.length) {
      const p = personalize(templates[0], staff, b.extras || {});
      subject = subject || p.subject;
      body = body || p.body;
      letterType = letterType || templates[0].letter_type;
    }
  }

  if (!subject || !body || !letterType) {
    return res.status(400).json({ error: 'subject, body, and letter_type are required' });
  }

  const id = randomUUID();
  const ref = `HRL-${randomBytes(4).toString('hex').toUpperCase()}`;
  await pool.query(
    `INSERT INTO hr_letters (id, template_id, staff_profile_id, letter_type, subject, body, reference_code, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [id, b.template_id || null, b.staff_profile_id, letterType, subject, body, ref, req.user.sub]
  );

  let whatsappSent = false;
  if (b.send_whatsapp !== false && staff.phone) {
    const phone = formatPhoneNumber(staff.phone);
    if (phone) {
      const msg = buildStatusMessage({
        emoji: '📄',
        title: 'HR Letter',
        name: staff.first_name,
        body: `${subject}\n`,
        bullets: [['Reference', ref]],
        extra: `_${body.slice(0, 500)}${body.length > 500 ? '…' : ''}_`,
      });
      try {
        await sendTextMessage(phone, msg);
        whatsappSent = true;
        await pool.query(
          `UPDATE hr_letters SET status = 'sent', sent_whatsapp_at = NOW() WHERE id = ?`, [id]
        );
      } catch {
        await pool.query(`UPDATE hr_letters SET status = 'failed' WHERE id = ?`, [id]);
      }
    }
  } else if (b.mark_sent) {
    await pool.query(`UPDATE hr_letters SET status = 'sent' WHERE id = ?`, [id]);
  }

  res.json({ success: true, id, reference_code: ref, whatsapp_sent: whatsappSent });
});

router.get('/history', requireHrAccess, async (req, res) => {
  let sql = `SELECT l.*, sp.first_name, sp.last_name, sp.staff_code
             FROM hr_letters l
             JOIN hr_staff_profiles sp ON sp.id = l.staff_profile_id WHERE 1=1`;
  const params = [];
  if (req.query.letter_type) {
    sql += ` AND l.letter_type = ?`;
    params.push(req.query.letter_type);
  }
  sql += ` ORDER BY l.created_at DESC LIMIT 100`;
  const [rows] = await getPool().query(sql, params);
  res.json({ success: true, data: rows });
});

export default router;
