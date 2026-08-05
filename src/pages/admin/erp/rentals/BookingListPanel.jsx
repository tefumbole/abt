import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Columns3, Download, FileSpreadsheet,
  FileText, Loader2, Pencil, PenLine, Printer, RotateCcw, Search, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';
import BookingDetailsModal, {
  bookingPeriod, downloadBookingSheet, printBookingSheet,
} from '@/components/erp/rentals/BookingDetailsModal';
import { formatErpDate, makeMoney, num } from '@/lib/erpFormat';
import {
  BOOKING_STATUSES, BOOKING_STATUS_META, REVIEW_STATUS_META, SIGNATURE_STATUS_META, statusMeta,
} from '@/lib/rentalFormat';
import {
  exportCsv, exportExcel, exportTablePdf, printTable,
} from '@/lib/erpExport';
import {
  deleteBooking, getBooking, listCustomers, listWarehouses, queryBookings,
  reviewBooking, sendBookingSignLink, setBookingStatus,
} from '@/services/erpService';

const COLUMN_STORAGE_KEY = 'erp.rental-bookings.columns';

const COLUMN_DEFS = [
  { key: 'date', label: 'Date' },
  { key: 'reference', label: 'Reference' },
  { key: 'customer', label: 'Customer' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'biller', label: 'Biller' },
  { key: 'period', label: 'Period' },
  { key: 'items', label: 'Items', align: 'right' },
  { key: 'booking_status', label: 'Booking Status' },
  { key: 'signature_status', label: 'Signature' },
  { key: 'review_status', label: 'Review' },
  { key: 'grand_total', label: 'Grand Total', align: 'right' },
];

const VIEW_META = {
  list: { title: 'Booking List', empty: 'No bookings found for this filter.' },
  request: { title: 'Booking Requests', empty: 'No booking requests are waiting for a decision.' },
  'awaiting-signature': { title: 'Awaiting Signature', empty: 'No bookings are waiting for a signature.' },
  'pending-review': { title: 'Pending Review', empty: 'No bookings are waiting for review.' },
  signed: { title: 'Signed Contracts', empty: 'No signed contracts yet.' },
  reminder: { title: 'Booking Reminder', empty: 'No bookings need a reminder right now.' },
};

/** `counts` is keyed by workflow queue, so a few status pills read an aliased key. */
const COUNT_ALIASES = { requested: 'request' };

const STATUS_ACTIONS = [
  { status: 'confirmed', label: 'Confirm' },
  { status: 'ongoing', label: 'Mark Ongoing' },
  { status: 'completed', label: 'Mark Completed' },
  { status: 'cancelled', label: 'Cancel' },
];

const EMPTY_FILTERS = {
  q: '',
  booking_status: '',
  warehouse_id: '',
  customer_id: '',
  from: '',
  to: '',
};

function readStoredColumns() {
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) {
      return COLUMN_DEFS.filter((c) => parsed.includes(c.key)).map((c) => c.key);
    }
  } catch {
    /* fall through to defaults */
  }
  return COLUMN_DEFS.map((c) => c.key);
}

/**
 * One list surface for every booking queue. `view` is a server-side preset
 * (`list`, `request`, `awaiting-signature`, `pending-review`, `signed`, `reminder`).
 */
