/** Alpha Bridge ERP release identifier — update when creating a new restore point. */
export const APP_VERSION = 'ABT_ERP_V.2.2.13';

export const APP_VERSION_LABEL = 'Version';

export const RESTORE_POINT = {
  id: APP_VERSION,
  name: 'Alpha Bridge ERP v2.2.13',
  created: '2026-08-05',
  gitTag: APP_VERSION,
};

/**
 * Newest-first deployment / release notes shown in admin.
 * Keep in sync with notable production deploys.
 */
export const DEPLOYMENT_HISTORY = [
  {
    version: 'ABT_ERP_V.2.2.11',
    date: '2026-08-05',
    title: 'Products & Stock as link with top tabs',
    notes: [
      'Sidebar shows Products & Stock as a single link',
      'Category, Product List, Add Product, Barcode, Adjustments, Stock Count as top tabs',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.10',
    date: '2026-08-05',
    title: 'Flat sidebar like Beyond + POS polish',
    notes: [
      'No sidebar section headers — menus listed directly',
      'POS: more search/cart spacing, tighter Category/Brand/Featured bar',
      'POS customers from erp_customers only (Walk-in Customer seeded)',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.8',
    date: '2026-08-04',
    title: 'Products: sidebar nav, no top menu',
    notes: [
      'Removed Products page top pill menu',
      'Category / Product List / Adjustments live under sidebar Products & Stock',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.7',
    date: '2026-08-04',
    title: 'Beyond-style Product Categories',
    notes: [
      'Category tab with Add/Import, search, and export helpers',
      'Table: image, parent, product count, stock qty, stock worth, Action menu',
      'Product sub-tabs aligned with Beyond (list, add, barcode, adjustments, stock count)',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.6',
    date: '2026-08-04',
    title: 'Default unit + collapsible sidebar',
    notes: [
      'Set default unit from General Setting and Unit tabs',
      'All admin side-menu section headings are collapsible',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.5',
    date: '2026-08-04',
    title: 'Multi-currency Settings',
    notes: [
      'Create multiple currencies with code, symbol, exchange rate',
      'Set preferred default currency for the system',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.4',
    date: '2026-08-04',
    title: 'Beyond-style full POS screen',
    notes: [
      'Full two-column POS (cart + product grid)',
      'Payment methods: JE, Cash, Credit, Group Credit, Orange Money, MTN momo, Deposit, Cancel',
      'POS removed from sidebar; open via header POS button',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.3',
    date: '2026-08-04',
    title: 'Beyond-style ERP People',
    notes: [
      'ERP People: User/Customer/Biller/Supplier list + add tabs',
      'Customer list layout aligned with user list',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.2',
    date: '2026-08-04',
    title: 'Slim System menu + Customer Groups',
    notes: [
      'System sidebar: Site Content, Backup & Restore, Settings only',
      'Customer Group create/edit/delete in Settings',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.1',
    date: '2026-08-04',
    title: 'Beyond-style Settings hub',
    notes: [
      'Side menu renamed to Settings',
      'Colored settings tabs (General, Warehouse, Brand, Unit, POS, …)',
      'General Setting form: title, logo, header/footer/watermark, timezone, letter serial',
      'Branding merged into General Setting (existing assets preserved)',
    ],
  },
  {
    version: 'ABT_ERP_V.2.2.0',
    date: '2026-08-04',
    title: 'ERP menus, POS header, Quotations UI',
    notes: [
      'Site Content Side Menu includes all ERP items',
      'Gold POS shortcut in admin header',
      'Beyond-style Quotations list/add screen',
      'Deployment version history in admin',
    ],
  },
  {
    version: 'ABT_ERP_V.2.1.4',
    date: '2026-07-27',
    title: 'ERP commerce port (Wave A–C)',
    notes: [
      'Warehouses, products, people, purchases, sales, POS',
      'Quotations/deliveries WhatsApp portals',
      'Transfers, returns, expenses, accounting',
      'Rentals, contracts, ERP letters, fixed assets, leaders',
    ],
  },
  {
    version: 'ABT_ERP_V.2.1.3',
    date: '2026-07-27',
    title: 'Site content & dashboard',
    notes: [
      'Site Content CMS',
      'Admin dashboard analytics',
      'OTP for all users',
    ],
  },
];
