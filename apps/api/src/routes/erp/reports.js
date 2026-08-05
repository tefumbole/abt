import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { computeProfitLoss } from '../../services/erp/accountingReports.js';
import { num, requireErpAdmin } from './helpers.js';

const router = Router();

function dateParams(query) {
  return {
    from: query.from || null,
    to: query.to || null,
    warehouse_id: query.warehouse_id || null,
  };
}

router.get('/sales-summary', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { from, to, warehouse_id } = dateParams(req.query);
    const params = [];
    let where = `s.sale_status = 'completed'`;
    if (from) { where += ' AND DATE(s.sale_date) >= ?'; params.push(from); }
    if (to) { where += ' AND DATE(s.sale_date) <= ?'; params.push(to); }
    if (warehouse_id) { where += ' AND s.warehouse_id = ?'; params.push(warehouse_id); }

    const [[totals]] = await getPool().query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(s.grand_total),0) AS grand_total,
              COALESCE(SUM(s.paid_amount),0) AS paid_amount,
              COALESCE(SUM(GREATEST(s.grand_total - s.paid_amount, 0)),0) AS due_amount
       FROM sales s WHERE ${where}`,
      params
    );
    const [byDay] = await getPool().query(
      `SELECT DATE(s.sale_date) AS day,
              COUNT(*) AS count,
              COALESCE(SUM(s.grand_total),0) AS grand_total,
              COALESCE(SUM(s.paid_amount),0) AS paid_amount
       FROM sales s WHERE ${where}
       GROUP BY DATE(s.sale_date)
       ORDER BY day DESC
       LIMIT 90`,
      params
    );
    const [byWarehouse] = await getPool().query(
      `SELECT s.warehouse_id, w.name AS warehouse_name,
              COUNT(*) AS count,
              COALESCE(SUM(s.grand_total),0) AS grand_total
       FROM sales s
       LEFT JOIN warehouses w ON w.id = s.warehouse_id
       WHERE ${where}
       GROUP BY s.warehouse_id, w.name
       ORDER BY grand_total DESC`,
      params
    );

    res.json({
      data: {
        from, to, warehouse_id,
        summary: {
          count: Number(totals.count) || 0,
          grand_total: num(totals.grand_total),
          paid_amount: num(totals.paid_amount),
          due_amount: num(totals.due_amount),
        },
        by_day: byDay.map((r) => ({
          ...r,
          grand_total: num(r.grand_total),
          paid_amount: num(r.paid_amount),
          count: Number(r.count) || 0,
        })),
        by_warehouse: byWarehouse.map((r) => ({
          ...r,
          grand_total: num(r.grand_total),
          count: Number(r.count) || 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/purchases-summary', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { from, to, warehouse_id } = dateParams(req.query);
    const params = [];
    let where = '1=1';
    if (from) { where += ' AND p.purchase_date >= ?'; params.push(from); }
    if (to) { where += ' AND p.purchase_date <= ?'; params.push(to); }
    if (warehouse_id) { where += ' AND p.warehouse_id = ?'; params.push(warehouse_id); }

    const [[totals]] = await getPool().query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(p.grand_total),0) AS grand_total,
              COALESCE(SUM(p.paid_amount),0) AS paid_amount,
              COALESCE(SUM(GREATEST(p.grand_total - p.paid_amount, 0)),0) AS due_amount
       FROM purchases p WHERE ${where}`,
      params
    );
    const [byDay] = await getPool().query(
      `SELECT p.purchase_date AS day,
              COUNT(*) AS count,
              COALESCE(SUM(p.grand_total),0) AS grand_total,
              COALESCE(SUM(p.paid_amount),0) AS paid_amount
       FROM purchases p WHERE ${where}
       GROUP BY p.purchase_date
       ORDER BY day DESC
       LIMIT 90`,
      params
    );
    const [bySupplier] = await getPool().query(
      `SELECT p.supplier_id, s.name AS supplier_name,
              COUNT(*) AS count,
              COALESCE(SUM(p.grand_total),0) AS grand_total
       FROM purchases p
       LEFT JOIN erp_suppliers s ON s.id = p.supplier_id
       WHERE ${where}
       GROUP BY p.supplier_id, s.name
       ORDER BY grand_total DESC
       LIMIT 50`,
      params
    );

    res.json({
      data: {
        from, to, warehouse_id,
        summary: {
          count: Number(totals.count) || 0,
          grand_total: num(totals.grand_total),
          paid_amount: num(totals.paid_amount),
          due_amount: num(totals.due_amount),
        },
        by_day: byDay.map((r) => ({
          ...r,
          grand_total: num(r.grand_total),
          paid_amount: num(r.paid_amount),
          count: Number(r.count) || 0,
        })),
        by_supplier: bySupplier.map((r) => ({
          ...r,
          grand_total: num(r.grand_total),
          count: Number(r.count) || 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stock-summary', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const warehouse_id = req.query.warehouse_id || null;
    const params = [];
    let where = 'p.is_active = 1';
    if (warehouse_id) {
      where += ' AND pw.warehouse_id = ?';
      params.push(warehouse_id);
    }

    const [rows] = await getPool().query(
      `SELECT p.id, p.name, p.code, p.cost, p.price,
              COALESCE(SUM(pw.qty), 0) AS qty,
              COALESCE(SUM(pw.qty * COALESCE(pw.cost, p.cost, 0)), 0) AS stock_value,
              GROUP_CONCAT(DISTINCT w.name ORDER BY w.name SEPARATOR ', ') AS warehouses
       FROM products p
       LEFT JOIN product_warehouse pw ON pw.product_id = p.id
       LEFT JOIN warehouses w ON w.id = pw.warehouse_id
       WHERE ${where}
       GROUP BY p.id, p.name, p.code, p.cost, p.price
       ORDER BY p.name
       LIMIT 2000`,
      params
    );

    const items = rows.map((r) => ({
      ...r,
      qty: num(r.qty),
      cost: num(r.cost),
      price: num(r.price),
      stock_value: num(r.stock_value),
    }));
    const total_qty = items.reduce((s, r) => s + r.qty, 0);
    const total_value = items.reduce((s, r) => s + r.stock_value, 0);

    res.json({
      data: {
        warehouse_id,
        summary: {
          product_count: items.length,
          total_qty,
          total_value,
        },
        items,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

router.get('/expenses-summary', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { from, to } = dateParams(req.query);
    const params = [];
    let where = '1=1';
    if (from) { where += ' AND e.expense_date >= ?'; params.push(from); }
    if (to) { where += ' AND e.expense_date <= ?'; params.push(to); }

    const [[totals]] = await getPool().query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e WHERE ${where}`,
      params
    );
    const [byCategory] = await getPool().query(
      `SELECT e.category_id, c.name AS category_name,
              COUNT(*) AS count, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE ${where}
       GROUP BY e.category_id, c.name
       ORDER BY total DESC`,
      params
    );
    const [byAccount] = await getPool().query(
      `SELECT e.account_id, a.name AS account_name,
              COUNT(*) AS count, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e
       LEFT JOIN erp_accounts a ON a.id = e.account_id
       WHERE ${where}
       GROUP BY e.account_id, a.name
       ORDER BY total DESC`,
      params
    );
    const [byDay] = await getPool().query(
      `SELECT e.expense_date AS day,
              COUNT(*) AS count, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e WHERE ${where}
       GROUP BY e.expense_date
       ORDER BY day DESC
       LIMIT 90`,
      params
    );

    res.json({
      data: {
        from, to,
        summary: {
          count: Number(totals.count) || 0,
          total: num(totals.total),
        },
        by_category: byCategory.map((r) => ({
          ...r,
          total: num(r.total),
          count: Number(r.count) || 0,
        })),
        by_account: byAccount.map((r) => ({
          ...r,
          total: num(r.total),
          count: Number(r.count) || 0,
        })),
        by_day: byDay.map((r) => ({
          ...r,
          total: num(r.total),
          count: Number(r.count) || 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
