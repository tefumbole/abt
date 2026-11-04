import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { sendTextMessage, formatPhoneNumber, isWasenderConfigured } from '../../services/wasenderWhatsAppService.js';

const router = Router();

router.get('/quotation/:token', async (req, res) => {
  try {
    const { findByToken, healSignedAwaiting, publicPayload } = await import('../../services/erp/quotationApproval.js');
    const { isLinkLive } = await import('../../services/erp/quotationStatus.js');
    let quotation = await findByToken(req.params.token);
    if (quotation) quotation = await healSignedAwaiting(quotation);
    if (!quotation || !isLinkLive(quotation)) {
      return res.status(410).json({
        error: 'This approval link has already been used or replaced. Please ask the company for a new one.',
        expired: true,
      });
    }
    const [settings] = await getPool().query(`SELECT application_name FROM system_settings LIMIT 1`);
    const company = process.env.COMPANY_NAME || settings[0]?.application_name || 'Alpha Bridge';
    res.json({ data: publicPayload(quotation, company) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/quotation/:token/respond', async (req, res) => {
  const action = String(req.body?.action || '').toLowerCase();
  const token = req.params.token;
  const { approveByToken, rejectByToken, quoteByToken } = await import('../../services/erp/quotationApproval.js');
  try {
    if (action === 'quote') {
      await quoteByToken(req, token, req.body || {});
      return res.json({ ok: true, message: 'Your quote was submitted. Our team will review it.' });
    }
    if (action === 'reject') {
      await rejectByToken(req, token, { comment: req.body?.comment || req.body?.client_comment });
      return res.json({ ok: true, message: 'Your response has been recorded.' });
    }
    const result = await approveByToken(req, token, {
      signature_data: req.body?.signature_data,
      comment: req.body?.comment,
    });
    res.json({ ok: true, waiting_company: result.waitingCompany });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
  }
});

router.post('/quotation/:token/approve', async (req, res) => {
  try {
    const { approveByToken } = await import('../../services/erp/quotationApproval.js');
    const result = await approveByToken(req, req.params.token, req.body || {});
    res.json({ ok: true, waiting_company: result.waitingCompany });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
  }
});

router.post('/quotation/:token/reject', async (req, res) => {
  try {
    const { rejectByToken } = await import('../../services/erp/quotationApproval.js');
    await rejectByToken(req, req.params.token, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
  }
});

router.post('/quotation/:token/quote', async (req, res) => {
  try {
    const { quoteByToken } = await import('../../services/erp/quotationApproval.js');
    await quoteByToken(req, req.params.token, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
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
    // Mark signed + delivered. delivered_at is optional (older DBs may lack the column).
    try {
      await pool.query(
        `UPDATE deliveries SET signature_status = 'signed', signature_data = ?, signed_at = NOW(),
          status = 'delivered', delivered_at = COALESCE(delivered_at, NOW())
         WHERE id = ?`,
        [signature_data, d.id]
      );
    } catch (err) {
      if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
      await pool.query(
        `UPDATE deliveries SET signature_status = 'signed', signature_data = ?, signed_at = NOW(), status = 'delivered'
         WHERE id = ?`,
        [signature_data, d.id]
      );
    }
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
    // A fresh signature queues the booking for staff review.
    await getPool().query(
      `UPDATE erp_bookings
         SET signature_status = 'signed', signed_at = NOW(), booking_status = 'confirmed',
             review_status = 'pending'
       WHERE id = ?`,
      [rows[0].id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
