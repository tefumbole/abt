import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { sendTextMessage, formatPhoneNumber, isWasenderConfigured } from '../../services/wasenderWhatsAppService.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

function publicBaseUrl(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
  if (env && env !== '*') return String(env).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

// --- Rentals / Bookings ---
router.get('/bookings', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.status) {
      where += ' AND b.booking_status = ?';
      params.push(req.query.status);
    }
    const [rows] = await getPool().query(
      `SELECT b.*, c.name AS customer_name, w.name AS warehouse_name
       FROM erp_bookings b
       LEFT JOIN erp_customers c ON c.id = b.customer_id
       LEFT JOIN warehouses w ON w.id = b.warehouse_id
       WHERE ${where}
       ORDER BY b.from_datetime DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bookings/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_bookings WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await getPool().query(
      `SELECT bp.*, p.name AS product_name FROM erp_booking_products bp
       LEFT JOIN products p ON p.id = bp.product_id WHERE bp.booking_id = ?`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id || !b.from_datetime || !b.to_datetime) {
      return res.status(400).json({ error: 'warehouse_id, from_datetime, to_datetime required' });
    }
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('bk-', 'erp_bookings');
    let grand = 0;
    for (const item of items) {
      grand += num(item.qty) * num(item.net_unit_price) * num(item.duration_hours || 1) - num(item.discount) + num(item.tax);
    }
    const token = randomBytes(24).toString('hex');
    await conn.query(
      `INSERT INTO erp_bookings (id, reference, warehouse_id, customer_id, biller_id, from_datetime, to_datetime,
        booking_status, payment_status, contract_type, grand_total, note, staff_note, signature_token, signature_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null, b.from_datetime, b.to_datetime,
        b.booking_status || 'pending', b.payment_status || 'pending', b.contract_type || 'none', grand,
        b.note || null, b.staff_note || null, token, b.contract_type && b.contract_type !== 'none' ? 'pending' : 'none',
        req.user?.sub || req.user?.id || null,
      ]
    );
    for (const item of items) {
      const sub = num(item.qty) * num(item.net_unit_price) * num(item.duration_hours || 1) - num(item.discount) + num(item.tax);
      await conn.query(
        `INSERT INTO erp_booking_products (id, booking_id, product_id, qty, net_unit_price, duration_hours, discount, tax, subtotal, from_datetime, to_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_price), num(item.duration_hours || 1),
          num(item.discount), num(item.tax), sub, item.from_datetime || b.from_datetime, item.to_datetime || b.to_datetime,
        ]
      );
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference, grand_total: grand, signature_token: token } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.post('/bookings/:id/send-sign-link', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT b.*, c.phone AS customer_phone FROM erp_bookings b
       LEFT JOIN erp_customers c ON c.id = b.customer_id WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!isWasenderConfigured()) return res.status(503).json({ error: 'WhatsApp not configured' });
    const phone = req.body?.phone || rows[0].customer_phone;
    if (!phone) return res.status(400).json({ error: 'Phone required' });
    let token = rows[0].signature_token;
    if (!token) {
      token = randomBytes(24).toString('hex');
      await pool.query(`UPDATE erp_bookings SET signature_token = ?, signature_status = 'pending' WHERE id = ?`, [token, rows[0].id]);
    }
    const link = `${publicBaseUrl(req)}/erp/public/booking/${token}`;
    await sendTextMessage(formatPhoneNumber(phone), `Rental booking ${rows[0].reference}: please sign.\n${link}`, 'erp-booking-sign');
    res.json({ ok: true, link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Contracts ---
router.get('/contracts', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.status) {
      where += ' AND ct.status = ?';
      params.push(req.query.status);
    }
    if (req.query.customer_id) {
      where += ' AND ct.customer_id = ?';
      params.push(req.query.customer_id);
    }
    if (req.query.contract_type) {
      where += ' AND ct.contract_type = ?';
      params.push(req.query.contract_type);
    }
    if (req.query.q) {
      where += ' AND (ct.title LIKE ? OR ct.reference LIKE ? OR c.name LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    const [rows] = await getPool().query(
      `SELECT ct.*, c.name AS customer_name FROM erp_contracts ct
       LEFT JOIN erp_customers c ON c.id = ct.customer_id
       WHERE ${where} ORDER BY ct.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contracts', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title?.trim()) return res.status(400).json({ error: 'title required' });
    const id = randomUUID();
    const reference = await nextErpReference('ct-', 'erp_contracts');
    await getPool().query(
      `INSERT INTO erp_contracts (id, reference, title, contract_type, status, customer_id, body_html, client_sign_token, admin_sign_token, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.title.trim(), b.contract_type || 'general', b.status || 'draft', b.customer_id || null,
        b.body_html || null, randomBytes(24).toString('hex'), randomBytes(24).toString('hex'),
        b.expires_at || null, req.user?.sub || req.user?.id || null,
      ]
    );
    const [rows] = await getPool().query(`SELECT * FROM erp_contracts WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/contracts/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_contracts WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    await pool.query(
      `UPDATE erp_contracts SET title=?, contract_type=?, status=?, customer_id=?, body_html=?, expires_at=? WHERE id=?`,
      [
        b.title?.trim() || c.title,
        b.contract_type || c.contract_type,
        b.status || c.status,
        b.customer_id !== undefined ? b.customer_id : c.customer_id,
        b.body_html !== undefined ? b.body_html : c.body_html,
        b.expires_at !== undefined ? b.expires_at : c.expires_at,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_contracts WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/contracts/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [ex] = await getPool().query(`SELECT id FROM erp_contracts WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await getPool().query(`DELETE FROM erp_contracts WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/contract-templates', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_contract_templates ORDER BY name`);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contract-templates', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    if (!req.body?.name?.trim()) return res.status(400).json({ error: 'name required' });
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO erp_contract_templates (id, name, body_html, is_active) VALUES (?, ?, ?, 1)`,
      [id, req.body.name.trim(), req.body.body_html || null]
    );
    const [rows] = await getPool().query(`SELECT * FROM erp_contract_templates WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/contract-templates/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_contract_templates WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    await pool.query(
      `UPDATE erp_contract_templates SET name=?, body_html=?, is_active=? WHERE id=?`,
      [
        b.name?.trim() || c.name,
        b.body_html !== undefined ? b.body_html : c.body_html,
        (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_contract_templates WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/contract-templates/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [ex] = await getPool().query(`SELECT id FROM erp_contract_templates WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await getPool().query(`DELETE FROM erp_contract_templates WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- General Letters (ERP, not HR) ---
router.get('/letter-categories', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_letter_categories ORDER BY name`);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/letter-categories', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    if (!req.body?.name?.trim()) return res.status(400).json({ error: 'name required' });
    const id = randomUUID();
    await getPool().query(`INSERT INTO erp_letter_categories (id, name) VALUES (?, ?)`, [id, req.body.name.trim()]);
    const [rows] = await getPool().query(`SELECT * FROM erp_letter_categories WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/letter-categories/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_letter_categories WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    await pool.query(`UPDATE erp_letter_categories SET name = ? WHERE id = ?`, [name, req.params.id]);
    const [rows] = await pool.query(`SELECT * FROM erp_letter_categories WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/letter-categories/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [ex] = await getPool().query(`SELECT id FROM erp_letter_categories WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await getPool().query(`UPDATE erp_letters SET category_id = NULL WHERE category_id = ?`, [req.params.id]);
    await getPool().query(`DELETE FROM erp_letter_categories WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/letters', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT l.*, c.name AS category_name FROM erp_letters l
       LEFT JOIN erp_letter_categories c ON c.id = l.category_id
       ORDER BY l.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/letters', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.subject?.trim()) return res.status(400).json({ error: 'subject required' });
    const id = randomUUID();
    const reference = await nextErpReference('lt-', 'erp_letters');
    await getPool().query(
      `INSERT INTO erp_letters (id, reference, category_id, subject, body_html, status, recipient_name, recipient_phone, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.category_id || null, b.subject.trim(), b.body_html || null, b.status || 'draft',
        b.recipient_name || null, b.recipient_phone || null, req.user?.sub || req.user?.id || null,
      ]
    );
    const [rows] = await getPool().query(`SELECT * FROM erp_letters WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/letters/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_letters WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    await pool.query(
      `UPDATE erp_letters SET category_id=?, subject=?, body_html=?, status=?, recipient_name=?, recipient_phone=? WHERE id=?`,
      [
        b.category_id !== undefined ? b.category_id : c.category_id,
        b.subject?.trim() || c.subject,
        b.body_html !== undefined ? b.body_html : c.body_html,
        b.status || c.status,
        b.recipient_name !== undefined ? b.recipient_name : c.recipient_name,
        b.recipient_phone !== undefined ? b.recipient_phone : c.recipient_phone,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_letters WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/letters/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [ex] = await getPool().query(`SELECT id FROM erp_letters WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await getPool().query(`DELETE FROM erp_letters WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Fixed Assets ---
async function simpleCrudList(table) {
  const [rows] = await getPool().query(`SELECT * FROM ${table} ORDER BY name`);
  return rows;
}

async function simpleNamedUpdate(table, id, body) {
  const pool = getPool();
  const [ex] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!ex.length) return null;
  const name = body?.name?.trim() || ex[0].name;
  if (table === 'asset_stations') {
    await pool.query(
      `UPDATE asset_stations SET name = ?, region_id = ? WHERE id = ?`,
      [name, body?.region_id !== undefined ? body.region_id : ex[0].region_id, id]
    );
  } else {
    await pool.query(`UPDATE ${table} SET name = ? WHERE id = ?`, [name, id]);
  }
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows[0];
}

router.get('/asset-regions', requireAuth, requireErpAdmin, async (_req, res) => {
  try { res.json({ data: await simpleCrudList('asset_regions') }); } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/asset-regions', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const id = randomUUID();
    await getPool().query(`INSERT INTO asset_regions (id, name) VALUES (?, ?)`, [id, req.body?.name?.trim()]);
    const [rows] = await getPool().query(`SELECT * FROM asset_regions WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/asset-regions/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const row = await simpleNamedUpdate('asset_regions', req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/asset-regions/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM asset_regions WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/asset-stations', requireAuth, requireErpAdmin, async (_req, res) => {
  try { res.json({ data: await simpleCrudList('asset_stations') }); } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/asset-stations', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const id = randomUUID();
    await getPool().query(`INSERT INTO asset_stations (id, region_id, name) VALUES (?, ?, ?)`, [id, req.body?.region_id || null, req.body?.name?.trim()]);
    const [rows] = await getPool().query(`SELECT * FROM asset_stations WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/asset-stations/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const row = await simpleNamedUpdate('asset_stations', req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/asset-stations/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM asset_stations WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/asset-donors', requireAuth, requireErpAdmin, async (_req, res) => {
  try { res.json({ data: await simpleCrudList('asset_donors') }); } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/asset-donors', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const id = randomUUID();
    await getPool().query(`INSERT INTO asset_donors (id, name) VALUES (?, ?)`, [id, req.body?.name?.trim()]);
    const [rows] = await getPool().query(`SELECT * FROM asset_donors WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/asset-donors/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const row = await simpleNamedUpdate('asset_donors', req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/asset-donors/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM asset_donors WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/asset-categories', requireAuth, requireErpAdmin, async (_req, res) => {
  try { res.json({ data: await simpleCrudList('asset_categories') }); } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/asset-categories', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const id = randomUUID();
    await getPool().query(`INSERT INTO asset_categories (id, name) VALUES (?, ?)`, [id, req.body?.name?.trim()]);
    const [rows] = await getPool().query(`SELECT * FROM asset_categories WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/asset-categories/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const row = await simpleNamedUpdate('asset_categories', req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ data: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/asset-categories/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM asset_categories WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fixed-assets', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.category_id) {
      where += ' AND a.category_id = ?';
      params.push(req.query.category_id);
    }
    if (req.query.status) {
      where += ' AND a.status = ?';
      params.push(req.query.status);
    }
    if (req.query.region_id) {
      where += ' AND a.region_id = ?';
      params.push(req.query.region_id);
    }
    const [rows] = await getPool().query(
      `SELECT a.*, c.name AS category_name, r.name AS region_name, s.name AS station_name, d.name AS donor_name
       FROM fixed_assets a
       LEFT JOIN asset_categories c ON c.id = a.category_id
       LEFT JOIN asset_regions r ON r.id = a.region_id
       LEFT JOIN asset_stations s ON s.id = a.station_id
       LEFT JOIN asset_donors d ON d.id = a.donor_id
       WHERE ${where}
       ORDER BY a.name`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fixed-assets', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: 'name required' });
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO fixed_assets (id, name, category_id, region_id, station_id, donor_id, purchase_cost, book_value, status, purchase_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, b.name.trim(), b.category_id || null, b.region_id || null, b.station_id || null, b.donor_id || null,
        num(b.purchase_cost), num(b.book_value ?? b.purchase_cost), b.status || 'active', b.purchase_date || null, b.note || null,
      ]
    );
    const [rows] = await getPool().query(`SELECT * FROM fixed_assets WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/fixed-assets/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM fixed_assets WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    await pool.query(
      `UPDATE fixed_assets SET name=?, category_id=?, region_id=?, station_id=?, donor_id=?, purchase_cost=?, book_value=?, status=?, purchase_date=?, note=? WHERE id=?`,
      [
        b.name?.trim() || c.name,
        b.category_id !== undefined ? b.category_id : c.category_id,
        b.region_id !== undefined ? b.region_id : c.region_id,
        b.station_id !== undefined ? b.station_id : c.station_id,
        b.donor_id !== undefined ? b.donor_id : c.donor_id,
        b.purchase_cost !== undefined ? num(b.purchase_cost) : num(c.purchase_cost),
        b.book_value !== undefined ? num(b.book_value) : num(c.book_value),
        b.status || c.status,
        b.purchase_date !== undefined ? b.purchase_date : c.purchase_date,
        b.note !== undefined ? b.note : c.note,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM fixed_assets WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/fixed-assets/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [ex] = await getPool().query(`SELECT id FROM fixed_assets WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await getPool().query(`DELETE FROM fixed_assets WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fixed-assets/:id/dispose', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`UPDATE fixed_assets SET status = 'disposed', book_value = 0 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Leaders (thin; can link to members) ---
router.get('/leaders', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_leaders ORDER BY sort_order ASC, name ASC`);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/leaders', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: 'name required' });
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO erp_leaders (id, member_id, name, title, photo_url, bio, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, b.member_id || null, b.name.trim(), b.title || null, b.photo_url || null, b.bio || null,
        num(b.sort_order), bool(b.is_active, true) ? 1 : 0,
      ]
    );
    const [rows] = await getPool().query(`SELECT * FROM erp_leaders WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/leaders/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_leaders WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    await pool.query(
      `UPDATE erp_leaders SET member_id=?, name=?, title=?, photo_url=?, bio=?, sort_order=?, is_active=? WHERE id=?`,
      [
        b.member_id !== undefined ? b.member_id : c.member_id,
        b.name?.trim() || c.name,
        b.title !== undefined ? b.title : c.title,
        b.photo_url !== undefined ? b.photo_url : c.photo_url,
        b.bio !== undefined ? b.bio : c.bio,
        b.sort_order !== undefined ? num(b.sort_order) : c.sort_order,
        (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_leaders WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/leaders/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM erp_leaders WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
