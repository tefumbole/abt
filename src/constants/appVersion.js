/** Alpha Bridge ERP release identifier — update when creating a new restore point. */
export const APP_VERSION = 'ABT_ERP_V.2.2.0';

export const APP_VERSION_LABEL = 'Version';

export const RESTORE_POINT = {
  id: APP_VERSION,
  name: 'Alpha Bridge ERP v2.2.0',
  created: '2026-08-04',
  gitTag: APP_VERSION,
};

/**
 * Newest-first deployment / release notes shown in admin.
 * Keep in sync with notable production deploys.
 */
export const DEPLOYMENT_HISTORY = [
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
