import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { num, requireErpAdmin } from './helpers.js';

const router = Router();

router.get('/settings', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM pos_settings ORDER BY updated_at DESC LIMIT 1`);
    res.json({ data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT id FROM pos_settings LIMIT 1`);
    const b = req.body || {};
    if (rows.length) {
      await pool.query(
        `UPDATE pos_settings SET warehouse_id=?, customer_id=?, biller_id=?, settings_json=? WHERE id=?`,
        [b.warehouse_id || null, b.customer_id || null, b.biller_id || null, b.settings_json ? JSON.stringify(b.settings_json) : null, rows[0].id]
      );
      const [updated] = await pool.query(`SELECT * FROM pos_settings WHERE id = ?`, [rows[0].id]);
      return res.json({ data: updated[0] });
    }
    const id = randomUUID();
    await pool.query(
      `INSERT INTO pos_settings (id, warehouse_id, customer_id, biller_id, settings_json) VALUES (?, ?, ?, ?, ?)`,
      [id, b.warehouse_id || null, b.customer_id || null, b.biller_id || null, b.settings_json ? JSON.stringify(b.settings_json) : null]
    );
    const [created] = await pool.query(`SELECT * FROM pos_settings WHERE id = ?`, [id]);
    res.json({ data: created[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/registers', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.warehouse_id) {
      where += ' AND warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.status) {
      where += ' AND status = ?';
      params.push(req.query.status);
    }
    const [rows] = await getPool().query(
      `SELECT cr.*, w.name AS warehouse_name FROM cash_registers cr
       LEFT JOIN warehouses w ON w.id = cr.warehouse_id
       WHERE ${where} ORDER BY opened_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/registers/open', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { warehouse_id, cash_in_hand = 0 } = req.body || {};
    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id required' });
    const pool = getPool();
    const [open] = await pool.query(
      `SELECT id FROM cash_registers WHERE warehouse_id = ? AND status = 'open' LIMIT 1`,
      [warehouse_id]
    );
    if (open.length) return res.status(400).json({ error: 'Register already open for this warehouse' });
    const id = randomUUID();
    await pool.query(
      `INSERT INTO cash_registers (id, warehouse_id, user_id, status, cash_in_hand) VALUES (?, ?, ?, 'open', ?)`,
      [id, warehouse_id, req.user?.sub || req.user?.id || null, num(cash_in_hand)]
    );
    const [rows] = await pool.query(`SELECT * FROM cash_registers WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/registers/:id/close', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM cash_registers WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'open') return res.status(400).json({ error: 'Register is not open' });
    await pool.query(`UPDATE cash_registers SET status = 'closed', closed_at = NOW() WHERE id = ?`, [req.params.id]);
    const [updated] = await pool.query(`SELECT * FROM cash_registers WHERE id = ?`, [req.params.id]);
    res.json({ data: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POS sale shortcut — same as sales create with is_pos=true */
router.post('/sale', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const body = { ...(req.body || {}), is_pos: true, sale_status: 'completed' };
    // Reuse sales POST by forwarding to sales module logic via dynamic import of create path
    const salesMod = await import('./sales.js');
    // Mount a mini request by calling the same endpoint handler isn't trivial;
    // instead duplicate thin wrapper via fetch-like internal call using pool from sales pattern.
    req.url = '/';
    req.body = body;
    // Create sale by posting through shared helper extracted inline:
    const { getPool: gp } = await import('../../db/pool.js');
    const { nextErpReference } = await import('../../services/erp/referenceNumbers.js');
    const { adjustStock, getStock } = await import('../../services/erp/stock.js');
    const { randomUUID } = await import('node:crypto');
    const pool = gp();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!body.warehouse_id) return res.status(400).json({ error: 'warehouse_id required' });
    if (!items.length) return res.status(400).json({ error: 'items required' });
    for (const item of items) {
      const stock = await getStock(item.product_id, body.warehouse_id);
      if (stock < num(item.qty)) {
        return res.status(400).json({ error: `Insufficient stock for product ${item.product_id}` });
      }
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const id = randomUUID();
      const reference = await nextErpReference('posr-', 'sales');
      let subtotal = 0;
      for (const item of items) {
        subtotal += num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
      }
      const grand = subtotal - num(body.discount) + num(body.shipping) + num(body.tax);
      const paid = num(body.paid_amount, grand);
      const payment_status = paid <= 0 ? 'pending' : paid >= grand ? 'paid' : 'partial';
      const sale_date = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await conn.query(
        `INSERT INTO sales (id, reference, warehouse_id, customer_id, biller_id, sale_status, payment_status,
          grand_total, paid_amount, discount, shipping, tax, note, is_pos, sale_date, created_by)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          id, reference, body.warehouse_id, body.customer_id || null, body.biller_id || null,
          payment_status, grand, paid, num(body.discount), num(body.shipping), num(body.tax),
          body.note || null, sale_date, req.user?.sub || req.user?.id || null,
        ]
      );
      for (const item of items) {
        const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
        await conn.query(
          `INSERT INTO product_sales (id, sale_id, product_id, qty, net_unit_price, discount, tax, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_price), num(item.discount), num(item.tax), line]
        );
        await adjustStock(conn, { productId: item.product_id, warehouseId: body.warehouse_id, delta: -num(item.qty) });
      }
      if (paid > 0) {
        await conn.query(
          `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, created_by)
           VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
          [
            randomUUID(), await nextErpReference('pay-', 'erp_payments'), id, paid,
            body.paying_method || 'cash', body.note || null, req.user?.sub || req.user?.id || null,
          ]
        );
      }
      await conn.commit();
      void salesMod;
      res.status(201).json({ data: { id, reference, grand_total: grand, payment_status } });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
