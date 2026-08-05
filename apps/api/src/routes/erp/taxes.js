import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

async function syncSystemTaxRate(pool, rate) {
  const [rows] = await pool.query(`SELECT id FROM system_settings LIMIT 1`);
  if (rows.length) {
    await pool.query(`UPDATE system_settings SET tax_rate = ? WHERE id = ?`, [rate, rows[0].id]);
  }
}

function mapTax(r) {
  return {
    ...r,
    rate: num(r.rate),
    is_active: Boolean(r.is_active),
    is_default: Boolean(r.is_default),
  };
}

router.get('/', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_taxes ORDER BY name ASC`);
    res.json({ data: rows.map(mapTax) });
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
    const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM erp_taxes`);
    const makeDefault = bool(b.is_default, false) || Number(countRows[0]?.c || 0) === 0;
    if (makeDefault) await pool.query(`UPDATE erp_taxes SET is_default = 0`);
    const rate = num(b.rate);
    await pool.query(
      `INSERT INTO erp_taxes (id, name, rate, is_active, is_default) VALUES (?, ?, ?, ?, ?)`,
      [id, b.name.trim(), rate, bool(b.is_active, true) ? 1 : 0, makeDefault ? 1 : 0]
    );
    if (makeDefault) await syncSystemTaxRate(pool, rate);
    const [rows] = await pool.query(`SELECT * FROM erp_taxes WHERE id = ?`, [id]);
    res.status(201).json({ data: mapTax(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_taxes WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    const rate = b.rate !== undefined ? num(b.rate) : num(c.rate);
    await pool.query(
      `UPDATE erp_taxes SET name = ?, rate = ?, is_active = ? WHERE id = ?`,
      [
        b.name?.trim() || c.name,
        rate,
        (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
        req.params.id,
      ]
    );
    if (c.is_default) await syncSystemTaxRate(pool, rate);
    const [rows] = await pool.query(`SELECT * FROM erp_taxes WHERE id = ?`, [req.params.id]);
    res.json({ data: mapTax(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/set-default', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_taxes WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await pool.query(`UPDATE erp_taxes SET is_default = 0`);
    await pool.query(`UPDATE erp_taxes SET is_default = 1 WHERE id = ?`, [req.params.id]);
    await syncSystemTaxRate(pool, num(ex[0].rate));
    const [rows] = await pool.query(`SELECT * FROM erp_taxes WHERE id = ?`, [req.params.id]);
    res.json({ data: mapTax(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_taxes WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].is_default) {
      return res.status(400).json({ error: 'You cannot delete the default tax. Set another default first.' });
    }
    await pool.query(`DELETE FROM erp_taxes WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
