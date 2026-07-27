/**
 * Permission keys for admin sidebar menu items.
 * Used with PermissionContext.hasPermission() — admins bypass all checks.
 */
export const MENU_PERMISSIONS = {
  dashboard: 'menu.dashboard',
  events: 'menu.events',
  invitations: 'menu.invitations',
  eventTemplates: 'menu.event_templates',
  tasks: 'menu.tasks',
  jobs: 'menu.jobs',
  users: 'menu.users',
  members: 'menu.members',
  shareholders: 'menu.shareholders',
  courses: 'menu.courses',
  announcements: 'menu.announcements',
  gallery: 'menu.gallery',
  siteContent: 'menu.site_content',
  timesheets: 'menu.timesheets',
  operations: 'menu.operations',
  hr: 'menu.hr',
  system: 'menu.system',
  roles: 'menu.roles',
};

export function itemVisible(hasPermission, permission) {
  if (!permission) return true;
  return hasPermission(permission);
}

const ADMIN_ROUTE_RULES = [
  ['/admin/dashboard', ['dashboard.view', 'menu.dashboard']],
  ['/admin/users', ['users.view', 'users.create', 'users.edit', 'menu.users']],
  ['/admin/courses', ['courses.view', 'courses.create', 'courses.edit', 'menu.courses']],
  ['/admin/jobs', ['jobs.view', 'jobs.create', 'jobs.edit', 'menu.jobs']],
  ['/admin/applications', ['applications.view', 'applications.create', 'menu.jobs']],
  ['/admin/shareholders', ['shareholders.view', 'shareholders.create', 'menu.shareholders']],
  ['/admin/members', ['members.view', 'members.create', 'menu.members']],
  ['/admin/settings', ['system.settings.view', 'menu.system']],
  ['/admin/system', ['system.settings.view', 'system.reports.view', 'menu.system']],
  ['/admin/roles', ['roles.view', 'roles.create', 'menu.roles']],
  ['/admin/events', ['events.view', 'events.create', 'menu.events']],
  ['/admin/invitations', ['invitations.view', 'invitations.create', 'menu.invitations']],
  ['/admin/announcements', ['announcements.compose.view', 'announcements.list.view', 'menu.announcements']],
  ['/admin/gallery', ['gallery.view', 'gallery.create', 'gallery.edit', 'menu.gallery']],
  ['/admin/site-content', ['site_content.view', 'site_content.edit', 'menu.site_content']],
  ['/admin/timesheet', ['timesheets.view', 'timesheets.create', 'menu.timesheets']],
  ['/admin/tasks', ['tasks.view', 'tasks.create', 'menu.tasks']],
  ['/admin/hr', ['view_hr', 'hr.staff.view', 'menu.hr']],
  ['/admin/hr/letters', ['view_hr', 'hr.letters.view', 'menu.hr']],
  ['/admin/letters', ['letters.send.view', 'letters.templates.view']],
  ['/admin/communication', ['letters.send.view', 'announcements.compose.view']],
];

export function canAccessAdminRoute(pathname, hasPermission, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false;

  const path = String(pathname || '').split('?')[0].replace(/\/$/, '') || '/admin/dashboard';

  for (const [prefix, keys] of ADMIN_ROUTE_RULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return keys.some((key) => hasPermission(key));
    }
  }

  return permissions.some((key) => key.startsWith('menu.') || key === 'dashboard.view');
}

export function hasAdminPanelAccess(hasPermission, permissions = []) {
  return (
    hasPermission('dashboard.view')
    || hasPermission('menu.dashboard')
    || permissions.some((key) => key.startsWith('menu.'))
  );
}
