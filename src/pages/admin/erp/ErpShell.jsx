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

export const COMMERCE_TABS = [
  { label: 'Warehouses', path: '/admin/erp/warehouses' },
  { label: 'Products', path: '/admin/erp/products' },
  { label: 'People', path: '/admin/erp/people' },
  { label: 'Purchases', path: '/admin/erp/purchases' },
  { label: 'Sales', path: '/admin/erp/sales' },
  { label: 'Quotations', path: '/admin/erp/quotations' },
  { label: 'Deliveries', path: '/admin/erp/deliveries' },
  { label: 'Transfers', path: '/admin/erp/transfers' },
  { label: 'Returns', path: '/admin/erp/returns' },
  { label: 'Expenses', path: '/admin/erp/expenses' },
  { label: 'Payments', path: '/admin/erp/payments' },
  { label: 'Accounting', path: '/admin/erp/accounting' },
];
