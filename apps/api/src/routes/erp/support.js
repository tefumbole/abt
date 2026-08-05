import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { computeBalanceSheet, computeProfitLoss } from '../../services/erp/accountingReports.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock, getNonStockProductIds, getStock } from '../../services/erp/stock.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

async function applyTransferStock(conn, { fromWarehouseId, toWarehouseId, items, nonStockIds }) {
  for (const item of items) {
    if (nonStockIds.has(item.product_id)) continue;
    const qty = num(item.qty);
    if (qty <= 0) continue;
    await adjustStock(conn, { productId: item.product_id, warehouseId: fromWarehouseId, delta: -qty });
    await adjustStock(conn, { productId: item.product_id, warehouseId: toWarehouseId, delta: qty });
  }
}

async function reverseTransferStock(conn, { fromWarehouseId, toWarehouseId, items, nonStockIds }) {
  for (const item of items) {
    if (nonStockIds.has(item.product_id)) continue;
    const qty = num(item.qty);
    if (qty <= 0) continue;
    // Undo completed move: add back to from, remove from to
    await adjustStock(conn, { productId: item.product_id, warehouseId: fromWarehouseId, delta: qty });
    await adjustStock(conn, { productId: item.product_id, warehouseId: toWarehouseId, delta: -qty });
  }
}

async function assertTransferStock(pool, fromWarehouseId, items) {
  const nonStockIds = await getNonStockProductIds(pool, items.map((i) => i.product_id));
  for (const item of items) {
    if (!item.product_id) return { error: 'product_id required on each item', nonStockIds };
    const qty = num(item.qty);
    if (qty <= 0) return { error: 'qty must be positive', nonStockIds };
    if (nonStockIds.has(item.product_id)) continue;
    const stock = await getStock(item.product_id, fromWarehouseId);
    if (stock < qty) {
      return { error: `Insufficient stock for product ${item.product_id} (have ${stock}, need ${qty})`, nonStockIds };
    }
  }
  return { nonStockIds };
}

