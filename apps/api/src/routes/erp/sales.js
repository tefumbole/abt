import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock, getStock } from '../../services/erp/stock.js';
import { bool, mysqlDateTime, num, requireErpAdmin } from './helpers.js';

const router = Router();

const SALE_SORT_COLUMNS = {
  sale_date: 's.sale_date',
  reference: 's.reference',
  grand_total: 's.grand_total',
  customer_name: 'c.name',
};

function paymentStatusFor(paid, grand) {
  if (paid <= 0) return 'pending';
  return paid >= grand ? 'paid' : 'partial';
}

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

async function listSalePayments(db, saleId) {
  const [rows] = await db.query(
    `SELECT id, reference, amount, paying_method, note, paid_at
     FROM erp_payments
     WHERE payable_type = 'sale' AND payable_id = ?
     ORDER BY paid_at DESC`,
    [saleId]
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
async function recalcSalePayment(db, saleId) {
  const [saleRows] = await db.query(`SELECT grand_total FROM sales WHERE id = ?`, [saleId]);
  if (!saleRows.length) return null;
  const grand = num(saleRows[0].grand_total);
  const [payRows] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid FROM erp_payments
     WHERE payable_type = 'sale' AND payable_id = ?`,
    [saleId]
  );
  const paid = num(payRows[0]?.paid);
  const payment_status = paymentStatusFor(paid, grand);
  await db.query(`UPDATE sales SET paid_amount = ?, payment_status = ? WHERE id = ?`, [
    paid,
    payment_status,
    saleId,
  ]);
  return { grand_total: grand, paid_amount: paid, payment_status, due_amount: grand - paid };
}

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    let where = '1=1';

    if (req.query.q) {
      where += ' AND (s.reference LIKE ? OR c.name LIKE ? OR b.name LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    if (req.query.warehouse_id) {
      where += ' AND s.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.customer_id) {
      where += ' AND s.customer_id = ?';
      params.push(req.query.customer_id);
    }
    if (req.query.biller_id) {
      where += ' AND s.biller_id = ?';
      params.push(req.query.biller_id);
    }
    if (req.query.sale_status) {
      where += ' AND s.sale_status = ?';
      params.push(req.query.sale_status);
    }
    if (req.query.payment_status) {
      where += ' AND s.payment_status = ?';
      params.push(req.query.payment_status);
    }
    if (req.query.from) {
      where += ' AND s.sale_date >= ?';
      params.push(`${String(req.query.from).slice(0, 10)} 00:00:00`);
    }
    if (req.query.to) {
      where += ' AND s.sale_date <= ?';
      params.push(`${String(req.query.to).slice(0, 10)} 23:59:59`);
    }
    if (req.query.is_pos !== undefined && req.query.is_pos !== '') {
      where += ' AND s.is_pos = ?';
      params.push(bool(req.query.is_pos, false) ? 1 : 0);
    }

    const joins = `FROM sales s
       LEFT JOIN warehouses w ON w.id = s.warehouse_id
       LEFT JOIN erp_customers c ON c.id = s.customer_id
       LEFT JOIN erp_billers b ON b.id = s.biller_id`;

    const [aggRows] = await pool.query(
      `SELECT COUNT(*) AS total,
        COALESCE(SUM(s.grand_total), 0) AS grand_total,
        COALESCE(SUM(s.paid_amount), 0) AS paid,
        COALESCE(SUM(s.grand_total - s.paid_amount), 0) AS due,
        COALESCE(SUM(s.sale_status = 'completed'), 0) AS completed_count,
        COALESCE(SUM(s.sale_status = 'pending'), 0) AS pending_count,
        COALESCE(SUM(s.sale_status = 'draft'), 0) AS draft_count,
        COALESCE(SUM(s.payment_status = 'paid'), 0) AS paid_count,
        COALESCE(SUM(s.payment_status = 'partial'), 0) AS partial_count,
        COALESCE(SUM(s.payment_status IN ('pending', 'due')), 0) AS due_count
       ${joins}
       WHERE ${where}`,
      params
    );
    const agg = aggRows[0] || {};
    const total = num(agg.total);

    const sortBy = SALE_SORT_COLUMNS[String(req.query.sort_by || '')] || SALE_SORT_COLUMNS.sale_date;
    const sortDir = String(req.query.sort_dir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const all = String(req.query.per_page || '').toLowerCase() === 'all';
    const page = Math.max(1, Math.trunc(num(req.query.page, 1)) || 1);
    const perPage = all ? total : Math.max(1, Math.trunc(num(req.query.per_page, 10)) || 10);
    const offset = all ? 0 : (page - 1) * perPage;

    const listParams = [...params];
    let limitSql = '';
    if (!all) {
      limitSql = ' LIMIT ? OFFSET ?';
      listParams.push(perPage, offset);
    }

    const [rows] = await pool.query(
      `SELECT s.*, w.name AS warehouse_name, c.name AS customer_name, b.name AS biller_name,
        (SELECT COUNT(*) FROM product_sales ps WHERE ps.sale_id = s.id) AS items_count
       ${joins}
       WHERE ${where}
       ORDER BY ${sortBy} ${sortDir}, s.reference DESC${limitSql}`,
      listParams
    );

    res.json({
      data: rows.map((r) => ({
        ...r,
        grand_total: num(r.grand_total),
        paid_amount: num(r.paid_amount),
        due_amount: num(r.grand_total) - num(r.paid_amount),
        discount: num(r.discount),
        tax: num(r.tax),
        shipping: num(r.shipping),
        is_pos: Boolean(r.is_pos),
        items_count: num(r.items_count),
        note: r.note ?? null,
      })),
      total,
      page: all ? 1 : page,
      per_page: all ? total : perPage,
      totals: {
        grand_total: num(agg.grand_total),
        paid: num(agg.paid),
        due: num(agg.due),
      },
      counts: {
        all: total,
        completed: num(agg.completed_count),
        pending: num(agg.pending_count),
        draft: num(agg.draft_count),
        paid: num(agg.paid_count),
        partial: num(agg.partial_count),
        due: num(agg.due_count),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT s.*, w.name AS warehouse_name,
        c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
        c.address AS customer_address, c.company_name AS customer_company,
        b.name AS biller_name
       FROM sales s
       LEFT JOIN warehouses w ON w.id = s.warehouse_id
       LEFT JOIN erp_customers c ON c.id = s.customer_id
       LEFT JOIN erp_billers b ON b.id = s.biller_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const sale = rows[0];
    const [items] = await pool.query(
      `SELECT ps.*, p.name AS product_name, p.code AS product_code
       FROM product_sales ps
       LEFT JOIN products p ON p.id = ps.product_id
       WHERE ps.sale_id = ?`,
      [req.params.id]
    );
    const payments = await listSalePayments(pool, req.params.id);
    res.json({
      data: {
        ...sale,
        grand_total: num(sale.grand_total),
        paid_amount: num(sale.paid_amount),
        due_amount: num(sale.grand_total) - num(sale.paid_amount),
        discount: num(sale.discount),
        tax: num(sale.tax),
        shipping: num(sale.shipping),
        is_pos: Boolean(sale.is_pos),
        items: items.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          product_name: i.product_name || null,
          product_code: i.product_code || null,
          qty: num(i.qty),
          net_unit_price: num(i.net_unit_price),
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
    const payment_status = paymentStatusFor(paid, grand);
    const sale_date = mysqlDateTime(b.sale_date);

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

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const sale = await loadSale(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Not found' });
    if (!items.length) return res.status(400).json({ error: 'items required' });

    const oldWarehouseId = sale.warehouse_id;
    const oldCompleted = sale.sale_status === 'completed';
    const warehouseId = b.warehouse_id || oldWarehouseId;
    const saleStatus = b.sale_status || sale.sale_status || 'completed';

    if (saleStatus === 'completed') {
      // Stock released by the old (completed) lines is available again on the same warehouse.
      const restored = new Map();
      if (oldCompleted && oldWarehouseId === warehouseId) {
        for (const item of sale.items) {
          restored.set(item.product_id, (restored.get(item.product_id) || 0) + num(item.qty));
        }
      }
      const required = new Map();
      for (const item of items) {
        required.set(item.product_id, (required.get(item.product_id) || 0) + num(item.qty));
      }
      for (const [productId, qty] of required) {
        const available = (await getStock(productId, warehouseId)) + (restored.get(productId) || 0);
        if (available < qty) {
          return res.status(400).json({
            error: `Insufficient stock for product ${productId} (available ${available}, required ${qty})`,
          });
        }
      }
    }

    await conn.beginTransaction();

    if (oldCompleted) {
      for (const item of sale.items) {
        await adjustStock(conn, {
          productId: item.product_id,
          warehouseId: oldWarehouseId,
          delta: num(item.qty),
        });
      }
    }
    await conn.query(`DELETE FROM product_sales WHERE sale_id = ?`, [req.params.id]);

    let subtotal = 0;
    for (const item of items) {
      const qty = num(item.qty);
      const price = num(item.net_unit_price);
      const line = qty * price - num(item.discount) + num(item.tax);
      subtotal += line;
      await conn.query(
        `INSERT INTO product_sales (id, sale_id, product_id, qty, net_unit_price, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), req.params.id, item.product_id, qty, price, num(item.discount), num(item.tax), line]
      );
      if (saleStatus === 'completed') {
        await adjustStock(conn, { productId: item.product_id, warehouseId, delta: -qty });
      }
    }

    const discount = b.discount !== undefined ? num(b.discount) : num(sale.discount);
    const shipping = b.shipping !== undefined ? num(b.shipping) : num(sale.shipping);
    const tax = b.tax !== undefined ? num(b.tax) : num(sale.tax);
    const grand = subtotal - discount + shipping + tax;

    await conn.query(
      `UPDATE sales SET warehouse_id = ?, customer_id = ?, biller_id = ?, sale_status = ?, sale_date = ?,
        grand_total = ?, discount = ?, shipping = ?, tax = ?, note = ?
       WHERE id = ?`,
      [
        warehouseId,
        b.customer_id !== undefined ? b.customer_id || null : sale.customer_id,
        b.biller_id !== undefined ? b.biller_id || null : sale.biller_id,
        saleStatus,
        b.sale_date ? mysqlDateTime(b.sale_date) : sale.sale_date,
        grand,
        discount,
        shipping,
        tax,
        b.note !== undefined ? b.note || null : sale.note,
        req.params.id,
      ]
    );

    const totals = await recalcSalePayment(conn, req.params.id);
    await conn.commit();
    res.json({
      data: {
        id: req.params.id,
        reference: sale.reference,
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

router.get('/:id/payments', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT id FROM sales WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: await listSalePayments(pool, req.params.id) });
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
    const [ex] = await pool.query(`SELECT id FROM sales WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });

    const id = randomUUID();
    const reference = await nextErpReference('pay-', 'erp_payments');
    const paying_method = b.paying_method || 'cash';
    const paid_at = mysqlDateTime(b.paid_at);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, paid_at, created_by)
       VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?)`,
      [id, reference, req.params.id, amount, paying_method, b.note || null, paid_at, req.user?.sub || req.user?.id || null]
    );
    const totals = await recalcSalePayment(conn, req.params.id);
    await conn.commit();

    res.status(201).json({
      data: { id, reference, amount, paying_method, paid_at },
      sale: {
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
      `SELECT id FROM erp_payments WHERE id = ? AND payable_type = 'sale' AND payable_id = ?`,
      [req.params.paymentId, req.params.id]
    );
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await conn.beginTransaction();
    await conn.query(`DELETE FROM erp_payments WHERE id = ?`, [req.params.paymentId]);
    await recalcSalePayment(conn, req.params.id);
    await conn.commit();
    res.json({ ok: true });
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
