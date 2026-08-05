import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronLeft, ChevronRight, Columns3, Download, FileSpreadsheet,
  FileText, Loader2, Plus, Printer, RotateCcw, Search, Trash2, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';
import SaleDetailsModal from '@/components/erp/SaleDetailsModal';
import SaleFormFields from '@/components/erp/SaleFormFields';
import { AddPaymentModal, ViewPaymentsModal } from '@/components/erp/SalePaymentModals';
import {
  PAYMENT_STATUS_META, SALE_STATUS_META, formatErpDate, makeMoney, num,
} from '@/lib/erpFormat';
import {
  downloadHtmlPdf, exportCsv, exportExcel, exportTablePdf, openPrintWindow, printTable,
} from '@/lib/erpExport';
import { DOCUMENT_STYLES, buildDocumentHtml, loadErpCompany } from '@/lib/erpDocuments';
import { getSystemSettings } from '@/services/settingsService';
import {
  createSale, deleteSale, getSale, listBillers, listCustomers, listProducts,
  listWarehouses, querySales, updateSale,
} from '@/services/erpService';

const COLUMN_STORAGE_KEY = 'erp.sales.columns';

const COLUMN_DEFS = [
  { key: 'date', label: 'Date' },
  { key: 'reference', label: 'Reference' },
  { key: 'customer', label: 'Customer' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'biller', label: 'Biller' },
  { key: 'sale_status', label: 'Sale Status' },
  { key: 'payment_status', label: 'Payment Status' },
  { key: 'source', label: 'Source' },
  { key: 'grand_total', label: 'Grand Total', align: 'right' },
  { key: 'paid', label: 'Paid', align: 'right' },
  { key: 'due', label: 'Due', align: 'right' },
];

const SALE_PILLS = [
  { key: 'all', label: 'All', countKey: 'all', color: 'navy' },
  { key: 'completed', label: 'Completed', countKey: 'completed', color: 'green' },
  { key: 'pending', label: 'Pending', countKey: 'pending', color: 'orange' },
  { key: 'draft', label: 'Draft', countKey: 'draft', color: 'slate' },
];

const PAYMENT_PILLS = [
  { key: 'paid', label: 'Paid', countKey: 'paid', color: 'teal' },
  { key: 'partial', label: 'Partial', countKey: 'partial', color: 'gold' },
  { key: 'due', label: 'Due', countKey: 'due', color: 'rose' },
];

