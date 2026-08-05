import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { adjustStock } from '../../services/erp/stock.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

const PRODUCT_TYPES = new Set(['standard', 'digital', 'donation', 'service']);
const TAX_METHODS = new Set(['exclusive', 'inclusive']);

const PRODUCT_SELECT = `SELECT p.*,
    c.name AS category_name, b.name AS brand_name, u.name AS unit_name,
    su.name AS sale_unit_name, pu.name AS purchase_unit_name,
    t.name AS tax_name, t.rate AS tax_rate
   FROM products p
   LEFT JOIN erp_categories c ON c.id = p.category_id
   LEFT JOIN erp_brands b ON b.id = p.brand_id
   LEFT JOIN erp_units u ON u.id = p.unit_id
   LEFT JOIN erp_units su ON su.id = p.sale_unit_id
   LEFT JOIN erp_units pu ON pu.id = p.purchase_unit_id
   LEFT JOIN erp_taxes t ON t.id = p.tax_id`;

function mapProduct(r) {
  const product_type = r.product_type || 'standard';
  const rent_price_hour = num(r.rent_price_hour);
  const rent_price_day = num(r.rent_price_day);
  const rent_price_month = num(r.rent_price_month);
  return {
    ...r,
    product_type,
    tax_method: r.tax_method || 'exclusive',
    is_active: Boolean(r.is_active),
    is_featured: Boolean(r.is_featured),
    has_warehouse_price: Boolean(r.has_warehouse_price),
    cost: num(r.cost),
    price: num(r.price),
    rent_price_hour,
    rent_price_day,
    rent_price_month,
    alert_quantity: num(r.alert_quantity),
    tax_rate: r.tax_rate == null ? null : num(r.tax_rate),
    tracks_stock: product_type === 'standard',
    is_rentable: rent_price_hour > 0 || rent_price_day > 0 || rent_price_month > 0,
  };
}

function randomProductCode() {
  return String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
}

async function generateProductCode(pool) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomProductCode();
    const [rows] = await pool.query(`SELECT id FROM products WHERE code = ? LIMIT 1`, [code]);
    if (!rows.length) return code;
  }
  return String(Date.now()).slice(-10);
}

async function isProductCodeTaken(pool, code, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT id FROM products WHERE code = ? AND id <> ? LIMIT 1`,
    [code, excludeId || '']
  );
  return rows.length > 0;
}

/** Set the absolute quantity of a warehouse line, reusing the delta-based helper. */
async function setWarehouseStock(pool, productId, stock, price, cost) {
  const [rows] = await pool.query(
    `SELECT qty FROM product_warehouse WHERE product_id = ? AND warehouse_id = ? LIMIT 1`,
    [productId, stock.warehouse_id]
  );
  const current = rows.length ? num(rows[0].qty) : 0;
  await adjustStock(pool, {
    productId,
    warehouseId: stock.warehouse_id,
    delta: num(stock.qty) - current,
    price,
    cost,
  });
}

async function loadProduct(pool, id) {
  const [rows] = await pool.query(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  return rows.length ? mapProduct(rows[0]) : null;
}

async function crudList(table, order = 'name ASC') {
  const pool = getPool();
  const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
  return rows;
}

// --- Categories ---
router.get('/categories', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT c.*,
        p.name AS parent_name,
        COALESCE(stats.product_count, 0) AS product_count,
        COALESCE(stats.stock_qty, 0) AS stock_qty,
        COALESCE(stats.stock_price, 0) AS stock_price,
        COALESCE(stats.stock_cost, 0) AS stock_cost
       FROM erp_categories c
       LEFT JOIN erp_categories p ON p.id = c.parent_id
       LEFT JOIN (
         SELECT pr.category_id,
           COUNT(DISTINCT pr.id) AS product_count,
           COALESCE(SUM(pw.qty), 0) AS stock_qty,
           COALESCE(SUM(pw.qty * COALESCE(pw.price, pr.price, 0)), 0) AS stock_price,
           COALESCE(SUM(pw.qty * COALESCE(pw.cost, pr.cost, 0)), 0) AS stock_cost
         FROM products pr
         LEFT JOIN product_warehouse pw ON pw.product_id = pr.id
         WHERE pr.is_active = 1
         GROUP BY pr.category_id
       ) stats ON stats.category_id = c.id
       ORDER BY c.name ASC`
    );
    res.json({
      data: rows.map((r) => ({
        ...r,
        is_active: Boolean(r.is_active),
        product_count: num(r.product_count),
        stock_qty: num(r.stock_qty),
        stock_price: num(r.stock_price),
        stock_cost: num(r.stock_cost),
      })),
    });
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
    const [rows] = await pool.query(`${PRODUCT_SELECT} ORDER BY p.name ASC`);
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
        ...mapProduct(r),
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

