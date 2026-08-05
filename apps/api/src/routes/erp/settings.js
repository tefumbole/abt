import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireErpAdmin } from './helpers.js';

const router = Router();

function decode(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function encode(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function readSettings(db) {
  const [rows] = await db.query(`SELECT setting_key, setting_value FROM erp_settings`);
  const out = {};
  for (const row of rows) out[row.setting_key] = decode(row.setting_value);
  return out;
}

router.get('/', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    res.json({ data: await readSettings(getPool()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    if (typeof b !== 'object' || Array.isArray(b)) {
      return res.status(400).json({ error: 'Body must be an object of settings' });
    }
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(b)) {
      const settingKey = String(key).slice(0, 64);
      if (!settingKey) continue;
      await conn.query(
        `INSERT INTO erp_settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [settingKey, encode(value)]
      );
    }
    await conn.commit();
    res.json({ data: await readSettings(pool) });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

export default router;
