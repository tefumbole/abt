import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOtp, formatPhoneNumber } from '../services/wasenderWhatsAppService.js';
import { syncProfile } from './users.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();
const JWT_EXPIRY = '7d';

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

function buildSession(user, profile) {
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: profile?.role || user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return {
    access_token: token,
    refresh_token: token,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      phone: profile?.phone || user.phone || null,
      role: profile?.role || user.role,
      user_metadata: { full_name: profile?.full_name || user.name },
      app_metadata: { role: profile?.role || user.role },
    },
  };
}

async function findUserByLoginIdentifier(pool, identifier) {
  const id = String(identifier || '').trim();
  if (!id) return null;

  const [byEmail] = await pool.query(
    `SELECT * FROM users
     WHERE status = 'active'
       AND (LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?))
     LIMIT 1`,
    [id, id]
  );
  return byEmail[0] || null;
}

async function findUserByPhone(pool, phone) {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return null;

  const digits = formatted.replace(/\D/g, '');
  const [rows] = await pool.query(
    `SELECT u.* FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.status = 'active'
       AND (
         REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '+', ''), ' ', ''), '-', ''), '(', '') = ?
         OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(p.phone, ''), '+', ''), ' ', ''), '-', ''), '(', '') = ?
         OR u.phone = ?
         OR p.phone = ?
       )
     LIMIT 1`,
    [digits, digits, formatted, formatted]
  );
  return rows[0] || null;
}

