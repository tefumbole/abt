import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock } from '../../services/erp/stock.js';
import { mysqlDateTime, num, requireErpAdmin } from './helpers.js';

const router = Router();

function paymentStatusFor(paid, grand) {
  if (paid <= 0) return 'pending';
  return paid >= grand ? 'paid' : 'partial';
}

function purchaseDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function loadPurchase(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT p.*, w.name AS warehouse_name, s.name AS supplier_name
     FROM purchases p
     LEFT JOIN warehouses w ON w.id = p.warehouse_id
     LEFT JOIN erp_suppliers s ON s.id = p.supplier_id
     WHERE p.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [items] = await pool.query(
    `SELECT pp.*, pr.name AS product_name, pr.code AS product_code
     FROM product_purchases pp
     LEFT JOIN products pr ON pr.id = pp.product_id
     WHERE pp.purchase_id = ?`,
    [id]
  );
  return { ...rows[0], items };
}

async function listPurchasePayments(db, purchaseId) {
  const [rows] = await db.query(
    `SELECT id, reference, amount, paying_method, note, paid_at
     FROM erp_payments
     WHERE payable_type = 'purchase' AND payable_id = ?
     ORDER BY paid_at DESC`,
    [purchaseId]
  );
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    amount: num(r.amount),
    paying_method: r.paying_method || null,
    note: r.note ?? null,
    paid_at: r.paid_at,
  }));
}

