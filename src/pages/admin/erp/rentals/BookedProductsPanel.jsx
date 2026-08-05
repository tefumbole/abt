import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, FileSpreadsheet, FileText, Loader2, Printer, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatErpDate, makeMoney, num } from '@/lib/erpFormat';
import { exportCsv, exportExcel, exportTablePdf, printTable } from '@/lib/erpExport';
import { listBookedProducts, listWarehouses } from '@/services/erpService';

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** The API may name these fields slightly differently per aggregation; read them tolerantly. */
const rowQty = (row) => num(row.total_qty ?? row.qty_booked ?? row.qty);
const rowBookings = (row) => num(row.bookings_count ?? row.bookings ?? row.booking_count);
const rowNextFrom = (row) => row.next_from ?? row.next_from_datetime ?? row.from_datetime;
const rowNextTo = (row) => row.next_to ?? row.next_to_datetime ?? row.to_datetime;
const rowValue = (row) => row.total_value ?? row.booked_value ?? row.grand_total;

/** Availability summary: how much of each product is committed over a date window. */
export default function BookedProductsPanel({ money, dateFormat = 'd-m-Y' }) {
  const fmtMoney = useMemo(() => money || makeMoney({}), [money]);

  const [warehouses, setWarehouses] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // `filters` is what the table shows; the inputs stay draft until Submit.
  const [draft, setDraft] = useState({ from: isoDate(), to: isoDate(30), warehouse_id: '' });
  const [filters, setFilters] = useState(draft);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await listWarehouses();
        if (alive.current) setWarehouses(list || []);
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listBookedProducts({
        from: filters.from || undefined,
        to: filters.to || undefined,
        warehouse_id: filters.warehouse_id || undefined,
      });
      if (!alive.current) return;
      setRows(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      if (!alive.current) return;
      setRows([]);
      setError(err.message || 'Booked products could not be loaded.');
      toast.error(err.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const showValue = rows.some((row) => rowValue(row) !== undefined && rowValue(row) !== null);

  const columns = useMemo(() => {
    const defs = [
      { key: 'product', label: 'Product', value: (row) => row.product_name || row.name || '—' },
      { key: 'code', label: 'Code', value: (row) => row.product_code || row.code || '—' },
      { key: 'qty', label: 'Total Qty Booked', align: 'right', value: (row) => String(rowQty(row)) },
      { key: 'bookings', label: 'Bookings', align: 'right', value: (row) => String(rowBookings(row)) },
      { key: 'next_from', label: 'Next From', value: (row) => formatErpDate(rowNextFrom(row), dateFormat, { withTime: true }) || '—' },
      { key: 'next_to', label: 'Next To', value: (row) => formatErpDate(rowNextTo(row), dateFormat, { withTime: true }) || '—' },
    ];
    if (showValue) {
      defs.push({ key: 'value', label: 'Booked Value', align: 'right', value: (row) => fmtMoney(rowValue(row)) });
    }
    return defs;
  }, [dateFormat, fmtMoney, showValue]);

  const runExport = (fn, filename) => {
    try {
      const result = fn({ filename, title: 'Booked Products', columns, rows });
      if (result?.catch) result.catch((err) => toast.error(err.message));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setFilters({ ...draft });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Booked Products</h2>
        <p className="text-sm text-slate-500">
          Equipment committed to bookings inside the selected window.
        </p>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
          <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={draft.from}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              />
              <span>to</span>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={draft.to}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              />
            </div>
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={draft.warehouse_id}
              onChange={(e) => setDraft((d) => ({ ...d, warehouse_id: e.target.value }))}
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <Button type="submit" size="sm" className="bg-[#003D82] hover:bg-[#002855]">
              <Search className="h-4 w-4 mr-1" /> Submit
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button" size="icon" variant="outline" className="text-pink-600" title="Export PDF"
              onClick={() => runExport(exportTablePdf, 'booked-products.pdf')}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              type="button" size="icon" variant="outline" className="text-emerald-600" title="Export Excel"
              onClick={() => runExport(exportExcel, 'booked-products.xls')}
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              type="button" size="icon" variant="outline" className="text-amber-600" title="Export CSV"
              onClick={() => runExport(exportCsv, 'booked-products.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button" size="icon" variant="outline" className="text-blue-600" title="Print"
              onClick={() => runExport(printTable, 'booked-products.pdf')}
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#003D82]" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={cn('p-3 whitespace-nowrap', c.align === 'right' && 'text-right')}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {error && (
                  <tr>
                    <td colSpan={columns.length} className="p-10 text-center">
                      <div className="text-rose-600">{error}</div>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={load}>
                        Try again
                      </Button>
                    </td>
                  </tr>
                )}
                {!error && rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="p-10 text-center text-slate-500">
                      No products are booked in this period.
                    </td>
                  </tr>
                )}
                {!error && rows.map((row, index) => (
                  <tr key={row.product_id ?? row.id ?? `${row.product_code || row.product_name}-${index}`} className="border-t hover:bg-slate-50/80">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'p-3 whitespace-nowrap',
                          c.align === 'right' && 'text-right',
                          c.key === 'product' && 'font-medium text-[#003D82]'
                        )}
                      >
                        {c.value(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
