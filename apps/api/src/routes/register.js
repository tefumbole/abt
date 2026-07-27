import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { sendOtp, formatPhoneNumber } from '../services/wasenderWhatsAppService.js';
import { syncProfile } from './users.js';

const router = Router();

router.post('/request', async (req, res) => {
  try {
    const { email, password, full_name, phone, role, inviteToken, signupType } = req.body || {};
    if (!email || !password || !full_name || !phone) {
      return res.status(400).json({ success: false, error: 'Email, password, full name, and phone are required.' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return res.status(400).json({ success: false, error: 'Invalid phone number.' });
    }

    const pool = getPool();
    const isCustomerSignup = signupType === 'customer' || role === 'customer';
    let assignedRole = role || 'user';

    if (inviteToken) {
      const [invites] = await pool.query(
        'SELECT id FROM task_assignments WHERE invite_token = ? LIMIT 1',
        [inviteToken]
      );
      if (!invites.length) {
        return res.status(400).json({ success: false, error: 'Invalid task invite link.' });
      }
      assignedRole = 'task_assignee';
    } else if (isCustomerSignup) {
      assignedRole = 'customer';
    }

    const [existingByPhone] = await pool.query(
      'SELECT id, email, role FROM users WHERE phone = ? LIMIT 1',
      [formattedPhone]
    );
    const [existingByEmail] = await pool.query(
      'SELECT id, email, role, phone FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );

    const existingPhone = existingByPhone[0] || null;
    const existingEmail = existingByEmail[0] || null;

    // Task-invite or public customer signup: allow replacing an existing record with the same phone.
    const allowReplace = Boolean((inviteToken || isCustomerSignup) && existingPhone);

    if (existingEmail && existingEmail.phone !== formattedPhone && !allowReplace) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists. Please sign in instead.' });
    }
    if (existingPhone && !allowReplace) {
      return res.status(409).json({ success: false, error: 'An account with this phone already exists. Please sign in instead.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const pendingId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query('DELETE FROM pending_registrations WHERE LOWER(email) = LOWER(?) OR phone = ?', [
      email.trim(),
      formattedPhone,
    ]);

    await pool.query(
      `INSERT INTO pending_registrations (id, email, password_hash, full_name, phone, role, otp, expires_at, invite_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pendingId,
        email.trim(),
        passwordHash,
        full_name.trim(),
        formattedPhone,
        assignedRole,
        otpCode,
        expiresAt,
        inviteToken || null,
      ]
    );

    const otpPurpose = isCustomerSignup
      ? 'register'
      : inviteToken
        ? 'verify'
        : 'register';
    const sendResult = await sendOtp(formattedPhone, otpCode, otpPurpose);
    if (!sendResult.success) {
      return res.status(502).json({ success: false, error: sendResult.error || 'Failed to send WhatsApp OTP' });
    }

    res.json({
      success: true,
      message: 'OTP sent to your WhatsApp number.',
      pendingId,
      maskedPhone: `${formattedPhone.substring(0, 6)}****${formattedPhone.slice(-2)}`,
    });
  } catch (err) {
    console.error('[register/request]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { pendingId, otp } = req.body || {};
    const cleanOtp = String(otp || '').replace(/\D/g, '');
    if (!pendingId || cleanOtp.length !== 6) {
      return res.status(400).json({ success: false, error: 'Pending registration ID and 6-digit OTP required.' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM pending_registrations WHERE id = ? AND expires_at >= NOW() LIMIT 1',
      [pendingId]
    );
    const pending = rows[0];
    if (!pending) {
      return res.status(400).json({ success: false, error: 'Registration expired. Please start again.' });
    }
    if (pending.otp !== cleanOtp) {
      return res.status(400).json({ success: false, error: 'Incorrect verification code.' });
    }

    const PRESERVE_ROLES = ['super_admin', 'admin', 'director', 'manager', 'staff', 'employee', 'teacher'];
    const [existingRows] = await pool.query(
      'SELECT id, email, role FROM users WHERE phone = ? LIMIT 1',
      [pending.phone]
    );
    const existing = existingRows[0] || null;

    let userId;
    let finalRole = pending.role;

    if (existing) {
      userId = existing.id;
      if (PRESERVE_ROLES.includes(String(existing.role || '').toLowerCase())) {
        finalRole = existing.role;
      } else if (String(existing.role || '').toLowerCase() === 'customer') {
        finalRole = 'customer';
      }

      await pool.query(
        `UPDATE users SET email = ?, password_hash = ?, name = ?, role = ?, status = 'active', phone = ? WHERE id = ?`,
        [pending.email, pending.password_hash, pending.full_name, finalRole, pending.phone, userId]
      );
    } else {
      userId = randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, password_hash, name, role, status, phone)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
        [userId, pending.email, pending.password_hash, pending.full_name, pending.role, pending.phone]
      );
      finalRole = pending.role;
    }

    const userRow = {
      id: userId,
      email: pending.email,
      full_name: pending.full_name,
      name: pending.full_name,
      phone: pending.phone,
      role: finalRole,
      status: 'active',
    };
    await syncProfile(pool, userRow);

    if (pending.invite_token) {
      await pool.query(
        'UPDATE task_assignments SET user_id = ? WHERE invite_token = ?',
        [userId, pending.invite_token]
      );
    }

    await pool.query('DELETE FROM pending_registrations WHERE id = ?', [pendingId]);

    res.json({
      success: true,
      message: 'Account created successfully. You can now log in.',
      user: { id: userId, email: pending.email, role: finalRole },
      inviteToken: pending.invite_token || null,
    });
  } catch (err) {
    console.error('[register/verify]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
