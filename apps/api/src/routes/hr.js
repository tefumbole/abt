import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendTextMessage, formatPhoneNumber } from '../services/wasenderWhatsAppService.js';
import { COMPANY_NAME as BRAND } from '../constants/branding.js';

const router = Router();
const APP_BASE = process.env.APP_BASE_URL || 'https://beyondtechworld.com';

const STAFF_DEFAULT_PERMISSIONS = [
  'menu.tasks', 'tasks.view', 'tasks.create',
  'menu.jobs', 'jobs.view',
  'menu.timesheets', 'timesheets.view', 'timesheets.create',
];

async function ensureStaffRolePermissions(pool) {
  for (const permission of STAFF_DEFAULT_PERMISSIONS) {
    const [existing] = await pool.query(
      'SELECT id FROM role_permissions WHERE role = ? AND permission = ? LIMIT 1',
      ['Staff', permission]
    );
    if (!existing.length) {
      await pool.query(
        'INSERT INTO role_permissions (id, role, permission, created_at) VALUES (?, ?, ?, NOW())',
        [randomUUID(), 'Staff', permission]
      );
    }
  }
}

async function promoteUserToStaff(pool, userId) {
  await ensureStaffRolePermissions(pool);
  await pool.query(`UPDATE profiles SET role = 'Staff', status = 'active' WHERE id = ?`, [userId]);
  await pool.query(`UPDATE users SET role = 'Staff', status = 'active' WHERE id = ?`, [userId]);
}