export default function BookingListPanel({
  view = 'list',
  title,
  description,
  money,
  dateFormat = 'd-m-Y',
  onEdit = () => {},
  onCountsChange = () => {},
}) {
  const meta = VIEW_META[view] || VIEW_META.list;
  const fmtMoney = useMemo(() => money || makeMoney({}), [money]);

  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ grand_total: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(readStoredColumns);

  // Keeping the callback in a ref stops a new inline parent function from re-triggering loads.
  const countsCallback = useRef(onCountsChange);
  useEffect(() => { countsCallback.current = onCountsChange; }, [onCountsChange]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Switching queue resets paging/filters during render so only one fetch runs.
  const [renderedView, setRenderedView] = useState(view);
  if (renderedView !== view) {
    setRenderedView(view);
    setPage(1);
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
    setSelected([]);
  }

  const activeColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* storage unavailable — visibility stays in-memory */
    }
  }, [visibleColumns]);

  useEffect(() => {
    (async () => {
      try {
        const [w, c] = await Promise.all([listWarehouses(), listCustomers('?active=1')]);
        if (!alive.current) return;
        setWarehouses(w || []);
        setCustomers(c || []);
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, []);

  // Sequence guard: a slow earlier request must never overwrite a newer result.
  const requestId = useRef(0);

  const loadList = useCallback(async () => {
    const request = requestId.current + 1;
    requestId.current = request;
    const current = () => alive.current && requestId.current === request;
    setLoading(true);
    setError('');
    try {
      const res = await queryBookings({
        view,
        page,
        per_page: perPage,
        q: filters.q || undefined,
        warehouse_id: filters.warehouse_id || undefined,
        customer_id: filters.customer_id || undefined,
        booking_status: filters.booking_status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      if (!current()) return;
      const data = res?.data || [];
      setRows(data);
      setTotal(num(res?.total, data.length));
      setTotals(res?.totals || { grand_total: 0 });
      setCounts(res?.counts || {});
      setSelected([]);
      countsCallback.current?.(res?.counts || {});
    } catch (err) {
      if (!current()) return;
      setRows([]);
      setTotal(0);
      setError(err.message || 'Bookings could not be loaded.');
      toast.error(err.message);
    } finally {
      if (current()) setLoading(false);
    }
  }, [view, page, perPage, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
  const firstRow = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastRow = Math.min(page * perPage, total);
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const cellText = useCallback((row, key) => {
    switch (key) {
      case 'date': return formatErpDate(row.from_datetime || row.created_at, dateFormat, { withTime: true });
      case 'reference': return row.reference || '';
      case 'customer': return row.customer_name || '—';
      case 'warehouse': return row.warehouse_name || '—';
      case 'biller': return row.biller_name || '—';
      case 'period': return bookingPeriod(row, dateFormat) || '—';
      case 'items': return String(num(row.items_count));
      case 'booking_status': return statusMeta(BOOKING_STATUS_META, row.booking_status, 'pending').label;
      case 'signature_status': return statusMeta(SIGNATURE_STATUS_META, row.signature_status, 'none').label;
      case 'review_status': return statusMeta(REVIEW_STATUS_META, row.review_status, 'none').label;
      case 'grand_total': return fmtMoney(row.grand_total);
      default: return '';
    }
  }, [dateFormat, fmtMoney]);

  const exportPayload = useCallback((filename) => ({
    filename,
    title: title || meta.title,
    columns: activeColumns.map((c) => ({
      key: c.key,
      label: c.label,
      align: c.align,
      value: (row) => cellText(row, c.key),
    })),
    rows,
  }), [activeColumns, cellText, meta.title, rows, title]);

  const runExport = (fn, filename) => {
    try {
      const result = fn(exportPayload(filename));
      if (result?.catch) result.catch((err) => toast.error(err.message));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const withFullBooking = async (row) => (row.items ? row : getBooking(row.id));

  const runRowAction = async (row, action) => {
    setBusyId(row.id);
    try {
      await action();
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (alive.current) setBusyId(null);
    }
  };

  const printSheet = (row) => runRowAction(row, async () => {
    await printBookingSheet(await withFullBooking(row), dateFormat);
  });

  const downloadSheet = (row) => runRowAction(row, async () => {
    await downloadBookingSheet(await withFullBooking(row), dateFormat);
  });

  const sendSignLink = (row) => runRowAction(row, async () => {
    await sendBookingSignLink(row.id, {});
    toast.success(`Signature link sent for ${row.reference || 'the booking'}`);
    await loadList();
  });

  const changeStatus = (row, status, message) => runRowAction(row, async () => {
    await setBookingStatus(row.id, status);
    toast.success(message);
    await loadList();
  });

  const review = (row, action) => {
    let note = '';
    if (action === 'reject') {
      const answer = window.prompt('Why is this booking rejected?');
      if (answer === null) return;
      note = answer.trim();
    }
    runRowAction(row, async () => {
      await reviewBooking(row.id, { action, note });
      toast.success(action === 'approve' ? 'Booking approved' : 'Booking rejected');
      await loadList();
    });
  };

  const removeBooking = (row) => {
    if (!window.confirm(`Delete booking ${row.reference || row.id}? This cannot be undone.`)) return;
    runRowAction(row, async () => {
      await deleteBooking(row.id);
      toast.success('Booking deleted');
      await loadList();
    });
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected booking(s)?`)) return;
    let ok = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        // Sequential so a partial failure still reports an accurate count.
        await deleteBooking(id);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    if (ok) toast.success(`${ok} booking(s) deleted`);
    if (failed) toast.error(`${failed} booking(s) could not be deleted`);
    loadList();
  };

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters((f) => ({ ...f, q: searchInput.trim() }));
  };

  const resetFilters = () => {
    setSearchInput('');
    setPage(1);
    setFilters(EMPTY_FILTERS);
  };

  const setFilter = (patch) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const statusPills = useMemo(() => ([
    { key: 'all', label: 'All', color: 'navy' },
    ...BOOKING_STATUSES.map((key, index) => ({
      key,
      label: BOOKING_STATUS_META[key].label,
      color: index + 1,
    })),
  ]), []);

  const pillCount = (key) => {
    const raw = key === 'all' ? counts.all : counts[key] ?? counts[COUNT_ALIASES[key]];
    return raw === undefined || raw === null ? null : num(raw);
  };

  const pageNumbers = useMemo(() => {
    const span = 5;
    let start = Math.max(1, page - Math.floor(span / 2));
    const end = Math.min(totalPages, start + span - 1);
    start = Math.max(1, end - span + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const showGrandTotal = activeColumns.some((c) => c.key === 'grand_total');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">{title || meta.title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>

      {view === 'list' && (
        <div className="flex flex-wrap gap-2">
          {statusPills.map((pill) => {
            const theme = getTabTheme(pill.color);
            const active = pill.key === 'all' ? !filters.booking_status : filters.booking_status === pill.key;
            const count = pillCount(pill.key);
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setFilter({
                  booking_status: pill.key === 'all' || filters.booking_status === pill.key ? '' : pill.key,
                })}
                className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
              >
                {pill.label}
                {count !== null && (
                  <span className={cn(
                    'min-w-[1.5rem] rounded-full px-1.5 text-xs font-bold text-center',
                    active ? 'bg-white/25' : 'bg-white/80'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <select
                className="h-9 rounded-md border px-2"
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              records per page
            </div>

            <form className="flex items-center gap-2" onSubmit={applySearch}>
              <div className="relative w-full min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-8 h-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Reference, customer…"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">Go</Button>
            </form>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={filters.from}
                onChange={(e) => setFilter({ from: e.target.value })}
              />
              <span>to</span>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={filters.to}
                onChange={(e) => setFilter({ to: e.target.value })}
              />
            </div>

            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={filters.warehouse_id}
              onChange={(e) => setFilter({ warehouse_id: e.target.value })}
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>

            <select
              className="h-9 rounded-md border px-2 text-sm max-w-[200px]"
              value={filters.customer_id}
              onChange={(e) => setFilter({ customer_id: e.target.value })}
            >
              <option value="">All customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {selected.length > 0 && (
                <Button type="button" size="sm" variant="destructive" onClick={deleteSelected}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete selected ({selected.length})
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button" size="icon" variant="outline" className="text-pink-600" title="Export PDF"
                onClick={() => runExport(exportTablePdf, `bookings-${view}.pdf`)}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                type="button" size="icon" variant="outline" className="text-emerald-600" title="Export Excel"
                onClick={() => runExport(exportExcel, `bookings-${view}.xls`)}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button
                type="button" size="icon" variant="outline" className="text-amber-600" title="Export CSV"
                onClick={() => runExport(exportCsv, `bookings-${view}.csv`)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button" size="icon" variant="outline" className="text-blue-600" title="Print"
                onClick={() => runExport(printTable, `bookings-${view}.pdf`)}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="gap-1">
                    <Columns3 className="h-4 w-4" /> Columns <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMN_DEFS.map((c) => (
                    <DropdownMenuItem
                      key={c.key}
                      onSelect={(e) => {
                        e.preventDefault();
                        setVisibleColumns((prev) => (
                          prev.includes(c.key)
                            ? prev.filter((k) => k !== c.key)
                            : COLUMN_DEFS.filter((d) => d.key === c.key || prev.includes(d.key)).map((d) => d.key)
                        ));
                      }}
                      className="gap-2"
                    >
                      <input type="checkbox" readOnly checked={visibleColumns.includes(c.key)} />
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#003D82]" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}
                    />
                  </th>
                  {activeColumns.map((c) => (
                    <th key={c.key} className={cn('p-3 whitespace-nowrap', c.align === 'right' && 'text-right')}>
                      {c.label}
                    </th>
                  ))}
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {error && (
                  <tr>
                    <td colSpan={activeColumns.length + 2} className="p-10 text-center">
                      <div className="text-rose-600">{error}</div>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={loadList}>
                        Try again
                      </Button>
                    </td>
                  </tr>
                )}
                {!error && rows.length === 0 && (
                  <tr>
                    <td colSpan={activeColumns.length + 2} className="p-10 text-center text-slate-500">
                      {meta.empty}
                    </td>
                  </tr>
                )}
                {!error && rows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-slate-50/80">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={() => setSelected((prev) => (
                          prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id]
                        ))}
                      />
                    </td>
                    {activeColumns.map((c) => {
                      if (c.key === 'booking_status' || c.key === 'signature_status' || c.key === 'review_status') {
                        const map = c.key === 'booking_status'
                          ? BOOKING_STATUS_META
                          : c.key === 'signature_status' ? SIGNATURE_STATUS_META : REVIEW_STATUS_META;
                        const fallback = c.key === 'booking_status' ? 'pending' : 'none';
                        const badge = statusMeta(map, row[c.key], fallback);
                        return (
                          <td key={c.key} className="p-3">
                            <Badge variant="outline" className={cn('border whitespace-nowrap', badge.className)}>
                              {badge.label}
                            </Badge>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            'p-3 whitespace-nowrap',
                            c.align === 'right' && 'text-right',
                            c.key === 'reference' && 'font-medium text-[#003D82]'
                          )}
                        >
                          {cellText(row, c.key)}
                        </td>
                      );
                    })}
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {view === 'request' && (
                          <>
                            <Button
                              type="button" size="sm" disabled={busyId === row.id}
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => changeStatus(row, 'confirmed', 'Booking accepted')}
                            >
                              <Check className="h-4 w-4 mr-1" /> Accept
                            </Button>
                            <Button
                              type="button" size="sm" variant="outline" disabled={busyId === row.id}
                              className="border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={() => changeStatus(row, 'rejected', 'Booking rejected')}
                            >
                              <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {view === 'pending-review' && (
                          <>
                            <Button
                              type="button" size="sm" disabled={busyId === row.id}
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => review(row, 'approve')}
                            >
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button
                              type="button" size="sm" variant="outline" disabled={busyId === row.id}
                              className="border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={() => review(row, 'reject')}
                            >
                              <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1" disabled={busyId === row.id}>
                              {busyId === row.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <>Action <ChevronDown className="h-3.5 w-3.5" /></>}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailId(row.id)}>
                              <FileText className="h-4 w-4 mr-2" /> Booking Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(row.id)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendSignLink(row)}>
                              <PenLine className="h-4 w-4 mr-2" /> Send Signature Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => printSheet(row)}>
                              <Printer className="h-4 w-4 mr-2" /> Print Booking Sheet
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadSheet(row)}>
                              <Download className="h-4 w-4 mr-2" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {STATUS_ACTIONS.map((action) => (
                                  <DropdownMenuItem
                                    key={action.status}
                                    disabled={row.booking_status === action.status}
                                    onClick={() => changeStatus(
                                      row,
                                      action.status,
                                      `Booking marked ${BOOKING_STATUS_META[action.status].label.toLowerCase()}`
                                    )}
                                  >
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => removeBooking(row)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold">
                  <td className="p-3" colSpan={1 + activeColumns.filter((c) => c.key !== 'grand_total').length}>
                    Totals
                  </td>
                  {showGrandTotal && <td className="p-3 text-right">{fmtMoney(totals.grand_total)}</td>}
                  <td className="p-3" />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-slate-600">
          <div>Showing {firstRow} to {lastRow} of {total} entries</div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button" size="sm" variant="outline" disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            {pageNumbers.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={n === page ? 'default' : 'outline'}
                className={n === page ? 'bg-[#003D82] hover:bg-[#002855]' : ''}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              type="button" size="sm" variant="outline" disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {detailId && (
        <BookingDetailsModal
          bookingId={detailId}
          money={fmtMoney}
          dateFormat={dateFormat}
          onClose={() => setDetailId(null)}
          onEdit={(id) => { setDetailId(null); onEdit(id); }}
          onUpdated={() => { loadList(); }}
        />
      )}
    </div>
  );
}
