import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock } from '../../services/erp/stock.js';
import { num, requireErpAdmin } from './helpers.js';

const router = Router();

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    let where = '1=1';
    if (req.query.warehouse_id) {
      where += ' AND p.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.from) {
      where += ' AND p.purchase_date >= ?';
      params.push(req.query.from);
    }
    if (req.query.to) {
      where += ' AND p.purchase_date <= ?';
      params.push(req.query.to);
    }
    const [rows] = await pool.query(
      `SELECT p.*, w.name AS warehouse_name, s.name AS supplier_name
       FROM purchases p
       LEFT JOIN warehouses w ON w.id = p.warehouse_id
       LEFT JOIN erp_suppliers s ON s.id = p.supplier_id
       WHERE ${where}
       ORDER BY p.purchase_date DESC, p.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM purchases WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await pool.query(
      `SELECT pp.*, pr.name AS product_name FROM product_purchases pp
       LEFT JOIN products pr ON pr.id = pp.product_id WHERE pp.purchase_id = ?`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], items } });
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
    const reference = await nextErpReference('pr-', 'purchases');
    let grand = 0;
    for (const item of items) {
      const qty = num(item.qty);
      const cost = num(item.net_unit_cost);
      const sub = qty * cost - num(item.discount) + num(item.tax);
      grand += sub;
    }
    const paid = num(b.paid_amount);
    const payment_status = paid <= 0 ? 'pending' : paid >= grand ? 'paid' : 'partial';
    const purchase_date = b.purchase_date || new Date().toISOString().slice(0, 10);

    await conn.query(
      `INSERT INTO purchases (id, reference, warehouse_id, supplier_id, biller_id, purchase_status, payment_status,
        grand_total, paid_amount, note, purchase_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.supplier_id || null, b.biller_id || null,
        b.purchase_status || 'received', payment_status, grand, paid, b.note || null,
        purchase_date, req.user?.sub || req.user?.id || null,
      ]
    );

    for (const item of items) {
      const qty = num(item.qty);
      const cost = num(item.net_unit_cost);
      const sub = qty * cost - num(item.discount) + num(item.tax);
      await conn.query(
        `INSERT INTO product_purchases (id, purchase_id, product_id, qty, net_unit_cost, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, qty, cost, num(item.discount), num(item.tax), sub]
      );
      if ((b.purchase_status || 'received') === 'received') {
        await adjustStock(conn, {
          productId: item.product_id,
          warehouseId: b.warehouse_id,
          delta: qty,
          cost,
        });
      }
    }

    if (paid > 0) {
      await conn.query(
        `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, created_by)
         VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          await nextErpReference('pay-', 'erp_payments'),
          id,
          paid,
          b.paying_method || 'cash',
          b.note || null,
          req.user?.sub || req.user?.id || null,
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ data: { id, reference, grand_total: grand, payment_status } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM purchases WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const purchase = rows[0];
    const [items] = await conn.query(`SELECT * FROM product_purchases WHERE purchase_id = ?`, [req.params.id]);
    await conn.beginTransaction();
    if (purchase.purchase_status === 'received') {
      for (const item of items) {
        await adjustStock(conn, {
          productId: item.product_id,
          warehouseId: purchase.warehouse_id,
          delta: -num(item.qty),
        });
      }
    }
    await conn.query(`DELETE FROM product_purchases WHERE purchase_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM erp_payments WHERE payable_type = 'purchase' AND payable_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM purchases WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

export default router;