// --- Transfers ---
router.get('/transfers', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT t.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name,
        (SELECT COUNT(*) FROM product_transfers pt WHERE pt.transfer_id = t.id) AS items_count
       FROM stock_transfers t
       LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
       LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
       ORDER BY t.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transfers/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT t.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
       FROM stock_transfers t
       LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
       LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await pool.query(
      `SELECT pt.*, p.name AS product_name
       FROM product_transfers pt
       LEFT JOIN products p ON p.id = pt.product_id
       WHERE pt.transfer_id = ?`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transfers', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const {
      from_warehouse_id,
      to_warehouse_id,
      note = null,
      items = [],
      status: rawStatus,
    } = req.body || {};
    const status = rawStatus === 'pending' ? 'pending' : 'completed';
    if (!from_warehouse_id || !to_warehouse_id) return res.status(400).json({ error: 'warehouses required' });
    if (from_warehouse_id === to_warehouse_id) return res.status(400).json({ error: 'warehouses must differ' });
    const lineItems = Array.isArray(items) ? items : [];
    if (!lineItems.length) return res.status(400).json({ error: 'items required' });

    let nonStockIds = new Set();
    if (status === 'completed') {
      const check = await assertTransferStock(pool, from_warehouse_id, lineItems);
      if (check.error) return res.status(400).json({ error: check.error });
      nonStockIds = check.nonStockIds;
    } else {
      nonStockIds = await getNonStockProductIds(pool, lineItems.map((i) => i.product_id));
      for (const item of lineItems) {
        if (!item.product_id) return res.status(400).json({ error: 'product_id required on each item' });
        if (num(item.qty) <= 0) return res.status(400).json({ error: 'qty must be positive' });
      }
    }

    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('tr-', 'stock_transfers');
    await conn.query(
      `INSERT INTO stock_transfers (id, reference, from_warehouse_id, to_warehouse_id, status, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, from_warehouse_id, to_warehouse_id, status, note, req.user?.sub || req.user?.id || null]
    );
    for (const item of lineItems) {
      await conn.query(
        `INSERT INTO product_transfers (id, transfer_id, product_id, qty) VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty)]
      );
    }
    if (status === 'completed') {
      await applyTransferStock(conn, {
        fromWarehouseId: from_warehouse_id,
        toWarehouseId: to_warehouse_id,
        items: lineItems,
        nonStockIds,
      });
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference, status } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/** Complete a pending transfer (applies stock only on pending→completed). */
router.put('/transfers/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const nextStatus = req.body?.status;
    if (nextStatus !== 'completed') {
      return res.status(400).json({ error: 'Only status completed is supported' });
    }
    const [rows] = await conn.query(`SELECT * FROM stock_transfers WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const transfer = rows[0];
    if (transfer.status === 'completed') {
      return res.json({ data: { id: transfer.id, reference: transfer.reference, status: 'completed' } });
    }
    if (transfer.status !== 'pending') {
      return res.status(400).json({ error: `Cannot complete transfer with status ${transfer.status}` });
    }
    const [items] = await conn.query(`SELECT * FROM product_transfers WHERE transfer_id = ?`, [req.params.id]);
    if (!items.length) return res.status(400).json({ error: 'Transfer has no items' });

    const check = await assertTransferStock(pool, transfer.from_warehouse_id, items);
    if (check.error) return res.status(400).json({ error: check.error });

    await conn.beginTransaction();
    await applyTransferStock(conn, {
      fromWarehouseId: transfer.from_warehouse_id,
      toWarehouseId: transfer.to_warehouse_id,
      items,
      nonStockIds: check.nonStockIds,
    });
    await conn.query(`UPDATE stock_transfers SET status = 'completed' WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ data: { id: transfer.id, reference: transfer.reference, status: 'completed' } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/transfers/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM stock_transfers WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const transfer = rows[0];
    const [items] = await conn.query(`SELECT * FROM product_transfers WHERE transfer_id = ?`, [req.params.id]);
    const nonStockIds = await getNonStockProductIds(pool, items.map((i) => i.product_id));

    await conn.beginTransaction();
    if (transfer.status === 'completed') {
      await reverseTransferStock(conn, {
        fromWarehouseId: transfer.from_warehouse_id,
        toWarehouseId: transfer.to_warehouse_id,
        items,
        nonStockIds,
      });
    }
    await conn.query(`DELETE FROM product_transfers WHERE transfer_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM stock_transfers WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// --- Sale returns ---
router.get('/sale-returns', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT r.*, w.name AS warehouse_name, c.name AS customer_name,
        (SELECT COUNT(*) FROM sale_return_items sri WHERE sri.return_id = r.id) AS items_count
       FROM sale_returns r
       LEFT JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN erp_customers c ON c.id = r.customer_id
       ORDER BY r.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sale-returns/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT r.*, w.name AS warehouse_name, c.name AS customer_name
       FROM sale_returns r
       LEFT JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN erp_customers c ON c.id = r.customer_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await pool.query(
      `SELECT sri.*, p.name AS product_name
       FROM sale_return_items sri
       LEFT JOIN products p ON p.id = sri.product_id
       WHERE sri.return_id = ?`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sale-returns', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id || !items.length) return res.status(400).json({ error: 'warehouse_id and items required' });
    for (const item of items) {
      if (!item.product_id) return res.status(400).json({ error: 'product_id required on each item' });
      if (num(item.qty) <= 0) return res.status(400).json({ error: 'qty must be positive' });
    }

    const nonStockIds = await getNonStockProductIds(pool, items.map((i) => i.product_id));
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('srr-', 'sale_returns');
    let grand = 0;
    for (const item of items) grand += num(item.qty) * num(item.net_unit_price);
    await conn.query(
      `INSERT INTO sale_returns (id, reference, sale_id, warehouse_id, customer_id, grand_total, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.sale_id || null, b.warehouse_id, b.customer_id || null, grand,
        b.note || null, req.user?.sub || req.user?.id || null,
      ]
    );
    for (const item of items) {
      const qty = num(item.qty);
      const price = num(item.net_unit_price);
      const sub = qty * price;
      await conn.query(
        `INSERT INTO sale_return_items (id, return_id, product_id, qty, net_unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, qty, price, sub]
      );
      if (!nonStockIds.has(item.product_id)) {
        await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: qty });
      }
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference, grand_total: grand } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/sale-returns/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM sale_returns WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ret = rows[0];
    const [items] = await conn.query(`SELECT * FROM sale_return_items WHERE return_id = ?`, [req.params.id]);
    const nonStockIds = await getNonStockProductIds(pool, items.map((i) => i.product_id));

    await conn.beginTransaction();
    for (const item of items) {
      if (nonStockIds.has(item.product_id)) continue;
      // Reverse restore: remove qty that was returned into stock
      await adjustStock(conn, {
        productId: item.product_id,
        warehouseId: ret.warehouse_id,
        delta: -num(item.qty),
      });
    }
    await conn.query(`DELETE FROM sale_return_items WHERE return_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM sale_returns WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// --- Purchase returns ---
router.get('/purchase-returns', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT r.*, w.name AS warehouse_name, s.name AS supplier_name,
        (SELECT COUNT(*) FROM purchase_return_items pri WHERE pri.return_id = r.id) AS items_count
       FROM purchase_returns r
       LEFT JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN erp_suppliers s ON s.id = r.supplier_id
       ORDER BY r.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/purchase-returns/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT r.*, w.name AS warehouse_name, s.name AS supplier_name
       FROM purchase_returns r
       LEFT JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN erp_suppliers s ON s.id = r.supplier_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await pool.query(
      `SELECT pri.*, p.name AS product_name
       FROM purchase_return_items pri
       LEFT JOIN products p ON p.id = pri.product_id
       WHERE pri.return_id = ?`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchase-returns', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id || !items.length) return res.status(400).json({ error: 'warehouse_id and items required' });
    for (const item of items) {
      if (!item.product_id) return res.status(400).json({ error: 'product_id required on each item' });
      if (num(item.qty) <= 0) return res.status(400).json({ error: 'qty must be positive' });
    }

    const nonStockIds = await getNonStockProductIds(pool, items.map((i) => i.product_id));
    for (const item of items) {
      if (nonStockIds.has(item.product_id)) continue;
      const stock = await getStock(item.product_id, b.warehouse_id);
      if (stock < num(item.qty)) {
        return res.status(400).json({
          error: `Insufficient stock for product ${item.product_id} (have ${stock}, need ${num(item.qty)})`,
        });
      }
    }

    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('prr-', 'purchase_returns');
    let grand = 0;
    for (const item of items) grand += num(item.qty) * num(item.net_unit_cost);
    await conn.query(
      `INSERT INTO purchase_returns (id, reference, purchase_id, warehouse_id, supplier_id, grand_total, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.purchase_id || null, b.warehouse_id, b.supplier_id || null, grand,
        b.note || null, req.user?.sub || req.user?.id || null,
      ]
    );
    for (const item of items) {
      const qty = num(item.qty);
      const cost = num(item.net_unit_cost);
      const sub = qty * cost;
      await conn.query(
        `INSERT INTO purchase_return_items (id, return_id, product_id, qty, net_unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, qty, cost, sub]
      );
      if (!nonStockIds.has(item.product_id)) {
        await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: -qty });
      }
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference, grand_total: grand } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/purchase-returns/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(`SELECT * FROM purchase_returns WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ret = rows[0];
    const [items] = await conn.query(`SELECT * FROM purchase_return_items WHERE return_id = ?`, [req.params.id]);
    const nonStockIds = await getNonStockProductIds(pool, items.map((i) => i.product_id));

    await conn.beginTransaction();
    for (const item of items) {
      if (nonStockIds.has(item.product_id)) continue;
      // Reverse deduction: put qty back into warehouse
      await adjustStock(conn, {
        productId: item.product_id,
        warehouseId: ret.warehouse_id,
        delta: num(item.qty),
      });
    }
    await conn.query(`DELETE FROM purchase_return_items WHERE return_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM purchase_returns WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// --- Expenses ---
router.get('/expense-categories', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM expense_categories ORDER BY name`);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/expense-categories', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    if (!req.body?.name?.trim()) return res.status(400).json({ error: 'Name required' });
    const id = randomUUID();
    await getPool().query(`INSERT INTO expense_categories (id, name, is_active) VALUES (?, ?, 1)`, [id, req.body.name.trim()]);
    const [rows] = await getPool().query(`SELECT * FROM expense_categories WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/expenses', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.warehouse_id) {
      where += ' AND e.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.from) {
      where += ' AND e.expense_date >= ?';
      params.push(req.query.from);
    }
    if (req.query.to) {
      where += ' AND e.expense_date <= ?';
      params.push(req.query.to);
    }
    if (req.query.account_id) {
      where += ' AND e.account_id = ?';
      params.push(req.query.account_id);
    }
    const [rows] = await getPool().query(
      `SELECT e.*, c.name AS category_name, w.name AS warehouse_name, a.name AS account_name
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       LEFT JOIN warehouses w ON w.id = e.warehouse_id
       LEFT JOIN erp_accounts a ON a.id = e.account_id
       WHERE ${where}
       ORDER BY e.expense_date DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/expenses', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.amount) return res.status(400).json({ error: 'amount required' });
    if (!b.account_id) return res.status(400).json({ error: 'account_id required' });
    const id = randomUUID();
    const reference = await nextErpReference('ex-', 'expenses');
    await getPool().query(
      `INSERT INTO expenses (id, reference, warehouse_id, category_id, account_id, amount, note, expense_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id || null, b.category_id || null, b.account_id,
        num(b.amount), b.note || null, b.expense_date || new Date().toISOString().slice(0, 10),
        req.user?.sub || req.user?.id || null,
      ]
    );
    await getPool().query(`UPDATE erp_accounts SET balance = balance - ? WHERE id = ?`, [num(b.amount), b.account_id]);
    res.status(201).json({ data: { id, reference } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/expenses/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Expense not found' });
    }
    const prev = existing[0];
    const amount = b.amount != null ? num(b.amount) : num(prev.amount);
    const accountId = b.account_id !== undefined ? (b.account_id || null) : prev.account_id;
    if (!accountId) {
      await conn.rollback();
      return res.status(400).json({ error: 'account_id required' });
    }
    if (prev.account_id) {
      await conn.query(`UPDATE erp_accounts SET balance = balance + ? WHERE id = ?`, [num(prev.amount), prev.account_id]);
    }
    await conn.query(
      `UPDATE expenses SET warehouse_id = ?, category_id = ?, account_id = ?, amount = ?, note = ?, expense_date = ?
       WHERE id = ?`,
      [
        b.warehouse_id !== undefined ? (b.warehouse_id || null) : prev.warehouse_id,
        b.category_id !== undefined ? (b.category_id || null) : prev.category_id,
        accountId,
        amount,
        b.note !== undefined ? (b.note || null) : prev.note,
        b.expense_date || prev.expense_date,
        req.params.id,
      ]
    );
    await conn.query(`UPDATE erp_accounts SET balance = balance - ? WHERE id = ?`, [amount, accountId]);
    await conn.commit();
    const [rows] = await pool.query(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/expenses/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Expense not found' });
    }
    const prev = existing[0];
    if (prev.account_id) {
      await conn.query(`UPDATE erp_accounts SET balance = balance + ? WHERE id = ?`, [num(prev.amount), prev.account_id]);
    }
    await conn.query(`DELETE FROM expenses WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ data: { id: req.params.id, deleted: true } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// --- Payments ledger ---
router.get('/payments', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.payable_type) {
      where += ' AND payable_type = ?';
      params.push(req.query.payable_type);
    }
    if (req.query.awaiting === '1') {
      // awaiting = sales/purchases with unpaid balance
      const [sales] = await getPool().query(
        `SELECT id, reference, 'sale' AS type, grand_total, paid_amount, (grand_total - paid_amount) AS due
         FROM sales WHERE payment_status IN ('pending','partial') ORDER BY sale_date DESC`
      );
      const [purchases] = await getPool().query(
        `SELECT id, reference, 'purchase' AS type, grand_total, paid_amount, (grand_total - paid_amount) AS due
         FROM purchases WHERE payment_status IN ('pending','partial') ORDER BY purchase_date DESC`
      );
      return res.json({ data: { awaiting: [...sales, ...purchases] } });
    }
    const [rows] = await getPool().query(
      `SELECT * FROM erp_payments WHERE ${where} ORDER BY paid_at DESC LIMIT 500`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payments', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { payable_type, payable_id, amount, paying_method = 'cash', note = null } = req.body || {};
    if (!payable_type || !payable_id || !amount) {
      return res.status(400).json({ error: 'payable_type, payable_id, amount required' });
    }
    if (!['sale', 'purchase', 'deposit'].includes(payable_type)) {
      return res.status(400).json({ error: 'Invalid payable_type' });
    }
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('pay-', 'erp_payments');
    await conn.query(
      `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, payable_type, payable_id, num(amount), paying_method, note, req.user?.sub || req.user?.id || null]
    );
    if (payable_type === 'sale') {
      const [rows] = await conn.query(`SELECT grand_total, paid_amount FROM sales WHERE id = ?`, [payable_id]);
      if (rows.length) {
        const paid = num(rows[0].paid_amount) + num(amount);
        const status = paid >= num(rows[0].grand_total) ? 'paid' : paid > 0 ? 'partial' : 'pending';
        await conn.query(`UPDATE sales SET paid_amount = ?, payment_status = ? WHERE id = ?`, [paid, status, payable_id]);
      }
    } else if (payable_type === 'purchase') {
      const [rows] = await conn.query(`SELECT grand_total, paid_amount FROM purchases WHERE id = ?`, [payable_id]);
      if (rows.length) {
        const paid = num(rows[0].paid_amount) + num(amount);
        const status = paid >= num(rows[0].grand_total) ? 'paid' : paid > 0 ? 'partial' : 'pending';
        await conn.query(`UPDATE purchases SET paid_amount = ?, payment_status = ? WHERE id = ?`, [paid, status, payable_id]);
      }
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/payments/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM erp_payments WHERE id = ?`, [req.params.id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Payment not found' });
    }
    const pay = existing[0];
    const amount = num(pay.amount);
    if (pay.payable_type === 'sale') {
      const [rows] = await conn.query(`SELECT grand_total, paid_amount FROM sales WHERE id = ?`, [pay.payable_id]);
      if (rows.length) {
        const paid = Math.max(0, num(rows[0].paid_amount) - amount);
        const status = paid <= 0 ? 'pending' : paid >= num(rows[0].grand_total) ? 'paid' : 'partial';
        await conn.query(`UPDATE sales SET paid_amount = ?, payment_status = ? WHERE id = ?`, [paid, status, pay.payable_id]);
      }
    } else if (pay.payable_type === 'purchase') {
      const [rows] = await conn.query(`SELECT grand_total, paid_amount FROM purchases WHERE id = ?`, [pay.payable_id]);
      if (rows.length) {
        const paid = Math.max(0, num(rows[0].paid_amount) - amount);
        const status = paid <= 0 ? 'pending' : paid >= num(rows[0].grand_total) ? 'paid' : 'partial';
        await conn.query(`UPDATE purchases SET paid_amount = ?, payment_status = ? WHERE id = ?`, [paid, status, pay.payable_id]);
      }
    }
    await conn.query(`DELETE FROM erp_payments WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ data: { id: req.params.id, deleted: true } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// --- Accounting ---
router.get('/accounts', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_accounts ORDER BY name`);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    if (!req.body?.name?.trim()) return res.status(400).json({ error: 'Name required' });
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO erp_accounts (id, name, account_no, balance, is_active) VALUES (?, ?, ?, ?, ?)`,
      [id, req.body.name.trim(), req.body.account_no || null, num(req.body.balance), bool(req.body.is_active, true) ? 1 : 0]
    );
    const [rows] = await getPool().query(`SELECT * FROM erp_accounts WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/accounts/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const [existing] = await getPool().query(`SELECT * FROM erp_accounts WHERE id = ?`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Account not found' });
    const prev = existing[0];
    if (!b.name?.trim() && b.name !== undefined) return res.status(400).json({ error: 'Name required' });
    await getPool().query(
      `UPDATE erp_accounts SET name = ?, account_no = ?, is_active = ? WHERE id = ?`,
      [
        b.name !== undefined ? b.name.trim() : prev.name,
        b.account_no !== undefined ? (b.account_no || null) : prev.account_no,
        b.is_active !== undefined ? (bool(b.is_active, true) ? 1 : 0) : prev.is_active,
        req.params.id,
      ]
    );
    // Opening balance edits: only when explicitly provided (rare admin correction).
    if (b.balance !== undefined && b.balance !== null) {
      await getPool().query(`UPDATE erp_accounts SET balance = ? WHERE id = ?`, [num(b.balance), req.params.id]);
    }
    const [rows] = await getPool().query(`SELECT * FROM erp_accounts WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [existing] = await getPool().query(`SELECT id FROM erp_accounts WHERE id = ?`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Account not found' });
    await getPool().query(`UPDATE erp_accounts SET is_active = 0 WHERE id = ?`, [req.params.id]);
    res.json({ data: { id: req.params.id, deactivated: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/money-transfers', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT mt.*, fa.name AS from_account_name, ta.name AS to_account_name
       FROM money_transfers mt
       LEFT JOIN erp_accounts fa ON fa.id = mt.from_account_id
       LEFT JOIN erp_accounts ta ON ta.id = mt.to_account_id
       ORDER BY mt.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/money-transfers', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { from_account_id, to_account_id, amount, note = null } = req.body || {};
    if (!from_account_id || !to_account_id || !amount) {
      return res.status(400).json({ error: 'from_account_id, to_account_id, amount required' });
    }
    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'accounts must differ' });
    }
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('mt-', 'money_transfers');
    await conn.query(
      `INSERT INTO money_transfers (id, reference, from_account_id, to_account_id, amount, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, from_account_id, to_account_id, num(amount), note, req.user?.sub || req.user?.id || null]
    );
    await conn.query(`UPDATE erp_accounts SET balance = balance - ? WHERE id = ?`, [num(amount), from_account_id]);
    await conn.query(`UPDATE erp_accounts SET balance = balance + ? WHERE id = ?`, [num(amount), to_account_id]);
    await conn.commit();
    res.status(201).json({ data: { id, reference } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/money-transfers/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT * FROM money_transfers WHERE id = ?`, [req.params.id]);
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Money transfer not found' });
    }
    const mt = existing[0];
    const amount = num(mt.amount);
    // Reverse original transfer: credit from, debit to.
    await conn.query(`UPDATE erp_accounts SET balance = balance + ? WHERE id = ?`, [amount, mt.from_account_id]);
    await conn.query(`UPDATE erp_accounts SET balance = balance - ? WHERE id = ?`, [amount, mt.to_account_id]);
    await conn.query(`DELETE FROM money_transfers WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ data: { id: req.params.id, deleted: true } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/profit-loss', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const data = await computeProfitLoss(getPool(), {
      from: req.query.from || null,
      to: req.query.to || null,
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/balance-sheet', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const data = await computeBalanceSheet(getPool());
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