// Public payslip verification (QR / barcode scan)
router.get('/payslips/verify/:code', async (req, res) => {
  try {
    const pool = getPool();
    const code = String(req.params.code || '').trim().toUpperCase();
    const [rows] = await pool.query(
      `SELECT sp.first_name, sp.last_name, sp.staff_code, sp.position, sp.hire_date,
              pr.title AS payroll_title, pi.net_amount, ps.verification_code, ps.generated_at
       FROM hr_payslips ps
       JOIN hr_payroll_items pi ON pi.id = ps.payroll_item_id
       JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
       JOIN hr_payroll_runs pr ON pr.id = pi.payroll_run_id
       WHERE UPPER(ps.verification_code) = ? OR ps.payroll_item_id = ?
       LIMIT 1`,
      [code, req.params.code]
    );
    if (!rows.length) return res.status(404).json({ valid: false, error: 'Payslip not found' });
    const row = rows[0];
    res.json({
      valid: true,
      employee_name: `${row.first_name} ${row.last_name}`.trim(),
      staff_code: row.staff_code,
      position: row.position,
      hire_date: row.hire_date,
      payroll_title: row.payroll_title,
      net_amount: row.net_amount,
      verification_code: row.verification_code,
      generated_at: row.generated_at,
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

router.use(requireAuth);

function requireHrAccess(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (['admin', 'super_admin', 'director', 'manager', 'secretary', 'finance'].includes(role)) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function effectiveDays(row) {
  const days = num(row.days_worked);
  if (row.day_status === 'partial') {
    return days * num(row.partial_fraction || 1);
  }
  return days;
}

function calcItemTotals({ basic, allowances = [], deductions = [], advances = 0 }) {
  const totalAllowances = allowances.reduce((s, a) => s + num(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + num(d.amount), 0);
  const gross = num(basic) + totalAllowances;
  const net = gross - totalDeductions - num(advances);
  return { totalAllowances, totalDeductions, gross, net };
}

async function nextStaffCode(pool) {
  const [rows] = await pool.query(
    `SELECT staff_code FROM hr_staff_profiles ORDER BY created_at DESC LIMIT 1`
  );
  const last = rows[0]?.staff_code || 'ABT-HR-000';
  const match = last.match(/(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `ABT-HR-${String(next).padStart(3, '0')}`;
}

async function loadStaff(pool, id) {
  const [rows] = await pool.query(
    `SELECT sp.*, sc.name AS category_name, sc.code AS category_code
     FROM hr_staff_profiles sp
     JOIN hr_staff_categories sc ON sc.id = sp.category_id
     WHERE sp.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getOpenAdvances(pool, staffId, jobId = null) {
  let sql = `SELECT * FROM hr_advance_payments WHERE staff_profile_id = ? AND status = 'open'`;
  const params = [staffId];
  if (jobId) {
    sql += ` AND (job_id = ? OR job_id IS NULL)`;
    params.push(jobId);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function sumTimesheetHours(pool, staffId, start, end, jobId = null) {
  let sql = `SELECT COALESCE(SUM(hours_worked), 0) AS hours,
                    COALESCE(SUM(day_fraction), 0) AS days
             FROM hr_timesheet_entries
             WHERE staff_profile_id = ? AND entry_date >= ? AND entry_date <= ?
               AND status IN ('submitted','confirmed')`;
  const params = [staffId, start, end];
  if (jobId) {
    sql += ` AND job_id = ?`;
    params.push(jobId);
  }
  const [rows] = await pool.query(sql, params);
  return { hours: num(rows[0]?.hours), days: num(rows[0]?.days) };
}

function expectedHoursForPeriod(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const ms = Math.max(0, e - s);
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  const weeks = days / 7;
  return Math.round(weeks * 40 * 100) / 100;
}

async function recordApproval(pool, runId, stage, userId, notes = null) {
  await pool.query(
    `INSERT INTO hr_payroll_approvals (id, payroll_run_id, stage, action_by, notes) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), runId, stage, userId, notes]
  );
}

async function notifyStaff(pool, staff, message) {
  if (!staff?.phone) return { sent: false };
  const phone = formatPhoneNumber(staff.phone);
  if (!phone) return { sent: false };
  try {
    await sendTextMessage(phone, message);
    return { sent: true };
  } catch {
    return { sent: false };
  }
}

async function notifyPayrollStage(pool, runId, stage) {
  const [items] = await pool.query(
    `SELECT pi.*, sp.first_name, sp.last_name, sp.phone, sp.staff_code
     FROM hr_payroll_items pi
     JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     WHERE pi.payroll_run_id = ?`,
    [runId]
  );
  const [runs] = await pool.query(`SELECT title FROM hr_payroll_runs WHERE id = ?`, [runId]);
  const title = runs[0]?.title || 'Payroll';
  const stageLabel = {
    review: 'submitted for review',
    approved: 'approved by management',
    finance: 'forwarded to Finance',
    paid: 'marked as PAID',
    rejected: 'rejected',
  }[stage] || stage;

  for (const item of items) {
    const name = `${item.first_name} ${item.last_name}`.trim();
    const msg = `💼 *HR PAYROLL UPDATE*\n\nHello *${name}*,\n\nYour payroll *${title}* has been ${stageLabel}.\n\nNet pay: *${Number(item.net_amount).toLocaleString()} FCFA*\nStatus: ${item.payment_status}\n\n_${BRAND}_`;
    await notifyStaff(pool, item, msg);
  }
}

// ─── Staff ───────────────────────────────────────────────────────────────────

router.get('/staff', requireHrAccess, async (req, res) => {
  try {
    const pool = getPool();
    const { status, category_id, q } = req.query;
    let sql = `SELECT sp.*, sc.name AS category_name FROM hr_staff_profiles sp
               LEFT JOIN hr_staff_categories sc ON sc.id = sp.category_id WHERE 1=1`;
    const params = [];
    if (status) { sql += ` AND sp.status = ?`; params.push(status); }
    if (category_id) { sql += ` AND sp.category_id = ?`; params.push(category_id); }
    if (q) {
      sql += ` AND (sp.first_name LIKE ? OR sp.last_name LIKE ? OR sp.staff_code LIKE ? OR sp.email LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ` ORDER BY sp.created_at DESC LIMIT 500`;
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/staff/next-code', requireHrAccess, async (_req, res) => {
  try {
    const code = await nextStaffCode(getPool());
    res.json({ success: true, staff_code: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/staff/:id', requireHrAccess, async (req, res) => {
  try {
    const staff = await loadStaff(getPool(), req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/staff', requireHrAccess, async (req, res) => {
  try {
    const pool = getPool();
    const b = req.body || {};
    const id = randomUUID();
    const staffCode = b.staff_code || (await nextStaffCode(pool));

    let firstName = b.first_name;
    let lastName = b.last_name;
    let email = b.email;
    let phone = b.phone;

    if (b.user_id) {
      const [users] = await pool.query(
        `SELECT COALESCE(u.name, p.full_name) AS name, COALESCE(u.email, p.email) AS email,
                COALESCE(u.phone, p.phone) AS phone
         FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = ? LIMIT 1`,
        [b.user_id]
      );
      if (!users.length) {
        const [profiles] = await pool.query(
          `SELECT full_name, email, phone FROM profiles WHERE id = ? LIMIT 1`, [b.user_id]
        );
        if (profiles.length) {
          const parts = String(profiles[0].full_name || '').split(' ');
          firstName = firstName || parts[0] || 'Staff';
          lastName = lastName || parts.slice(1).join(' ') || '';
          email = email || profiles[0].email;
          phone = phone || profiles[0].phone;
        }
      } else {
        const parts = String(users[0].name || '').split(' ');
        firstName = firstName || parts[0] || 'Staff';
        lastName = lastName || parts.slice(1).join(' ') || '';
        email = email || users[0].email;
        phone = phone || users[0].phone;
      }
    }

    if (!firstName || !b.category_id) {
      return res.status(400).json({ error: 'first_name and category_id are required' });
    }

    let dailyRate = b.daily_rate != null ? num(b.daily_rate) : null;
    if (!dailyRate && b.position) {
      const [rates] = await pool.query(
        `SELECT daily_rate FROM hr_position_rates WHERE position = ? LIMIT 1`, [b.position]
      );
      if (rates.length) dailyRate = num(rates[0].daily_rate);
    }

    await pool.query(
      `INSERT INTO hr_staff_profiles
       (id, user_id, staff_code, first_name, last_name, email, phone, category_id, position,
        department, payment_type, daily_rate, monthly_salary, contract_start, contract_end,
        hire_date, bank_name, bank_account, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, b.user_id || null, staffCode, firstName, lastName || '', email, phone,
        b.category_id, b.position || null, b.department || null,
        b.payment_type || 'daily', dailyRate, b.monthly_salary != null ? num(b.monthly_salary) : null,
        b.contract_start || null, b.contract_end || null, b.hire_date || null,
        b.bank_name || null, b.bank_account || null, b.status || 'active',
        b.notes || null, req.user.sub,
      ]
    );

    if (b.user_id) {
      await promoteUserToStaff(pool, b.user_id);
    }

    const staff = await loadStaff(pool, id);
    res.json({ success: true, data: staff });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Staff code already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/staff/:id', requireHrAccess, async (req, res) => {
  try {
    const pool = getPool();
    const b = req.body || {};
    const fields = [
      'first_name', 'last_name', 'email', 'phone', 'category_id', 'position', 'department',
      'payment_type', 'daily_rate', 'monthly_salary', 'contract_start', 'contract_end',
      'hire_date', 'bank_name', 'bank_account', 'status', 'notes', 'user_id',
    ];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (b[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(b[f]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    await pool.query(`UPDATE hr_staff_profiles SET ${sets.join(', ')} WHERE id = ?`, params);
    const staff = await loadStaff(pool, req.params.id);
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/search', requireHrAccess, async (req, res) => {
  try {
    const pool = getPool();
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: [] });
    const like = `%${q}%`;
    const map = new Map();

    const add = (row) => {
      if (!row?.id || map.has(row.id)) return;
      map.set(row.id, row);
    };

    const [profiles] = await pool.query(
      `SELECT p.id, p.full_name AS name, p.email, p.phone, p.role, p.created_at,
              CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END AS is_staff,
              sp.staff_code, sp.hire_date,
              CASE
                WHEN LOWER(COALESCE(p.role,'')) IN ('customer','client') THEN 'customer'
                WHEN LOWER(COALESCE(p.role,'')) = 'staff' THEN 'staff'
                ELSE 'user'
              END AS user_type
       FROM profiles p
       LEFT JOIN hr_staff_profiles sp ON sp.user_id = p.id
       WHERE COALESCE(p.status,'active') = 'active'
         AND (LOWER(p.full_name) LIKE LOWER(?) OR LOWER(p.email) LIKE LOWER(?) OR p.phone LIKE ?)
       ORDER BY p.full_name LIMIT 40`,
      [like, like, like]
    );
    profiles.forEach(add);

    const [users] = await pool.query(
      `SELECT u.id, COALESCE(u.name, p.full_name) AS name, COALESCE(u.email, p.email) AS email,
              COALESCE(u.phone, p.phone) AS phone, u.role, u.created_at,
              CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END AS is_staff,
              sp.staff_code, sp.hire_date,
              CASE
                WHEN LOWER(COALESCE(u.role,'')) IN ('customer','client') THEN 'customer'
                WHEN LOWER(COALESCE(u.email,'')) LIKE '%@customers.%' THEN 'customer'
                WHEN LOWER(COALESCE(u.role,'')) = 'staff' THEN 'staff'
                ELSE 'user'
              END AS user_type
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN hr_staff_profiles sp ON sp.user_id = u.id
       WHERE COALESCE(u.status,'active') = 'active'
         AND (LOWER(COALESCE(u.name, p.full_name)) LIKE LOWER(?)
              OR LOWER(COALESCE(u.email, p.email)) LIKE LOWER(?)
              OR COALESCE(u.phone, p.phone) LIKE ?)
       ORDER BY name LIMIT 40`,
      [like, like, like]
    );
    users.forEach(add);

    const nextCode = await nextStaffCode(pool);
    const data = [...map.values()].map((row) => ({
      ...row,
      suggested_hire_date: row.hire_date || (row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10)),
      suggested_staff_code: row.staff_code || nextCode,
    }));

    res.json({ success: true, data, next_staff_code: nextCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Categories & rates ────────────────────────────────────────────────────

router.get('/categories', requireHrAccess, async (_req, res) => {
  const [rows] = await getPool().query(`SELECT * FROM hr_staff_categories ORDER BY name`);
  res.json({ success: true, data: rows });
});

router.post('/categories', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  const code = String(b.code || b.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || id.slice(0, 8);
  await getPool().query(
    `INSERT INTO hr_staff_categories (id, code, name, description, is_active) VALUES (?, ?, ?, ?, 1)`,
    [id, code, b.name, b.description || null]
  );
  res.json({ success: true, id });
});

router.put('/categories/:id', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_staff_categories SET name = COALESCE(?, name), description = COALESCE(?, description),
     is_active = COALESCE(?, is_active) WHERE id = ?`,
    [b.name, b.description, b.is_active, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/categories/:id', requireHrAccess, async (req, res) => {
  const [used] = await getPool().query(
    `SELECT COUNT(*) AS c FROM hr_staff_profiles WHERE category_id = ?`, [req.params.id]
  );
  if (used[0]?.c > 0) {
    return res.status(400).json({ error: 'Category is assigned to staff and cannot be deleted.' });
  }
  await getPool().query(`DELETE FROM hr_staff_categories WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

router.get('/position-rates', requireHrAccess, async (_req, res) => {
  const [rows] = await getPool().query(`SELECT * FROM hr_position_rates ORDER BY daily_rate`);
  res.json({ success: true, data: rows });
});

router.post('/position-rates', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO hr_position_rates (id, position, daily_rate, is_active) VALUES (?, ?, ?, 1)`,
    [id, b.position, num(b.daily_rate)]
  );
  res.json({ success: true, id });
});

router.put('/position-rates/:id', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_position_rates SET position = COALESCE(?, position), daily_rate = COALESCE(?, daily_rate),
     is_active = COALESCE(?, is_active) WHERE id = ?`,
    [b.position, b.daily_rate != null ? num(b.daily_rate) : null, b.is_active, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/position-rates/:id', requireHrAccess, async (req, res) => {
  await getPool().query(`DELETE FROM hr_position_rates WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

// ─── Allowance & deduction types ─────────────────────────────────────────────

router.get('/allowance-types', requireHrAccess, async (_req, res) => {
  const [rows] = await getPool().query(`SELECT * FROM hr_allowance_types ORDER BY name`);
  res.json({ success: true, data: rows });
});

router.post('/allowance-types', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO hr_allowance_types (id, code, name, default_amount, is_active) VALUES (?, ?, ?, ?, 1)`,
    [id, b.code || id.slice(0, 8), b.name, num(b.default_amount)]
  );
  res.json({ success: true, id });
});

router.put('/allowance-types/:id', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_allowance_types SET name = COALESCE(?, name), default_amount = COALESCE(?, default_amount),
     is_active = COALESCE(?, is_active) WHERE id = ?`,
    [b.name, b.default_amount, b.is_active, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/allowance-types/:id', requireHrAccess, async (req, res) => {
  await getPool().query(`DELETE FROM hr_allowance_types WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

router.post('/allowance-types/bulk-delete', requireHrAccess, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
  const placeholders = ids.map(() => '?').join(',');
  const [result] = await getPool().query(
    `DELETE FROM hr_allowance_types WHERE id IN (${placeholders})`, ids
  );
  res.json({ success: true, deleted: result.affectedRows || 0 });
});

router.get('/deduction-types', requireHrAccess, async (_req, res) => {
  const [rows] = await getPool().query(`SELECT * FROM hr_deduction_types ORDER BY name`);
  res.json({ success: true, data: rows });
});

router.post('/deduction-types', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO hr_deduction_types (id, code, name, default_amount, is_active) VALUES (?, ?, ?, ?, 1)`,
    [id, b.code || id.slice(0, 8), b.name, num(b.default_amount)]
  );
  res.json({ success: true, id });
});

router.put('/deduction-types/:id', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_deduction_types SET name = COALESCE(?, name), default_amount = COALESCE(?, default_amount),
     is_active = COALESCE(?, is_active) WHERE id = ?`,
    [b.name, b.default_amount, b.is_active, req.params.id]
  );
  res.json({ success: true });
});

router.delete('/deduction-types/:id', requireHrAccess, async (req, res) => {
  await getPool().query(`DELETE FROM hr_deduction_types WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

router.post('/deduction-types/bulk-delete', requireHrAccess, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' });
  const placeholders = ids.map(() => '?').join(',');
  const [result] = await getPool().query(
    `DELETE FROM hr_deduction_types WHERE id IN (${placeholders})`, ids
  );
  res.json({ success: true, deleted: result.affectedRows || 0 });
});

// ─── Jobs / Events ───────────────────────────────────────────────────────────

router.get('/jobs', requireHrAccess, async (req, res) => {
  const pool = getPool();
  let sql = `SELECT j.*, (SELECT COUNT(*) FROM hr_job_staff js WHERE js.job_id = j.id) AS staff_count
             FROM hr_jobs j WHERE 1=1`;
  const params = [];
  if (req.query.status) { sql += ` AND j.status = ?`; params.push(req.query.status); }
  sql += ` ORDER BY j.created_at DESC LIMIT 200`;
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
});

router.get('/jobs/:id', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const [jobs] = await pool.query(`SELECT * FROM hr_jobs WHERE id = ?`, [req.params.id]);
  if (!jobs.length) return res.status(404).json({ error: 'Job not found' });
  const [staff] = await pool.query(
    `SELECT js.*, sp.first_name, sp.last_name, sp.staff_code, sp.position, sp.phone
     FROM hr_job_staff js
     JOIN hr_staff_profiles sp ON sp.id = js.staff_profile_id
     WHERE js.job_id = ?`,
    [req.params.id]
  );
  res.json({ success: true, data: { ...jobs[0], staff } });
});

router.post('/jobs', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO hr_jobs (id, name, client_name, location, description, start_date, end_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, b.name, b.client_name, b.location, b.description, b.start_date, b.end_date, b.status || 'draft', req.user.sub]
  );
  res.json({ success: true, id });
});

router.put('/jobs/:id', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_jobs SET name = COALESCE(?, name), client_name = COALESCE(?, client_name),
     location = COALESCE(?, location), description = COALESCE(?, description),
     start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
     status = COALESCE(?, status) WHERE id = ?`,
    [b.name, b.client_name, b.location, b.description, b.start_date, b.end_date, b.status, req.params.id]
  );
  res.json({ success: true });
});

router.post('/jobs/:id/staff', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const b = req.body || {};
  const staff = await loadStaff(pool, b.staff_profile_id);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  const id = randomUUID();
  const dailyRate = b.daily_rate != null ? num(b.daily_rate) : num(staff.daily_rate);
  await pool.query(
    `INSERT INTO hr_job_staff (id, job_id, staff_profile_id, daily_rate, days_worked, day_status, partial_fraction, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE daily_rate = VALUES(daily_rate), days_worked = VALUES(days_worked),
       day_status = VALUES(day_status), partial_fraction = VALUES(partial_fraction), notes = VALUES(notes)`,
    [
      id, req.params.id, b.staff_profile_id, dailyRate,
      num(b.days_worked), b.day_status || 'full', num(b.partial_fraction || 1), b.notes,
    ]
  );
  res.json({ success: true });
});

router.put('/jobs/:jobId/staff/:rowId', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  await getPool().query(
    `UPDATE hr_job_staff SET daily_rate = COALESCE(?, daily_rate), days_worked = COALESCE(?, days_worked),
     day_status = COALESCE(?, day_status), partial_fraction = COALESCE(?, partial_fraction),
     notes = COALESCE(?, notes) WHERE id = ? AND job_id = ?`,
    [b.daily_rate, b.days_worked, b.day_status, b.partial_fraction, b.notes, req.params.rowId, req.params.jobId]
  );
  res.json({ success: true });
});

router.delete('/jobs/:jobId/staff/:rowId', requireHrAccess, async (req, res) => {
  await getPool().query(`DELETE FROM hr_job_staff WHERE id = ? AND job_id = ?`, [req.params.rowId, req.params.jobId]);
  res.json({ success: true });
});

router.post('/jobs/:id/sync-timesheet', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const jobId = req.params.id;
  const [jobs] = await pool.query(`SELECT * FROM hr_jobs WHERE id = ?`, [jobId]);
  if (!jobs.length) return res.status(404).json({ error: 'Job not found' });
  const job = jobs[0];
  const [assignments] = await pool.query(`SELECT * FROM hr_job_staff WHERE job_id = ?`, [jobId]);
  let updated = 0;
  for (const row of assignments) {
    const ts = await sumTimesheetHours(pool, row.staff_profile_id, job.start_date, job.end_date, jobId);
    if (ts.days > 0 || ts.hours > 0) {
      const days = ts.days || (ts.hours / 8);
      await pool.query(`UPDATE hr_job_staff SET days_worked = ? WHERE id = ?`, [days, row.id]);
      updated += 1;
    }
  }
  res.json({ success: true, updated });
});

// ─── Payroll runs ────────────────────────────────────────────────────────────

async function loadPayrollRun(pool, id) {
  const [runs] = await pool.query(
    `SELECT pr.*, j.name AS job_name FROM hr_payroll_runs pr
     LEFT JOIN hr_jobs j ON j.id = pr.job_id WHERE pr.id = ?`,
    [id]
  );
  if (!runs.length) return null;
  const run = runs[0];
  const [items] = await pool.query(
    `SELECT pi.*, sp.first_name, sp.last_name, sp.staff_code, sp.position, sp.phone, sp.payment_type,
            sc.name AS category_name
     FROM hr_payroll_items pi
     JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     JOIN hr_staff_categories sc ON sc.id = sp.category_id
     WHERE pi.payroll_run_id = ?`,
    [id]
  );
  for (const item of items) {
    const [allowances] = await pool.query(`SELECT * FROM hr_payroll_allowances WHERE payroll_item_id = ?`, [item.id]);
    const [deductions] = await pool.query(`SELECT * FROM hr_payroll_deductions WHERE payroll_item_id = ?`, [item.id]);
    item.allowances = allowances;
    item.deductions = deductions;
  }
  const [approvals] = await pool.query(
    `SELECT * FROM hr_payroll_approvals WHERE payroll_run_id = ? ORDER BY created_at`,
    [id]
  );
  run.items = items;
  run.approvals = approvals;
  return run;
}

router.get('/payroll-runs', requireHrAccess, async (req, res) => {
  let sql = `SELECT pr.*, j.name AS job_name FROM hr_payroll_runs pr
             LEFT JOIN hr_jobs j ON j.id = pr.job_id WHERE 1=1`;
  const params = [];
  if (req.query.status) { sql += ` AND pr.status = ?`; params.push(req.query.status); }
  if (req.query.run_type) { sql += ` AND pr.run_type = ?`; params.push(req.query.run_type); }
  sql += ` ORDER BY pr.created_at DESC LIMIT 200`;
  const [rows] = await getPool().query(sql, params);
  res.json({ success: true, data: rows });
});

router.get('/payroll-runs/:id', requireHrAccess, async (req, res) => {
  const run = await loadPayrollRun(getPool(), req.params.id);
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  res.json({ success: true, data: run });
});

router.post('/payroll-runs/from-job/:jobId', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const jobId = req.params.jobId;
  const [jobs] = await pool.query(`SELECT * FROM hr_jobs WHERE id = ?`, [jobId]);
  if (!jobs.length) return res.status(404).json({ error: 'Job not found' });
  const job = jobs[0];
  const [assignments] = await pool.query(
    `SELECT js.*, sp.first_name, sp.last_name FROM hr_job_staff js
     JOIN hr_staff_profiles sp ON sp.id = js.staff_profile_id WHERE js.job_id = ?`,
    [jobId]
  );
  if (!assignments.length) return res.status(400).json({ error: 'No staff assigned to job' });

  const runId = randomUUID();
  await pool.query(
    `INSERT INTO hr_payroll_runs (id, run_type, title, job_id, period_start, period_end, status, created_by)
     VALUES (?, 'job', ?, ?, ?, ?, 'draft', ?)`,
    [runId, `Job Payroll: ${job.name}`, jobId, job.start_date, job.end_date, req.user.sub]
  );
  await recordApproval(pool, runId, 'draft', req.user.sub, 'Payroll created from job');

  let totalGross = 0;
  let totalNet = 0;

  for (const row of assignments) {
    const days = effectiveDays(row);
    const basic = num(row.daily_rate) * days;
    const advances = await getOpenAdvances(pool, row.staff_profile_id, jobId);
    const advanceTotal = advances.reduce((s, a) => s + num(a.balance_remaining || a.amount), 0);
    const { gross, net, totalAllowances, totalDeductions } = calcItemTotals({
      basic, allowances: [], deductions: [], advances: advanceTotal,
    });

    const itemId = randomUUID();
    await pool.query(
      `INSERT INTO hr_payroll_items
       (id, payroll_run_id, staff_profile_id, basic_amount, daily_rate, days_worked, gross_amount,
        total_allowances, total_deductions, total_advances, net_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, runId, row.staff_profile_id, basic, row.daily_rate, days, gross,
        totalAllowances, totalDeductions, advanceTotal, net]
    );

    for (const adv of advances) {
      await pool.query(
        `UPDATE hr_advance_payments SET payroll_item_id = ?, status = 'applied' WHERE id = ?`,
        [itemId, adv.id]
      );
    }

    totalGross += gross;
    totalNet += net;
  }

  await pool.query(`UPDATE hr_payroll_runs SET total_gross = ?, total_net = ? WHERE id = ?`, [totalGross, totalNet, runId]);
  const run = await loadPayrollRun(pool, runId);
  res.json({ success: true, data: run });
});

router.post('/payroll-runs/monthly', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const { period_start, period_end, title } = req.body || {};
  if (!period_start || !period_end) {
    return res.status(400).json({ error: 'period_start and period_end required' });
  }

  const [staffList] = await pool.query(
    `SELECT sp.* FROM hr_staff_profiles sp
     JOIN hr_staff_categories sc ON sc.id = sp.category_id
     WHERE sp.status = 'active' AND (sp.payment_type = 'monthly' OR sc.code = 'permanent')`
  );

  const runId = randomUUID();
  const runTitle = title || `Monthly Payroll ${period_start} to ${period_end}`;
  await pool.query(
    `INSERT INTO hr_payroll_runs (id, run_type, title, period_start, period_end, status, created_by)
     VALUES (?, 'monthly', ?, ?, ?, 'draft', ?)`,
    [runId, runTitle, period_start, period_end, req.user.sub]
  );
  await recordApproval(pool, runId, 'draft', req.user.sub);

  let totalGross = 0;
  let totalNet = 0;
  const expectedHours = expectedHoursForPeriod(period_start, period_end);

  for (const staff of staffList) {
    const ts = await sumTimesheetHours(pool, staff.id, period_start, period_end);
    const basic = num(staff.monthly_salary);
    const overtimeHours = Math.max(0, ts.hours - expectedHours);
    const advances = await getOpenAdvances(pool, staff.id);
    const advanceTotal = advances.reduce((s, a) => s + num(a.balance_remaining || a.amount), 0);
    const { gross, net, totalAllowances, totalDeductions } = calcItemTotals({
      basic, allowances: [], deductions: [], advances: advanceTotal,
    });

    const itemId = randomUUID();
    await pool.query(
      `INSERT INTO hr_payroll_items
       (id, payroll_run_id, staff_profile_id, basic_amount, hours_expected, hours_actual,
        overtime_hours, gross_amount, total_allowances, total_deductions, total_advances, net_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, runId, staff.id, basic, expectedHours, ts.hours, overtimeHours,
        gross, totalAllowances, totalDeductions, advanceTotal, net]
    );

    for (const adv of advances) {
      await pool.query(
        `UPDATE hr_advance_payments SET payroll_item_id = ?, status = 'applied' WHERE id = ?`,
        [itemId, adv.id]
      );
    }

    totalGross += gross;
    totalNet += net;
  }

  await pool.query(`UPDATE hr_payroll_runs SET total_gross = ?, total_net = ? WHERE id = ?`, [totalGross, totalNet, runId]);
  const run = await loadPayrollRun(pool, runId);
  res.json({ success: true, data: run });
});

router.put('/payroll-runs/:runId/items/:itemId', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const { allowances = [], deductions = [], days_worked, daily_rate, notes } = req.body || {};
  const itemId = req.params.itemId;

  const [items] = await pool.query(`SELECT * FROM hr_payroll_items WHERE id = ?`, [itemId]);
  if (!items.length) return res.status(404).json({ error: 'Item not found' });
  const item = items[0];

  let basic = num(item.basic_amount);
  if (days_worked != null || daily_rate != null) {
    const rate = daily_rate != null ? num(daily_rate) : num(item.daily_rate);
    const days = days_worked != null ? num(days_worked) : num(item.days_worked);
    basic = rate * days;
  }

  await pool.query(`DELETE FROM hr_payroll_allowances WHERE payroll_item_id = ?`, [itemId]);
  await pool.query(`DELETE FROM hr_payroll_deductions WHERE payroll_item_id = ?`, [itemId]);

  for (const a of allowances) {
    await pool.query(
      `INSERT INTO hr_payroll_allowances (id, payroll_item_id, allowance_type_id, label, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), itemId, a.allowance_type_id || null, a.label || 'Allowance', num(a.amount)]
    );
  }
  for (const d of deductions) {
    await pool.query(
      `INSERT INTO hr_payroll_deductions (id, payroll_item_id, deduction_type_id, label, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), itemId, d.deduction_type_id || null, d.label || 'Deduction', num(d.amount)]
    );
  }

  const totals = calcItemTotals({
    basic,
    allowances,
    deductions,
    advances: item.total_advances,
  });

  await pool.query(
    `UPDATE hr_payroll_items SET basic_amount = ?, daily_rate = COALESCE(?, daily_rate),
     days_worked = COALESCE(?, days_worked), gross_amount = ?, total_allowances = ?,
     total_deductions = ?, net_amount = ?, notes = COALESCE(?, notes) WHERE id = ?`,
    [
      basic, daily_rate, days_worked, totals.gross, totals.totalAllowances,
      totals.totalDeductions, totals.net, notes, itemId,
    ]
  );

  const [sums] = await pool.query(
    `SELECT COALESCE(SUM(gross_amount),0) AS g, COALESCE(SUM(net_amount),0) AS n
     FROM hr_payroll_items WHERE payroll_run_id = ?`,
    [req.params.runId]
  );
  await pool.query(
    `UPDATE hr_payroll_runs SET total_gross = ?, total_net = ? WHERE id = ?`,
    [sums[0].g, sums[0].n, req.params.runId]
  );

  res.json({ success: true });
});

async function transitionPayroll(pool, runId, status, userId, extra = {}) {
  const sets = [`status = ?`];
  const params = [status];
  if (extra.reviewed_by) { sets.push('reviewed_by = ?'); params.push(extra.reviewed_by); }
  if (extra.approved_by) { sets.push('approved_by = ?'); params.push(extra.approved_by); }
  if (extra.forwarded) { sets.push('forwarded_to_finance_at = NOW()'); }
  params.push(runId);
  await pool.query(`UPDATE hr_payroll_runs SET ${sets.join(', ')} WHERE id = ?`, params);
}

router.post('/payroll-runs/:id/submit-review', requireHrAccess, async (req, res) => {
  const pool = getPool();
  await transitionPayroll(pool, req.params.id, 'review', req.user.sub, { reviewed_by: req.user.sub });
  await recordApproval(pool, req.params.id, 'review', req.user.sub, req.body?.notes);
  await notifyPayrollStage(pool, req.params.id, 'review');
  res.json({ success: true });
});

router.post('/payroll-runs/:id/approve', requireHrAccess, async (req, res) => {
  const pool = getPool();
  await transitionPayroll(pool, req.params.id, 'approved', req.user.sub, { approved_by: req.user.sub });
  await recordApproval(pool, req.params.id, 'approved', req.user.sub, req.body?.notes);
  await notifyPayrollStage(pool, req.params.id, 'approved');
  res.json({ success: true });
});

router.post('/payroll-runs/:id/forward-finance', requireHrAccess, async (req, res) => {
  const pool = getPool();
  await transitionPayroll(pool, req.params.id, 'finance', req.user.sub, { forwarded: true });
  await recordApproval(pool, req.params.id, 'finance', req.user.sub, req.body?.notes);
  const [items] = await pool.query(`SELECT id, net_amount FROM hr_payroll_items WHERE payroll_run_id = ?`, [req.params.id]);
  for (const item of items) {
    await pool.query(
      `INSERT INTO hr_finance_payments (id, payroll_run_id, payroll_item_id, amount, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [randomUUID(), req.params.id, item.id, item.net_amount]
    );
    const [existingPs] = await pool.query(`SELECT id FROM hr_payslips WHERE payroll_item_id = ?`, [item.id]);
    if (!existingPs.length) {
      await pool.query(
        `INSERT INTO hr_payslips (id, payroll_item_id, verification_code) VALUES (?, ?, ?)`,
        [randomUUID(), item.id, randomBytes(6).toString('hex').toUpperCase()]
      );
    }
  }
  await notifyPayrollStage(pool, req.params.id, 'finance');
  res.json({ success: true });
});

router.post('/payroll-runs/:id/reject', requireHrAccess, async (req, res) => {
  const pool = getPool();
  await transitionPayroll(pool, req.params.id, 'rejected', req.user.sub);
  await recordApproval(pool, req.params.id, 'rejected', req.user.sub, req.body?.notes);
  await notifyPayrollStage(pool, req.params.id, 'rejected');
  res.json({ success: true });
});

// ─── Advances ────────────────────────────────────────────────────────────────

router.get('/advances', requireHrAccess, async (req, res) => {
  let sql = `SELECT a.*, sp.first_name, sp.last_name, sp.staff_code, j.name AS job_name
             FROM hr_advance_payments a
             JOIN hr_staff_profiles sp ON sp.id = a.staff_profile_id
             LEFT JOIN hr_jobs j ON j.id = a.job_id WHERE 1=1`;
  const params = [];
  if (req.query.status) { sql += ` AND a.status = ?`; params.push(req.query.status); }
  sql += ` ORDER BY a.created_at DESC LIMIT 200`;
  const [rows] = await getPool().query(sql, params);
  res.json({ success: true, data: rows });
});

router.post('/advances', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  const amount = num(b.amount);
  await getPool().query(
    `INSERT INTO hr_advance_payments
     (id, staff_profile_id, job_id, amount, paid_date, reason, approved_by, balance_remaining, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
    [id, b.staff_profile_id, b.job_id || null, amount, b.paid_date, b.reason, req.user.sub, amount]
  );
  res.json({ success: true, id });
});

// ─── Finance ─────────────────────────────────────────────────────────────────

router.get('/finance', requireHrAccess, async (req, res) => {
  let sql = `SELECT fp.*, sp.first_name, sp.last_name, sp.staff_code, pr.title AS payroll_title
             FROM hr_finance_payments fp
             JOIN hr_payroll_items pi ON pi.id = fp.payroll_item_id
             JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
             JOIN hr_payroll_runs pr ON pr.id = fp.payroll_run_id WHERE 1=1`;
  const params = [];
  if (req.query.status) { sql += ` AND fp.status = ?`; params.push(req.query.status); }
  sql += ` ORDER BY fp.created_at DESC LIMIT 300`;
  const [rows] = await getPool().query(sql, params);
  res.json({ success: true, data: rows });
});

router.put('/finance/:id', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const b = req.body || {};
  const status = b.status || 'pending';
  await pool.query(
    `UPDATE hr_finance_payments SET status = ?, amount = COALESCE(?, amount),
     paid_at = CASE WHEN ? IN ('paid','partially_paid') THEN NOW() ELSE paid_at END,
     paid_by = ?, notes = COALESCE(?, notes) WHERE id = ?`,
    [status, b.amount, status, req.user.sub, b.notes, req.params.id]
  );

  const [rows] = await pool.query(
    `SELECT fp.*, pi.staff_profile_id, pi.net_amount, sp.first_name, sp.last_name, sp.phone
     FROM hr_finance_payments fp
     JOIN hr_payroll_items pi ON pi.id = fp.payroll_item_id
     JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     WHERE fp.id = ?`,
    [req.params.id]
  );
  if (rows.length) {
    const row = rows[0];
    await pool.query(`UPDATE hr_payroll_items SET payment_status = ? WHERE id = ?`, [status, row.payroll_item_id]);
    if (status === 'paid') {
      const name = `${row.first_name} ${row.last_name}`.trim();
      await notifyStaff(pool, row, `✅ *PAYMENT CONFIRMED*\n\nHello *${name}*,\n\nYour salary payment of *${Number(row.amount).toLocaleString()} FCFA* has been processed.\n\n_${BRAND}_`);
    }
  }

  res.json({ success: true });
});

// ─── Payslips ────────────────────────────────────────────────────────────────

router.get('/payslips', requireHrAccess, async (_req, res) => {
  const [rows] = await getPool().query(
    `SELECT ps.*, pi.net_amount, pi.payment_status, sp.first_name, sp.last_name, sp.staff_code,
            pr.title AS payroll_title, pr.period_start, pr.period_end
     FROM hr_payslips ps
     JOIN hr_payroll_items pi ON pi.id = ps.payroll_item_id
     JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     JOIN hr_payroll_runs pr ON pr.id = pi.payroll_run_id
     ORDER BY ps.generated_at DESC LIMIT 300`
  );
  res.json({ success: true, data: rows });
});

router.post('/payslips/generate/:itemId', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const itemId = req.params.itemId;
  const [existing] = await pool.query(`SELECT id FROM hr_payslips WHERE payroll_item_id = ?`, [itemId]);
  if (existing.length) return res.json({ success: true, id: existing[0].id, verification_code: existing[0].verification_code });

  const code = randomBytes(6).toString('hex').toUpperCase();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO hr_payslips (id, payroll_item_id, verification_code) VALUES (?, ?, ?)`,
    [id, itemId, code]
  );
  res.json({ success: true, id, verification_code: code });
});

router.get('/payslips/detail/:itemId', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const [items] = await pool.query(
    `SELECT pi.*, sp.*, sc.name AS category_name, pr.title AS payroll_title, pr.run_type,
            pr.period_start, pr.period_end, pr.status AS run_status, j.name AS job_name
     FROM hr_payroll_items pi
     JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     JOIN hr_staff_categories sc ON sc.id = sp.category_id
     JOIN hr_payroll_runs pr ON pr.id = pi.payroll_run_id
     LEFT JOIN hr_jobs j ON j.id = pr.job_id
     WHERE pi.id = ?`,
    [req.params.itemId]
  );
  if (!items.length) return res.status(404).json({ error: 'Not found' });
  const item = items[0];
  const [allowances] = await pool.query(`SELECT * FROM hr_payroll_allowances WHERE payroll_item_id = ?`, [item.id]);
  const [deductions] = await pool.query(`SELECT * FROM hr_payroll_deductions WHERE payroll_item_id = ?`, [item.id]);
  const [payslip] = await pool.query(`SELECT * FROM hr_payslips WHERE payroll_item_id = ?`, [item.id]);
  item.allowances = allowances;
  item.deductions = deductions;
  item.payslip = payslip[0] || null;
  res.json({ success: true, data: item });
});

router.post('/payslips/:itemId/send-whatsapp', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const detail = await pool.query(
    `SELECT pi.*, sp.first_name, sp.last_name, sp.phone, ps.verification_code, pr.title
     FROM hr_payroll_items pi
     JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     JOIN hr_payroll_runs pr ON pr.id = pi.payroll_run_id
     LEFT JOIN hr_payslips ps ON ps.payroll_item_id = pi.id
     WHERE pi.id = ?`,
    [req.params.itemId]
  );
  const row = detail[0]?.[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  const name = `${row.first_name} ${row.last_name}`.trim();
  const verifyUrl = `${APP_BASE}/verify/payslip/${row.verification_code || row.id}`;
  const msg = `📄 *PAYSLIP — ${BRAND}*\n\nHello *${name}*,\n\nYour payslip for *${row.title}* is ready.\n\nNet Pay: *${Number(row.net_amount).toLocaleString()} FCFA*\nVerify: ${verifyUrl}\n\n_${BRAND}_`;
  const result = await notifyStaff(pool, row, msg);
  if (result.sent) {
    await pool.query(`UPDATE hr_payslips SET sent_whatsapp_at = NOW() WHERE payroll_item_id = ?`, [req.params.itemId]);
  }
  res.json({ success: true, sent: result.sent });
});

// ─── Timesheet entries (HR) ──────────────────────────────────────────────────

router.get('/timesheet', requireHrAccess, async (req, res) => {
  let sql = `SELECT te.*, sp.first_name, sp.last_name, sp.staff_code, j.name AS job_name
             FROM hr_timesheet_entries te
             JOIN hr_staff_profiles sp ON sp.id = te.staff_profile_id
             LEFT JOIN hr_jobs j ON j.id = te.job_id WHERE 1=1`;
  const params = [];
  if (req.query.staff_profile_id) { sql += ` AND te.staff_profile_id = ?`; params.push(req.query.staff_profile_id); }
  if (req.query.job_id) { sql += ` AND te.job_id = ?`; params.push(req.query.job_id); }
  sql += ` ORDER BY te.entry_date DESC LIMIT 500`;
  const [rows] = await getPool().query(sql, params);
  res.json({ success: true, data: rows });
});

router.post('/timesheet', requireHrAccess, async (req, res) => {
  const b = req.body || {};
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO hr_timesheet_entries
     (id, staff_profile_id, job_id, entry_date, hours_worked, day_fraction, status, notes, confirmed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE hours_worked = VALUES(hours_worked), day_fraction = VALUES(day_fraction),
       status = VALUES(status), notes = VALUES(notes), confirmed_by = VALUES(confirmed_by)`,
    [
      id, b.staff_profile_id, b.job_id || null, b.entry_date,
      num(b.hours_worked), num(b.day_fraction || 1), b.status || 'confirmed',
      b.notes, req.user.sub,
    ]
  );
  res.json({ success: true });
});

// ─── Reports ─────────────────────────────────────────────────────────────────

router.get('/reports/summary', requireHrAccess, async (req, res) => {
  const pool = getPool();
  const month = req.query.month;
  let monthFilter = '';
  const params = [];
  if (month) {
    monthFilter = ` AND DATE_FORMAT(pr.created_at, '%Y-%m') = ?`;
    params.push(month);
  }

  const [byMonth] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total_net) AS total_net, SUM(total_gross) AS total_gross
     FROM hr_payroll_runs WHERE status IN ('paid','partially_paid','finance','approved') GROUP BY month ORDER BY month DESC`
  );
  const [byJob] = await pool.query(
    `SELECT j.name, SUM(pr.total_net) AS total_net FROM hr_payroll_runs pr
     JOIN hr_jobs j ON j.id = pr.job_id WHERE pr.run_type = 'job'${monthFilter.replace('pr.created_at', 'pr.created_at')}
     GROUP BY j.id ORDER BY total_net DESC`,
    params
  );
  const [engineers] = await pool.query(
    `SELECT sp.first_name, sp.last_name, SUM(pi.net_amount) AS total_paid
     FROM hr_payroll_items pi JOIN hr_staff_profiles sp ON sp.id = pi.staff_profile_id
     WHERE pi.payment_status = 'paid' AND sp.position LIKE '%Engineer%'${monthFilter.replace('pr.created_at', 'pi.created_at')}
     GROUP BY sp.id ORDER BY total_paid DESC LIMIT 20`,
    params
  );
  const [unpaid] = await pool.query(
    `SELECT COALESCE(SUM(net_amount),0) AS total FROM hr_payroll_items
     WHERE payment_status IN ('pending','approved_for_payment','partially_paid')`
  );
  const [allowances] = await pool.query(
    `SELECT label, SUM(amount) AS total FROM hr_payroll_allowances GROUP BY label ORDER BY total DESC`
  );
  const [deductions] = await pool.query(
    `SELECT label, SUM(amount) AS total FROM hr_payroll_deductions GROUP BY label ORDER BY total DESC`
  );
  const [advances] = await pool.query(
    `SELECT COALESCE(SUM(balance_remaining),0) AS open_balance, COALESCE(SUM(amount),0) AS total_advanced
     FROM hr_advance_payments WHERE status = 'open'`
  );

  res.json({
    success: true,
    data: {
      byMonth,
      byJob,
      engineers,
      unpaidTotal: unpaid[0]?.total || 0,
      allowances,
      deductions,
      advances,
    },
  });
});

router.get('/reports/staff-history/:staffId', requireHrAccess, async (req, res) => {
  const [rows] = await getPool().query(
    `SELECT pi.*, pr.title, pr.period_start, pr.period_end, pr.run_type
     FROM hr_payroll_items pi JOIN hr_payroll_runs pr ON pr.id = pi.payroll_run_id
     WHERE pi.staff_profile_id = ? ORDER BY pi.created_at DESC`,
    [req.params.staffId]
  );
  res.json({ success: true, data: rows });
});

export default router;
