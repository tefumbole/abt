import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOtp, formatPhoneNumber, isWasenderConfigured } from '../services/wasenderWhatsAppService.js';

const router = Router();
const RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS || 45_000);
let tablesReady = null;

const CRITERIA = ['professionalism', 'time_score', 'quality', 'after_sales'];

async function ensureTables() {
  if (!tablesReady) {
    const pool = getPool();
    tablesReady = Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS review_otp_codes (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        phone VARCHAR(30) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        attempts INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_review_otp_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`),
      pool.query(`CREATE TABLE IF NOT EXISTS public_reviews (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        reviewer_name VARCHAR(120) NOT NULL,
        country VARCHAR(80) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        professionalism TINYINT NOT NULL,
        time_score TINYINT NOT NULL,
        quality TINYINT NOT NULL,
        after_sales TINYINT NOT NULL,
        overall DECIMAL(3,2) NOT NULL,
        comment VARCHAR(600) NOT NULL,
        is_published TINYINT NOT NULL DEFAULT 0,
        source VARCHAR(20) NOT NULL DEFAULT 'public',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reviews_published (is_published, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`),
    ]);
  }
  await tablesReady;
}

function normalizeReviewPhone(phone) {
  const raw = String(phone || '').trim();
  return formatPhoneNumber(raw, 'RW') || formatPhoneNumber(raw, 'CM') || formatPhoneNumber(raw);
}

function scoreValue(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function readScores(body = {}) {
  const scores = {};
  for (const key of CRITERIA) {
    const value = scoreValue(body[key]);
    if (value == null) return null;
    scores[key] = value;
  }
  const overall = Number(
    ((scores.professionalism + scores.time_score + scores.quality + scores.after_sales) / 4).toFixed(2)
  );
  return { ...scores, overall };
}

function shouldPublish(overall) {
  return Number(overall) >= 4;
}

function publicShape(row) {
  return {
    id: row.id,
    reviewer_name: row.reviewer_name,
    country: row.country,
    professionalism: Number(row.professionalism),
    time_score: Number(row.time_score),
    quality: Number(row.quality),
    after_sales: Number(row.after_sales),
    overall: Number(row.overall),
    comment: row.comment,
    created_at: row.created_at,
  };
}

function adminShape(row) {
  return {
    ...publicShape(row),
    phone: row.phone,
    is_published: Boolean(Number(row.is_published)),
    source: row.source,
  };
}

function summaryFrom(rows) {
  if (!rows.length) {
    return { count: 0, average: 0, professionalism: 0, time_score: 0, quality: 0, after_sales: 0 };
  }
  const totals = rows.reduce(
    (acc, row) => {
      acc.overall += Number(row.overall);
      acc.professionalism += Number(row.professionalism);
      acc.time_score += Number(row.time_score);
      acc.quality += Number(row.quality);
      acc.after_sales += Number(row.after_sales);
      return acc;
    },
    { overall: 0, professionalism: 0, time_score: 0, quality: 0, after_sales: 0 }
  );
  const n = rows.length;
  const avg = (value) => Number((value / n).toFixed(2));
  return {
    count: n,
    average: avg(totals.overall),
    professionalism: avg(totals.professionalism),
    time_score: avg(totals.time_score),
    quality: avg(totals.quality),
    after_sales: avg(totals.after_sales),
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM public_reviews WHERE is_published = 1 ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows.map(publicShape), summary: summaryFrom(rows) });
  } catch (err) {
    console.error('[reviews/list]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/otp', async (req, res) => {
  try {
    await ensureTables();
    if (!isWasenderConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp OTP is not configured on the server.',
      });
    }

    const phone = normalizeReviewPhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Enter a valid phone number, e.g. +250 7XX XXX XXX.' });
    }

    const pool = getPool();
    const [recent] = await pool.query(
      `SELECT created_at FROM review_otp_codes
       WHERE phone = ? AND verified_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );
    if (recent[0]?.created_at) {
      const ageMs = Date.now() - new Date(recent[0].created_at).getTime();
      if (ageMs >= 0 && ageMs < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - ageMs) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSec}s before requesting another code.`,
          retryAfter: waitSec,
        });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE review_otp_codes SET expires_at = NOW()
       WHERE phone = ? AND verified_at IS NULL AND expires_at >= NOW()`,
      [phone]
    );
    await pool.query(
      `INSERT INTO review_otp_codes (id, phone, otp, expires_at, attempts)
       VALUES (?, ?, ?, ?, 0)`,
      [randomUUID(), phone, otpCode, expiresAt]
    );

    const sendResult = await sendOtp(phone, otpCode, 'review');
    if (!sendResult.success) {
      return res.status(502).json({
        success: false,
        error: sendResult.error || 'Failed to send WhatsApp OTP.',
        maskedPhone: `${phone.substring(0, 6)}****${phone.slice(-2)}`,
      });
    }

    res.json({
      success: true,
      message: 'OTP sent via WhatsApp.',
      maskedPhone: `${phone.substring(0, 6)}****${phone.slice(-2)}`,
    });
  } catch (err) {
    console.error('[reviews/otp]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureTables();
    const body = req.body || {};
    const phone = normalizeReviewPhone(body.phone);
    const code = String(body.code || '').replace(/\D/g, '');
    const name = String(body.reviewer_name || '').trim();
    const country = String(body.country || '').trim();
    const comment = String(body.comment || '').trim();
    const scores = readScores(body);

    if (!phone) return res.status(400).json({ success: false, error: 'Valid phone number is required.' });
    if (code.length !== 6) return res.status(400).json({ success: false, error: 'Enter the 6-digit WhatsApp code.' });
    if (name.length < 2) return res.status(400).json({ success: false, error: 'Name is required.' });
    if (!country) return res.status(400).json({ success: false, error: 'Country is required.' });
    if (comment.length < 8) return res.status(400).json({ success: false, error: 'Write a short review of at least 8 characters.' });
    if (comment.length > 500) return res.status(400).json({ success: false, error: 'Review must stay under 500 characters.' });
    if (!scores) return res.status(400).json({ success: false, error: 'Rate professionalism, time, quality, and after-sales support from 1 to 5 stars.' });

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM review_otp_codes
       WHERE phone = ? AND verified_at IS NULL AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );
    const session = rows[0];
    if (!session) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP. Request a new code.' });
    }
    if (Number(session.attempts || 0) >= 5) {
      return res.status(400).json({ success: false, error: 'Too many attempts. Request a new code.' });
    }
    if (session.otp !== code) {
      await pool.query('UPDATE review_otp_codes SET attempts = attempts + 1 WHERE id = ?', [session.id]);
      return res.status(400).json({ success: false, error: 'Incorrect verification code.' });
    }

    await pool.query('UPDATE review_otp_codes SET verified_at = NOW() WHERE id = ?', [session.id]);

    const published = shouldPublish(scores.overall) ? 1 : 0;
    const id = randomUUID();
    await pool.query(
      `INSERT INTO public_reviews
        (id, reviewer_name, country, phone, professionalism, time_score, quality, after_sales, overall, comment, is_published, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')`,
      [
        id,
        name,
        country,
        phone,
        scores.professionalism,
        scores.time_score,
        scores.quality,
        scores.after_sales,
        scores.overall,
        comment,
        published,
      ]
    );

    res.json({
      success: true,
      published: Boolean(published),
      overall: scores.overall,
      message: published
        ? 'Thank you. Your review is now live.'
        : 'Thank you. Reviews below 4 stars are held for the team and are not published.',
    });
  } catch (err) {
    console.error('[reviews/create]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin', requireAuth, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM public_reviews ORDER BY created_at DESC');
    res.json({ success: true, data: rows.map(adminShape) });
  } catch (err) {
    console.error('[reviews/admin]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const body = req.body || {};
    const name = String(body.reviewer_name || '').trim();
    const country = String(body.country || '').trim();
    const phone = normalizeReviewPhone(body.phone) || String(body.phone || '').trim() || 'admin';
    const comment = String(body.comment || '').trim();
    const scores = readScores(body);
    if (name.length < 2) return res.status(400).json({ success: false, error: 'Name is required.' });
    if (!country) return res.status(400).json({ success: false, error: 'Country is required.' });
    if (comment.length < 8) return res.status(400).json({ success: false, error: 'Write a short review.' });
    if (!scores) return res.status(400).json({ success: false, error: 'All four ratings are required.' });

    const published = body.is_published === false || body.is_published === 0
      ? 0
      : 1;
    const id = randomUUID();
    const pool = getPool();
    await pool.query(
      `INSERT INTO public_reviews
        (id, reviewer_name, country, phone, professionalism, time_score, quality, after_sales, overall, comment, is_published, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')`,
      [
        id,
        name,
        country,
        phone,
        scores.professionalism,
        scores.time_score,
        scores.quality,
        scores.after_sales,
        scores.overall,
        comment,
        published,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM public_reviews WHERE id = ? LIMIT 1', [id]);
    res.json({ success: true, data: adminShape(rows[0]) });
  } catch (err) {
    console.error('[reviews/admin-create]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const id = String(req.params.id || '');
    const published = req.body?.is_published ? 1 : 0;
    const pool = getPool();
    const [result] = await pool.query(
      'UPDATE public_reviews SET is_published = ? WHERE id = ?',
      [published, id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Review not found.' });
    const [rows] = await pool.query('SELECT * FROM public_reviews WHERE id = ? LIMIT 1', [id]);
    res.json({ success: true, data: adminShape(rows[0]) });
  } catch (err) {
    console.error('[reviews/patch]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM public_reviews WHERE id = ?', [String(req.params.id || '')]);
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Review not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[reviews/delete]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
