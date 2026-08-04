import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { bool, requireErpAdmin } from './helpers.js';

const router = Router();

function mapWh(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    is_active: Boolean(row.is_active),
    is_default: Boolean(row.is_default),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get('/', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM warehouses ORDER BY is_default DESC, name ASC`);
    res.json({ data: rows.map(mapWh) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const { name, phone = null, email = null, address = null, is_active = true, is_default = false } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const pool = getPool();
    const id = randomUUID();
    const makeDefault = bool(is_default, false);
    if (makeDefault) await pool.query(`UPDATE warehouses SET is_default = 0`);
    await pool.query(
      `INSERT INTO warehouses (id, name, phone, email, address, is_active, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), phone, email, address, bool(is_active, true) ? 1 : 0, makeDefault ? 1 : 0]
    );
    const [rows] = await pool.query(`SELECT * FROM warehouses WHERE id = ?`, [id]);
    res.status(201).json({ data: mapWh(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [existing] = await pool.query(`SELECT * FROM warehouses WHERE id = ?`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Warehouse not found' });
    const cur = existing[0];
    const name = req.body?.name?.trim() || cur.name;
    const phone = req.body?.phone !== undefined ? req.body.phone : cur.phone;
    const email = req.body?.email !== undefined ? req.body.email : cur.email;
    const address = req.body?.address !== undefined ? req.body.address : cur.address;
    const is_active = req.body?.is_active !== undefined ? bool(req.body.is_active) : Boolean(cur.is_active);
    const is_default = req.body?.is_default !== undefined ? bool(req.body.is_default) : Boolean(cur.is_default);
    if (is_default) await pool.query(`UPDATE warehouses SET is_default = 0`);
    await pool.query(
      `UPDATE warehouses SET name=?, phone=?, email=?, address=?, is_active=?, is_default=? WHERE id=?`,
      [name, phone, email, address, is_active ? 1 : 0, is_default ? 1 : 0, req.params.id]
    );
    const [rows] = await pool.query(`SELECT * FROM warehouses WHERE id = ?`, [req.params.id]);
    res.json({ data: mapWh(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [existing] = await pool.query(`SELECT * FROM warehouses WHERE id = ?`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Warehouse not found' });
    if (existing[0].is_default) return res.status(400).json({ error: 'Cannot delete the default warehouse' });
    await pool.query(`DELETE FROM warehouses WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
