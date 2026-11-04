import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { isLinkLive } from '../services/erp/quotationStatus.js';
import {
  findByToken,
  healSignedAwaiting,
  approveByToken,
  rejectByToken,
  quoteByToken,
  publicPayload,
} from '../services/erp/quotationApproval.js';

const router = Router();

const EXPIRED = 'This approval link has already been used or replaced. Please ask the company for a new one.';

async function companyName() {
  try {
    const [rows] = await getPool().query(`SELECT application_name FROM system_settings LIMIT 1`);
    return process.env.COMPANY_NAME || rows[0]?.application_name || 'Alpha Bridge';
  } catch {
    return process.env.COMPANY_NAME || 'Alpha Bridge';
  }
}

router.get('/:token', async (req, res) => {
  try {
    let quotation = await findByToken(req.params.token);
    if (quotation) quotation = await healSignedAwaiting(quotation);
    if (!quotation || !isLinkLive(quotation)) {
      return res.status(410).json({ error: EXPIRED, expired: true });
    }
    const company = await companyName();
    res.json({ data: publicPayload(quotation, company) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:token/approve', async (req, res) => {
  try {
    const result = await approveByToken(req, req.params.token, {
      signature_data: req.body?.signature_data,
      comment: req.body?.comment || req.body?.client_comment,
    });
    res.json({
      ok: true,
      waiting_company: result.waitingCompany,
      message: result.waitingCompany
        ? 'Thank you. Your acceptance is waiting for the company to confirm.'
        : 'Thank you. Your signed quotation PDF will be sent on WhatsApp.',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
  }
});

router.post('/:token/reject', async (req, res) => {
  try {
    await rejectByToken(req, req.params.token, { comment: req.body?.comment || req.body?.client_comment });
    res.json({ ok: true, message: 'Your response has been recorded.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
  }
});

router.post('/:token/quote', async (req, res) => {
  try {
    await quoteByToken(req, req.params.token, req.body || {});
    res.json({ ok: true, message: 'Your quote was submitted. Our team will review it.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, expired: err.status === 410 });
  }
});

export default router;