router.get('/next-code', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    res.json({ code: await generateProductCode(getPool()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`${PRODUCT_SELECT} WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [stocks] = await pool.query(
      `SELECT pw.*, w.name AS warehouse_name FROM product_warehouse pw
       JOIN warehouses w ON w.id = pw.warehouse_id WHERE pw.product_id = ?`,
      [req.params.id]
    );
    res.json({
      data: {
        ...mapProduct(rows[0]),
        warehouses: stocks,
        warehouse_prices: stocks.map((s) => ({
          warehouse_id: s.warehouse_id,
          warehouse_name: s.warehouse_name,
          qty: num(s.qty),
          price: s.price == null ? null : num(s.price),
          cost: s.cost == null ? null : num(s.cost),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const productType = String(b.product_type || 'standard').toLowerCase();
    if (!PRODUCT_TYPES.has(productType)) {
      return res.status(400).json({ error: `Invalid product type "${b.product_type}"` });
    }
    const taxMethod = String(b.tax_method || 'exclusive').toLowerCase();
    if (!TAX_METHODS.has(taxMethod)) {
      return res.status(400).json({ error: `Invalid tax method "${b.tax_method}"` });
    }
    const pool = getPool();
    const id = randomUUID();
    const code = b.code?.trim() || (await generateProductCode(pool));
    if (await isProductCodeTaken(pool, code)) {
      return res.status(409).json({ error: `Product code "${code}" is already used by another product` });
    }
    const tracksStock = productType === 'standard';
    const hasWarehousePrice = bool(b.has_warehouse_price, false);
    const price = num(b.price);
    const cost = num(b.cost);
    await pool.query(
      `INSERT INTO products (id, name, code, barcode, category_id, brand_id, unit_id, sale_unit_id, purchase_unit_id,
        cost, price, rent_price_hour, rent_price_day, rent_price_month, alert_quantity, tax_id, tax_method,
        product_location, is_featured, has_warehouse_price, image_url, description, product_type, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, b.name.trim(), code, b.barcode || null, b.category_id || null, b.brand_id || null, b.unit_id || null,
        b.sale_unit_id || null, b.purchase_unit_id || null,
        cost, price, num(b.rent_price_hour), num(b.rent_price_day), num(b.rent_price_month),
        tracksStock ? num(b.alert_quantity) : 0, b.tax_id || null, taxMethod,
        b.product_location || null, bool(b.is_featured, false) ? 1 : 0, hasWarehousePrice ? 1 : 0,
        b.image_url || null, b.description || null, productType,
        bool(b.is_active, true) ? 1 : 0,
      ]
    );
    const stocks = tracksStock && Array.isArray(b.stocks) ? b.stocks : [];
    for (const s of stocks) {
      if (!s.warehouse_id) continue;
      await adjustStock(pool, {
        productId: id,
        warehouseId: s.warehouse_id,
        delta: num(s.qty),
        price: hasWarehousePrice && s.price != null ? num(s.price) : price,
        cost: hasWarehousePrice && s.cost != null ? num(s.cost) : cost,
      });
    }
    res.status(201).json({ data: await loadProduct(pool, id) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Product code is already used by another product' });
    }
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
    const productType = String(b.product_type || c.product_type || 'standard').toLowerCase();
    if (!PRODUCT_TYPES.has(productType)) {
      return res.status(400).json({ error: `Invalid product type "${b.product_type}"` });
    }
    const taxMethod = String(b.tax_method || c.tax_method || 'exclusive').toLowerCase();
    if (!TAX_METHODS.has(taxMethod)) {
      return res.status(400).json({ error: `Invalid tax method "${b.tax_method}"` });
    }
    const code = b.code !== undefined ? String(b.code || '').trim() || c.code : c.code;
    if (code && code !== c.code && (await isProductCodeTaken(pool, code, req.params.id))) {
      return res.status(409).json({ error: `Product code "${code}" is already used by another product` });
    }
    const tracksStock = productType === 'standard';
    const hasWarehousePrice = b.has_warehouse_price !== undefined
      ? bool(b.has_warehouse_price, false)
      : Boolean(c.has_warehouse_price);
    const price = b.price !== undefined ? num(b.price) : num(c.price);
    const cost = b.cost !== undefined ? num(b.cost) : num(c.cost);
    await pool.query(
      `UPDATE products SET name=?, code=?, barcode=?, category_id=?, brand_id=?, unit_id=?, sale_unit_id=?,
        purchase_unit_id=?, cost=?, price=?, rent_price_hour=?, rent_price_day=?, rent_price_month=?,
        alert_quantity=?, tax_id=?, tax_method=?, product_location=?, is_featured=?, has_warehouse_price=?,
        image_url=?, description=?, product_type=?, is_active=? WHERE id=?`,
      [
        b.name?.trim() || c.name,
        code,
        b.barcode !== undefined ? b.barcode : c.barcode,
        b.category_id !== undefined ? b.category_id : c.category_id,
        b.brand_id !== undefined ? b.brand_id : c.brand_id,
        b.unit_id !== undefined ? b.unit_id : c.unit_id,
        b.sale_unit_id !== undefined ? b.sale_unit_id || null : c.sale_unit_id,
        b.purchase_unit_id !== undefined ? b.purchase_unit_id || null : c.purchase_unit_id,
        cost,
        price,
        b.rent_price_hour !== undefined ? num(b.rent_price_hour) : num(c.rent_price_hour),
        b.rent_price_day !== undefined ? num(b.rent_price_day) : num(c.rent_price_day),
        b.rent_price_month !== undefined ? num(b.rent_price_month) : num(c.rent_price_month),
        tracksStock ? (b.alert_quantity !== undefined ? num(b.alert_quantity) : num(c.alert_quantity)) : 0,
        b.tax_id !== undefined ? b.tax_id || null : c.tax_id,
        taxMethod,
        b.product_location !== undefined ? b.product_location || null : c.product_location,
        (b.is_featured !== undefined ? bool(b.is_featured, false) : Boolean(c.is_featured)) ? 1 : 0,
        hasWarehousePrice ? 1 : 0,
        b.image_url !== undefined ? b.image_url : c.image_url,
        b.description !== undefined ? b.description : c.description,
        productType,
        (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
        req.params.id,
      ]
    );
    if (!tracksStock) {
      await pool.query(`DELETE FROM product_warehouse WHERE product_id = ?`, [req.params.id]);
    } else if (Array.isArray(b.stocks)) {
      for (const s of b.stocks) {
        if (!s.warehouse_id) continue;
        await setWarehouseStock(
          pool,
          req.params.id,
          s,
          hasWarehousePrice && s.price != null ? num(s.price) : price,
          hasWarehousePrice && s.cost != null ? num(s.cost) : cost
        );
      }
    }
    res.json({ data: await loadProduct(pool, req.params.id) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Product code is already used by another product' });
    }
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
