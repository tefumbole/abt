import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock } from '../../services/erp/stock.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

async function crudList(table, order = 'name ASC') {
  const pool = getPool();
  const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
  return rows;
}

// --- Categories ---
router.get('/categories', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    res.json({ data: await crudList('erp_categories') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { name, parent_id = null, image_url = null, is_active = true } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const id = randomUUID();
    const pool = getPool();
    await pool.query(
      `INSERT INTO erp_categories (id, name, parent_id, image_url, is_active) VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim(), parent_id, image_url, bool(is_active) ? 1 : 0]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_categories WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_categories WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const name = req.body?.name?.trim() || c.name;
    const parent_id = req.body?.parent_id !== undefined ? req.body.parent_id : c.parent_id;
    const image_url = req.body?.image_url !== undefined ? req.body.image_url : c.image_url;
    const is_active = req.body?.is_active !== undefined ? bool(req.body.is_active) : Boolean(c.is_active);
    await pool.query(
      `UPDATE erp_categories SET name=?, parent_id=?, image_url=?, is_active=? WHERE id=?`,
      [name, parent_id, image_url, is_active ? 1 : 0, req.params.id]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_categories WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM erp_categories WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Brands ---
router.get('/brands', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    res.json({ data: await crudList('erp_brands') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/brands', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { name, image_url = null, is_active = true } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO erp_brands (id, name, image_url, is_active) VALUES (?, ?, ?, ?)`,
      [id, name.trim(), image_url, bool(is_active) ? 1 : 0]
    );
    const [rows] = await getPool().query(`SELECT * FROM erp_brands WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/brands/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_brands WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    await pool.query(
      `UPDATE erp_brands SET name=?, image_url=?, is_active=? WHERE id=?`,
      [
        req.body?.name?.trim() || c.name,
        req.body?.image_url !== undefined ? req.body.image_url : c.image_url,
        (req.body?.is_active !== undefined ? bool(req.body.is_active) : Boolean(c.is_active)) ? 1 : 0,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM erp_brands WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/brands/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    await getPool().query(`DELETE FROM erp_brands WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function syncDefaultUnitSetting(pool, unitId) {
  if (!unitId) return;
  const [rows] = await pool.query(`SELECT id FROM system_settings LIMIT 1`);
  if (rows.length) {
    await pool.query(`UPDATE system_settings SET default_unit_id = ? WHERE id = ?`, [unitId, rows[0].id]);
  }
}

// --- Units ---
router.get('/units', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const rows = await crudList('erp_units');
    res.json({
      data: rows.map((r) => ({
        ...r,
        is_active: Boolean(r.is_active),
        is_default: Boolean(r.is_default),
      })).sort((a, b) => Number(b.is_default) - Number(a.is_default) || String(a.name).localeCompare(String(b.name))),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/units', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { name, code = null, is_active = true, is_default = false } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const pool = getPool();
    const id = randomUUID();
    const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM erp_units`);
    const makeDefault = bool(is_default, false) || Number(countRows[0]?.c || 0) === 0;
    if (makeDefault) await pool.query(`UPDATE erp_units SET is_default = 0`);
    await pool.query(
      `INSERT INTO erp_units (id, name, code, is_active, is_default) VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim(), code, bool(is_active) ? 1 : 0, makeDefault ? 1 : 0]
    );
    if (makeDefault) await syncDefaultUnitSetting(pool, id);
    const [rows] = await pool.query(`SELECT * FROM erp_units WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/units/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_units WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const makeDefault = req.body?.is_default !== undefined ? bool(req.body.is_default) : Boolean(c.is_default);
    if (makeDefault) await pool.query(`UPDATE erp_units SET is_default = 0`);
    await pool.query(
      `UPDATE erp_units SET name=?, code=?, is_active=?, is_default=? WHERE id=?`,
      [
        req.body?.name?.trim() || c.name,
        req.body?.code !== undefined ? req.body.code : c.code,
        (req.body?.is_active !== undefined ? bool(req.body.is_active) : Boolean(c.is_active)) ? 1 : 0,
        makeDefault ? 1 : 0,
        req.params.id,
      ]
    );
    if (makeDefault) await syncDefaultUnitSetting(pool, req.params.id);
    const [rows] = await pool.query(`SELECT * FROM erp_units WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/units/:id/set-default', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_units WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await pool.query(`UPDATE erp_units SET is_default = 0`);
    await pool.query(`UPDATE erp_units SET is_default = 1 WHERE id = ?`, [req.params.id]);
    await syncDefaultUnitSetting(pool, req.params.id);
    const [rows] = await pool.query(`SELECT * FROM erp_units WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/units/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_units WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].is_default) {
      return res.status(400).json({ error: 'You cannot delete the default unit. Set another default first.' });
    }
    await pool.query(`DELETE FROM erp_units WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Products ---
router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const warehouseId = req.query.warehouse_id || null;
    const [rows] = await pool.query(
      `SELECT p.*,
        c.name AS category_name, b.name AS brand_name, u.name AS unit_name
       FROM products p
       LEFT JOIN erp_categories c ON c.id = p.category_id
       LEFT JOIN erp_brands b ON b.id = p.brand_id
       LEFT JOIN erp_units u ON u.id = p.unit_id
       ORDER BY p.name ASC`
    );
    let stockMap = {};
    if (warehouseId) {
      const [stocks] = await pool.query(
        `SELECT product_id, qty, price, cost FROM product_warehouse WHERE warehouse_id = ?`,
        [warehouseId]
      );
      stockMap = Object.fromEntries(stocks.map((s) => [s.product_id, s]));
    } else {
      const [stocks] = await pool.query(
        `SELECT product_id, SUM(qty) AS qty FROM product_warehouse GROUP BY product_id`
      );
      stockMap = Object.fromEntries(stocks.map((s) => [s.product_id, s]));
    }
    res.json({
      data: rows.map((r) => ({
        ...r,
        is_active: Boolean(r.is_active),
        cost: num(r.cost),
        price: num(r.price),
        stock_qty: stockMap[r.id] ? num(stockMap[r.id].qty) : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock adjustment (before /:id)
router.get('/adjustments/list', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT a.*, w.name AS warehouse_name FROM stock_adjustments a
       LEFT JOIN warehouses w ON w.id = a.warehouse_id ORDER BY a.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/adjustments', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { warehouse_id, note = null, items = [] } = req.body || {};
    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id required' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' });
    await conn.beginTransaction();
    const id = randomUUID();
    const reference = await nextErpReference('adj-', 'stock_adjustments');
    await conn.query(
      `INSERT INTO stock_adjustments (id, reference, warehouse_id, note, created_by) VALUES (?, ?, ?, ?, ?)`,
      [id, reference, warehouse_id, note, req.user?.sub || req.user?.id || null]
    );
    for (const item of items) {
      const itemId = randomUUID();
      const qty = num(item.qty);
      await conn.query(
        `INSERT INTO stock_adjustment_items (id, adjustment_id, product_id, qty) VALUES (?, ?, ?, ?)`,
        [itemId, id, item.product_id, qty]
      );
      await adjustStock(conn, { productId: item.product_id, warehouseId: warehouse_id, delta: qty });
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

router.get('/barcode/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, name, code, barcode, price FROM products WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({
      data: {
        ...rows[0],
        barcode_value: rows[0].barcode || rows[0].code || rows[0].id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [stocks] = await pool.query(
      `SELECT pw.*, w.name AS warehouse_name FROM product_warehouse pw
       JOIN warehouses w ON w.id = pw.warehouse_id WHERE pw.product_id = ?`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], warehouses: stocks } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const pool = getPool();
    const id = randomUUID();
    const code = b.code?.trim() || `P-${id.slice(0, 8).toUpperCase()}`;
    await pool.query(
      `INSERT INTO products (id, name, code, barcode, category_id, brand_id, unit_id, cost, price, image_url, description, product_type, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, b.name.trim(), code, b.barcode || null, b.category_id || null, b.brand_id || null, b.unit_id || null,
        num(b.cost), num(b.price), b.image_url || null, b.description || null, b.product_type || 'standard',
        bool(b.is_active, true) ? 1 : 0,
      ]
    );
    const stocks = Array.isArray(b.stocks) ? b.stocks : [];
    for (const s of stocks) {
      if (!s.warehouse_id) continue;
      await adjustStock(pool, {
        productId: id,
        warehouseId: s.warehouse_id,
        delta: num(s.qty),
        price: s.price != null ? num(s.price) : num(b.price),
        cost: s.cost != null ? num(s.cost) : num(b.cost),
      });
    }
    const [rows] = await pool.query(`SELECT * FROM products WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    await pool.query(
      `UPDATE products SET name=?, code=?, barcode=?, category_id=?, brand_id=?, unit_id=?, cost=?, price=?,
        image_url=?, description=?, product_type=?, is_active=? WHERE id=?`,
      [
        b.name?.trim() || c.name,
        b.code !== undefined ? b.code : c.code,
        b.barcode !== undefined ? b.barcode : c.barcode,
        b.category_id !== undefined ? b.category_id : c.category_id,
        b.brand_id !== undefined ? b.brand_id : c.brand_id,
        b.unit_id !== undefined ? b.unit_id : c.unit_id,
        b.cost !== undefined ? num(b.cost) : num(c.cost),
        b.price !== undefined ? num(b.price) : num(c.price),
        b.image_url !== undefined ? b.image_url : c.image_url,
        b.description !== undefined ? b.description : c.description,
        b.product_type || c.product_type,
        (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM product_warehouse WHERE product_id = ?`, [req.params.id]);
    await pool.query(`DELETE FROM products WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
