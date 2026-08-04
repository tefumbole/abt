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

  const [currencies] = await pool.query(`SELECT id FROM erp_currencies LIMIT 1`);
  if (!currencies.length) {
    let defaultCode = 'XAF';
    try {
      const [sys] = await pool.query(`SELECT currency FROM system_settings LIMIT 1`);
      if (sys[0]?.currency) defaultCode = String(sys[0].currency).toUpperCase();
    } catch {
      /* ignore */
    }
    const defaults = [
      { name: 'Central African CFA franc', code: 'XAF', symbol: 'FCFA', rate: 1, isDefault: defaultCode === 'XAF' },
      { name: 'US Dollar', code: 'USD', symbol: '$', rate: 1, isDefault: defaultCode === 'USD' },
      { name: 'Euro', code: 'EUR', symbol: '€', rate: 1, isDefault: defaultCode === 'EUR' },
    ];
    if (!defaults.some((d) => d.isDefault)) defaults[0].isDefault = true;
    for (const d of defaults) {
      await pool.query(
        `INSERT INTO erp_currencies (id, name, code, symbol, exchange_rate, is_active, is_default)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [randomUUID(), d.name, d.code, d.symbol, d.rate, d.isDefault ? 1 : 0]
      );
    }
    const def = defaults.find((d) => d.isDefault);
    if (def) {
      await pool.query(`UPDATE system_settings SET currency = ? WHERE id IS NOT NULL`, [def.code]).catch(() => {});
    }
    console.log('Seeded default ERP currencies');
  }
}
