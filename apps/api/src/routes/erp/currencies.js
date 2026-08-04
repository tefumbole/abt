import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { bool, num, requireErpAdmin } from './helpers.js';

const router = Router();

async function syncSystemCurrency(pool, code) {
  if (!code) return;
  const [rows] = await pool.query(`SELECT id FROM system_settings LIMIT 1`);
  if (rows.length) {
    await pool.query(`UPDATE system_settings SET currency = ? WHERE id = ?`, [code, rows[0].id]);
  }
}

router.get('/', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT * FROM erp_currencies ORDER BY is_default DESC, name ASC`
    );
    res.json({
      data: rows.map((r) => ({
        ...r,
        exchange_rate: Number(r.exchange_rate) || 1,
        is_active: Boolean(r.is_active),
        is_default: Boolean(r.is_default),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!b.code?.trim()) return res.status(400).json({ error: 'Code is required' });
    const pool = getPool();
    const code = b.code.trim().toUpperCase();
    const id = randomUUID();
    const makeDefault = bool(b.is_default, false);
    if (makeDefault) {
      await pool.query(`UPDATE erp_currencies SET is_default = 0`);
    }
    // First currency becomes default automatically
    const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM erp_currencies`);
    const isFirst = Number(countRows[0]?.c || 0) === 0;
    const isDefault = makeDefault || isFirst;
    await pool.query(
      `INSERT INTO erp_currencies (id, name, code, symbol, exchange_rate, is_active, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        b.name.trim(),
        code,
        b.symbol?.trim() || code,
        num(b.exchange_rate, 1) || 1,
        bool(b.is_active, true) ? 1 : 0,
        isDefault ? 1 : 0,
      ]
    );
    if (isDefault) await syncSystemCurrency(pool, code);
    const [rows] = await pool.query(`SELECT * FROM erp_currencies WHERE id = ?`, [id]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('Duplicate') || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Currency code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_currencies WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const c = ex[0];
    const b = req.body || {};
    const code = (b.code?.trim() || c.code).toUpperCase();
    const makeDefault = b.is_default !== undefined ? bool(b.is_default) : Boolean(c.is_default);
    if (makeDefault) {
      await pool.query(`UPDATE erp_currencies SET is_default = 0`);
    }
    await pool.query(
      `UPDATE erp_currencies SET name=?, code=?, symbol=?, exchange_rate=?, is_active=?, is_default=? WHERE id=?`,
      [
        b.name?.trim() || c.name,
        code,
        b.symbol !== undefined ? (b.symbol?.trim() || code) : c.symbol,
        b.exchange_rate !== undefined ? (num(b.exchange_rate, 1) || 1) : Number(c.exchange_rate) || 1,
        (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
        makeDefault ? 1 : 0,
        req.params.id,
      ]
    );
    if (makeDefault) await syncSystemCurrency(pool, code);
    const [rows] = await pool.query(`SELECT * FROM erp_currencies WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/set-default', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_currencies WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (!ex[0].is_active) return res.status(400).json({ error: 'Cannot set an inactive currency as default' });
    await pool.query(`UPDATE erp_currencies SET is_default = 0`);
    await pool.query(`UPDATE erp_currencies SET is_default = 1 WHERE id = ?`, [req.params.id]);
    await syncSystemCurrency(pool, ex[0].code);
    const [rows] = await pool.query(`SELECT * FROM erp_currencies WHERE id = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT * FROM erp_currencies WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].is_default) {
      return res.status(400).json({ error: 'You cannot delete the default currency. Set another default first.' });
    }
    await pool.query(`DELETE FROM erp_currencies WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
