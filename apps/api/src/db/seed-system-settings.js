import { randomUUID } from 'node:crypto';

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS system_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  developed_by TEXT DEFAULT NULL,
  copyright_text TEXT DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  logo_file_path VARCHAR(255) DEFAULT NULL,
  price_per_share DECIMAL(12,2) DEFAULT NULL,
  total_shares_available INT DEFAULT NULL,
  total_sold_admin_override INT DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function seedSystemSettings(pool) {
  const [cols] = await pool.query('SHOW COLUMNS FROM system_settings');
  const colNames = cols.map((c) => c.Field);
  const hasShareColumns = colNames.includes('price_per_share');

  if (!hasShareColumns) {
    const [countRows] = await pool.query('SELECT COUNT(*) AS c FROM system_settings');
    if (countRows[0].c > 0) {
      console.warn('system_settings: legacy schema with data — skipping auto-migrate');
      return;
    }
    console.log('system_settings: upgrading empty legacy table to current schema');
    await pool.query('DROP TABLE system_settings');
    await pool.query(CREATE_SQL);
  }

  const [rows] = await pool.query('SELECT id FROM system_settings LIMIT 1');
  if (rows.length) {
    console.log('system_settings: already seeded');
    return;
  }

  await pool.query(
    `INSERT INTO system_settings (
      id, developed_by, copyright_text, price_per_share,
      total_shares_available, total_sold_admin_override, currency
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      'Alpha Bridge Technologies',
      '© Alpha Bridge Technologies',
      1000,
      100,
      0,
      'USD',
    ]
  );
  console.log('system_settings: default row created');
}