/** Recompute paid_amount/payment_status from the payment ledger. */
async function recalcPurchasePayment(db, purchaseId) {
  const [purchaseRows] = await db.query(`SELECT grand_total FROM purchases WHERE id = ?`, [purchaseId]);
  if (!purchaseRows.length) return null;
  const grand = num(purchaseRows[0].grand_total);
  const [payRows] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM erp_payments
     WHERE payable_type = 'purchase' AND payable_id = ?`,
    [purchaseId]
  );
  const paid = num(payRows[0]?.paid);
  const payment_status = paymentStatusFor(paid, grand);
  await db.query(`UPDATE purchases SET paid_amount = ?, payment_status = ? WHERE id = ?`, [
    paid,
    payment_status,
    purchaseId,
  ]);
  return { grand_total: grand, paid_amount: paid, payment_status, due_amount: grand - paid };
}

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    let where = '1=1';

    if (req.query.q) {
      where += ' AND (p.reference LIKE ? OR s.name LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like);
    }
    if (req.query.warehouse_id) {
      where += ' AND p.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.supplier_id) {
      where += ' AND p.supplier_id = ?';
      params.push(req.query.supplier_id);
    }
    if (req.query.purchase_status) {
      where += ' AND p.purchase_status = ?';
      params.push(req.query.purchase_status);
    }
    if (req.query.payment_status) {
      where += ' AND p.payment_status = ?';
      params.push(req.query.payment_status);
    }
    if (req.query.from) {
      where += ' AND p.purchase_date >= ?';
      params.push(String(req.query.from).slice(0, 10));
    }
    if (req.query.to) {
      where += ' AND p.purchase_date <= ?';
      params.push(String(req.query.to).slice(0, 10));
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
    res.json({
      data: rows.map((r) => ({
        ...r,
        grand_total: num(r.grand_total),
        paid_amount: num(r.paid_amount),
        due_amount: num(r.grand_total) - num(r.paid_amount),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/payments', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT id FROM purchases WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: await listPurchasePayments(pool, req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/payments', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const amount = num(b.amount);
    const [ex] = await pool.query(`SELECT id FROM purchases WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });

    const id = randomUUID();
    const reference = await nextErpReference('pay-', 'erp_payments');
    const paying_method = b.paying_method || 'cash';
    const paid_at = mysqlDateTime(b.paid_at);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, paid_at, created_by)
       VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, ?)`,
      [id, reference, req.params.id, amount, paying_method, b.note || null, paid_at, req.user?.sub || req.user?.id || null]
    );
    const totals = await recalcPurchasePayment(conn, req.params.id);
    await conn.commit();

    res.status(201).json({
      data: { id, reference, amount, paying_method, paid_at },
      purchase: {
        paid_amount: num(totals?.paid_amount),
        payment_status: totals?.payment_status || 'pending',
        due_amount: num(totals?.due_amount),
      },
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id/payments/:paymentId', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [ex] = await pool.query(
      `SELECT id FROM erp_payments WHERE id = ? AND payable_type = 'purchase' AND payable_id = ?`,
      [req.params.paymentId, req.params.id]
    );
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await conn.beginTransaction();
    await conn.query(`DELETE FROM erp_payments WHERE id = ?`, [req.params.paymentId]);
    await recalcPurchasePayment(conn, req.params.id);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const purchase = await loadPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Not found' });
    const payments = await listPurchasePayments(getPool(), req.params.id);
    res.json({
      data: {
        ...purchase,
        grand_total: num(purchase.grand_total),
        paid_amount: num(purchase.paid_amount),
        due_amount: num(purchase.grand_total) - num(purchase.paid_amount),
        items: (purchase.items || []).map((i) => ({
          id: i.id,
          product_id: i.product_id,
          product_name: i.product_name || null,
          product_code: i.product_code || null,
          qty: num(i.qty),
          net_unit_cost: num(i.net_unit_cost),
          discount: num(i.discount),
          tax: num(i.tax),
          subtotal: num(i.subtotal),
        })),
        payments,
      },
    });
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
    const payment_status = paymentStatusFor(paid, grand);
    const purchase_status = b.purchase_status || 'received';
    const purchase_date = purchaseDate(b.purchase_date);

    await conn.query(
      `INSERT INTO purchases (id, reference, warehouse_id, supplier_id, biller_id, purchase_status, payment_status,
        grand_total, paid_amount, note, purchase_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.supplier_id || null, b.biller_id || null,
        purchase_status, payment_status, grand, paid, b.note || null,
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
      if (purchase_status === 'received') {
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

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const purchase = await loadPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Not found' });
    if (!items.length) return res.status(400).json({ error: 'items required' });

    const oldWarehouseId = purchase.warehouse_id;
    const oldReceived = purchase.purchase_status === 'received';
    const warehouseId = b.warehouse_id || oldWarehouseId;
    const purchaseStatus = b.purchase_status || purchase.purchase_status || 'received';

    await conn.beginTransaction();

    if (oldReceived) {
      for (const item of purchase.items) {
        await adjustStock(conn, {
          productId: item.product_id,
          warehouseId: oldWarehouseId,
          delta: -num(item.qty),
        });
      }
    }
    await conn.query(`DELETE FROM product_purchases WHERE purchase_id = ?`, [req.params.id]);

    let grand = 0;
    for (const item of items) {
      const qty = num(item.qty);
      const cost = num(item.net_unit_cost);
      const sub = qty * cost - num(item.discount) + num(item.tax);
      grand += sub;
      await conn.query(
        `INSERT INTO product_purchases (id, purchase_id, product_id, qty, net_unit_cost, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), req.params.id, item.product_id, qty, cost, num(item.discount), num(item.tax), sub]
      );
      if (purchaseStatus === 'received') {
        await adjustStock(conn, {
          productId: item.product_id,
          warehouseId,
          delta: qty,
          cost,
        });
      }
    }

    await conn.query(
      `UPDATE purchases SET warehouse_id = ?, supplier_id = ?, biller_id = ?, purchase_status = ?,
        purchase_date = ?, grand_total = ?, note = ?
       WHERE id = ?`,
      [
        warehouseId,
        b.supplier_id !== undefined ? b.supplier_id || null : purchase.supplier_id,
        b.biller_id !== undefined ? b.biller_id || null : purchase.biller_id,
        purchaseStatus,
        b.purchase_date ? purchaseDate(b.purchase_date) : purchase.purchase_date,
        grand,
        b.note !== undefined ? b.note || null : purchase.note,
        req.params.id,
      ]
    );

    const totals = await recalcPurchasePayment(conn, req.params.id);
    await conn.commit();
    res.json({
      data: {
        id: req.params.id,
        reference: purchase.reference,
        grand_total: grand,
        payment_status: totals?.payment_status || 'pending',
      },
    });
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
    const purchase = await loadPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Not found' });
    await conn.beginTransaction();
    if (purchase.purchase_status === 'received') {
      for (const item of purchase.items) {
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
