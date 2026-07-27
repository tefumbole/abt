import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';

/**
 * Horizontal sub-navigation shown on admin section pages (events, invitations, etc.)
 */
const AdminHorizontalNav = ({ items = [], title, description }) => {
  const location = useLocation();

  const isActive = (path) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    if (location.pathname === path) return true;
    const hasMoreSpecificNav = items.some(
      (item) => item.path !== path && item.path.startsWith(`${path}/`)
    );
    if (hasMoreSpecificNav) return false;
    return location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="mb-6 space-y-3">
      {(title || description) && (
        <div>
          {title && <h1 className="text-2xl font-bold text-[#003D82]">{title}</h1>}
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
      )}
      <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {items.map((item, index) => {
          const theme = getTabTheme(item.color || index);
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
            >
              {item.icon && <item.icon className="w-4 h-4 shrink-0" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default AdminHorizontalNav;
