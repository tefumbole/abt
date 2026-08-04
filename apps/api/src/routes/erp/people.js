import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { bool, requireErpAdmin } from './helpers.js';

const router = Router();

function makePartyCrud(table) {
  const r = Router();

  r.get('/', requireAuth, requireErpAdmin, async (_req, res) => {
    try {
      const [rows] = await getPool().query(`SELECT * FROM ${table} ORDER BY name ASC`);
      res.json({ data: rows.map((row) => ({ ...row, is_active: Boolean(row.is_active), is_default: Boolean(row.is_default) })) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  r.post('/', requireAuth, requireErpAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.name?.trim()) return res.status(400).json({ error: 'Name is required' });
      const id = randomUUID();
      const pool = getPool();
      if (table === 'erp_billers' && bool(b.is_default, false)) {
        await pool.query(`UPDATE erp_billers SET is_default = 0`);
      }
      if (table === 'erp_customers') {
        await pool.query(
          `INSERT INTO erp_customers (id, user_id, name, email, phone, company_name, address, city, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, b.user_id || null, b.name.trim(), b.email || null, b.phone || null,
            b.company_name || null, b.address || null, b.city || null, bool(b.is_active, true) ? 1 : 0,
          ]
        );
      } else if (table === 'erp_suppliers') {
        await pool.query(
          `INSERT INTO erp_suppliers (id, name, email, phone, company_name, address, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id, b.name.trim(), b.email || null, b.phone || null, b.company_name || null,
            b.address || null, bool(b.is_active, true) ? 1 : 0,
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO erp_billers (id, name, email, phone, company_name, address, warehouse_id, is_active, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, b.name.trim(), b.email || null, b.phone || null, b.company_name || null,
            b.address || null, b.warehouse_id || null, bool(b.is_active, true) ? 1 : 0, bool(b.is_default, false) ? 1 : 0,
          ]
        );
      }
      const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      res.status(201).json({ data: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  r.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
    try {
      const pool = getPool();
      const [ex] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!ex.length) return res.status(404).json({ error: 'Not found' });
      const c = ex[0];
      const b = req.body || {};
      if (table === 'erp_billers' && bool(b.is_default, false)) {
        await pool.query(`UPDATE erp_billers SET is_default = 0`);
      }
      if (table === 'erp_customers') {
        await pool.query(
          `UPDATE erp_customers SET user_id=?, name=?, email=?, phone=?, company_name=?, address=?, city=?, is_active=? WHERE id=?`,
          [
            b.user_id !== undefined ? b.user_id : c.user_id,
            b.name?.trim() || c.name,
            b.email !== undefined ? b.email : c.email,
            b.phone !== undefined ? b.phone : c.phone,
            b.company_name !== undefined ? b.company_name : c.company_name,
            b.address !== undefined ? b.address : c.address,
            b.city !== undefined ? b.city : c.city,
            (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
            req.params.id,
          ]
        );
      } else if (table === 'erp_suppliers') {
        await pool.query(
          `UPDATE erp_suppliers SET name=?, email=?, phone=?, company_name=?, address=?, is_active=? WHERE id=?`,
          [
            b.name?.trim() || c.name,
            b.email !== undefined ? b.email : c.email,
            b.phone !== undefined ? b.phone : c.phone,
            b.company_name !== undefined ? b.company_name : c.company_name,
            b.address !== undefined ? b.address : c.address,
            (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
            req.params.id,
          ]
        );
      } else {
        await pool.query(
          `UPDATE erp_billers SET name=?, email=?, phone=?, company_name=?, address=?, warehouse_id=?, is_active=?, is_default=? WHERE id=?`,
          [
            b.name?.trim() || c.name,
            b.email !== undefined ? b.email : c.email,
            b.phone !== undefined ? b.phone : c.phone,
            b.company_name !== undefined ? b.company_name : c.company_name,
            b.address !== undefined ? b.address : c.address,
            b.warehouse_id !== undefined ? b.warehouse_id : c.warehouse_id,
            (b.is_active !== undefined ? bool(b.is_active) : Boolean(c.is_active)) ? 1 : 0,
            (b.is_default !== undefined ? bool(b.is_default) : Boolean(c.is_default)) ? 1 : 0,
            req.params.id,
          ]
        );
      }
      const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json({ data: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  r.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
    try {
      await getPool().query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return r;
}

router.use('/customers', makePartyCrud('erp_customers'));
router.use('/suppliers', makePartyCrud('erp_suppliers'));
router.use('/billers', makePartyCrud('erp_billers'));

export default router;
