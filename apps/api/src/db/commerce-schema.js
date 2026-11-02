/**
 * Additive commerce tables for POS, products, and PawaPay (Rwanda) payments.
 * Uses Alpha's existing UUID products / sales / erp_* lookups.
 * campay_* table names are historical storage only — the live provider is PawaPay.
 */
import { randomUUID } from 'node:crypto';

export const COMMERCE_SCHEMA_PATCHES = [
  'ALTER TABLE products ADD COLUMN type VARCHAR(32) DEFAULT NULL',
  'ALTER TABLE products ADD COLUMN qty DECIMAL(15,3) NOT NULL DEFAULT 0',
  'ALTER TABLE products ADD COLUMN barcode_symbology VARCHAR(20) DEFAULT \'C128\'',
  'ALTER TABLE products ADD COLUMN product_details LONGTEXT NULL',
  'ALTER TABLE products ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE products ADD COLUMN product_list TEXT NULL',
  'ALTER TABLE products ADD COLUMN qty_list TEXT NULL',
  'ALTER TABLE products ADD COLUMN price_list TEXT NULL',
  'ALTER TABLE products ADD COLUMN promotion TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE products ADD COLUMN promotion_price DECIMAL(15,2) NULL',
  'ALTER TABLE products ADD COLUMN starting_date DATE NULL',
  'ALTER TABLE products ADD COLUMN last_date DATE NULL',
  'ALTER TABLE products ADD COLUMN is_batch TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE products ADD COLUMN is_variant TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE products ADD COLUMN file VARCHAR(255) NULL',
  'ALTER TABLE products ADD COLUMN image VARCHAR(1024) NULL',
  'ALTER TABLE products ADD COLUMN vendor_id CHAR(36) NULL',
  'ALTER TABLE sales ADD COLUMN paid_by_id VARCHAR(20) NULL',
  'ALTER TABLE sales ADD COLUMN customer_phone VARCHAR(50) NULL',
  'ALTER TABLE sales ADD COLUMN customer_name VARCHAR(255) NULL',
  'ALTER TABLE sales ADD COLUMN campay_reference VARCHAR(64) NULL',
  'ALTER TABLE sales ADD COLUMN pawapay_deposit_id VARCHAR(64) NULL',
  'ALTER TABLE deposits ADD COLUMN pawapay_deposit_id VARCHAR(64) NULL',
  'ALTER TABLE product_sales ADD COLUMN warehouse_id CHAR(36) NULL',
];

export const COMMERCE_CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS deposits (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    customer_id CHAR(36) DEFAULT NULL,
    customer_name VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    account_id CHAR(36) DEFAULT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_received DECIMAL(15,2) DEFAULT NULL,
    charges DECIMAL(15,2) NOT NULL DEFAULT 0,
    payment_method TINYINT NOT NULL DEFAULT 3,
    status TINYINT NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    campay_reference VARCHAR(64) DEFAULT NULL,
    pawapay_deposit_id VARCHAR(64) DEFAULT NULL,
    payment_link TEXT DEFAULT NULL,
    failure_reason TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_deposits_method (payment_method, status),
    INDEX idx_deposits_ref (campay_reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS campay_payout_requests (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    requester_name VARCHAR(255) DEFAULT NULL,
    requester_phone VARCHAR(50) DEFAULT NULL,
    note VARCHAR(500) DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payout_requests_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS campay_payouts (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    request_id CHAR(36) DEFAULT NULL,
    user_id CHAR(36) DEFAULT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    person_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    amount INT NOT NULL,
    momo_name VARCHAR(255) DEFAULT NULL,
    momo_checked TINYINT(1) NOT NULL DEFAULT 0,
    external_reference VARCHAR(64) NOT NULL,
    campay_reference VARCHAR(64) DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    note VARCHAR(500) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payout_ext (external_reference),
    INDEX idx_payouts_request (request_id),
    INDEX idx_payouts_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS public_donations (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    token VARCHAR(64) NOT NULL,
    person_name VARCHAR(191) NOT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    amount INT NOT NULL,
    note VARCHAR(191) DEFAULT NULL,
    method VARCHAR(20) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    campay_reference VARCHAR(64) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_public_donation_token (token),
    INDEX idx_public_donations_ref (campay_reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pawapay_deposits (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    deposit_id VARCHAR(64) NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    purpose_id CHAR(36) NOT NULL,
    extra_ids TEXT DEFAULT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'RWF',
    phone VARCHAR(32) DEFAULT NULL,
    provider VARCHAR(64) DEFAULT NULL,
    paying_method VARCHAR(64) DEFAULT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    raw_status VARCHAR(64) DEFAULT NULL,
    redirect_url VARCHAR(500) DEFAULT NULL,
    applied_at DATETIME DEFAULT NULL,
    user_id CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pawapay_deposit_id (deposit_id),
    INDEX idx_pawapay_purpose (purpose, purpose_id),
    INDEX idx_pawapay_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_variants (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    product_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    item_code VARCHAR(100) DEFAULT NULL,
    additional_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product_variants_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function seedCommerceDefaults(pool) {
  const defaults = [
    ['erp_units', { name: 'Donation', code: 'donation' }],
    ['erp_units', { name: 'Service', code: 'service' }],
    ['erp_categories', { name: 'donation' }],
    ['erp_categories', { name: 'SERVICES' }],
  ];

  for (const [table, row] of defaults) {
    const key = table === 'erp_units' ? 'code' : 'name';
    const value = table === 'erp_units' ? row.code : row.name;
    const [found] = await pool.query(`SELECT id FROM \`${table}\` WHERE \`${key}\` = ? LIMIT 1`, [value]);
    if (found.length) continue;
    await pool.query(
      `INSERT INTO \`${table}\` (id, name, ${table === 'erp_units' ? 'code, ' : ''}is_active, created_at, updated_at)
       VALUES (?, ?, ${table === 'erp_units' ? '?, ' : ''}1, NOW(), NOW())`,
      table === 'erp_units' ? [randomUUID(), row.name, row.code] : [randomUUID(), row.name]
    );
    console.log('Seeded commerce default:', table, value);
  }

  await pool.query(`
    UPDATE products
    SET type = COALESCE(NULLIF(type, ''), product_type),
        featured = COALESCE(featured, is_featured, 0),
        image = COALESCE(NULLIF(image, ''), image_url)
    WHERE type IS NULL OR image IS NULL OR featured IS NULL
  `).catch(() => {});
}
