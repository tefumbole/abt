import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { sendTextMessage, formatPhoneNumber, isWasenderConfigured } from '../../services/wasenderWhatsAppService.js';

const router = Router();

router.get('/quotation/:token', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT q.id, q.reference, q.status, q.grand_total, q.note, q.client_comment, q.discount, q.shipping, q.tax,
              c.name AS customer_name
       FROM quotations q
       LEFT JOIN erp_customers c ON c.id = q.customer_id
       WHERE q.approval_token = ?`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const [items] = await pool.query(
      `SELECT pq.qty, pq.net_unit_price, pq.discount, pq.tax, pq.subtotal, p.name AS product_name
       FROM product_quotations pq LEFT JOIN products p ON p.id = pq.product_id
       WHERE pq.quotation_id = ?`,
      [rows[0].id]
    );
    res.json({ data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/quotation/:token/respond', async (req, res) => {
  try {
    const { action, comment = null, signature_data = null } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM quotations WHERE approval_token = ?`, [req.params.token]);
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const q = rows[0];
    if (!['draft', 'awaiting_approval'].includes(q.status)) {
      return res.status(400).json({ error: 'Quotation already processed' });
    }
    const status = action === 'approve' ? 'approved' : 'rejected';
    const noteExtra = signature_data ? `\n[Signed electronically]` : '';
    await pool.query(
      `UPDATE quotations SET status = ?, client_comment = ?, note = CONCAT(COALESCE(note,''), ?) WHERE id = ?`,
      [status, comment, noteExtra, q.id]
    );
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/delivery/:token', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT d.id, d.reference, d.status, d.signature_status, d.address, s.reference AS sale_reference,
              c.name AS customer_name
       FROM deliveries d
       LEFT JOIN sales s ON s.id = d.sale_id
       LEFT JOIN erp_customers c ON c.id = d.customer_id
       WHERE d.signature_token = ?`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/delivery/:token/sign', async (req, res) => {
  try {
    const { signature_data } = req.body || {};
    if (!signature_data) return res.status(400).json({ error: 'signature_data required' });
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT d.*, c.phone AS customer_phone FROM deliveries d
       LEFT JOIN erp_customers c ON c.id = d.customer_id
       WHERE d.signature_token = ?`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const d = rows[0];
    if (d.signature_status === 'signed') {
      return res.status(400).json({ error: 'Already signed' });
    }
    await pool.query(
      `UPDATE deliveries SET signature_status = 'signed', signature_data = ?, signed_at = NOW(), status = 'delivered'
       WHERE id = ?`,
      [signature_data, d.id]
    );
    if (isWasenderConfigured() && d.customer_phone) {
      try {
        await sendTextMessage(
          formatPhoneNumber(d.customer_phone),
          `Thank you. Delivery ${d.reference} has been signed.`,
          'erp-delivery-signed'
        );
      } catch {
        /* ignore */
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/booking/:token', async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, reference, from_datetime, to_datetime, grand_total, signature_status, booking_status
       FROM erp_bookings WHERE signature_token = ?`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid link' });
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/booking/:token/sign', async (req, res) => {
  try {
    const [rows] = await getPool().query(`SELECT * FROM erp_bookings WHERE signature_token = ?`, [req.params.token]);
    if (!rows.length) return res.status(404).json({ error: 'Invalid link' });
    await getPool().query(
      `UPDATE erp_bookings SET signature_status = 'signed', signed_at = NOW(), booking_status = 'confirmed' WHERE id = ?`,
      [rows[0].id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
