import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { sendTextMessage, formatPhoneNumber, isWasenderConfigured } from '../../services/wasenderWhatsAppService.js';
import { requireErpAdmin } from './helpers.js';

const router = Router();

function publicBaseUrl(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
  if (env && env !== '*') return String(env).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.signature_status) {
      where += ' AND d.signature_status = ?';
      params.push(req.query.signature_status);
    }
    const [rows] = await getPool().query(
      `SELECT d.*, s.reference AS sale_reference, c.name AS customer_name, c.phone AS customer_phone
       FROM deliveries d
       LEFT JOIN sales s ON s.id = d.sale_id
       LEFT JOIN erp_customers c ON c.id = d.customer_id
       WHERE ${where}
       ORDER BY d.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.sale_id) return res.status(400).json({ error: 'sale_id required' });
    const pool = getPool();
    const [sales] = await pool.query(`SELECT * FROM sales WHERE id = ?`, [b.sale_id]);
    if (!sales.length) return res.status(404).json({ error: 'Sale not found' });
    const id = randomUUID();
    const reference = await nextErpReference('dr-', 'deliveries');
    const token = randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO deliveries (id, reference, sale_id, customer_id, address, status, signature_status, signature_token, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id, reference, b.sale_id, b.customer_id || sales[0].customer_id, b.address || null,
        b.status || 'packing', token, req.user?.sub || req.user?.id || null,
      ]
    );
    res.status(201).json({ data: { id, reference, signature_token: token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/send-sign-link', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT d.*, c.phone AS customer_phone, c.name AS customer_name
       FROM deliveries d LEFT JOIN erp_customers c ON c.id = d.customer_id WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const d = rows[0];
    if (!isWasenderConfigured()) return res.status(503).json({ error: 'WhatsApp not configured' });
    const phone = req.body?.phone || d.customer_phone;
    if (!phone) return res.status(400).json({ error: 'Phone required' });
    let token = d.signature_token;
    if (!token) {
      token = randomBytes(24).toString('hex');
      await pool.query(`UPDATE deliveries SET signature_token = ? WHERE id = ?`, [token, d.id]);
    }
    const link = `${publicBaseUrl(req)}/erp/public/delivery/${token}`;
    await sendTextMessage(
      formatPhoneNumber(phone),
      `Delivery ${d.reference}: please sign to confirm receipt.\n${link}`,
      'erp-delivery-sign'
    );
    res.json({ ok: true, link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
