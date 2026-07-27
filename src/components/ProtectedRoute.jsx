import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AccessDeniedPage from '@/components/AccessDeniedPage';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/context/PermissionContext';
import { canAccessAdminRoute, hasAdminPanelAccess } from '@/config/adminMenuPermissions';

const ADMIN_ROLES = ['admin', 'super_admin', 'director', 'manager'];

function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'superadmin' || raw === 'super admin') return 'super_admin';
  return raw.replace(/\s+/g, '_');
}

function getRoleFromStoredToken() {
  try {
    const raw = localStorage.getItem('alpha_supabase_auth');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token || parsed?.currentSession?.access_token;
    if (!token || !token.includes('.')) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return normalizeRole(payload.role);
  } catch {
    return '';
  }
}

function resolveUserRole({ role, profile, user, session, fallbackRole }) {
  const candidates = [
    fallbackRole,
    role,
    profile?.role,
    user?.app_metadata?.role,
    user?.user_metadata?.role,
    user?.role,
    session?.user?.app_metadata?.role,
    session?.user?.user_metadata?.role,
    session?.user?.role,
    getRoleFromStoredToken(),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate);
    if (normalized) return normalized;
  }
  return '';
}

const ProtectedRoute = ({
  children,
  requireAdmin = false,
  requireSuperAdmin = false,
  requiredPermission = null,
}) => {
  const {
    user,
    session,
    role,
    profile,
    loading: authLoading,
    isProfileLoading,
    otpVerified,
  } = useAuth();
  const { hasPermission, permissions, loading: permLoading, hasStaffAccess } = usePermission();
  const location = useLocation();
  const skipOtp = import.meta.env.VITE_DEV_SKIP_OTP === 'true';

  const needsRoleCheck = requireAdmin || requireSuperAdmin || requiredPermission;
  const fallbackRole = location.state?.verifiedRole;
  const userRole = resolveUserRole({ role, profile, user, session, fallbackRole });
  const isBuiltinAdmin = ADMIN_ROLES.includes(userRole);
  const waitingForRole = Boolean(user && needsRoleCheck && !userRole && (authLoading || isProfileLoading));
  const waitingForPermissions = Boolean(
    user && needsRoleCheck && !isBuiltinAdmin && !requireSuperAdmin && permLoading
  );

  if (authLoading || waitingForRole || waitingForPermissions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-transparent">
        <Loader2 className="w-10 h-10 animate-spin text-[#003D82] mb-4" />
        <p className="text-gray-500 text-sm animate-pulse">Verifying access...</p>
      </div>
    );
  }

  if (!user || !session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // OTP is required for every authenticated user (password alone is not enough).
  if (
    !skipOtp
    && !otpVerified
    && location.pathname !== '/otp-verification'
    && location.pathname !== '/login'
  ) {
    return (
      <Navigate
        to="/otp-verification"
        replace
        state={{ from: location, redirect: location.pathname + location.search }}
      />
    );
  }

  if (!needsRoleCheck) {
    if (
      ['task_assignee', 'customer'].includes(userRole)
      && !location.pathname.startsWith('/user/tasks')
      && !location.pathname.startsWith('/task-invite')
      && location.pathname !== '/login'
      && location.pathname !== '/otp-verification'
    ) {
      return <Navigate to="/user/tasks/pending-acceptances" replace />;
    }
    return children;
  }

  let allowed = false;
  if (requireSuperAdmin) {
    allowed = userRole === 'super_admin';
  } else if (requiredPermission) {
    allowed =
      userRole === 'super_admin'
      || hasPermission(requiredPermission)
      || isBuiltinAdmin;
  } else if (requireAdmin) {
    allowed = isBuiltinAdmin
      || hasAdminPanelAccess(hasPermission, permissions)
      || canAccessAdminRoute(location.pathname, hasPermission, permissions);
  }

  if (!allowed) {
    console.warn('[ProtectedRoute] Access denied', {
      userId: user.id,
      userRole,
      permissionCount: permissions.length,
      hasStaffAccess,
      path: location.pathname,
      requireAdmin,
      requireSuperAdmin,
      requiredPermission,
    });
    return <AccessDeniedPage />;
  }

  return children;
};

export default ProtectedRoute;
