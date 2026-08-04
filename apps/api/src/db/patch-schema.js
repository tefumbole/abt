/**
 * Idempotent ALTER patches for databases created from an older schema.sql.
 */
import { ERP_CREATE_STATEMENTS } from './erpSchema.js';

export const SCHEMA_PATCHES = [
  'ALTER TABLE profiles ADD COLUMN status VARCHAR(50) DEFAULT \'active\'',
  'ALTER TABLE shareholders MODIFY COLUMN email VARCHAR(255) NULL',
  'ALTER TABLE shareholders MODIFY COLUMN name VARCHAR(255) NULL',
  'ALTER TABLE shareholders ADD COLUMN full_name VARCHAR(255) NULL',
  'ALTER TABLE shareholders ADD COLUMN phone_number VARCHAR(50) NULL',
  'ALTER TABLE shareholders MODIFY COLUMN phone VARCHAR(50) NULL',
  'ALTER TABLE shareholders ADD COLUMN country_code VARCHAR(10) NULL',
  'ALTER TABLE shareholders ADD COLUMN full_phone_number VARCHAR(50) NULL',
  'ALTER TABLE shareholders ADD COLUMN company_name VARCHAR(255) NULL',
  'ALTER TABLE shareholders ADD COLUMN address TEXT NULL',
  'ALTER TABLE shareholders ADD COLUMN nationality VARCHAR(100) NULL',
  'ALTER TABLE shareholders ADD COLUMN investment_amount DECIMAL(14,2) NULL',
  'ALTER TABLE shareholders ADD COLUMN signature LONGTEXT NULL',
  'ALTER TABLE shareholders ADD COLUMN signature_image_url TEXT NULL',
  'ALTER TABLE shareholders ADD COLUMN agreement_signed_at DATETIME NULL',
  'ALTER TABLE shareholders ADD COLUMN is_guest TINYINT(1) DEFAULT 1',
  'ALTER TABLE shareholders ADD COLUMN user_id CHAR(36) NULL',
  'ALTER TABLE shareholders ADD COLUMN submitted_at DATETIME NULL',
  'ALTER TABLE shareholders ADD COLUMN approved_at DATETIME NULL',
  'ALTER TABLE shareholders ADD COLUMN approved_by CHAR(36) NULL',
  'ALTER TABLE shareholders ADD COLUMN rejection_reason TEXT NULL',
  'ALTER TABLE shareholders ADD COLUMN admin_notes TEXT NULL',
  'ALTER TABLE whatsapp_message_logs ADD COLUMN recipient_phone VARCHAR(50) NULL',
  'ALTER TABLE whatsapp_message_logs ADD COLUMN related_registration_id CHAR(36) NULL',
  'ALTER TABLE whatsapp_message_logs ADD COLUMN retry_count INT DEFAULT 0',
  'ALTER TABLE whatsapp_message_logs ADD COLUMN sent_at DATETIME NULL',
  'ALTER TABLE tasks ADD COLUMN category_id CHAR(36) NULL',
  'ALTER TABLE task_assignments ADD COLUMN last_update_at DATETIME NULL',
  'ALTER TABLE task_assignments ADD COLUMN declined_at DATETIME NULL',
  'ALTER TABLE task_assignments ADD COLUMN invite_token CHAR(36) NULL',
  'ALTER TABLE task_assignments ADD COLUMN acceptance_signature LONGTEXT NULL',
  'ALTER TABLE tasks ADD COLUMN notification_template LONGTEXT NULL',
  'ALTER TABLE tasks ADD COLUMN schedules_json JSON NULL',
  'ALTER TABLE tasks ADD COLUMN is_scheduled TINYINT(1) DEFAULT 0',
  'ALTER TABLE tasks ADD COLUMN color VARCHAR(20) DEFAULT NULL',
  'ALTER TABLE tasks ADD COLUMN start_time VARCHAR(10) DEFAULT NULL',
  'ALTER TABLE tasks ADD COLUMN deadline_time VARCHAR(10) DEFAULT NULL',
  'ALTER TABLE task_attachments ADD COLUMN attachment_type VARCHAR(50) DEFAULT NULL',
  'ALTER TABLE applications ADD COLUMN status_changed_at DATETIME NULL',
  'ALTER TABLE applications ADD COLUMN status_changed_by CHAR(36) NULL',
  'ALTER TABLE shareholders ADD COLUMN deleted_at DATETIME NULL',
  'ALTER TABLE courses ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
  'ALTER TABLE courses ADD COLUMN category VARCHAR(100) DEFAULT NULL',
  'ALTER TABLE events ADD COLUMN meals_json JSON DEFAULT NULL',
  'ALTER TABLE events ADD COLUMN specify_meals TINYINT(1) DEFAULT 0',
  'ALTER TABLE system_settings ADD COLUMN application_name VARCHAR(255) DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN pdf_header_text TEXT DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN pdf_footer_text TEXT DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN pdf_header_url TEXT DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN pdf_header_file_path VARCHAR(255) DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN pdf_footer_url TEXT DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN pdf_footer_file_path VARCHAR(255) DEFAULT NULL',
  'ALTER TABLE shareholders ADD COLUMN agreement_pdf_url TEXT NULL',
  'ALTER TABLE shareholders ADD COLUMN agreement_pdf_path TEXT NULL',
  'ALTER TABLE shareholders ADD COLUMN pdf_generated_at DATETIME NULL',
  'ALTER TABLE courses ADD COLUMN curriculum_json JSON DEFAULT NULL',
  'ALTER TABLE courses ADD COLUMN delivery_mode VARCHAR(255) DEFAULT NULL',
  'ALTER TABLE courses ADD COLUMN icon VARCHAR(50) DEFAULT NULL',
  'ALTER TABLE courses ADD COLUMN color VARCHAR(20) DEFAULT NULL',
  'ALTER TABLE system_settings ADD COLUMN license_agreement_json JSON DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL',
  'ALTER TABLE profiles ADD COLUMN username VARCHAR(100) NULL',
  'ALTER TABLE otp_sessions ADD COLUMN purpose VARCHAR(50) DEFAULT \'login\'',
  'ALTER TABLE event_meals ADD COLUMN image_url TEXT NULL',
  'ALTER TABLE registrations ADD COLUMN company_name VARCHAR(255) NULL',
  'ALTER TABLE registrations ADD COLUMN course_ids JSON NULL',
  'ALTER TABLE registrations ADD COLUMN total_price DECIMAL(14,2) NULL',
  'ALTER TABLE registrations ADD COLUMN status VARCHAR(50) DEFAULT \'pending\'',
  'ALTER TABLE registrations ADD COLUMN payment_id VARCHAR(255) NULL',
  'ALTER TABLE registrations ADD COLUMN payment_date DATETIME NULL',
  // Task guest onboarding + forced first-login profile completion
  'ALTER TABLE users ADD COLUMN address TEXT NULL',
  'ALTER TABLE users ADD COLUMN must_change_credentials TINYINT(1) NOT NULL DEFAULT 0',
  'ALTER TABLE profiles ADD COLUMN address TEXT NULL',
  'ALTER TABLE profiles ADD COLUMN must_change_credentials TINYINT(1) NOT NULL DEFAULT 0',
  // Team member country flag
  'ALTER TABLE members ADD COLUMN country VARCHAR(100) NULL',
  // Public team display order (drag-and-drop in admin)
  'ALTER TABLE members ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
  'CREATE INDEX idx_members_sort_order ON members (sort_order)',
];

