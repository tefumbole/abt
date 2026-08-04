import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock, getStock } from '../../services/erp/stock.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

async function loadSale(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT s.*, w.name AS warehouse_name, c.name AS customer_name
     FROM sales s
     LEFT JOIN warehouses w ON w.id = s.warehouse_id
     LEFT JOIN erp_customers c ON c.id = s.customer_id
     WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [items] = await pool.query(
    `SELECT ps.*, p.name AS product_name FROM product_sales ps
     LEFT JOIN products p ON p.id = ps.product_id WHERE ps.sale_id = ?`,
    [id]
  );
  return { ...rows[0], items };
}

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.warehouse_id) {
      where += ' AND s.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.is_pos != null) {
      where += ' AND s.is_pos = ?';
      params.push(bool(req.query.is_pos, false) ? 1 : 0);
    }
    const [rows] = await getPool().query(
      `SELECT s.*, w.name AS warehouse_name, c.name AS customer_name
       FROM sales s
       LEFT JOIN warehouses w ON w.id = s.warehouse_id
       LEFT JOIN erp_customers c ON c.id = s.customer_id
       WHERE ${where}
       ORDER BY s.sale_date DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const sale = await loadSale(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Not found' });
    res.json({ data: sale });
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

    for (const item of items) {
      const stock = await getStock(item.product_id, b.warehouse_id);
      if (stock < num(item.qty)) {
        return res.status(400).json({ error: `Insufficient stock for product ${item.product_id}` });
      }
    }

    await conn.beginTransaction();
    const id = randomUUID();
    const isPos = bool(b.is_pos, false);
    const reference = await nextErpReference(isPos ? 'posr-' : 'sr-', 'sales');
    let subtotal = 0;
    for (const item of items) {
      const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
      subtotal += line;
    }
    const grand = subtotal - num(b.discount) + num(b.shipping) + num(b.tax);
    const paid = num(b.paid_amount);
    const payment_status = paid <= 0 ? 'pending' : paid >= grand ? 'paid' : 'partial';
    const sale_date = b.sale_date || new Date().toISOString().slice(0, 19).replace('T', ' ');

    await conn.query(
      `INSERT INTO sales (id, reference, warehouse_id, customer_id, biller_id, sale_status, payment_status,
        grand_total, paid_amount, discount, shipping, tax, note, is_pos, sale_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null,
        b.sale_status || 'completed', payment_status, grand, paid, num(b.discount), num(b.shipping),
        num(b.tax), b.note || null, isPos ? 1 : 0, sale_date, req.user?.sub || req.user?.id || null,
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
      if ((b.sale_status || 'completed') === 'completed') {
        await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: -qty });
      }
    }

    if (paid > 0) {
      await conn.query(
        `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, created_by)
         VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
        [
          randomUUID(), await nextErpReference('pay-', 'erp_payments'), id, paid,
          b.paying_method || 'cash', b.note || null, req.user?.sub || req.user?.id || null,
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
    const sale = await loadSale(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Not found' });
    await conn.beginTransaction();
    if (sale.sale_status === 'completed') {
      for (const item of sale.items) {
        await adjustStock(conn, {
          productId: item.product_id,
          warehouseId: sale.warehouse_id,
          delta: num(item.qty),
        });
      }
    }
    await conn.query(`DELETE FROM product_sales WHERE sale_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM erp_payments WHERE payable_type = 'sale' AND payable_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM sales WHERE id = ?`, [req.params.id]);
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
