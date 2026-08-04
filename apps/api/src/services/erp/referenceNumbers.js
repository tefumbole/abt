import { getPool } from '../../db/pool.js';

/**
 * Beyond-style reference generators: posr-, qr-, dr-, pr-, tr-, etc.
 */
export async function nextErpReference(prefix, table, column = 'reference') {
  const pool = getPool();
  const like = `${prefix}%`;
  const [rows] = await pool.query(
    `SELECT ${column} AS ref FROM ${table} WHERE ${column} LIKE ? LIMIT 200`,
    [like]
  );
  let max = 0;
  for (const row of rows) {
    const m = String(row.ref || '').match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(5, '0')}`;
}
