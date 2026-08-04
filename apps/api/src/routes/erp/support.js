import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock } from '../../services/erp/stock.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

// --- Transfers ---
router.get('/transfers', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT t.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
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

router.post('/transfers', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { from_warehouse_id, to_warehouse_id, note = null, items = [] } = req.body || {};
    if (!from_warehouse_id || !to_warehouse_id) return res.status(400).json({ error: 'warehouses required' });
    if (from_warehouse_id === to_warehouse_id) return res.status(400).json({ error: 'warehouses must differ' });
    if (!items.length) return res.status(400).json({ error: 'items required' });
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('tr-', 'stock_transfers');
    await conn.query(
      `INSERT INTO stock_transfers (id, reference, from_warehouse_id, to_warehouse_id, status, note, created_by)
       VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
      [id, reference, from_warehouse_id, to_warehouse_id, note, req.user?.sub || req.user?.id || null]
    );
    for (const item of items) {
      await conn.query(
        `INSERT INTO product_transfers (id, transfer_id, product_id, qty) VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty)]
      );
      await adjustStock(conn, { productId: item.product_id, warehouseId: from_warehouse_id, delta: -num(item.qty) });
      await adjustStock(conn, { productId: item.product_id, warehouseId: to_warehouse_id, delta: num(item.qty) });
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

// --- Sale returns ---
router.get('/sale-returns', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT r.*, w.name AS warehouse_name, c.name AS customer_name
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

router.post('/sale-returns', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id || !items.length) return res.status(400).json({ error: 'warehouse_id and items required' });
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('srr-', 'sale_returns');
    let grand = 0;
    for (const item of items) grand += num(item.qty) * num(item.net_unit_price);
    await conn.query(
      `INSERT INTO sale_returns (id, reference, sale_id, warehouse_id, customer_id, grand_total, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, b.sale_id || null, b.warehouse_id, b.customer_id || null, grand, b.note || null, req.user?.sub || req.user?.id || null]
    );
    for (const item of items) {
      const sub = num(item.qty) * num(item.net_unit_price);
      await conn.query(
        `INSERT INTO sale_return_items (id, return_id, product_id, qty, net_unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_price), sub]
      );
      await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: num(item.qty) });
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

// --- Purchase returns ---
router.get('/purchase-returns', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT r.*, w.name AS warehouse_name, s.name AS supplier_name
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

router.post('/purchase-returns', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id || !items.length) return res.status(400).json({ error: 'warehouse_id and items required' });
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('prr-', 'purchase_returns');
    let grand = 0;
    for (const item of items) grand += num(item.qty) * num(item.net_unit_cost);
    await conn.query(
      `INSERT INTO purchase_returns (id, reference, purchase_id, warehouse_id, supplier_id, grand_total, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, b.purchase_id || null, b.warehouse_id, b.supplier_id || null, grand, b.note || null, req.user?.sub || req.user?.id || null]
    );
    for (const item of items) {
      const sub = num(item.qty) * num(item.net_unit_cost);
      await conn.query(
        `INSERT INTO purchase_return_items (id, return_id, product_id, qty, net_unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_cost), sub]
      );
      await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: -num(item.qty) });
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
    const [rows] = await getPool().query(
      `SELECT e.*, c.name AS category_name, w.name AS warehouse_name
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       LEFT JOIN warehouses w ON w.id = e.warehouse_id
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
    const id = randomUUID();
    const reference = await nextErpReference('ex-', 'expenses');
    await getPool().query(
      `INSERT INTO expenses (id, reference, warehouse_id, category_id, account_id, amount, note, expense_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id || null, b.category_id || null, b.account_id || null,
        num(b.amount), b.note || null, b.expense_date || new Date().toISOString().slice(0, 10),
        req.user?.sub || req.user?.id || null,
      ]
    );
    if (b.account_id) {
      await getPool().query(`UPDATE erp_accounts SET balance = balance - ? WHERE id = ?`, [num(b.amount), b.account_id]);
    }
    res.status(201).json({ data: { id, reference } });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        const status = paid >= num(rows[0].grand_total) ? 'paid' : 'partial';
        await conn.query(`UPDATE sales SET paid_amount = ?, payment_status = ? WHERE id = ?`, [paid, status, payable_id]);
      }
    } else if (payable_type === 'purchase') {
      const [rows] = await conn.query(`SELECT grand_total, paid_amount FROM purchases WHERE id = ?`, [payable_id]);
      if (rows.length) {
        const paid = num(rows[0].paid_amount) + num(amount);
        const status = paid >= num(rows[0].grand_total) ? 'paid' : 'partial';
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

router.get('/balance-sheet', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    const [[accounts]] = await pool.query(`SELECT COALESCE(SUM(balance),0) AS total FROM erp_accounts WHERE is_active = 1`);
    const [[sales]] = await pool.query(`SELECT COALESCE(SUM(grand_total),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM sales`);
    const [[purchases]] = await pool.query(`SELECT COALESCE(SUM(grand_total),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM purchases`);
    const [[expenses]] = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`);
    const [accountRows] = await pool.query(`SELECT id, name, account_no, balance FROM erp_accounts WHERE is_active = 1 ORDER BY name`);
    res.json({
      data: {
        accounts_total: num(accounts.total),
        sales_total: num(sales.total),
        sales_paid: num(sales.paid),
        purchases_total: num(purchases.total),
        purchases_paid: num(purchases.paid),
        expenses_total: num(expenses.total),
        accounts: accountRows,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
