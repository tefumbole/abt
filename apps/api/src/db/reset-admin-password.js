import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const email = process.env.SEED_ADMIN_EMAIL || 'admin@alpha-bridge.net';
const password = process.env.SEED_ADMIN_PASSWORD || 'system';

const pool = getPool();

try {
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'UPDATE users SET password_hash = ?, status = ? WHERE LOWER(email) = LOWER(?)',
    [hash, 'active', email]
  );

  if (result.affectedRows === 0) {
    console.error(`No user found for ${email}. Run npm run db:migrate first.`);
    process.exit(1);
  }

  await pool.query(
    `INSERT INTO profiles (id, email, full_name, role, status)
     SELECT id, email, name, role, 'active' FROM users WHERE LOWER(email) = LOWER(?)
     ON DUPLICATE KEY UPDATE role = VALUES(role), status = 'active'`,
    [email]
  );

  console.log(`Admin password reset for ${email}`);
  console.log(`Use password: ${password}`);
} finally {
  await pool.end();
}