router.post('/login', async (req, res) => {
  try {
    const { email, identifier, password } = req.body || {};
    const loginId = (identifier || email || '').trim();
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Email/username and password required' });
    }

    const pool = getPool();
    const user = await findUserByLoginIdentifier(pool, loginId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [user.id]);
    const profile = profiles[0] || null;
    const session = buildSession(user, profile);

    logActivity({
      req,
      userId: user.id,
      userName: user.name || user.email || user.username,
      userRole: user.role,
      action: 'login',
      entity: 'auth',
      entityId: user.id,
      summary: `${user.name || user.email || 'User'} signed in`,
    });

    res.json({ session, user: session.user });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Self-service first-login profile completion for task guests:
 * update username, password, email and address; clears the forced-change flag.
 */
router.patch('/complete-profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { username, password, email, address, full_name } = req.body || {};
    const pool = getPool();

    const updates = [];
    const params = [];

    if (username !== undefined && username !== null && String(username).trim() !== '') {
      const norm = normalizeUsername(username);
      if (norm.length < 3) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters.' });
      }
      const [dup] = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1',
        [norm, userId]
      );
      if (dup.length) {
        return res.status(409).json({ success: false, error: 'Username is already taken.' });
      }
      updates.push('username = ?');
      params.push(norm);
    }

    if (email !== undefined && email !== null && String(email).trim() !== '') {
      const cleanEmail = String(email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
      }
      const [dupEmail] = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1',
        [cleanEmail, userId]
      );
      if (dupEmail.length) {
        return res.status(409).json({ success: false, error: 'This email is already in use.' });
      }
      updates.push('email = ?');
      params.push(cleanEmail);
    }

    if (full_name !== undefined && String(full_name).trim() !== '') {
      updates.push('name = ?');
      params.push(String(full_name).trim());
    }

    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address ? String(address).trim() : null);
    }

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      }
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(String(password), 10));
    }

    updates.push('must_change_credentials = 0');

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...params, userId]);

    const [users] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const user = users[0];
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await syncProfile(pool, { ...user, full_name: user.name, must_change_credentials: 0 });

    const [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId]);
    const session = buildSession(user, profiles[0] || null);
    res.json({ success: true, session, user: session.user });
  } catch (err) {
    console.error('[auth/complete-profile]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/password-reset/request', async (req, res) => {
  try {
    const { phone } = req.body || {};
    const formatted = formatPhoneNumber(phone);
    if (!formatted) {
      return res.status(400).json({ success: false, error: 'Enter a valid phone number linked to your account.' });
    }

    const pool = getPool();
    const user = await findUserByPhone(pool, formatted);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this phone number.',
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO otp_sessions (id, phone, otp, expires_at, attempts, resend_count, purpose)
       VALUES (?, ?, ?, ?, 0, 0, 'password_reset')`,
      [randomUUID(), formatted, otpCode, expiresAt]
    );

    const sendResult = await sendOtp(formatted, otpCode, 'password_reset');
    if (!sendResult.success) {
      return res.status(502).json({
        success: false,
        error: sendResult.error || 'Failed to send WhatsApp OTP',
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to your WhatsApp.',
      maskedPhone: `${formatted.substring(0, 6)}****${formatted.slice(-2)}`,
    });
  } catch (err) {
    console.error('[auth/password-reset/request]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body || {};
    const formatted = formatPhoneNumber(phone);
    const cleanOtp = String(otp || '').replace(/\D/g, '');

    if (!formatted || cleanOtp.length !== 6) {
      return res.status(400).json({ success: false, error: 'Valid phone and 6-digit OTP required' });
    }
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM otp_sessions
       WHERE phone = ? AND purpose = 'password_reset' AND verified_at IS NULL AND expires_at >= NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [formatted]
    );
    const session = rows[0];

    if (!session || session.otp !== cleanOtp) {
      if (session) {
        await pool.query('UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = ?', [session.id]);
      }
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    const user = await findUserByPhone(pool, formatted);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Account not found for this phone number.' });
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    await pool.query('UPDATE otp_sessions SET verified_at = NOW() WHERE id = ?', [session.id]);

    res.json({ success: true, message: 'Password updated. You can now sign in.' });
  } catch (err) {
    console.error('[auth/password-reset/confirm]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/session', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [user.id]);
    const session = buildSession(user, profiles[0] || null);
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const [profiles] = await pool.query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [user.id]);
    const session = buildSession(user, profiles[0] || null);
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const username = normalizeUsername(process.env.SEED_ADMIN_USERNAME || 'admin');
  const phone = process.env.SEED_ADMIN_PHONE || null;
  const forcePassword = process.env.SEED_ADMIN_FORCE_PASSWORD === 'true'
    || process.env.NODE_ENV === 'development';
  if (!email || !password) return;

  const pool = getPool();
  const [existing] = await pool.query(
    `SELECT id FROM users
     WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)
     LIMIT 1`,
    [email, username]
  );

  if (existing.length) {
    const userId = existing[0].id;
    const updates = ['username = ?', 'email = ?', "role = 'super_admin'", "status = 'active'"];
    const params = [username, email];

    if (forcePassword) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (phone) {
      updates.push('phone = ?');
      params.push(phone);
    }
    params.push(userId);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    await pool.query(
      `INSERT INTO profiles (id, email, username, full_name, role, phone)
       VALUES (?, ?, ?, 'Super Administrator', 'super_admin', ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         username = VALUES(username),
         role = 'super_admin',
         phone = COALESCE(VALUES(phone), phone)`,
      [userId, email, username, phone]
    );
    console.log(
      '[seed] Admin synced:',
      username,
      `(${email})`,
      forcePassword ? '[password refreshed]' : '[password unchanged]'
    );
    return;
  }

  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (id, email, username, password_hash, name, role, status, phone)
     VALUES (?, ?, ?, ?, ?, 'super_admin', 'active', ?)`,
    [id, email, username, hash, 'Super Administrator', phone]
  );

  await pool.query(
    `INSERT INTO profiles (id, email, username, full_name, role, phone)
     VALUES (?, ?, ?, ?, 'super_admin', ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), username = VALUES(username), role = 'super_admin', phone = COALESCE(VALUES(phone), phone)`,
    [id, email, username, 'Super Administrator', phone]
  );

  console.log('[seed] Admin user created:', username, `(${email})`);
}

export default router;
