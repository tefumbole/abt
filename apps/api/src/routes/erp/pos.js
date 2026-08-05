import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock, getStock } from '../../services/erp/stock.js';
import { mysqlDateTime, num, requireErpAdmin } from './helpers.js';

const router = Router();

function parseSettings(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapPosSettings(row) {
  if (!row) {
    return { id: null, warehouse_id: null, customer_id: null, biller_id: null, settings: {} };
  }
  return {
    id: row.id,
    warehouse_id: row.warehouse_id,
    customer_id: row.customer_id,
    biller_id: row.biller_id,
    settings: parseSettings(row.settings_json),
  };
}

router.get('/settings', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM pos_settings ORDER BY updated_at DESC LIMIT 1`);
    res.json({ data: mapPosSettings(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, settings_json FROM pos_settings ORDER BY updated_at DESC LIMIT 1`
    );
    const b = req.body || {};
    const source = b.settings !== undefined ? b.settings : b.settings_json;
    const settingsJson = source !== undefined
      ? (source ? JSON.stringify(parseSettings(source)) : null)
      : (rows[0]?.settings_json ?? null);
    if (rows.length) {
      await pool.query(
        `UPDATE pos_settings SET warehouse_id=?, customer_id=?, biller_id=?, settings_json=? WHERE id=?`,
        [b.warehouse_id || null, b.customer_id || null, b.biller_id || null, settingsJson, rows[0].id]
      );
      const [updated] = await pool.query(`SELECT * FROM pos_settings WHERE id = ?`, [rows[0].id]);
      return res.json({ data: mapPosSettings(updated[0]) });
    }
    const id = randomUUID();
    await pool.query(
      `INSERT INTO pos_settings (id, warehouse_id, customer_id, biller_id, settings_json) VALUES (?, ?, ?, ?, ?)`,
      [id, b.warehouse_id || null, b.customer_id || null, b.biller_id || null, settingsJson]
    );
    const [created] = await pool.query(`SELECT * FROM pos_settings WHERE id = ?`, [id]);
    res.json({ data: mapPosSettings(created[0]) });
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

/** Session totals for a register: POS sales in its warehouse between open and close. */
router.get('/registers/:id/summary', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT cr.*, w.name AS warehouse_name FROM cash_registers cr
       LEFT JOIN warehouses w ON w.id = cr.warehouse_id
       WHERE cr.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const register = rows[0];
    const scope = `s.is_pos = 1 AND s.warehouse_id = ?
       AND s.sale_date >= ? AND s.sale_date <= COALESCE(?, NOW())`;
    const scopeParams = [register.warehouse_id, register.opened_at, register.closed_at];

    const [totalsRows] = await pool.query(
      `SELECT COUNT(*) AS sales_count,
        COALESCE(SUM(s.grand_total), 0) AS total_sales,
        COALESCE(SUM(s.paid_amount), 0) AS total_paid
       FROM sales s WHERE ${scope}`,
      scopeParams
    );
    const [methodRows] = await pool.query(
      `SELECT p.paying_method, COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS count
       FROM erp_payments p
       JOIN sales s ON s.id = p.payable_id
       WHERE p.payable_type = 'sale' AND ${scope}
       GROUP BY p.paying_method
       ORDER BY total DESC`,
      scopeParams
    );

    const by_method = methodRows.map((r) => ({
      paying_method: r.paying_method || 'cash',
      total: num(r.total),
      count: num(r.count),
    }));
    const cashTotal = by_method
      .filter((m) => m.paying_method === 'cash')
      .reduce((sum, m) => sum + m.total, 0);

    res.json({
      data: {
        register: {
          ...register,
          cash_in_hand: num(register.cash_in_hand),
        },
        sales_count: num(totalsRows[0]?.sales_count),
        total_sales: num(totalsRows[0]?.total_sales),
        total_paid: num(totalsRows[0]?.total_paid),
        by_method,
        expected_cash: num(register.cash_in_hand) + cashTotal,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recent-sales', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = 's.is_pos = 1';
    if (req.query.warehouse_id) {
      where += ' AND s.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    const limit = Math.min(50, Math.max(1, Math.trunc(num(req.query.limit, 10)) || 10));
    params.push(limit);
    const [rows] = await getPool().query(
      `SELECT s.id, s.reference, s.sale_date, s.grand_total, s.paid_amount, s.payment_status,
        c.name AS customer_name,
        (SELECT COUNT(*) FROM product_sales ps WHERE ps.sale_id = s.id) AS items_count
       FROM sales s
       LEFT JOIN erp_customers c ON c.id = s.customer_id
       WHERE ${where}
       ORDER BY s.sale_date DESC, s.reference DESC
       LIMIT ?`,
      params
    );
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        sale_date: r.sale_date,
        customer_name: r.customer_name || null,
        grand_total: num(r.grand_total),
        paid_amount: num(r.paid_amount),
        payment_status: r.payment_status,
        items_count: num(r.items_count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PAID_BY_METHODS = {
  1: 'cash',
  3: 'je',
  6: 'deposit',
  8: 'momo_orange',
  9: 'pay_later',
  10: 'credit',
  11: 'group_credit',
};

/** POS sale shortcut — same as sales create with is_pos=true */
router.post('/sale', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!body.warehouse_id) return res.status(400).json({ error: 'warehouse_id required' });
    if (!items.length) return res.status(400).json({ error: 'items required' });
    for (const item of items) {
      const stock = await getStock(item.product_id, body.warehouse_id);
      if (stock < num(item.qty)) {
        return res.status(400).json({ error: `Insufficient stock for product ${item.product_id}` });
      }
    }

    // A cashier-typed reference wins over the generated one, as long as it is free.
    const wanted = String(body.reference || '').trim();
    if (wanted) {
      const [dup] = await pool.query(`SELECT id FROM sales WHERE reference = ? LIMIT 1`, [wanted]);
      if (dup.length) return res.status(400).json({ error: `Reference "${wanted}" is already used` });
    }

    await conn.beginTransaction();
    const id = randomUUID();
    const reference = wanted || (await nextErpReference('posr-', 'sales'));
    let subtotal = 0;
    for (const item of items) {
      subtotal += num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
    }
    const grand = subtotal - num(body.discount) + num(body.shipping) + num(body.tax);
    const paid = num(body.paid_amount, grand);
    const payment_status = paid <= 0 ? 'pending' : paid >= grand ? 'paid' : 'partial';
    const sale_date = mysqlDateTime(body.sale_date);
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
      const qty = num(item.qty);
      const price = num(item.net_unit_price);
      const line = qty * price - num(item.discount) + num(item.tax);
      await conn.query(
        `INSERT INTO product_sales (id, sale_id, product_id, qty, net_unit_price, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, qty, price, num(item.discount), num(item.tax), line]
      );
      await adjustStock(conn, { productId: item.product_id, warehouseId: body.warehouse_id, delta: -qty });
    }
    const payingMethod = body.paying_method
      || PAID_BY_METHODS[Number(body.paid_by_id)]
      || 'cash';
    if (paid > 0 || ['pay_later', 'credit', 'group_credit'].includes(payingMethod)) {
      await conn.query(
        `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, created_by)
         VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
        [
          randomUUID(), await nextErpReference('pay-', 'erp_payments'), id, paid,
          payingMethod,
          body.note || (body.paid_by_id != null ? `paid_by_id=${body.paid_by_id}` : null),
          req.user?.sub || req.user?.id || null,
        ]
      );
    }
    await conn.commit();
    res.status(201).json({
      data: { id, reference, grand_total: grand, payment_status, sale_date, paid_amount: paid },
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

export default router;
