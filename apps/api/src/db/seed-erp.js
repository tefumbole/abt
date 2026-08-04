import { randomUUID } from 'node:crypto';

/** Seed default warehouse + unit if missing. */
export async function seedErp(pool) {
  const [wh] = await pool.query(`SELECT id FROM warehouses WHERE is_default = 1 LIMIT 1`);
  if (!wh.length) {
    const [any] = await pool.query(`SELECT id FROM warehouses LIMIT 1`);
    if (any.length) {
      await pool.query(`UPDATE warehouses SET is_default = 1 WHERE id = ?`, [any[0].id]);
    } else {
      await pool.query(
        `INSERT INTO warehouses (id, name, phone, email, address, is_active, is_default)
         VALUES (?, 'Alpha Bridge', NULL, NULL, 'Head Office', 1, 1)`,
        [randomUUID()]
      );
      console.log('Seeded default warehouse: Alpha Bridge');
    }
  }

  const [units] = await pool.query(`SELECT id FROM erp_units LIMIT 1`);
  if (!units.length) {
    for (const [name, code] of [['Piece', 'pc'], ['Box', 'box'], ['Kg', 'kg']]) {
      await pool.query(
        `INSERT INTO erp_units (id, name, code, is_active) VALUES (?, ?, ?, 1)`,
        [randomUUID(), name, code]
      );
    }
    console.log('Seeded default ERP units');
  }

  const [accounts] = await pool.query(`SELECT id FROM erp_accounts LIMIT 1`);
  if (!accounts.length) {
    await pool.query(
      `INSERT INTO erp_accounts (id, name, account_no, balance, is_active) VALUES (?, 'Cash', 'CASH-001', 0, 1)`,
      [randomUUID()]
    );
    console.log('Seeded default ERP cash account');
  }
}
