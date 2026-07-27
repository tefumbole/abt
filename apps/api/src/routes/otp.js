import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOtp, formatPhoneNumber, isWasenderConfigured } from '../services/wasenderWhatsAppService.js';

const router = Router();
const RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS || 45_000);

async function getUserPhone(userId) {
  const pool = getPool();
  const [profiles] = await pool.query(
    'SELECT phone FROM profiles WHERE id = ? LIMIT 1',
    [userId]
  );
  const [users] = await pool.query(
    'SELECT phone FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const raw = profiles[0]?.phone || users[0]?.phone || null;
  const formatted = formatPhoneNumber(raw);
  if (!formatted) {
    throw new Error('No valid phone number on your profile.');
  }
  return formatted;
}

async function logWhatsAppAttempt(pool, { phone, content, status, errorMessage = null }) {
  try {
    await pool.query(
      `INSERT INTO whatsapp_message_logs
        (id, recipient_phone, message_content, status, error_message, sent_at)
       VALUES (?, ?, ?, ?, ?, ${status === 'sent' ? 'NOW()' : 'NULL'})`,
      [randomUUID(), phone, content, status, errorMessage]
    );
  } catch (err) {
    console.warn('[otp/send] log skipped:', err.message);
  }
}

router.post('/send', requireAuth, async (req, res) => {
  try {
    if (!isWasenderConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp OTP is not configured on the server (WASENDER_API_KEY missing).',
      });
    }

    const userId = req.user.sub;
    const phone = await getUserPhone(userId);
    const pool = getPool();

    const [recent] = await pool.query(
      `SELECT created_at FROM otp_sessions
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
          maskedPhone: `${phone.substring(0, 6)}****${phone.slice(-2)}`,
        });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate any previous unused codes for this phone
    await pool.query(
      `UPDATE otp_sessions
       SET expires_at = NOW()
       WHERE phone = ? AND verified_at IS NULL AND expires_at >= NOW()`,
      [phone]
    );

    await pool.query(
      `INSERT INTO otp_sessions (id, phone, otp, expires_at, attempts, resend_count)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [randomUUID(), phone, otpCode, expiresAt]
    );

    const sendResult = await sendOtp(phone, otpCode, 'Alpha Bridge login verification');
    if (!sendResult.success) {
      console.error('[otp/send]', sendResult.error);
      await logWhatsAppAttempt(pool, {
        phone,
        content: 'OTP login code',
        status: 'failed',
        errorMessage: sendResult.error || 'Failed to send WhatsApp OTP',
      });
      return res.status(502).json({
        success: false,
        error: sendResult.error || 'Failed to send WhatsApp OTP. Check WhatsApp session on Wasender.',
        maskedPhone: `${phone.substring(0, 6)}****${phone.slice(-2)}`,
      });
    }

    await logWhatsAppAttempt(pool, {
      phone,
      content: 'OTP login code',
      status: 'sent',
    });

    console.log(`[otp/send] WhatsApp OTP accepted for ${phone} msgId=${sendResult.messageSid || 'n/a'}`);

    res.json({
      success: true,
      message: 'OTP sent via WhatsApp. Open WhatsApp (not SMS) to read the code.',
      maskedPhone: `${phone.substring(0, 6)}****${phone.slice(-2)}`,
      channel: 'whatsapp',
      resendAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    });
  } catch (err) {
    console.error('[otp/send]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { otp } = req.body || {};
    if (!otp || String(otp).replace(/\D/g, '').length !== 6) {
      return res.status(400).json({ success: false, error: 'Valid 6-digit OTP required' });
    }

    const cleanOtp = String(otp).replace(/\D/g, '');
    const phone = await getUserPhone(userId);
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT * FROM otp_sessions
       WHERE phone = ? AND verified_at IS NULL AND expires_at >= NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );
    const session = rows[0];

    if (!session) {
      return res.json({ success: false, error: 'Invalid or expired OTP.' });
    }

    if (Number(session.attempts || 0) >= 5) {
      return res.json({ success: false, error: 'Too many attempts. Request a new code.' });
    }

    if (session.otp !== cleanOtp) {
      await pool.query(
        'UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = ?',
        [session.id]
      );
      return res.json({ success: false, error: 'Incorrect verification code.' });
    }

    await pool.query(
      'UPDATE otp_sessions SET verified_at = NOW() WHERE id = ?',
      [session.id]
    );

    let [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId]);
    if (!profiles[0]) {
      const [users] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      const u = users[0];
      if (u) {
        await pool.query(
          `INSERT INTO profiles (id, email, full_name, phone, role)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE email = VALUES(email), role = VALUES(role)`,
          [u.id, u.email, u.name, u.phone, u.role]
        );
        [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId]);
      }
    }

    res.json({
      success: true,
      message: 'OTP verified.',
      profile: profiles[0] || null,
    });
  } catch (err) {
    console.error('[otp/verify]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