export const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) DEFAULT NULL,
    user_name VARCHAR(255) DEFAULT NULL,
    user_role VARCHAR(80) DEFAULT NULL,
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(120) DEFAULT NULL,
    entity_id VARCHAR(120) DEFAULT NULL,
    summary VARCHAR(500) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    ip_address VARCHAR(60) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activity_logs_created (created_at),
    INDEX idx_activity_logs_user (user_id),
    INDEX idx_activity_logs_entity (entity)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pending_registrations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    otp VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    invite_token VARCHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pending_reg_email (email),
    INDEX idx_pending_reg_phone (phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS task_notification_queue (
    id CHAR(36) NOT NULL PRIMARY KEY,
    task_id CHAR(36) NOT NULL,
    assignment_id CHAR(36) NOT NULL,
    scheduled_at DATETIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at DATETIME DEFAULT NULL,
    last_error TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_notif_sched (scheduled_at, status),
    INDEX idx_task_notif_assignment (assignment_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS task_cc (
    id CHAR(36) NOT NULL PRIMARY KEY,
    task_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_task_cc (task_id, user_id),
    INDEX idx_task_cc_task (task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS application_status_history (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    application_id CHAR(36) NOT NULL,
    old_status VARCHAR(50) DEFAULT NULL,
    new_status VARCHAR(50) DEFAULT NULL,
    reason TEXT DEFAULT NULL,
    changed_by CHAR(36) DEFAULT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_app_status_hist_app (application_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS webhook_settings (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    webhook_url TEXT NOT NULL,
    triggers JSON DEFAULT NULL,
    enabled TINYINT(1) DEFAULT 1,
    secret_key VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_webhook_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS event_meals (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(100) DEFAULT 'General',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_event_meals_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS announcement_categories (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ann_category_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS certificates (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    certificate_number VARCHAR(100) NOT NULL,
    registration_id CHAR(36) DEFAULT NULL,
    student_name VARCHAR(255) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    completion_date DATETIME DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'active',
    revoked_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_certificates_reg (registration_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    invoice_number VARCHAR(100) NOT NULL,
    registration_id CHAR(36) DEFAULT NULL,
    client_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    courses_json JSON DEFAULT NULL,
    subtotal DECIMAL(14,2) DEFAULT 0,
    tax DECIMAL(14,2) DEFAULT 0,
    total DECIMAL(14,2) DEFAULT 0,
    payment_method VARCHAR(100) DEFAULT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_date DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_invoices_reg (registration_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS student_progress (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    registration_id CHAR(36) NOT NULL,
    course_id CHAR(36) NOT NULL,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'not_started',
    start_date DATETIME DEFAULT NULL,
    completion_date DATETIME DEFAULT NULL,
    last_updated DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_progress_reg (registration_id),
    INDEX idx_progress_course (course_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS course_feedback (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    registration_id CHAR(36) DEFAULT NULL,
    course_id CHAR(36) DEFAULT NULL,
    student_name VARCHAR(255) DEFAULT NULL,
    rating INT DEFAULT 5,
    feedback_text TEXT DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_feedback_course (course_id),
    INDEX idx_feedback_reg (registration_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_staff_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_position_rates (
    id CHAR(36) NOT NULL PRIMARY KEY,
    position VARCHAR(120) NOT NULL UNIQUE,
    daily_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_staff_profiles (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) DEFAULT NULL,
    staff_code VARCHAR(40) NOT NULL UNIQUE,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(40) DEFAULT NULL,
    category_id CHAR(36) NOT NULL,
    position VARCHAR(120) DEFAULT NULL,
    department VARCHAR(120) DEFAULT NULL,
    payment_type ENUM('monthly','daily') NOT NULL DEFAULT 'daily',
    daily_rate DECIMAL(12,2) DEFAULT NULL,
    monthly_salary DECIMAL(12,2) DEFAULT NULL,
    contract_start DATE DEFAULT NULL,
    contract_end DATE DEFAULT NULL,
    hire_date DATE DEFAULT NULL,
    bank_name VARCHAR(120) DEFAULT NULL,
    bank_account VARCHAR(80) DEFAULT NULL,
    status ENUM('active','inactive','terminated') NOT NULL DEFAULT 'active',
    notes TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_staff_user (user_id),
    INDEX idx_hr_staff_category (category_id),
    INDEX idx_hr_staff_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_allowance_types (
    id CHAR(36) NOT NULL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    default_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_deduction_types (
    id CHAR(36) NOT NULL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    default_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_jobs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) DEFAULT NULL,
    location VARCHAR(255) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    status ENUM('draft','active','completed','cancelled') NOT NULL DEFAULT 'draft',
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_jobs_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_job_staff (
    id CHAR(36) NOT NULL PRIMARY KEY,
    job_id CHAR(36) NOT NULL,
    staff_profile_id CHAR(36) NOT NULL,
    daily_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    days_worked DECIMAL(6,2) NOT NULL DEFAULT 0,
    day_status ENUM('full','partial') NOT NULL DEFAULT 'full',
    partial_fraction DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_hr_job_staff (job_id, staff_profile_id),
    INDEX idx_hr_job_staff_job (job_id),
    INDEX idx_hr_job_staff_staff (staff_profile_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_payroll_runs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    run_type ENUM('job','monthly') NOT NULL,
    title VARCHAR(255) NOT NULL,
    job_id CHAR(36) DEFAULT NULL,
    period_start DATE DEFAULT NULL,
    period_end DATE DEFAULT NULL,
    status ENUM('draft','review','approved','finance','partially_paid','paid','rejected') NOT NULL DEFAULT 'draft',
    total_gross DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_net DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes TEXT DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    reviewed_by CHAR(36) DEFAULT NULL,
    approved_by CHAR(36) DEFAULT NULL,
    forwarded_to_finance_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_payroll_runs_type (run_type),
    INDEX idx_hr_payroll_runs_status (status),
    INDEX idx_hr_payroll_runs_job (job_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_payroll_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payroll_run_id CHAR(36) NOT NULL,
    staff_profile_id CHAR(36) NOT NULL,
    basic_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    daily_rate DECIMAL(12,2) DEFAULT NULL,
    days_worked DECIMAL(6,2) DEFAULT NULL,
    hours_expected DECIMAL(8,2) DEFAULT NULL,
    hours_actual DECIMAL(8,2) DEFAULT NULL,
    overtime_hours DECIMAL(8,2) DEFAULT NULL,
    gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_advances DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_status ENUM('pending','approved_for_payment','partially_paid','paid','rejected') NOT NULL DEFAULT 'pending',
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_payroll_items_run (payroll_run_id),
    INDEX idx_hr_payroll_items_staff (staff_profile_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_payroll_allowances (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payroll_item_id CHAR(36) NOT NULL,
    allowance_type_id CHAR(36) DEFAULT NULL,
    label VARCHAR(120) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_payroll_allowances_item (payroll_item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_payroll_deductions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payroll_item_id CHAR(36) NOT NULL,
    deduction_type_id CHAR(36) DEFAULT NULL,
    label VARCHAR(120) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_payroll_deductions_item (payroll_item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_advance_payments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    staff_profile_id CHAR(36) NOT NULL,
    job_id CHAR(36) DEFAULT NULL,
    payroll_item_id CHAR(36) DEFAULT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_date DATE NOT NULL,
    reason TEXT DEFAULT NULL,
    approved_by CHAR(36) DEFAULT NULL,
    balance_remaining DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('open','applied','closed') NOT NULL DEFAULT 'open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_advances_staff (staff_profile_id),
    INDEX idx_hr_advances_job (job_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_payslips (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payroll_item_id CHAR(36) NOT NULL UNIQUE,
    verification_code VARCHAR(32) NOT NULL UNIQUE,
    pdf_path VARCHAR(500) DEFAULT NULL,
    sent_email_at DATETIME DEFAULT NULL,
    sent_whatsapp_at DATETIME DEFAULT NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_payslips_item (payroll_item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_payroll_approvals (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payroll_run_id CHAR(36) NOT NULL,
    stage ENUM('draft','review','approved','finance','paid','rejected') NOT NULL,
    action_by CHAR(36) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_payroll_approvals_run (payroll_run_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_finance_payments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    payroll_run_id CHAR(36) DEFAULT NULL,
    payroll_item_id CHAR(36) DEFAULT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pending','approved_for_payment','partially_paid','paid','rejected') NOT NULL DEFAULT 'pending',
    paid_at DATETIME DEFAULT NULL,
    paid_by CHAR(36) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_finance_run (payroll_run_id),
    INDEX idx_hr_finance_item (payroll_item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_timesheet_entries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    staff_profile_id CHAR(36) NOT NULL,
    job_id CHAR(36) DEFAULT NULL,
    entry_date DATE NOT NULL,
    hours_worked DECIMAL(6,2) NOT NULL DEFAULT 0,
    day_fraction DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    status ENUM('draft','submitted','confirmed') NOT NULL DEFAULT 'draft',
    notes TEXT DEFAULT NULL,
    confirmed_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_hr_timesheet (staff_profile_id, entry_date, job_id),
    INDEX idx_hr_timesheet_staff (staff_profile_id),
    INDEX idx_hr_timesheet_job (job_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_letter_templates (
    id CHAR(36) NOT NULL PRIMARY KEY,
    letter_type ENUM('leave_of_absence','permission','employment_letter','attestation_of_work') NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hr_letter_templates_type (letter_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS hr_letters (
    id CHAR(36) NOT NULL PRIMARY KEY,
    template_id CHAR(36) DEFAULT NULL,
    staff_profile_id CHAR(36) NOT NULL,
    letter_type ENUM('leave_of_absence','permission','employment_letter','attestation_of_work') NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    reference_code VARCHAR(32) NOT NULL UNIQUE,
    status ENUM('draft','sent','failed') NOT NULL DEFAULT 'draft',
    sent_whatsapp_at DATETIME DEFAULT NULL,
    sent_email_at DATETIME DEFAULT NULL,
    created_by CHAR(36) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hr_letters_staff (staff_profile_id),
    INDEX idx_hr_letters_type (letter_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS gallery_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    file_path VARCHAR(512) DEFAULT NULL,
    media_url VARCHAR(2048) DEFAULT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_gallery_items_published (is_published, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS site_settings (
    \`key\` VARCHAR(191) NOT NULL PRIMARY KEY,
    value LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  ...ERP_CREATE_STATEMENTS,
];

export const DATA_PATCHES = [];

export async function applySchemaPatches(pool) {
  for (const sql of SCHEMA_PATCHES) {
    try {
      await pool.query(sql);
      const col = sql.match(/ADD COLUMN `?(\w+)`?|MODIFY COLUMN `?(\w+)`?/i);
      console.log('Patched:', col?.[1] || col?.[2] || sql.slice(0, 40));
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') continue;
      if (err.code === 'ER_BAD_FIELD_ERROR' && sql.includes('MODIFY')) continue;
      console.warn('Patch skipped:', err.message);
    }
  }

  for (const sql of DATA_PATCHES || []) {
    try {
      const [result] = await pool.query(sql);
      if (result?.affectedRows) {
        console.log('Data patch applied:', result.affectedRows, 'row(s)');
      }
    } catch (err) {
      console.warn('Data patch skipped:', err.message);
    }
  }
}
