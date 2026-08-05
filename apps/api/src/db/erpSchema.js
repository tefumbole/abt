/**
 * ERP module tables (Beyond Tech port). Isolated from HR/tasks/events/shareholders.
 * Applied via CREATE_STATEMENTS in patch-schema.js and schema.sql.
 */

export const ERP_CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS warehouses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_warehouses_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id CHAR(36) DEFAULT NULL,
    image_url VARCHAR(1024) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_erp_categories_parent (parent_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_brands (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image_url VARCHAR(1024) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_units (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(32) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_erp_units_default (is_default)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_currencies (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(16) NOT NULL,
    symbol VARCHAR(16) DEFAULT NULL,
    exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_erp_currencies_code (code),
    INDEX idx_erp_currencies_default (is_default)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) DEFAULT NULL,
    barcode VARCHAR(100) DEFAULT NULL,
    category_id CHAR(36) DEFAULT NULL,
    brand_id CHAR(36) DEFAULT NULL,
    unit_id CHAR(36) DEFAULT NULL,
    sale_unit_id CHAR(36) DEFAULT NULL,
    purchase_unit_id CHAR(36) DEFAULT NULL,
    cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    rent_price_hour DECIMAL(15,2) NOT NULL DEFAULT 0,
    rent_price_day DECIMAL(15,2) NOT NULL DEFAULT 0,
    rent_price_month DECIMAL(15,2) NOT NULL DEFAULT 0,
    alert_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    tax_id CHAR(36) DEFAULT NULL,
    tax_method VARCHAR(16) NOT NULL DEFAULT 'exclusive',
    product_location VARCHAR(255) DEFAULT NULL,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    has_warehouse_price TINYINT(1) NOT NULL DEFAULT 0,
    image_url VARCHAR(1024) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    product_type VARCHAR(32) NOT NULL DEFAULT 'standard',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_products_code (code),
    INDEX idx_products_category (category_id),
    INDEX idx_products_barcode (barcode)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS product_warehouse (
    id CHAR(36) NOT NULL PRIMARY KEY,
    product_id CHAR(36) NOT NULL,
    warehouse_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    price DECIMAL(15,2) DEFAULT NULL,
    cost DECIMAL(15,2) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_warehouse (product_id, warehouse_id),
    INDEX idx_pw_warehouse (warehouse_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS stock_adjustments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    warehouse_id CHAR(36) NOT NULL,
    note TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_adj_ref (reference),
    INDEX idx_adj_warehouse (warehouse_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    adjustment_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    INDEX idx_adj_items_adj (adjustment_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_customer_groups (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    percentage DECIMAL(8,2) NOT NULL DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_erp_customer_groups_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_customers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) DEFAULT NULL,
    customer_group_id CHAR(36) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    company_name VARCHAR(255) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_erp_customers_phone (phone),
    INDEX idx_erp_customers_user (user_id),
    INDEX idx_erp_customers_group (customer_group_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_suppliers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    company_name VARCHAR(255) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_billers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    company_name VARCHAR(255) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    warehouse_id CHAR(36) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS purchases (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    warehouse_id CHAR(36) NOT NULL,
    supplier_id CHAR(36) DEFAULT NULL,
    biller_id CHAR(36) DEFAULT NULL,
    purchase_status VARCHAR(32) NOT NULL DEFAULT 'received',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    purchase_date DATE NOT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_purchases_ref (reference),
    INDEX idx_purchases_date (purchase_date),
    INDEX idx_purchases_warehouse (warehouse_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS product_purchases (
    id CHAR(36) NOT NULL PRIMARY KEY,
    purchase_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    net_unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    INDEX idx_pp_purchase (purchase_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS sales (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    warehouse_id CHAR(36) NOT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    biller_id CHAR(36) DEFAULT NULL,
    sale_status VARCHAR(32) NOT NULL DEFAULT 'completed',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    shipping DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    is_pos TINYINT(1) NOT NULL DEFAULT 0,
    sale_date DATETIME NOT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sales_ref (reference),
    INDEX idx_sales_date (sale_date),
    INDEX idx_sales_warehouse (warehouse_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS product_sales (
    id CHAR(36) NOT NULL PRIMARY KEY,
    sale_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    net_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    INDEX idx_ps_sale (sale_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS quotations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    warehouse_id CHAR(36) NOT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    biller_id CHAR(36) DEFAULT NULL,
    supplier_id CHAR(36) DEFAULT NULL,
    status VARCHAR(48) NOT NULL DEFAULT 'draft',
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    shipping DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    note LONGTEXT DEFAULT NULL,
    client_comment TEXT DEFAULT NULL,
    approval_token CHAR(64) DEFAULT NULL,
    cc_phones TEXT DEFAULT NULL,
    sale_id CHAR(36) DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_quotations_ref (reference),
    UNIQUE KEY uq_quotations_token (approval_token),
    INDEX idx_quotations_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS product_quotations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    quotation_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    net_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    INDEX idx_pq_quotation (quotation_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS deliveries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    sale_id CHAR(36) NOT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'packing',
    signature_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    signature_token CHAR(64) DEFAULT NULL,
    signature_data LONGTEXT DEFAULT NULL,
    signed_at DATETIME DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_deliveries_ref (reference),
    UNIQUE KEY uq_deliveries_token (signature_token),
    INDEX idx_deliveries_sale (sale_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS cash_registers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    warehouse_id CHAR(36) NOT NULL,
    user_id CHAR(36) DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    cash_in_hand DECIMAL(15,2) NOT NULL DEFAULT 0,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME DEFAULT NULL,
    INDEX idx_cr_warehouse (warehouse_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS pos_settings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    warehouse_id CHAR(36) DEFAULT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    biller_id CHAR(36) DEFAULT NULL,
    settings_json LONGTEXT DEFAULT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS stock_transfers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    from_warehouse_id CHAR(36) NOT NULL,
    to_warehouse_id CHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    note TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_transfers_ref (reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS product_transfers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    transfer_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    INDEX idx_pt_transfer (transfer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS sale_returns (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    sale_id CHAR(36) DEFAULT NULL,
    warehouse_id CHAR(36) NOT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sale_returns_ref (reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS sale_return_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    return_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    net_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    INDEX idx_sri_return (return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS purchase_returns (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    purchase_id CHAR(36) DEFAULT NULL,
    warehouse_id CHAR(36) NOT NULL,
    supplier_id CHAR(36) DEFAULT NULL,
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_purchase_returns_ref (reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS purchase_return_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    return_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 0,
    net_unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    INDEX idx_pri_return (return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS expense_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    warehouse_id CHAR(36) DEFAULT NULL,
    category_id CHAR(36) DEFAULT NULL,
    account_id CHAR(36) DEFAULT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    expense_date DATE NOT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_expenses_ref (reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_payments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    payable_type VARCHAR(32) NOT NULL,
    payable_id CHAR(36) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paying_method VARCHAR(48) DEFAULT 'cash',
    note TEXT DEFAULT NULL,
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by CHAR(36) DEFAULT NULL,
    UNIQUE KEY uq_erp_payments_ref (reference),
    INDEX idx_erp_payments_payable (payable_type, payable_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_accounts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    account_no VARCHAR(100) DEFAULT NULL,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS money_transfers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    from_account_id CHAR(36) NOT NULL,
    to_account_id CHAR(36) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    note TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_money_transfers_ref (reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_bookings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    warehouse_id CHAR(36) NOT NULL,
    customer_id CHAR(36) DEFAULT NULL,
    biller_id CHAR(36) DEFAULT NULL,
    from_datetime DATETIME NOT NULL,
    to_datetime DATETIME NOT NULL,
    booking_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    contract_type VARCHAR(64) NOT NULL DEFAULT 'none',
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    note LONGTEXT DEFAULT NULL,
    staff_note TEXT DEFAULT NULL,
    signature_token CHAR(64) DEFAULT NULL,
    signature_status VARCHAR(32) NOT NULL DEFAULT 'none',
    signed_at DATETIME DEFAULT NULL,
    review_status VARCHAR(32) NOT NULL DEFAULT 'none',
    review_note TEXT DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    reviewed_by CHAR(36) DEFAULT NULL,
    reminder_sent_at DATETIME DEFAULT NULL,
    cc_recipients TEXT DEFAULT NULL,
    order_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    order_discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    shipping DECIMAL(15,2) NOT NULL DEFAULT 0,
    source VARCHAR(16) NOT NULL DEFAULT 'admin',
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bookings_ref (reference),
    UNIQUE KEY uq_bookings_token (signature_token)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_booking_products (
    id CHAR(36) NOT NULL PRIMARY KEY,
    booking_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    qty DECIMAL(15,3) NOT NULL DEFAULT 1,
    net_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    duration_hours DECIMAL(10,2) NOT NULL DEFAULT 1,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    from_datetime DATETIME DEFAULT NULL,
    to_datetime DATETIME DEFAULT NULL,
    batch_no VARCHAR(64) DEFAULT NULL,
    booking_method VARCHAR(32) NOT NULL DEFAULT 'daily',
    \`number\` VARCHAR(64) DEFAULT NULL,
    INDEX idx_bp_booking (booking_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_contracts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    contract_type VARCHAR(64) DEFAULT 'general',
    status VARCHAR(48) NOT NULL DEFAULT 'draft',
    customer_id CHAR(36) DEFAULT NULL,
    body_html LONGTEXT DEFAULT NULL,
    client_sign_token CHAR(64) DEFAULT NULL,
    admin_sign_token CHAR(64) DEFAULT NULL,
    client_signed_at DATETIME DEFAULT NULL,
    admin_signed_at DATETIME DEFAULT NULL,
    expires_at DATE DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_erp_contracts_ref (reference)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_contract_templates (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    body_html LONGTEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_letters (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(64) NOT NULL,
    category_id CHAR(36) DEFAULT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html LONGTEXT DEFAULT NULL,
    status VARCHAR(48) NOT NULL DEFAULT 'draft',
    recipient_name VARCHAR(255) DEFAULT NULL,
    recipient_phone VARCHAR(50) DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_erp_letters_ref (reference),
    INDEX idx_erp_letters_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_letter_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS asset_regions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS asset_stations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    region_id CHAR(36) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS asset_donors (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS asset_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS fixed_assets (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id CHAR(36) DEFAULT NULL,
    region_id CHAR(36) DEFAULT NULL,
    station_id CHAR(36) DEFAULT NULL,
    donor_id CHAR(36) DEFAULT NULL,
    purchase_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    book_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    purchase_date DATE DEFAULT NULL,
    note TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_taxes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(8,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_erp_taxes_default (is_default)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_settings (
    setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
    setting_value LONGTEXT DEFAULT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS erp_leaders (
    id CHAR(36) NOT NULL PRIMARY KEY,
    member_id CHAR(36) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) DEFAULT NULL,
    photo_url VARCHAR(1024) DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
