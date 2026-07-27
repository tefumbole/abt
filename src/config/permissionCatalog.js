/**
 * Canonical permission keys grouped by admin menu category.
 * Stored in role_permissions.permission (string) linked to roles.name.
 */

const CRUD = [
  { action: 'view', label: 'View' },
  { action: 'create', label: 'Create' },
  { action: 'edit', label: 'Edit' },
  { action: 'delete', label: 'Delete' },
];

const VIEW_EDIT = [
  { action: 'view', label: 'View' },
  { action: 'edit', label: 'Edit' },
];

function crudModule(category, key, label, actions = CRUD) {
  return actions.map(({ action, label: actionLabel }) => ({
    id: `${key}.${action}`,
    category,
    label: `${actionLabel} ${label}`,
    description: `${actionLabel} access for ${label}`,
  }));
}

/** @type {{ id: string, category: string, label: string, description?: string }[]} */
export const PERMISSION_CATALOG = [
  ...crudModule('Dashboard', 'dashboard', 'Dashboard', [{ action: 'view', label: 'View' }]),

  ...crudModule('Announcements', 'announcements.compose', 'Compose'),
  ...crudModule('Announcements', 'announcements.list', 'All Announcements / Listing'),
  ...crudModule('Announcements', 'announcements.scheduled', 'Scheduled Announcements'),
  ...crudModule('Announcements', 'announcements.templates', 'Announcement Templates'),
  ...crudModule('Announcements', 'announcements.categories', 'Announcement Categories'),
  ...VIEW_EDIT.flatMap((a) =>
    crudModule('Announcements', 'announcements.settings', 'Announcement Settings', [a])
  ),

  ...crudModule('Gallery', 'gallery', 'Gallery'),

  ...VIEW_EDIT.flatMap((a) =>
    crudModule('Site Content', 'site_content', 'Site Content', [a])
  ),

  ...crudModule('Letters & Messaging', 'letters.send', 'Send Letters'),
  ...crudModule('Letters & Messaging', 'letters.templates', 'Letter Templates'),
  ...crudModule('Letters & Messaging', 'letters.history', 'Letters History'),

  ...crudModule('Events', 'events', 'Events'),
  ...crudModule('Invitations', 'invitations', 'Invitations'),
  ...crudModule('Event Templates', 'event_templates', 'Event Design Templates'),
  ...crudModule('Meals', 'meals', 'Event Meals'),

  ...crudModule('Tasks', 'tasks', 'Tasks'),

  ...crudModule('Jobs', 'jobs', 'Jobs'),
  ...crudModule('Applications', 'applications', 'Job Applications'),

  ...crudModule('Users', 'users', 'Users'),
  ...crudModule('Members', 'members', 'Members'),

  ...crudModule('Shareholders', 'shareholders', 'Shareholders'),
  ...crudModule('Shareholders', 'shareholders.agreements', 'Shareholder Agreements'),
  ...crudModule('Shareholders', 'shareholders.payments', 'Pending Payments'),

  ...crudModule('Courses', 'courses', 'Courses / Training Programs'),
  ...crudModule('Registrations', 'registrations', 'Course Registrations'),
  ...crudModule('Feedback', 'feedback', 'Course Feedback'),

  ...crudModule('Timesheets', 'timesheets', 'Employee Timesheets'),
  ...crudModule('Operations', 'operations.timesheets', 'Timesheet Admin Reports'),
  ...crudModule('Operations', 'operations.payments', 'Payments'),

  ...crudModule('HR & Payroll', 'hr.staff', 'Staff Management'),
  ...crudModule('HR & Payroll', 'hr.categories', 'Staff Categories'),
  ...crudModule('HR & Payroll', 'hr.jobs', 'Job / Event Payroll'),
  ...crudModule('HR & Payroll', 'hr.monthly', 'Monthly Payroll'),
  ...VIEW_EDIT.flatMap((a) => crudModule('HR & Payroll', 'hr.allowances', 'Allowances', [a])),
  ...VIEW_EDIT.flatMap((a) => crudModule('HR & Payroll', 'hr.deductions', 'Deductions', [a])),
  ...crudModule('HR & Payroll', 'hr.advances', 'Advance Payments'),
  ...crudModule('HR & Payroll', 'hr.payslips', 'Payslips', [{ action: 'view', label: 'View' }, { action: 'download', label: 'Download' }]),
  ...crudModule('HR & Payroll', 'hr.approvals', 'Payroll Approvals'),
  ...crudModule('HR & Payroll', 'hr.finance', 'Finance Payment Status'),
  ...crudModule('HR & Payroll', 'hr.reports', 'Payroll Reports', [{ action: 'view', label: 'View' }]),
  ...crudModule('HR & Payroll', 'hr.letters', 'HR Letters'),

  ...Object.entries({
    view_hr: 'HR: View module',
    manage_staff: 'HR: Manage staff profiles',
    manage_staff_categories: 'HR: Manage staff categories',
    manage_allowances: 'HR: Manage allowance types',
    manage_deductions: 'HR: Manage deduction types',
    create_job_payroll: 'HR: Create job/event payroll',
    create_monthly_payroll: 'HR: Create monthly payroll',
    approve_payroll: 'HR: Approve payroll',
    forward_payroll_to_finance: 'HR: Forward payroll to finance',
    manage_finance_payment: 'HR: Manage finance payment status',
    view_payslips: 'HR: View payslips',
    download_payslips: 'HR: Download payslips',
    view_payroll_reports: 'HR: View payroll reports',
  }).map(([id, label]) => ({
    id,
    category: 'HR & Payroll (Workflow)',
    label,
    description: label,
  })),

  ...VIEW_EDIT.flatMap((a) => crudModule('System', 'system.settings', 'General Settings', [a])),
  ...VIEW_EDIT.flatMap((a) => crudModule('System', 'system.reports', 'Reports Hub', [a])),
  ...VIEW_EDIT.flatMap((a) => crudModule('System', 'system.backup', 'Backup & Restore', [a])),
  ...crudModule('Roles & Permissions', 'roles', 'Roles & Permissions'),

  ...Object.entries({
    'menu.dashboard': 'Menu: Dashboard',
    'menu.events': 'Menu: Events',
    'menu.invitations': 'Menu: Invitations',
    'menu.event_templates': 'Menu: Event Templates',
    'menu.tasks': 'Menu: Tasks',
    'menu.jobs': 'Menu: Jobs',
    'menu.users': 'Menu: Users',
    'menu.members': 'Menu: Members',
    'menu.shareholders': 'Menu: Shareholders',
    'menu.courses': 'Menu: Courses',
    'menu.announcements': 'Menu: Announcements',
    'menu.gallery': 'Menu: Gallery',
    'menu.site_content': 'Menu: Site Content',
    'menu.timesheets': 'Menu: Timesheets',
    'menu.operations': 'Menu: Operations',
    'menu.hr': 'Menu: HR & Payroll',
    'menu.system': 'Menu: System',
    'menu.roles': 'Menu: Roles & Permissions',
  }).map(([id, label]) => ({
    id,
    category: 'Sidebar Menu Access',
    label,
    description: `Show ${label.replace('Menu: ', '')} in admin sidebar`,
  })),
];

export function getPermissionsByCategory() {
  return PERMISSION_CATALOG.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});
}

export function getAllPermissionIds() {
  return PERMISSION_CATALOG.map((p) => p.id);
}

export function roleNameToSlug(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function findRoleNameForSlug(slug, roles = []) {
  if (!slug) return null;
  const normalized = String(slug).toLowerCase();
  const match = roles.find((r) => roleNameToSlug(r.name) === normalized);
  return match?.name || slug;
}
