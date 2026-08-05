import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';

/** Ensure product_warehouse row exists; adjust qty by delta. */
export async function adjustStock(connOrPool, { productId, warehouseId, delta, price = null, cost = null }) {
  const db = connOrPool || getPool();
  const [rows] = await db.query(
    `SELECT id, qty FROM product_warehouse WHERE product_id = ? AND warehouse_id = ? LIMIT 1`,
    [productId, warehouseId]
  );
  if (rows.length) {
    const next = Number(rows[0].qty) + Number(delta);
    await db.query(
      `UPDATE product_warehouse SET qty = ?, price = COALESCE(?, price), cost = COALESCE(?, cost) WHERE id = ?`,
      [next, price, cost, rows[0].id]
    );
    return next;
  }
  const id = randomUUID();
  const qty = Number(delta);
  await db.query(
    `INSERT INTO product_warehouse (id, product_id, warehouse_id, qty, price, cost) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, productId, warehouseId, qty, price, cost]
  );
  return qty;
}

/** Ids among `productIds` that never hold stock (digital, donation, service). */
export async function getNonStockProductIds(connOrPool, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) return new Set();
  const db = connOrPool || getPool();
  const [rows] = await db.query(
    `SELECT id FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND product_type <> 'standard'`,
    ids
  );
  return new Set(rows.map((r) => r.id));
}

export async function getStock(productId, warehouseId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT qty FROM product_warehouse WHERE product_id = ? AND warehouse_id = ? LIMIT 1`,
    [productId, warehouseId]
  );
  return rows.length ? Number(rows[0].qty) : 0;
}
