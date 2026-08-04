import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/context/PermissionContext';
import { MENU_PERMISSIONS, itemVisible } from '@/config/adminMenuPermissions';
import { formatRoleLabel } from '@/services/roleService';
import HrTopNav from '@/components/hr/HrTopNav';
import HrLettersTopNav from '@/components/hr/HrLettersTopNav';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  LogOut, 
  Menu, 
  X, 
  Clock, 
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
  Inbox,
  Ticket,
  QrCode,
  LineChart,
  Headphones,
  Music,
  Sliders,
  Utensils,
  ClipboardCheck,
  ClipboardList,
  Trash2,
  UserPlus,
  Wallet,
  UserCog,
  Image as ImageIcon,
  Globe,
  Warehouse,
  Package,
  PackagePlus,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Receipt,
  Landmark,
  Building2,
  FileSignature,
  Rocket,
  Tags,
  List,
  PencilLine,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useSiteLabel } from '@/hooks/useSiteLabel';
import { getAdminSiteContent } from '@/services/siteContentService';
import { APP_VERSION } from '@/constants/appVersion';

function orderIndex(order, key) {
  if (!Array.isArray(order) || !key) return 9999;
  const i = order.indexOf(key);
  return i === -1 ? 9999 : i;
}

const AdminLayout = () => {
  const { logout, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tl = useSiteLabel();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sideOrder, setSideOrder] = useState(null);
  const [settingsOrder, setSettingsOrder] = useState(null);
  const { hasPermission, hasStaffAccess, loading: permLoading } = usePermission();
  const userRoleLabel = formatRoleLabel(profile?.role || user?.app_metadata?.role || user?.role || '');

  useEffect(() => {
    let cancelled = false;
    const loadMenuOrders = () => {
      getAdminSiteContent()
        .then((data) => {
          if (cancelled) return;
          setSideOrder(data?.menus?.side?.order || null);
          setSettingsOrder(data?.menus?.settings?.order || null);
        })
        .catch(() => {});
    };
    loadMenuOrders();
    const onUpdated = () => loadMenuOrders();
    window.addEventListener('alphabridge:site-content-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('alphabridge:site-content-updated', onUpdated);
    };
  }, []);

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
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, permission: MENU_PERMISSIONS.dashboard, menuKey: 'dashboard' },
      ]
    },
    {
      label: 'Work Management',
      items: [
        { 
          label: 'Task Management', 
          icon: ListTodo,
          permission: MENU_PERMISSIONS.tasks,
          menuKey: 'tasks',
          submenu: [
            { label: 'Task Dashboard', path: '/admin/tasks/dashboard', icon: LayoutDashboard, color: 'navy' },
            { label: 'Create Task', path: '/admin/tasks/create', icon: PlusCircle, color: 'green' },
            { label: 'All Tasks', path: '/admin/tasks', icon: ListTodo, color: 'blue' },
            { label: 'Scheduled', path: '/admin/tasks/scheduled', icon: CalendarClock, color: 'purple' },
            { label: 'Reminders', path: '/admin/tasks/reminders', icon: Clock, color: 'orange' },
            { label: 'My Tasks', path: '/admin/tasks/my-tasks', icon: CheckCircle, color: 'teal' },
            { label: 'Pending Acceptances', path: '/admin/tasks/pending-acceptances', icon: Inbox, color: 'gold' },
            { label: 'Task Settings', path: '/admin/tasks/settings', icon: Settings, color: 'slate' },
          ]
        },
        { 
          label: 'Job Board', 
          icon: Briefcase,
          permission: MENU_PERMISSIONS.jobs,
          menuKey: 'jobs',
          submenu: [
            { label: 'Recruitment Dashboard', path: '/admin/recruitment-dashboard', color: 'navy' },
            { label: 'Manage Jobs', path: '/admin/jobs', color: 'blue' },
            { label: 'All Applications', path: '/admin/applications', color: 'purple' },
            { label: 'Shortlisted', path: '/admin/applications/shortlisted', color: 'green' },
            { label: 'Rejected', path: '/admin/applications/rejected', color: 'rose' },
          ]
        },
        { label: 'Event Management', path: '/admin/events', icon: CalendarDays, permission: MENU_PERMISSIONS.events, menuKey: 'events' },
        { label: 'Digital Invitations', path: '/admin/invitations', icon: Ticket, permission: MENU_PERMISSIONS.invitations, menuKey: 'invitations', activePaths: ['/admin/invitations', '/admin/check-in'] },
        { label: 'Event Templates & Config', path: '/admin/events/templates', icon: Settings, permission: MENU_PERMISSIONS.eventTemplates, menuKey: 'event-templates', activePaths: ['/admin/events/templates', '/admin/events/wa-templates', '/admin/events/webhooks'] },
      ]
    },
    {
      label: 'Communication & Messaging',
      items: [
        {
          label: 'Announcements',
          icon: Megaphone,
          permission: MENU_PERMISSIONS.announcements,
          menuKey: 'announcements',
          submenu: [
            { label: 'Compose', path: '/admin/announcements/compose', icon: PenLine, color: 'navy' },
            { label: 'All Announcements', path: '/admin/announcements/list', icon: FileText, color: 'blue' },
            { label: 'Scheduled', path: '/admin/announcements/scheduled', icon: Clock, color: 'gold' },
            { label: 'Templates', path: '/admin/announcements/templates', icon: FileText, color: 'purple' },
            { label: 'Categories', path: '/admin/announcements/categories', icon: FileText, color: 'teal' },
            { label: 'Settings', path: '/admin/announcements/settings', icon: Settings, color: 'slate' },
          ]
        },
        { label: 'Gallery', path: '/admin/gallery', icon: ImageIcon, permission: MENU_PERMISSIONS.gallery, menuKey: 'gallery' },
      ]
    },
    {
      label: 'Time & Attendance',
      items: [
        {
          label: 'TimeSheets (Employee)',
          icon: Clock,
          permission: MENU_PERMISSIONS.timesheets,
          menuKey: 'timesheets',
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
          menuKey: 'timesheet-admin',
          submenu: [
            { label: 'TimeSheet Report', path: '/admin/timesheet-report' },
            { label: 'Overtime Report', path: '/admin/overtime-report' },
            { label: 'Manage All', path: '/admin/manage-timesheets' },
            { label: 'Categories', path: '/admin/timesheet-categories' } 
          ]
        },
        { label: 'Payments', path: '/admin/payments', icon: CreditCard, permission: MENU_PERMISSIONS.operations, menuKey: 'payments' }, 
      ]
    },
    {
      label: 'Courses',
      items: [
        {
          label: 'Courses',
          icon: BookOpen,
          permission: MENU_PERMISSIONS.courses,
          menuKey: 'courses',
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
          menuKey: 'hr',
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
          menuKey: 'hr-letters',
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
          menuKey: 'users',
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
          menuKey: 'members',
          submenu: [
            { label: 'Member List', path: '/admin/members', color: 'navy' },
            { label: 'Add Member', path: '/admin/members?action=new', color: 'green' },
          ]
        },
        { 
          label: 'ShareHolders', 
          icon: PieChart,
          permission: MENU_PERMISSIONS.shareholders,
          menuKey: 'shareholders',
          submenu: [
            { label: 'Dashboard', path: '/admin/shareholders/dashboard', color: 'navy' },
            { label: 'List View', path: '/admin/shareholders/list', color: 'blue' },
            { label: 'Trash', path: '/admin/shareholders/trash', icon: Trash2, color: 'rose' },
            { label: 'Pending Approvals', path: '/admin/shareholders/pending-approvals', icon: ClipboardCheck, color: 'gold' },
            { label: 'Pending Payment', path: '/admin/shareholders/pending-payments', icon: CreditCard, color: 'orange' },
            { label: 'Signed Agreements', path: '/admin/shareholders/signed-agreements', icon: FileCheck, color: 'green' },
            { label: 'Settings', path: '/admin/shareholders/settings', color: 'slate' }
          ]
        },
        {
          label: 'ERP People',
          icon: Users,
          permission: MENU_PERMISSIONS.erpCommerce,
          menuKey: 'erp-people',
          submenu: [
            { label: 'User List', path: '/admin/erp/people?tab=user-list', color: 'navy' },
            { label: 'Add User', path: '/admin/erp/people?tab=add-user', color: 'gold' },
            { label: 'Customer List', path: '/admin/erp/people?tab=customer-list', color: 'purple' },
            { label: 'Add Customer', path: '/admin/erp/people?tab=add-customer', color: 'pink' },
            { label: 'Biller List', path: '/admin/erp/people?tab=biller-list', color: 'orange' },
            { label: 'Add Biller', path: '/admin/erp/people?tab=add-biller', color: 'cyan' },
            { label: 'Supplier List', path: '/admin/erp/people?tab=supplier-list', color: 'rose' },
            { label: 'Add Supplier', path: '/admin/erp/people?tab=add-supplier', color: 'indigo' },
          ],
        },
      ]
    },
    {
      label: 'ERP / Commerce',
      permission: MENU_PERMISSIONS.erpCommerce,
      items: [
        { label: 'Warehouses', path: '/admin/erp/warehouses', icon: Warehouse, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-warehouses' },
        {
          label: 'Products',
          icon: Package,
          permission: MENU_PERMISSIONS.erpCommerce,
          menuKey: 'erp-products',
          submenu: [
            { label: 'Category', path: '/admin/erp/products?tab=category', color: 'navy', icon: Tags },
            { label: 'Product List', path: '/admin/erp/products?tab=product-list', color: 'gold', icon: List },
            { label: 'Add Product', path: '/admin/erp/products?tab=add-product', color: 'purple', icon: PackagePlus },
            { label: 'Print Barcode', path: '/admin/erp/products?tab=barcode', color: 'pink', icon: Printer },
            { label: 'Adjustment List', path: '/admin/erp/products?tab=adjustment-list', color: 'green', icon: ClipboardList },
            { label: 'Add Adjustment', path: '/admin/erp/products?tab=add-adjustment', color: 'orange', icon: PencilLine },
            { label: 'Stock Count', path: '/admin/erp/products?tab=stock-count', color: 'cyan', icon: List },
          ],
        },
        { label: 'Purchases', path: '/admin/erp/purchases', icon: Truck, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-purchases' },
        { label: 'Sales', path: '/admin/erp/sales', icon: ShoppingCart, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-sales' },
        { label: 'Quotations', path: '/admin/erp/quotations', icon: FileText, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-quotations' },
        { label: 'Deliveries', path: '/admin/erp/deliveries', icon: Truck, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-deliveries' },
        { label: 'Transfers', path: '/admin/erp/transfers', icon: ArrowLeftRight, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-transfers' },
        { label: 'Returns', path: '/admin/erp/returns', icon: ArrowLeftRight, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-returns' },
        { label: 'Expenses', path: '/admin/erp/expenses', icon: Receipt, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-expenses' },
        { label: 'Payments', path: '/admin/erp/payments', icon: Wallet, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-payments' },
        { label: 'Accounting', path: '/admin/erp/accounting', icon: Landmark, permission: MENU_PERMISSIONS.erpCommerce, menuKey: 'erp-accounting' },
      ],
    },
    {
      label: 'ERP Rentals',
      permission: MENU_PERMISSIONS.erpRentals,
      items: [
        { label: 'Bookings', path: '/admin/erp/rentals', icon: CalendarDays, permission: MENU_PERMISSIONS.erpRentals, menuKey: 'erp-rentals' },
      ],
    },
    {
      label: 'ERP Contracts & Assets',
      items: [
        { label: 'Contracts', path: '/admin/erp/contracts', icon: FileSignature, permission: MENU_PERMISSIONS.erpContracts, menuKey: 'erp-contracts' },
        { label: 'ERP Letters', path: '/admin/erp/letters', icon: Mail, permission: MENU_PERMISSIONS.erpContracts, menuKey: 'erp-letters' },
        { label: 'Fixed Assets', path: '/admin/erp/assets', icon: Building2, permission: MENU_PERMISSIONS.erpAssets, menuKey: 'erp-assets' },
        { label: 'Leaders', path: '/admin/erp/leaders', icon: Users, permission: MENU_PERMISSIONS.erpAssets, menuKey: 'erp-leaders' },
      ],
    },
    {
      label: 'System',
      collapsible: true,
      permission: MENU_PERMISSIONS.system,
      items: [
        { label: 'Site Content', path: '/admin/site-content', icon: Globe, permission: MENU_PERMISSIONS.siteContent, menuKey: 'site-content' },
        { label: 'Backup & Restore', path: '/admin/backup-restore', icon: Database, menuKey: 'backup' },
        { label: 'Settings', path: '/admin/general-settings', icon: Settings, menuKey: 'general-settings' },
      ]
    }
  ];

  const menuGroupsOrdered = useMemo(() => {
    const groups = menuGroups.map((group) => {
      let items = [...(group.items || [])];
      if (group.label === 'System' && settingsOrder) {
        items = [...items].sort(
          (a, b) => orderIndex(settingsOrder, a.menuKey) - orderIndex(settingsOrder, b.menuKey)
        );
      }
      return { ...group, items };
    });

    // Flat unique list — no section headings (avoids duplicate group labels).
    const byKey = new Map();
    groups.forEach((group) => {
      (group.items || []).forEach((item) => {
        if (!item?.menuKey || byKey.has(item.menuKey)) return;
        byKey.set(item.menuKey, item);
      });
    });

    const orderedKeys = Array.isArray(sideOrder) && sideOrder.length
      ? [
          ...sideOrder.filter((key) => byKey.has(key)),
          ...[...byKey.keys()].filter((key) => !sideOrder.includes(key)),
        ]
      : [...byKey.keys()];

    return [{
      label: 'Menu',
      items: orderedKeys.map((key) => byKey.get(key)).filter(Boolean),
    }];
  }, [sideOrder, settingsOrder]);

  const pathMatches = (path) => {
    const base = path.split('?')[0];
    const hasQuery = path.includes('?');
    if (hasQuery) {
      const full = `${location.pathname}${location.search}`;
      if (full === path) return true;
      // Default Product/People tab when URL has no query
      if (
        (path.includes('tab=category') || path.includes('tab=user-list'))
        && location.pathname === base
        && (!location.search || location.search === `?${path.split('?')[1]}`)
      ) {
        return true;
      }
      return false;
    }
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  };

  const sectionMatches = (path) => {
    const base = path.split('?')[0];
    return location.pathname === base
      || location.pathname.startsWith(`${base}/`)
      || pathMatches(path);
  };

  const findActiveSection = () => {
    for (const group of menuGroupsOrdered) {
      for (const item of group.items || []) {
        if (item.submenu?.some((sub) => sectionMatches(sub.path))) {
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
      ? item.submenu.some((sub) => sectionMatches(sub.path))
      : (item.path ? activePaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`) || location.pathname + location.search === item.path) : false);

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
          isActive
            ? "bg-[#D4AF37] text-[#003D82] font-bold shadow-md" 
            : "text-gray-100 hover:bg-white/10 hover:text-white"
        )}
      >
        <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-[#003D82]" : "text-[#D4AF37]")} />
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

    // No section headings — render menu items only
    return (
      <div className="space-y-1">
        {visibleItems.map((item) => (
          <MenuItem key={item.menuKey || item.label} item={item} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <div className="md:hidden bg-[#003D82] text-white p-4 flex justify-between items-center z-20 sticky top-0 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-lg text-[#D4AF37]">Alpha Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {(hasStaffAccess || itemVisible(hasPermission, MENU_PERMISSIONS.erpCommerce)) && (
            <Link
              to="/admin/erp/pos"
              onClick={() => setSidebarOpen(false)}
              className="rounded-full bg-[#D4AF37] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[#0A2540] shadow-sm hover:bg-[#c9a227] transition-colors"
            >
              POS
            </Link>
          )}
          <LanguageSwitcher variant="admin" className="md:hidden" />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <aside className={cn(
        "fixed md:sticky top-0 h-screen bg-[#003D82] text-white w-64 transform transition-transform duration-200 ease-in-out z-10 flex flex-col shadow-2xl overflow-hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-[#D4AF37]/30 bg-[#002855] shrink-0">
          <h1 className="text-2xl font-bold text-[#D4AF37]">Alpha Bridge</h1>
          <p className="text-xs text-gray-300 mt-1 uppercase tracking-widest">Technologies Ltd</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-800">
          {menuGroupsOrdered.map((group, idx) => (
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
          <Link
            to="/admin/releases"
            onClick={() => setSidebarOpen(false)}
            className="mt-3 block text-center text-[10px] text-[#D4AF37]/90 hover:text-[#D4AF37] tracking-wide"
            title="Deployment versions"
          >
            {APP_VERSION}
          </Link>
        </div>
      </aside>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-0 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-50 h-[calc(100vh-64px)] md:h-screen">
        <div className="hidden md:flex justify-end items-center gap-3 mb-4">
          {(hasStaffAccess || itemVisible(hasPermission, MENU_PERMISSIONS.erpCommerce)) && (
            <Link
              to="/admin/erp/pos"
              className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[#0A2540] shadow-sm hover:bg-[#c9a227] transition-colors"
            >
              POS
            </Link>
          )}
          <Link
            to="/admin/releases"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#003D82]/40 hover:text-[#003D82]"
            title="Deployment versions"
          >
            <Rocket className="h-3.5 w-3.5 text-[#D4AF37]" />
            {APP_VERSION}
          </Link>
          <LanguageSwitcher variant="admin" />
        </div>
        {activeSection && (
          activeSection.label === 'Human Resources' ? (
            <HrTopNav />
          ) : activeSection.label === 'HR Letters' ? (
            <HrLettersTopNav />
          ) : (
          <div className="mb-6 overflow-x-auto scrollbar-thin">
            <nav className="flex flex-wrap gap-2 min-w-max">
              {activeSection.submenu.map((sub, index) => {
                const active = pathMatches(sub.path);
                const theme = getTabTheme(sub.color || index);
                return (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
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