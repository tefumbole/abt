import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { sendTextMessage, formatPhoneNumber, isWasenderConfigured } from '../../services/wasenderWhatsAppService.js';
import { num, requireErpAdmin } from './helpers.js';

const router = Router();

function publicBaseUrl(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
  if (env && env !== '*') return String(env).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function quotationReference() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `qr-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function loadQuotation(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT q.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
            c.address AS customer_address, c.company_name AS customer_company,
            w.name AS warehouse_name, b.name AS biller_name, s.name AS supplier_name
     FROM quotations q
     LEFT JOIN erp_customers c ON c.id = q.customer_id
     LEFT JOIN warehouses w ON w.id = q.warehouse_id
     LEFT JOIN erp_billers b ON b.id = q.biller_id
     LEFT JOIN erp_suppliers s ON s.id = q.supplier_id
     WHERE q.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [items] = await pool.query(
    `SELECT pq.*, p.name AS product_name, p.code AS product_code FROM product_quotations pq
     LEFT JOIN products p ON p.id = pq.product_id WHERE pq.quotation_id = ?`,
    [id]
  );
  return { ...rows[0], items };
}

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    let where = '1=1';
    if (req.query.status) {
      where += ' AND q.status = ?';
      params.push(req.query.status);
    }
    if (req.query.q) {
      where += ' AND (q.reference LIKE ? OR c.name LIKE ? OR b.name LIKE ? OR s.name LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like, like, like);
    }
    const [rows] = await pool.query(
      `SELECT q.*, c.name AS customer_name, w.name AS warehouse_name,
              b.name AS biller_name, s.name AS supplier_name
       FROM quotations q
       LEFT JOIN erp_customers c ON c.id = q.customer_id
       LEFT JOIN warehouses w ON w.id = q.warehouse_id
       LEFT JOIN erp_billers b ON b.id = q.biller_id
       LEFT JOIN erp_suppliers s ON s.id = q.supplier_id
       WHERE ${where}
       ORDER BY q.created_at DESC`,
      params
    );
    const [counts] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM quotations GROUP BY status`
    );
    const statusCounts = {
      awaiting_approval: 0,
      approved: 0,
      rejected: 0,
      draft: 0,
      all: 0,
    };
    for (const row of counts) {
      const key = String(row.status || '');
      statusCounts[key] = Number(row.count) || 0;
      statusCounts.all += Number(row.count) || 0;
    }
    res.json({ data: rows, statusCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json({ data: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id) return res.status(400).json({ error: 'warehouse_id required' });
    if (!items.length) return res.status(400).json({ error: 'items required' });

    await conn.beginTransaction();
    const id = randomUUID();
    let reference = quotationReference();
    const [dup] = await conn.query(`SELECT id FROM quotations WHERE reference = ? LIMIT 1`, [reference]);
    if (dup.length) reference = await nextErpReference('qr-', 'quotations');
    let subtotal = 0;
    for (const item of items) {
      subtotal += num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
    }
    const grand = subtotal - num(b.discount) + num(b.shipping) + num(b.tax);
    const token = randomBytes(24).toString('hex');
    const status = b.status || 'draft';

    await conn.query(
      `INSERT INTO quotations (id, reference, warehouse_id, customer_id, biller_id, supplier_id, status,
        grand_total, discount, shipping, tax, note, approval_token, cc_phones, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null, b.supplier_id || null,
        status, grand, num(b.discount), num(b.shipping), num(b.tax), b.note || null, token,
        b.cc_phones || null, req.user?.sub || req.user?.id || null,
      ]
    );
    for (const item of items) {
      const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
      await conn.query(
        `INSERT INTO product_quotations (id, quotation_id, product_id, qty, net_unit_price, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_price), num(item.discount), num(item.tax), line]
      );
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference, status, approval_token: token, grand_total: grand } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const [ex] = await pool.query(`SELECT * FROM quotations WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (!items.length) return res.status(400).json({ error: 'items required' });
    const current = ex[0];

    await conn.beginTransaction();
    await conn.query(`DELETE FROM product_quotations WHERE quotation_id = ?`, [req.params.id]);
    let subtotal = 0;
    for (const item of items) {
      const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
      subtotal += line;
      await conn.query(
        `INSERT INTO product_quotations (id, quotation_id, product_id, qty, net_unit_price, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), req.params.id, item.product_id, num(item.qty), num(item.net_unit_price), num(item.discount), num(item.tax), line]
      );
    }
    const discount = b.discount !== undefined ? num(b.discount) : num(current.discount);
    const shipping = b.shipping !== undefined ? num(b.shipping) : num(current.shipping);
    const tax = b.tax !== undefined ? num(b.tax) : num(current.tax);
    const grand = subtotal - discount + shipping + tax;

    await conn.query(
      `UPDATE quotations SET warehouse_id = ?, customer_id = ?, biller_id = ?, supplier_id = ?, status = ?,
        grand_total = ?, discount = ?, shipping = ?, tax = ?, note = ?, cc_phones = ?
       WHERE id = ?`,
      [
        b.warehouse_id || current.warehouse_id,
        b.customer_id !== undefined ? b.customer_id || null : current.customer_id,
        b.biller_id !== undefined ? b.biller_id || null : current.biller_id,
        b.supplier_id !== undefined ? b.supplier_id || null : current.supplier_id,
        b.status || current.status,
        grand,
        discount,
        shipping,
        tax,
        b.note !== undefined ? b.note || null : current.note,
        b.cc_phones !== undefined ? b.cc_phones || null : current.cc_phones,
        req.params.id,
      ]
    );
    await conn.commit();
    res.json({ data: { id: req.params.id, reference: current.reference, grand_total: grand } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT id FROM quotations WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await pool.query(`DELETE FROM product_quotations WHERE quotation_id = ?`, [req.params.id]);
    await pool.query(`DELETE FROM quotations WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    const allowed = ['draft', 'awaiting_approval', 'approved', 'rejected'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const pool = getPool();
    const [ex] = await pool.query(`SELECT id FROM quotations WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await pool.query(`UPDATE quotations SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/send-whatsapp', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    if (!isWasenderConfigured()) return res.status(503).json({ error: 'WhatsApp not configured' });
    const phone = req.body?.phone || q.customer_phone;
    if (!phone) return res.status(400).json({ error: 'Customer phone required' });
    if (!q.approval_token) {
      const token = randomBytes(24).toString('hex');
      await getPool().query(`UPDATE quotations SET approval_token = ? WHERE id = ?`, [token, q.id]);
      q.approval_token = token;
    }
    const link = `${publicBaseUrl(req)}/erp/public/quotation/${q.approval_token}`;
    const msg = `Quotation ${q.reference} from Alpha Bridge.\nTotal: ${Number(q.grand_total).toFixed(2)}\nApprove or reject: ${link}`;
    await sendTextMessage(formatPhoneNumber(phone), msg, 'erp-quotation');
    await getPool().query(`UPDATE quotations SET status = 'awaiting_approval' WHERE id = ? AND status = 'draft'`, [q.id]);

    const cc = String(q.cc_phones || req.body?.cc_phones || '')
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const p of cc) {
      try {
        await sendTextMessage(formatPhoneNumber(p), `CC: Quotation ${q.reference} sent for approval.\n${link}`, 'erp-quotation-cc');
      } catch {
        /* ignore CC failures */
      }
    }
    res.json({ ok: true, link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/convert-sale', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    if (!['approved', 'awaiting_approval'].includes(q.status) && q.status !== 'draft') {
      return res.status(400).json({ error: 'Quotation cannot be converted in current status' });
    }
    // Sale creation is delegated to sales route via internal insert
    const { default: salesRouter } = await import('./sales.js');
    void salesRouter;
    const saleBody = {
      warehouse_id: q.warehouse_id,
      customer_id: q.customer_id,
      biller_id: q.biller_id,
      discount: q.discount,
      shipping: q.shipping,
      tax: q.tax,
      note: `From quotation ${q.reference}`,
      paid_amount: 0,
      items: q.items.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        net_unit_price: i.net_unit_price,
        discount: i.discount,
        tax: i.tax,
      })),
    };
    // Call sales create logic inline to avoid nested HTTP
    const createRes = await createSaleFromQuotation(req, saleBody, q.id);
    res.status(201).json(createRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function createSaleFromQuotation(req, b, quotationId) {
  const pool = getPool();
  const { adjustStock, getStock } = await import('../../services/erp/stock.js');
  for (const item of b.items) {
    const stock = await getStock(item.product_id, b.warehouse_id);
    if (stock < num(item.qty)) throw new Error(`Insufficient stock for product ${item.product_id}`);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('sr-', 'sales');
    let subtotal = 0;
    for (const item of b.items) {
      subtotal += num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
    }
    const grand = subtotal - num(b.discount) + num(b.shipping) + num(b.tax);
    const sale_date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.query(
      `INSERT INTO sales (id, reference, warehouse_id, customer_id, biller_id, sale_status, payment_status,
        grand_total, paid_amount, discount, shipping, tax, note, is_pos, sale_date, created_by)
       VALUES (?, ?, ?, ?, ?, 'completed', 'pending', ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null, grand,
        num(b.discount), num(b.shipping), num(b.tax), b.note || null, sale_date,
        req.user?.sub || req.user?.id || null,
      ]
    );
    for (const item of b.items) {
      const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
      await conn.query(
        `INSERT INTO product_sales (id, sale_id, product_id, qty, net_unit_price, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_price), num(item.discount), num(item.tax), line]
      );
      await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: -num(item.qty) });
    }
    await conn.query(`UPDATE quotations SET status = 'approved', sale_id = ? WHERE id = ?`, [id, quotationId]);
    await conn.commit();
    return { data: { id, reference, grand_total: grand } };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export default router;
