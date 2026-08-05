import React, { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportCsv } from '@/lib/erpExport';
import {
  listReportExpensesSummary, listReportProfitLoss, listReportPurchasesSummary,
  listReportSalesSummary, listReportStockSummary, listWarehouses,
} from '@/services/erpService';
import ErpShell from './ErpShell';

const TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'stock', label: 'Stock' },
  { key: 'pl', label: 'P&L' },
  { key: 'expenses', label: 'Expenses' },
];

function money(v) {
  return Number(v || 0).toFixed(2);
}

function StatCards({ items }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {items.map(([label, val, isMoney = true]) => (
        <div key={label} className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-xl font-bold">{isMoney ? money(val) : Number(val || 0)}</div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="rounded-xl border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>{columns.map((c) => <th key={c.key} className="p-3">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {(rows || []).length === 0 ? (
            <tr><td className="p-4 text-slate-500" colSpan={columns.length}>No rows</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.id || r.day || r.reference || i} className="border-t">
              {columns.map((c) => {
                const raw = typeof c.value === 'function' ? c.value(r) : r[c.key];
                const display = c.money ? money(raw) : (raw ?? '—');
                return <td key={c.key} className="p-3">{display}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('sales');
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', warehouse_id: '' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    listWarehouses().then(setWarehouses).catch((e) => toast.error(e.message));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        from: filters.from || undefined,
        to: filters.to || undefined,
        warehouse_id: filters.warehouse_id || undefined,
      };
      let result;
      if (tab === 'sales') result = await listReportSalesSummary(params);
      else if (tab === 'purchases') result = await listReportPurchasesSummary(params);
      else if (tab === 'stock') result = await listReportStockSummary({ warehouse_id: params.warehouse_id });
      else if (tab === 'pl') result = await listReportProfitLoss({ from: params.from, to: params.to });
      else result = await listReportExpensesSummary({ from: params.from, to: params.to });
      setData(result);
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const exportCurrent = () => {
    if (!data) return;
    if (tab === 'sales') {
      exportCsv({
        filename: 'sales-summary.csv',
        columns: [
          { key: 'day', label: 'Day' },
          { key: 'count', label: 'Count' },
          { key: 'grand_total', label: 'Grand total' },
          { key: 'paid_amount', label: 'Paid' },
        ],
        rows: data.by_day || [],
      });
    } else if (tab === 'purchases') {
      exportCsv({
        filename: 'purchases-summary.csv',
        columns: [
          { key: 'day', label: 'Day' },
          { key: 'count', label: 'Count' },
          { key: 'grand_total', label: 'Grand total' },
          { key: 'paid_amount', label: 'Paid' },
        ],
        rows: data.by_day || [],
      });
    } else if (tab === 'stock') {
      exportCsv({
        filename: 'stock-summary.csv',
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'qty', label: 'Qty' },
          { key: 'stock_value', label: 'Value' },
          { key: 'warehouses', label: 'Warehouses' },
        ],
        rows: data.items || [],
      });
    } else if (tab === 'pl') {
      exportCsv({
        filename: 'profit-loss.csv',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value' },
        ],
        rows: [
          { metric: 'Revenue', value: data.revenue },
          { metric: 'COGS', value: data.cogs },
          { metric: 'Gross profit', value: data.gross_profit },
          { metric: 'Expenses', value: data.expenses },
          { metric: 'Net profit', value: data.net_profit },
        ],
      });
    } else {
      exportCsv({
        filename: 'expenses-summary.csv',
        columns: [
          { key: 'category_name', label: 'Category', value: (r) => r.category_name || 'Uncategorized' },
          { key: 'count', label: 'Count' },
          { key: 'total', label: 'Total' },
        ],
        rows: data.by_category || [],
      });
    }
    toast.success('CSV exported');
  };

  return (
    <ErpShell title="ERP Reports Hub" subtitle="Sales, purchases, stock, P&L and expenses">
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <form
        className="rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-end mb-4"
        onSubmit={(e) => { e.preventDefault(); load(); }}
      >
        {tab !== 'stock' && (
          <>
            <div><Label>From</Label><Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
            <div><Label>To</Label><Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
          </>
        )}
        {(tab === 'sales' || tab === 'purchases' || tab === 'stock') && (
          <div>
            <Label>Warehouse</Label>
            <select
              className="w-full border rounded-md h-10 px-2 min-w-[180px]"
              value={filters.warehouse_id}
              onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })}
            >
              <option value="">All</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}
        <Button type="submit">Apply</Button>
        <Button type="button" variant="outline" onClick={exportCurrent} disabled={!data || loading}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </form>

      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : !data ? (
        <p className="text-slate-500">No data</p>
      ) : (
        <>
          {tab === 'sales' && (
            <>
              <StatCards items={[
                ['Sales', data.summary?.count, false],
                ['Grand total', data.summary?.grand_total],
                ['Paid', data.summary?.paid_amount],
                ['Due', data.summary?.due_amount],
              ]} />
              <h3 className="font-semibold mb-2">By day</h3>
              <SimpleTable
                columns={[
                  { key: 'day', label: 'Day' },
                  { key: 'count', label: 'Count' },
                  { key: 'grand_total', label: 'Total', money: true },
                  { key: 'paid_amount', label: 'Paid', money: true },
                ]}
                rows={data.by_day}
              />
            </>
          )}
          {tab === 'purchases' && (
            <>
              <StatCards items={[
                ['Purchases', data.summary?.count, false],
                ['Grand total', data.summary?.grand_total],
                ['Paid', data.summary?.paid_amount],
                ['Due', data.summary?.due_amount],
              ]} />
              <h3 className="font-semibold mb-2">By supplier</h3>
              <SimpleTable
                columns={[
                  { key: 'supplier_name', label: 'Supplier', value: (r) => r.supplier_name || '—' },
                  { key: 'count', label: 'Count' },
                  { key: 'grand_total', label: 'Total', money: true },
                ]}
                rows={data.by_supplier}
              />
            </>
          )}
          {tab === 'stock' && (
            <>
              <StatCards items={[
                ['Products', data.summary?.product_count, false],
                ['Total qty', data.summary?.total_qty, false],
                ['Stock value', data.summary?.total_value],
              ]} />
              <SimpleTable
                columns={[
                  { key: 'code', label: 'Code' },
                  { key: 'name', label: 'Name' },
                  { key: 'qty', label: 'Qty', money: true },
                  { key: 'stock_value', label: 'Value', money: true },
                  { key: 'warehouses', label: 'Warehouses' },
                ]}
                rows={data.items}
              />
            </>
          )}
          {tab === 'pl' && (
            <StatCards items={[
              ['Revenue', data.revenue],
              ['COGS', data.cogs],
              ['Gross profit', data.gross_profit],
              ['Expenses', data.expenses],
              ['Net profit', data.net_profit],
              ['Sales', data.sale_count, false],
            ]} />
          )}
          {tab === 'expenses' && (
            <>
              <StatCards items={[
                ['Expenses', data.summary?.count, false],
                ['Total', data.summary?.total],
              ]} />
              <h3 className="font-semibold mb-2">By category</h3>
              <SimpleTable
                columns={[
                  { key: 'category_name', label: 'Category', value: (r) => r.category_name || 'Uncategorized' },
                  { key: 'count', label: 'Count' },
                  { key: 'total', label: 'Total', money: true },
                ]}
                rows={data.by_category}
              />
            </>
          )}
        </>
      )}
    </ErpShell>
  );
}