const EMPTY_FILTERS = {
  q: '',
  sale_status: '',
  payment_status: '',
  warehouse_id: '',
  customer_id: '',
  from: '',
  to: '',
  source: '',
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

function rowDue(row) {
  const due = row?.due_amount ?? num(row?.grand_total) - num(row?.paid_amount);
  return Math.max(0, num(due));
}

export default function SalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'add' ? 'add' : 'list';
  const editId = tab === 'add' ? searchParams.get('id') : null;

  const [settings, setSettings] = useState({});
  const money = useMemo(() => makeMoney(settings), [settings]);
  const dateFormat = settings.date_format || 'd-m-Y';

  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [billers, setBillers] = useState([]);
  const [products, setProducts] = useState([]);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ grand_total: 0, paid: 0, due: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(readStoredColumns);

  const [saving, setSaving] = useState(false);
  const [editSale, setEditSale] = useState(null);
  const [detailSale, setDetailSale] = useState(null);
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentsSale, setPaymentsSale] = useState(null);

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

  const goTab = (nextTab, id) => {
    const next = { tab: nextTab };
    if (id) next.id = id;
    setSearchParams(next, { replace: true });
  };

  const loadProducts = useCallback(async (warehouseId) => {
    try {
      setProducts((await listProducts(warehouseId || undefined)) || []);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sys = await getSystemSettings();
        if (sys) setSettings(sys);
      } catch {
        /* defaults are fine when settings are unavailable */
      }
      try {
        const [w, c, b] = await Promise.all([listWarehouses(), listCustomers('?active=1'), listBillers()]);
        setWarehouses(w || []);
        setCustomers(c || []);
        setBillers(b || []);
        const def = (w || []).find((x) => x.is_default) || (w || [])[0];
        if (def?.id) await loadProducts(def.id);
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, [loadProducts]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await querySales({
        page,
        per_page: perPage,
        q: filters.q || undefined,
        warehouse_id: filters.warehouse_id || undefined,
        customer_id: filters.customer_id || undefined,
        sale_status: filters.sale_status || undefined,
        payment_status: filters.payment_status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        // Blank source shows counter and POS sales together, like the Beyond sale list.
        is_pos: filters.source === 'pos' ? 1 : filters.source === 'shop' ? 0 : undefined,
      });
      const data = res?.data || [];
      setRows(data);
      setTotal(num(res?.total, data.length));
      setTotals(res?.totals || { grand_total: 0, paid: 0, due: 0 });
      setCounts(res?.counts || {});
      setSelected([]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters]);

  useEffect(() => {
    if (tab === 'list') loadList();
  }, [tab, loadList]);

  useEffect(() => {
    if (tab !== 'add') {
      setEditSale(null);
      return;
    }
    if (!editId) {
      setEditSale(null);
      return;
    }
    (async () => {
      try {
        const sale = await getSale(editId);
        setEditSale(sale);
        if (sale?.warehouse_id) await loadProducts(sale.warehouse_id);
      } catch (err) {
        toast.error(err.message);
        goTab('list');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editId, loadProducts]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
  const firstRow = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastRow = Math.min(page * perPage, total);
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  const cellText = useCallback((row, key) => {
    switch (key) {
      case 'date': return formatErpDate(row.sale_date || row.created_at, dateFormat, { withTime: true });
      case 'reference': return row.reference || '';
      case 'customer': return row.customer_name || 'Walk-in Customer';
      case 'warehouse': return row.warehouse_name || '—';
      case 'biller': return row.biller_name || '—';
      case 'sale_status': return SALE_STATUS_META[row.sale_status]?.label || row.sale_status || '—';
      case 'payment_status': return PAYMENT_STATUS_META[row.payment_status]?.label || row.payment_status || '—';
      case 'source': return row.is_pos ? 'POS' : 'Shop';
      case 'grand_total': return money(row.grand_total);
      case 'paid': return money(row.paid_amount);
      case 'due': return money(rowDue(row));
      default: return '';
    }
  }, [dateFormat, money]);

  const exportPayload = useCallback((filename) => ({
    filename,
    title: 'Sales',
    columns: activeColumns.map((c) => ({
      key: c.key,
      label: c.label,
      align: c.align,
      value: (row) => cellText(row, c.key),
    })),
    rows,
  }), [activeColumns, cellText, rows]);

  const runExport = (fn, filename) => {
    try {
      const result = fn(exportPayload(filename));
      if (result?.catch) result.catch((err) => toast.error(err.message));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toDocument = (sale) => ({
    reference: sale.reference,
    date: sale.sale_date || sale.created_at,
    status_label: SALE_STATUS_META[sale.sale_status]?.label || sale.sale_status,
    payment_status: PAYMENT_STATUS_META[sale.payment_status]?.label || sale.payment_status,
    warehouse_name: sale.warehouse_name,
    biller_name: sale.biller_name,
    note: sale.note,
    customer: {
      name: sale.customer_name || 'Walk-in Customer',
      phone: sale.customer_phone,
      email: sale.customer_email,
      address: sale.customer_address,
    },
    items: sale.items || [],
    payments: sale.payments || [],
    discount: sale.discount,
    tax: sale.tax,
    shipping: sale.shipping,
    grand_total: sale.grand_total,
    paid_amount: sale.paid_amount,
  });

  const buildInvoiceHtml = async (row) => {
    const [sale, company] = await Promise.all([
      row.items ? Promise.resolve(row) : getSale(row.id),
      loadErpCompany(),
    ]);
    return { sale, html: buildDocumentHtml({ kind: 'invoice', doc: toDocument(sale), company }) };
  };

  const printInvoice = async (row) => {
    try {
      const { sale, html } = await buildInvoiceHtml(row);
      openPrintWindow(html, { title: `Invoice ${sale.reference || ''}`, styles: DOCUMENT_STYLES });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const downloadInvoice = async (row) => {
    try {
      const { sale, html } = await buildInvoiceHtml(row);
      await downloadHtmlPdf(html, {
        filename: `invoice-${sale.reference || sale.id}.pdf`,
        styles: DOCUMENT_STYLES,
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDetails = async (row) => {
    try {
      setDetailSale(await getSale(row.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openPayment = async (row) => {
    try {
      setPaymentSale(row.items ? row : await getSale(row.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeSale = async (row) => {
    if (!window.confirm(`Delete sale ${row.reference}? Stock will be restored.`)) return;
    try {
      await deleteSale(row.id);
      toast.success('Sale deleted');
      loadList();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected sale(s)?`)) return;
    let ok = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        // Sequential so the API restores stock one sale at a time.
        // eslint-disable-next-line no-await-in-loop
        await deleteSale(id);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    if (ok) toast.success(`${ok} sale(s) deleted`);
    if (failed) toast.error(`${failed} sale(s) could not be deleted`);
    loadList();
  };

  const submitSale = async (body) => {
    setSaving(true);
    try {
      if (editId) {
        await updateSale(editId, body);
        toast.success('Sale updated');
      } else {
        await createSale(body);
        toast.success('Sale created');
      }
      goTab('list');
      setPage(1);
      loadList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
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

  const pillActive = (pill) => {
    if (pill.key === 'all') return !filters.sale_status && !filters.payment_status;
    return filters.sale_status === pill.key;
  };

  const clickSalePill = (pill) => {
    setPage(1);
    if (pill.key === 'all') {
      setFilters((f) => ({ ...f, sale_status: '', payment_status: '' }));
      return;
    }
    setFilters((f) => ({ ...f, sale_status: f.sale_status === pill.key ? '' : pill.key }));
  };

  const clickPaymentPill = (pill) => {
    setPage(1);
    setFilters((f) => ({ ...f, payment_status: f.payment_status === pill.key ? '' : pill.key }));
  };

  const pageNumbers = useMemo(() => {
    const span = 5;
    let start = Math.max(1, page - Math.floor(span / 2));
    const end = Math.min(totalPages, start + span - 1);
    start = Math.max(1, end - span + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#003D82]">
          {tab === 'add' ? (editId ? 'Edit Sale' : 'Add Sale') : 'Sale List'}
        </h1>
        {tab === 'list' && (
          <Button className="bg-[#003D82] hover:bg-[#002855]" onClick={() => goTab('add')}>
            <Plus className="h-4 w-4 mr-1" /> Add Sale
          </Button>
        )}
      </div>

      {tab === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SALE_PILLS.map((pill) => {
              const theme = getTabTheme(pill.color);
              const active = pillActive(pill);
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => clickSalePill(pill)}
                  className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
                >
                  {pill.label}
                  <span className={cn(
                    'min-w-[1.5rem] rounded-full px-1.5 text-xs font-bold text-center',
                    active ? 'bg-white/25' : 'bg-white/80'
                  )}>
                    {num(counts[pill.countKey])}
                  </span>
                </button>
              );
            })}
            <span className="hidden sm:block w-px bg-slate-200 mx-1" />
            {PAYMENT_PILLS.map((pill) => {
              const theme = getTabTheme(pill.color);
              const active = filters.payment_status === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => clickPaymentPill(pill)}
                  className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
                >
                  {pill.label}
                  <span className={cn(
                    'min-w-[1.5rem] rounded-full px-1.5 text-xs font-bold text-center',
                    active ? 'bg-white/25' : 'bg-white/80'
                  )}>
                    {num(counts[pill.countKey])}
                  </span>
                </button>
              );
            })}
          </div>

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
                    onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, from: e.target.value })); }}
                  />
                  <span>to</span>
                  <Input
                    type="date"
                    className="h-9 w-[150px]"
                    value={filters.to}
                    onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, to: e.target.value })); }}
                  />
                </div>

                <select
                  className="h-9 rounded-md border px-2 text-sm"
                  value={filters.warehouse_id}
                  onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, warehouse_id: e.target.value })); }}
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>

                <select
                  className="h-9 rounded-md border px-2 text-sm max-w-[200px]"
                  value={filters.customer_id}
                  onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, customer_id: e.target.value })); }}
                >
                  <option value="">All customers</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <select
                  className="h-9 rounded-md border px-2 text-sm"
                  value={filters.source}
                  onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, source: e.target.value })); }}
                >
                  <option value="">All sources</option>
                  <option value="shop">Counter sales</option>
                  <option value="pos">POS sales</option>
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
                    onClick={() => runExport(exportTablePdf, 'sales.pdf')}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button" size="icon" variant="outline" className="text-emerald-600" title="Export Excel"
                    onClick={() => runExport(exportExcel, 'sales.xls')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button" size="icon" variant="outline" className="text-amber-600" title="Export CSV"
                    onClick={() => runExport(exportCsv, 'sales.csv')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button" size="icon" variant="outline" className="text-blue-600" title="Print"
                    onClick={() => runExport(printTable, 'sales.pdf')}
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
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={activeColumns.length + 2} className="p-10 text-center text-slate-500">
                          No sales found for this filter.
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => (
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
                          if (c.key === 'sale_status') {
                            const meta = SALE_STATUS_META[row.sale_status] || SALE_STATUS_META.draft;
                            return (
                              <td key={c.key} className="p-3">
                                <Badge variant="outline" className={cn('border', meta.className)}>{meta.label}</Badge>
                              </td>
                            );
                          }
                          if (c.key === 'payment_status') {
                            const meta = PAYMENT_STATUS_META[row.payment_status] || PAYMENT_STATUS_META.pending;
                            return (
                              <td key={c.key} className="p-3">
                                <Badge variant="outline" className={cn('border', meta.className)}>{meta.label}</Badge>
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
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1">
                                Action <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetails(row)}>
                                <FileText className="h-4 w-4 mr-2" /> Sale Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => goTab('add', row.id)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPayment(row)}>
                                <Wallet className="h-4 w-4 mr-2" /> Add Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPaymentsSale(row)}>View Payments</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printInvoice(row)}>
                                <Printer className="h-4 w-4 mr-2" /> Print Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadInvoice(row)}>
                                <Download className="h-4 w-4 mr-2" /> Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => removeSale(row)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-slate-50 font-semibold">
                      <td className="p-3" colSpan={1 + activeColumns.filter((c) => !['grand_total', 'paid', 'due'].includes(c.key)).length}>
                        Totals
                      </td>
                      {activeColumns.some((c) => c.key === 'grand_total') && (
                        <td className="p-3 text-right">{money(totals.grand_total)}</td>
                      )}
                      {activeColumns.some((c) => c.key === 'paid') && (
                        <td className="p-3 text-right">{money(totals.paid)}</td>
                      )}
                      {activeColumns.some((c) => c.key === 'due') && (
                        <td className="p-3 text-right text-rose-600">{money(totals.due)}</td>
                      )}
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
        </div>
      )}

      {tab === 'add' && (
        <SaleFormFields
          key={editId || 'new'}
          mode={editId ? 'edit' : 'create'}
          initialSale={editId ? editSale : null}
          warehouses={warehouses}
          customers={customers}
          billers={billers}
          products={products}
          money={money}
          saving={saving}
          onWarehouseChange={loadProducts}
          onSubmit={submitSale}
          onCancel={() => goTab('list')}
        />
      )}

      {detailSale && (
        <SaleDetailsModal
          sale={detailSale}
          money={money}
          dateFormat={dateFormat}
          onClose={() => setDetailSale(null)}
          onPrint={printInvoice}
          onDownload={downloadInvoice}
          onAddPayment={(sale) => { setDetailSale(null); setPaymentSale(sale); }}
          onEdit={(sale) => { setDetailSale(null); goTab('add', sale.id); }}
        />
      )}

      {paymentSale && (
        <AddPaymentModal
          sale={paymentSale}
          money={money}
          onClose={() => setPaymentSale(null)}
          onSaved={loadList}
        />
      )}

      {paymentsSale && (
        <ViewPaymentsModal
          sale={paymentsSale}
          money={money}
          dateFormat={dateFormat}
          onClose={() => setPaymentsSale(null)}
          onChanged={loadList}
        />
      )}
    </div>
  );
}
