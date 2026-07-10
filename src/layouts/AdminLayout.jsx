import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/context/PermissionContext';
import { MENU_PERMISSIONS, itemVisible } from '@/config/adminMenuPermissions';
import { formatRoleLabel } from '@/services/roleService';
import HrTopNav from '@/components/hr/HrTopNav';
import HrLettersTopNav from '@/components/hr/HrLettersTopNav';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  LogOut, 
  Menu, 
  X, 
  Clock, 
  History, 
  FileBarChart, 
  ChevronDown, 
  Briefcase, 
  Settings, 
  CalendarDays, 
  PlusCircle, 
  BarChart, 
  CalendarClock, 
  PieChart, 
  Mail, 
  FileCheck, 
  Database, 
  BookOpen, 
  Award, 
  TrendingUp,
  Megaphone,
  PenLine,
  MessageSquare,
  FileText,
  ListTodo,
  CheckCircle,
  Key,
  Inbox,
  Ticket,
  QrCode,
  LineChart,
  Headphones,
  Music,
  Sliders,
  Utensils,
  ClipboardCheck,
  Trash2,
  UserPlus,
  Wallet,
  UserCog,
  ScrollText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useSiteLabel } from '@/hooks/useSiteLabel';

const AdminLayout = () => {
  const { logout, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tl = useSiteLabel();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const { hasPermission, hasStaffAccess, loading: permLoading } = usePermission();
  const userRoleLabel = formatRoleLabel(profile?.role || user?.app_metadata?.role || user?.role || '');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const menuGroups = [
    {
      label: 'Dashboard',
      items: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, permission: MENU_PERMISSIONS.dashboard },
      ]
    },
    {
      label: 'Work Management',
      items: [
        { 
          label: 'Task Management', 
          icon: ListTodo,
          permission: MENU_PERMISSIONS.tasks,
          submenu: [
            { label: 'Task Dashboard', path: '/admin/tasks/dashboard', icon: LayoutDashboard },
            { label: 'Create Task', path: '/admin/tasks/create', icon: PlusCircle },
            { label: 'All Tasks', path: '/admin/tasks', icon: ListTodo },
            { label: 'Scheduled', path: '/admin/tasks/scheduled', icon: CalendarClock },
            { label: 'Reminders', path: '/admin/tasks/reminders', icon: Clock },
            { label: 'My Tasks', path: '/admin/tasks/my-tasks', icon: CheckCircle },
            { label: 'Pending Acceptances', path: '/admin/tasks/pending-acceptances', icon: Inbox },
            { label: 'Task Settings', path: '/admin/tasks/settings', icon: Settings },
          ]
        },
        { 
          label: 'Job Board', 
          icon: Briefcase,
          permission: MENU_PERMISSIONS.jobs,
          submenu: [
            { label: 'Recruitment Dashboard', path: '/admin/recruitment-dashboard' },
            { label: 'Manage Jobs', path: '/admin/jobs' },
            { label: 'All Applications', path: '/admin/applications' },
            { label: 'Shortlisted', path: '/admin/applications/shortlisted' },
            { label: 'Rejected', path: '/admin/applications/rejected' },
          ]
        },
        { label: 'Event Management', path: '/admin/events', icon: CalendarDays, permission: MENU_PERMISSIONS.events },
        { label: 'Digital Invitations', path: '/admin/invitations', icon: Ticket, permission: MENU_PERMISSIONS.invitations, activePaths: ['/admin/invitations', '/admin/check-in'] },
        { label: 'Event Templates & Config', path: '/admin/events/templates', icon: Settings, permission: MENU_PERMISSIONS.eventTemplates, activePaths: ['/admin/events/templates', '/admin/events/wa-templates', '/admin/events/webhooks'] },
      ]
    },
    {
      label: 'Communication & Messaging',
      items: [
        {
          label: 'Announcements',
          icon: Megaphone,
          permission: MENU_PERMISSIONS.announcements,
          submenu: [
            { label: 'Compose', path: '/admin/announcements/compose', icon: PenLine },
            { label: 'All Announcements', path: '/admin/announcements/list', icon: FileText },
            { label: 'Scheduled', path: '/admin/announcements/scheduled', icon: Clock },
            { label: 'Templates', path: '/admin/announcements/templates', icon: FileText },
            { label: 'Categories', path: '/admin/announcements/categories', icon: FileText },
            { label: 'Settings', path: '/admin/announcements/settings', icon: Settings },
          ]
        },
      ]
    },
    {
      label: 'Time & Attendance',
      items: [
        {
          label: 'TimeSheets (Employee)',
          icon: Clock,
          permission: MENU_PERMISSIONS.timesheets,
          submenu: [
            { label: 'Create Activity', path: '/admin/timesheet/create-activity', icon: PlusCircle },
            { label: 'Fill Time Sheet', path: '/admin/timesheet/fill-timesheet', icon: Clock },
            { label: 'Working Week', path: '/admin/timesheet/working-week', icon: CalendarClock },
          ]
        },
      ]
    },
    {
      label: 'Operations',
      items: [
        { 
          label: 'TimeSheet Admin', 
          icon: BarChart,
          permission: MENU_PERMISSIONS.operations,
          submenu: [
            { label: 'TimeSheet Report', path: '/admin/timesheet-report' },
            { label: 'Overtime Report', path: '/admin/overtime-report' },
            { label: 'Manage All', path: '/admin/manage-timesheets' },
            { label: 'Categories', path: '/admin/timesheet-categories' } 
          ]
        },
        { label: 'Payments', path: '/admin/payments', icon: CreditCard, permission: MENU_PERMISSIONS.operations }, 
      ]
    },
    {
      label: 'Courses',
      items: [
        {
          label: 'Courses',
          icon: BookOpen,
          permission: MENU_PERMISSIONS.courses,
          submenu: [
            { label: 'Course List', path: '/admin/courses' },
            { label: 'Add Course', path: '/admin/courses/add' },
            { label: 'Registrations', path: '/admin/registrations' },
            { label: 'Invoices', path: '/admin/invoices', icon: FileText },
            { label: 'Certificates', path: '/admin/certificates', icon: Award },
            { label: 'Student Progress', path: '/admin/progress', icon: TrendingUp },
            { label: 'Feedback', path: '/admin/feedback', icon: MessageSquare },
          ]
        }
      ]
    },
    {
      label: 'HR & Payroll',
      items: [
        {
          label: 'Human Resources',
          icon: Wallet,
          permission: MENU_PERMISSIONS.hr,
          submenu: [
            { label: 'Staff Management', path: '/admin/hr/staff' },
            { label: 'Staff Categories', path: '/admin/hr/categories' },
            { label: 'Job / Event Payroll', path: '/admin/hr/jobs' },
            { label: 'Monthly Payroll', path: '/admin/hr/monthly-payroll' },
            { label: 'Allowances', path: '/admin/hr/allowances' },
            { label: 'Deductions', path: '/admin/hr/deductions' },
            { label: 'Advance Payments', path: '/admin/hr/advances' },
            { label: 'Payslips', path: '/admin/hr/payslips' },
            { label: 'Payroll Approvals', path: '/admin/hr/approvals' },
            { label: 'Finance Status', path: '/admin/hr/finance' },
            { label: 'Reports', path: '/admin/hr/reports' },
          ],
        },
        {
          label: 'HR Letters',
          icon: FileText,
          permission: MENU_PERMISSIONS.hr,
          submenu: [
            { label: 'Leave of Absence', path: '/admin/hr/letters/leave' },
            { label: 'Permission', path: '/admin/hr/letters/permission' },
            { label: 'Employment Letter', path: '/admin/hr/letters/employment' },
            { label: 'Attestation of Work', path: '/admin/hr/letters/attestation' },
            { label: 'Templates', path: '/admin/hr/letters/templates' },
          ],
        },
      ],
    },
    {
      label: 'People & Access',
      items: [
        { 
          label: 'Users', 
          icon: Users,
          permission: MENU_PERMISSIONS.users,
          submenu: [
            { label: 'All Users', path: '/admin/users' },
            { label: 'Add Customer', path: '/admin/users?action=customer', icon: UserPlus },
            { label: 'Customer List', path: '/admin/users?filter=customer' },
            { label: 'Add Student', path: '/admin/students?action=new', icon: UserPlus },
            { label: 'Student List', path: '/admin/students' },
            { label: 'ShareHolder', path: '/admin/shareholders/list', icon: PieChart },
          ]
        },
        { 
          label: 'Members (Team)', 
          icon: Users,
          permission: MENU_PERMISSIONS.members,
          submenu: [
            { label: 'Member List', path: '/admin/members' },
            { label: 'Add Member', path: '/admin/members?action=new' }, 
          ]
        },
        { 
          label: 'ShareHolders', 
          icon: PieChart,
          permission: MENU_PERMISSIONS.shareholders,
          submenu: [
            { label: 'Dashboard', path: '/admin/shareholders/dashboard' },
            { label: 'List View', path: '/admin/shareholders/list' },
            { label: 'Trash', path: '/admin/shareholders/trash', icon: Trash2 },
            { label: 'Pending Approvals', path: '/admin/shareholders/pending-approvals', icon: ClipboardCheck },
            { label: 'Pending Payment', path: '/admin/shareholders/pending-payments', icon: CreditCard },
            { label: 'Signed Agreements', path: '/admin/shareholders/signed-agreements', icon: FileCheck },
            { label: 'Settings', path: '/admin/shareholders/settings' }
          ]
        },
      ]
    },
    {
      label: 'System',
      collapsible: true,
      permission: MENU_PERMISSIONS.system,
      items: [
        { label: 'Reports Hub', path: '/admin/reports', icon: FileBarChart },
        { label: 'Activity Logs', path: '/admin/logs', icon: ScrollText },
        { label: 'Backup & Restore', path: '/admin/backup-restore', icon: Database },
        { label: 'General Settings', path: '/admin/general-settings', icon: Settings },
        { label: 'Roles & Permissions', path: '/admin/roles-permissions', icon: Key, permission: MENU_PERMISSIONS.roles },
        { label: 'System History', path: '/admin/history', icon: History },
      ]
    }
  ];

  const toggleMenu = (label) => {
    setOpenMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const pathMatches = (path) => {
    const base = path.split('?')[0];
    return location.pathname === base
      || location.pathname.startsWith(`${base}/`)
      || location.pathname + location.search === path;
  };

  const findActiveSection = () => {
    for (const group of menuGroups) {
      for (const item of group.items || []) {
        if (item.submenu?.some((sub) => pathMatches(sub.path))) {
          return item;
        }
      }
    }
    return null;
  };

  const activeSection = findActiveSection();

  const MenuItem = ({ item }) => {
    if (item.permission && !itemVisible(hasPermission, item.permission)) return null;

    const pathMatch = item.path?.split('?')[0];
    const activePaths = item.activePaths || (pathMatch ? [pathMatch] : []);
    const isActive = item.submenu
      ? item.submenu.some((sub) => pathMatches(sub.path))
      : (item.path ? activePaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`) || location.pathname + location.search === item.path) : false);

    const isOpen = Boolean(openMenus[item.label]);

    if (item.submenu) {
      const firstSub = item.submenu[0];
      return (
        <Link
          to={firstSub.path}
          onClick={() => setSidebarOpen(false)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden',
            isActive
              ? 'bg-[#D4AF37] text-[#003D82] font-bold shadow-md'
              : 'text-gray-100 hover:bg-white/10 hover:text-white'
          )}
        >
          <item.icon className={cn('w-5 h-5 transition-transform group-hover:scale-110', isActive ? 'text-[#003D82]' : 'text-[#D4AF37]')} />
          <span className="relative z-10">{tl('menu', item.label)}</span>
        </Link>
      );
    }

    return (
      <Link 
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden",
          location.pathname === item.path
            ? "bg-[#D4AF37] text-[#003D82] font-bold shadow-md" 
            : "text-gray-100 hover:bg-white/10 hover:text-white"
        )}
      >
        <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", location.pathname === item.path ? "text-[#003D82]" : "text-[#D4AF37]")} />
        <span className="relative z-10">{tl('menu', item.label)}</span>
      </Link>
    );
  };

  const MenuGroup = ({ group }) => {
    if (group.permission && !itemVisible(hasPermission, group.permission)) return null;

    const visibleItems = (group.items || []).filter((item) =>
      !item.permission || itemVisible(hasPermission, item.permission)
    );
    if (!visibleItems.length) return null;

    const groupKey = group.label;
    const isGroupOpen = openMenus[groupKey] ?? !group.collapsible;

    if (group.collapsible) {
      const groupActive = visibleItems.some((item) =>
        item.submenu
          ? item.submenu.some((sub) => location.pathname.startsWith(sub.path.split('?')[0]))
          : item.path && (location.pathname.startsWith(item.path.split('?')[0]) || location.pathname + location.search === item.path)
      );

      return (
        <Collapsible open={isGroupOpen} onOpenChange={() => toggleMenu(groupKey)} className="w-full">
          <CollapsibleTrigger className={cn(
            'flex items-center justify-between w-full px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/5',
            groupActive && 'text-[#D4AF37]'
          )}>
            <span>{tl('menu', group.label)}</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', isGroupOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            {visibleItems.map((item, i) => <MenuItem key={i} item={item} />)}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-4">{tl('menu', group.label)}</h3>
        <div className="space-y-1">
          {visibleItems.map((item, i) => <MenuItem key={i} item={item} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <div className="md:hidden bg-[#003D82] text-white p-4 flex justify-between items-center z-20 sticky top-0 shadow-md">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-[#D4AF37]">Alpha Admin</span>
          <LanguageSwitcher variant="admin" className="ml-auto md:hidden" />
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside className={cn(
        "fixed md:sticky top-0 h-screen bg-[#003D82] text-white w-64 transform transition-transform duration-200 ease-in-out z-10 flex flex-col shadow-2xl overflow-hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-[#D4AF37]/30 bg-[#002855] shrink-0">
          <h1 className="text-2xl font-bold text-[#D4AF37]">Alpha Bridge</h1>
          <p className="text-xs text-gray-300 mt-1 uppercase tracking-widest">Technologies Ltd</p>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-800">
          {menuGroups.map((group, idx) => (
            <MenuGroup key={idx} group={group} />
          ))}
        </nav>

        <div className="p-4 bg-[#002244] border-t border-[#D4AF37]/30 shrink-0">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-[#D4AF37] flex items-center justify-center text-[#003D82] font-bold">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-gray-200 font-medium truncate">
                {profile?.full_name || user?.email || 'Administrator'}
              </p>
              <div className="text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {permLoading ? tl('menu', 'Checking...') : (hasStaffAccess ? userRoleLabel : tl('menu', 'User'))}
              </div>
            </div>
          </div>
          
          <Link
            to="/admin/profile"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg text-gray-200 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <UserCog className="w-5 h-5 text-[#D4AF37]" />
            {tl('menu', 'My Profile')}
          </Link>

          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            className="w-full justify-start text-red-300 hover:text-white hover:bg-red-600/80 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-2" />
            {tl('menu', 'Sign Out')}
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-0 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-50 h-[calc(100vh-64px)] md:h-screen">
        <div className="hidden md:flex justify-end mb-4">
          <LanguageSwitcher variant="admin" />
        </div>
        {activeSection && (
          activeSection.label === 'Human Resources' ? (
            <HrTopNav />
          ) : activeSection.label === 'HR Letters' ? (
            <HrLettersTopNav />
          ) : (
          <div className="mb-6 -mx-1 overflow-x-auto scrollbar-thin">
            <nav className="flex gap-1 border-b border-gray-200 min-w-max pb-px">
              {activeSection.submenu.map((sub) => {
                const active = pathMatches(sub.path);
                return (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                      active
                        ? 'border-[#003D82] text-[#003D82] bg-white rounded-t-md'
                        : 'border-transparent text-gray-500 hover:text-[#003D82] hover:border-gray-300'
                    )}
                  >
                    {sub.icon && <sub.icon className="w-4 h-4 shrink-0" />}
                    {tl('menu', sub.label)}
                  </Link>
                );
              })}
            </nav>
          </div>
          )
        )}
        <div className="max-w-7xl mx-auto pb-10 print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;