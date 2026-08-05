import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';
import { cn } from '@/lib/utils';

export default function ErpShell({ title, subtitle, tabs = [], children }) {
  const location = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-600 mt-1">{subtitle}</p> : null}
      </div>
      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab, i) => {
            const theme = getTabTheme(i);
            const active = location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(COLORED_TAB_BASE, theme.idle, active && theme.active)}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}