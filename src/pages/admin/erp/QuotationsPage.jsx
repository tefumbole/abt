import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ban, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download,
  FileDown, FileSpreadsheet, FileText, Layers, Loader2, MessageCircle, Pencil,
  Plus, Printer, RotateCcw, Search, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatErpDate, makeMoney, num } from '@/lib/erpFormat';
import {
  downloadHtmlPdf, exportCsv, exportExcel, exportTablePdf, openPrintWindow, printTable,
} from '@/lib/erpExport';
import { buildDocumentHtml, loadErpCompany } from '@/lib/erpDocuments';
import { getSystemSettings } from '@/services/settingsService';
import {
  convertQuotation, createQuotation, deleteQuotation, getQuotation,
  listBillers, listCustomers, listProducts, listQuotations, listSuppliers,
  listWarehouses, sendQuotationWhatsApp, setQuotationStatus, updateQuotation,
} from '@/services/erpService';

const STATUS_META = {
  awaiting_approval: {
    label: 'Awaiting Client Approval',
    filterLabel: 'Awaiting Client Approval',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    pill: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100',
    pillActive: 'bg-orange-500 text-white border-orange-500',
    Icon: Clock3,
  },
  approved: {
    label: 'Approved',
    filterLabel: 'Approved',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    pill: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    pillActive: 'bg-emerald-600 text-white border-emerald-600',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    filterLabel: 'Rejected',
    badge: 'bg-red-100 text-red-800 border-red-300',
    pill: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
    pillActive: 'bg-red-600 text-white border-red-600',
    Icon: Ban,
  },
  draft: {
    label: 'Draft',
    filterLabel: 'Drafts',
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    pill: 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200',
    pillActive: 'bg-slate-600 text-white border-slate-600',
    Icon: FileText,
  },
};

const ALL_FILTER = {
  key: 'all',
  filterLabel: 'All',
  pill: 'border-[#7aa3d4] bg-[#eef5fc] text-[#003D82] hover:bg-[#dceaf8]',
  pillActive: 'bg-[#003D82] text-white border-[#003D82]',
  Icon: Layers,
};

const STATUS_FILTERS = [
  ALL_FILTER,
  ...Object.entries(STATUS_META).map(([key, meta]) => ({ key, ...meta })),
];

const statusLabel = (value) => STATUS_META[value]?.label || value || '—';

const EMPTY_LINE = { product_id: '', qty: 1, net_unit_price: 0, discount: 0, tax: 0 };

const lineSubtotal = (item) =>
  num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);

export default function QuotationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'add' ? 'add' : 'list';
  const editId = searchParams.get('id') || '';
  const isEdit = tab === 'add' && Boolean(editId);

  const [status, setStatus] = useState('awaiting_approval');
  const [reloadKey, setReloadKey] = useState(0);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ awaiting_approval: 0, approved: 0, rejected: 0, draft: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [billers, setBillers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editReference, setEditReference] = useState('');
  const [detail, setDetail] = useState(null);
  const [docBusy, setDocBusy] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: '',
    customer_id: '',
    biller_id: '',
    supplier_id: '',
    discount: 0,
    shipping: 0,
    tax: 0,
    note: '',
    cc_phones: '',
    status: 'draft',
    items: [{ ...EMPTY_LINE }],
  });

  const money = useMemo(() => makeMoney(settings), [settings]);
  const dateFormat = settings.date_format || 'd-m-Y';
  const showDate = (value) => (value ? formatErpDate(value, dateFormat, { withTime: true }) : '—');

  const goList = () => setSearchParams({}, { replace: true });
  const goAdd = (id) => setSearchParams(id ? { tab: 'add', id } : { tab: 'add' }, { replace: true });

  const loadMasters = async () => {
    const [w, c, b, s, p] = await Promise.all([
      listWarehouses(), listCustomers(), listBillers(), listSuppliers(), listProducts(),
    ]);
    setWarehouses(w);
    setCustomers(c);
    setBillers(b);
    setSuppliers(s);
    setProducts(p);
    const defWh = w.find((x) => x.is_default) || w[0];
    const defBiller = b.find((x) => x.is_default) || b[0];
    setForm((f) => ({
      ...f,
      warehouse_id: f.warehouse_id || defWh?.id || '',
      biller_id: f.biller_id || defBiller?.id || '',
    }));
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString() ? `?${params}` : '';
      const res = await listQuotations(qs);
      setRows(res.data || []);
      setCounts((prev) => res.statusCounts || prev);
      setSelected([]);
      setPage(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters().catch((e) => toast.error(e.message));
    getSystemSettings()
      .then((s) => setSettings(s || {}))
      .catch(() => setSettings({}));
  }, []);

  useEffect(() => {
    if (tab === 'list') loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status, reloadKey]);

  const resetForm = () => {
    const defWh = warehouses.find((x) => x.is_default) || warehouses[0];
    const defBiller = billers.find((x) => x.is_default) || billers[0];
    setEditReference('');
    setForm({
      warehouse_id: defWh?.id || '',
      customer_id: '',
      biller_id: defBiller?.id || '',
      supplier_id: '',
      discount: 0,
      shipping: 0,
      tax: 0,
      note: '',
      cc_phones: '',
      status: 'draft',
      items: [{ ...EMPTY_LINE }],
    });
  };

  const loadForEdit = async (id) => {
    setLoadingEdit(true);
    try {
      const q = await getQuotation(id);
      if (!q) throw new Error('Quotation not found');
      setEditReference(q.reference || '');
      setForm({
        warehouse_id: q.warehouse_id || '',
        customer_id: q.customer_id || '',
        biller_id: q.biller_id || '',
        supplier_id: q.supplier_id || '',
        discount: num(q.discount),
        shipping: num(q.shipping),
        tax: num(q.tax),
        note: q.note || '',
        cc_phones: q.cc_phones || '',
        status: q.status || 'draft',
        items: (q.items || []).length
          ? q.items.map((i) => ({
            product_id: i.product_id || '',
            qty: num(i.qty),
            net_unit_price: num(i.net_unit_price),
            discount: num(i.discount),
            tax: num(i.tax),
          }))
          : [{ ...EMPTY_LINE }],
      });
    } catch (e) {
      toast.error(e.message);
      goList();
    } finally {
      setLoadingEdit(false);
    }
  };

  useEffect(() => {
    if (tab !== 'add') return;
    if (editId) loadForEdit(editId);
    else resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editId]);

  const filtered = rows;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageTotal = pageRows.reduce((sum, r) => sum + num(r.grand_total), 0);
  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));

  const itemsTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + lineSubtotal(item), 0),
    [form.items]
  );
  const formGrand = itemsTotal - num(form.discount) + num(form.shipping) + num(form.tax);

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (allSelected) setSelected((prev) => prev.filter((id) => !pageRows.some((r) => r.id === id)));
    else setSelected((prev) => [...new Set([...prev, ...pageRows.map((r) => r.id)])]);
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setReloadKey((k) => k + 1);
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} quotation(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        await deleteQuotation(id);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    if (ok) toast.success(`Deleted ${ok} quotation${ok === 1 ? '' : 's'}`);
    if (failed) toast.error(`${failed} quotation${failed === 1 ? '' : 's'} could not be deleted`);
    setSelected([]);
    loadList();
  };

  const submitQuotation = async (e) => {
    e.preventDefault();
    const items = form.items.filter((i) => i.product_id);
    if (!form.warehouse_id) return toast.error('Warehouse is required');
    if (!items.length) return toast.error('Add at least one product line');
    setSaving(true);
    try {
      const body = {
        warehouse_id: form.warehouse_id,
        customer_id: form.customer_id || null,
        biller_id: form.biller_id || null,
        supplier_id: form.supplier_id || null,
        discount: num(form.discount),
        shipping: num(form.shipping),
        tax: num(form.tax),
        note: form.note || null,
        cc_phones: form.cc_phones || null,
        status: form.status || 'draft',
        items: items.map((i) => ({
          product_id: i.product_id,
          qty: num(i.qty),
          net_unit_price: num(i.net_unit_price),
          discount: num(i.discount),
          tax: num(i.tax),
        })),
      };
      if (isEdit) await updateQuotation(editId, body);
      else await createQuotation(body);
      toast.success(isEdit ? 'Quotation updated' : 'Quotation created');
      setStatus(form.status || 'draft');
      resetForm();
      goList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const viewQuote = async (id) => {
    try {
      setDetail(await getQuotation(id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  /** Normalises a quotation into the shape `buildDocumentHtml` expects. */
  const toDocument = (q) => ({
    reference: q.reference,
    date: q.created_at,
    status_label: statusLabel(q.status),
    customer: {
      name: q.customer_name,
      phone: q.customer_phone,
      email: q.customer_email,
      address: q.customer_address,
      company_name: q.customer_company,
    },
    warehouse_name: q.warehouse_name,
    biller_name: q.biller_name,
    supplier_name: q.supplier_name,
    items: (q.items || []).map((i) => ({
      product_name: i.product_name,
      product_code: i.product_code,
      qty: i.qty,
      net_unit_price: i.net_unit_price,
      discount: i.discount,
      tax: i.tax,
      subtotal: i.subtotal,
    })),
    discount: q.discount,
    shipping: q.shipping,
    tax: q.tax,
    grand_total: q.grand_total,
    note: q.note,
  });

  const buildQuotationHtml = async (source) => {
    const full = source?.items ? source : await getQuotation(source?.id || source);
    if (!full) throw new Error('Quotation not found');
    const company = await loadErpCompany();
    return {
      html: buildDocumentHtml({ kind: 'quotation', doc: toDocument(full), company }),
      reference: full.reference || 'quotation',
    };
  };

  const printQuotation = async (source) => {
    setDocBusy(true);
    try {
      const { html, reference } = await buildQuotationHtml(source);
      openPrintWindow(html, { title: `Quotation ${reference}` });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDocBusy(false);
    }
  };

  const downloadQuotationPdf = async (source) => {
    setDocBusy(true);
    try {
      const { html, reference } = await buildQuotationHtml(source);
      await downloadHtmlPdf(html, { filename: `${reference}.pdf` });
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDocBusy(false);
    }
  };

  const exportColumns = [
    { key: 'created_at', label: 'Date', value: (r) => (r.created_at ? formatErpDate(r.created_at, dateFormat, { withTime: true }) : '') },
    { key: 'reference', label: 'Reference' },
    { key: 'biller_name', label: 'Biller', value: (r) => r.biller_name || '' },
    { key: 'customer_name', label: 'Customer', value: (r) => r.customer_name || '' },
    { key: 'supplier_name', label: 'Supplier', value: (r) => r.supplier_name || '' },
    { key: 'status', label: 'Status', value: (r) => statusLabel(r.status) },
    { key: 'grand_total', label: 'Grand Total', align: 'right', value: (r) => money(r.grand_total) },
  ];

  const activeFilterLabel = STATUS_FILTERS.find((f) => f.key === status)?.filterLabel || 'All';
  const listStamp = formatErpDate(new Date(), dateFormat, { withTime: true });
  const exportBase = {
    title: 'Quotations',
    subtitle: `${activeFilterLabel} · ${filtered.length} record(s) · generated ${listStamp}`,
    columns: exportColumns,
    rows: filtered,
    footer: `Total: ${money(filtered.reduce((sum, r) => sum + num(r.grand_total), 0))}`,
  };
  const exportName = `quotations-${activeFilterLabel.toLowerCase().replace(/\s+/g, '-')}`;

  const handleExportPdf = async () => {
    try {
      await exportTablePdf({ ...exportBase, filename: `${exportName}.pdf` });
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleExportExcel = () => {
    try {
      exportExcel({ filename: `${exportName}.xls`, title: exportBase.title, columns: exportColumns, rows: filtered });
      toast.success('Excel file downloaded');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleExportCsv = () => {
    try {
      exportCsv({ filename: `${exportName}.csv`, columns: exportColumns, rows: filtered });
      toast.success('CSV downloaded');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePrintList = () => {
    try {
      printTable(exportBase);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const detailItemsTotal = (detail?.items || []).reduce(
    (sum, i) => sum + num(i.subtotal ?? lineSubtotal(i)),
    0
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">
          {tab === 'add' ? (isEdit ? 'Edit Quotation' : 'Add Quotation') : 'Quotation List'}
        </h1>
      </div>

      {tab === 'list' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-[#003D82] hover:bg-[#002855]" onClick={() => goAdd()}>
              <Plus className="h-4 w-4 mr-1" /> Add Quotation
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((meta) => {
              const active = status === meta.key;
              const Icon = meta.Icon;
              return (
                <button
                  key={meta.key}
                  type="button"
                  onClick={() => setStatus(meta.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? meta.pillActive : meta.pill
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {meta.filterLabel}
                  <span className={cn(
                    'min-w-[1.5rem] rounded-full px-1.5 text-xs font-bold text-center',
                    active ? 'bg-white/25 text-white' : 'bg-white/80'
                  )}>
                    {counts[meta.key] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3 p-4 border-b">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <select
                  className="border rounded-md h-9 px-2"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                records per page
              </div>
              <form
                className="flex items-center gap-2 flex-1 justify-center min-w-[220px]"
                onSubmit={(e) => { e.preventDefault(); setReloadKey((k) => k + 1); }}
              >
                <span className="text-sm text-slate-600">Search</span>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Reference, customer…"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm">Go</Button>
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
              </form>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="text-pink-600" title="Download PDF"
                  onClick={handleExportPdf}>
                  <FileText className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="outline" className="text-emerald-600" title="Download Excel"
                  onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="outline" className="text-amber-600" title="Download CSV"
                  onClick={handleExportCsv}>
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="outline" className="text-blue-600" title="Print list"
                  onClick={handlePrintList}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b bg-[#eef5fc] px-4 py-3">
                <span className="text-sm font-semibold text-[#003D82]">{selected.length} selected</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={bulkBusy}
                  onClick={deleteSelected}
                >
                  {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Delete selected
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={bulkBusy} onClick={() => setSelected([])}>
                  <X className="h-4 w-4 mr-1" /> Clear selection
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="p-3 w-10">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      </th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Biller</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">Quotation Status</th>
                      <th className="p-3">Client comment</th>
                      <th className="p-3 text-right">Grand Total</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">No quotations in this filter.</td>
                      </tr>
                    )}
                    {pageRows.map((r) => {
                      const meta = STATUS_META[r.status] || STATUS_META.draft;
                      return (
                        <tr key={r.id} className="border-t hover:bg-slate-50/80">
                          <td className="p-3">
                            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                          </td>
                          <td className="p-3 whitespace-nowrap">{showDate(r.created_at)}</td>
                          <td className="p-3 font-medium text-[#003D82]">{r.reference}</td>
                          <td className="p-3">{r.biller_name || '—'}</td>
                          <td className="p-3">{r.customer_name || '—'}</td>
                          <td className="p-3">{r.supplier_name || '—'}</td>
                          <td className="p-3">
                            <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold', meta.badge)}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="p-3 max-w-[180px] truncate">{r.client_comment || '—'}</td>
                          <td className="p-3 text-right font-medium">{money(r.grand_total)}</td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-1">
                                  Action <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => viewQuote(r.id)}>View</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => goAdd(r.id)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => printQuotation(r)}>
                                  <Printer className="h-4 w-4 mr-2" /> Print
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadQuotationPdf(r)}>
                                  <Download className="h-4 w-4 mr-2" /> Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    const res = await sendQuotationWhatsApp(r.id);
                                    toast.success(res.link ? 'WhatsApp approval link sent' : 'WhatsApp sent');
                                    loadList();
                                  } catch (e) { toast.error(e.message); }
                                }}>
                                  <MessageCircle className="h-4 w-4 mr-2" /> Send WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    await setQuotationStatus(r.id, 'awaiting_approval');
                                    toast.success('Marked awaiting approval');
                                    loadList();
                                  } catch (e) { toast.error(e.message); }
                                }}>Mark awaiting approval</DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    await setQuotationStatus(r.id, 'approved');
                                    toast.success('Approved');
                                    loadList();
                                  } catch (e) { toast.error(e.message); }
                                }}>Approve</DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    await setQuotationStatus(r.id, 'rejected');
                                    toast.success('Rejected');
                                    loadList();
                                  } catch (e) { toast.error(e.message); }
                                }}>Reject</DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    await convertQuotation(r.id);
                                    toast.success('Converted to sale');
                                    loadList();
                                  } catch (e) { toast.error(e.message); }
                                }}>Convert to sale</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={async () => {
                                  if (!confirm('Delete this quotation?')) return;
                                  try {
                                    await deleteQuotation(r.id);
                                    toast.success('Deleted');
                                    loadList();
                                  } catch (e) { toast.error(e.message); }
                                }}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-slate-50 font-semibold">
                      <td className="p-3" colSpan={8}>Total</td>
                      <td className="p-3 text-right">{money(pageTotal)}</td>
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t text-sm text-slate-600">
              <div>
                Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}
                {' - '}
                {Math.min(page * pageSize, filtered.length)} ({filtered.length})
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[2rem] text-center font-semibold text-[#003D82] border rounded-md px-2 py-1">{page}</span>
                <Button size="icon" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'add' && (
        <form onSubmit={submitQuotation} className="rounded-xl border bg-white shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#0A2540]">
              {isEdit ? 'Edit Quotation' : 'Add Quotation'}
            </h2>
            <Button type="button" variant="outline" onClick={goList}>Back to list</Button>
          </div>

          {loadingEdit ? (
            <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isEdit && (
                  <div>
                    <Label>Reference</Label>
                    <Input className="mt-1 bg-slate-100" value={editReference} readOnly />
                  </div>
                )}
                <div>
                  <Label>Warehouse</Label>
                  <select className="w-full border rounded-md h-10 px-2 mt-1" required value={form.warehouse_id}
                    onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                    <option value="">Select…</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Biller</Label>
                  <select className="w-full border rounded-md h-10 px-2 mt-1" value={form.biller_id}
                    onChange={(e) => setForm({ ...form, biller_id: e.target.value })}>
                    <option value="">—</option>
                    {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Customer</Label>
                  <select className="w-full border rounded-md h-10 px-2 mt-1" value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                    <option value="">—</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Supplier</Label>
                  <select className="w-full border rounded-md h-10 px-2 mt-1" value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full border rounded-md h-10 px-2 mt-1" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="awaiting_approval">Awaiting Client Approval</option>
                    {isEdit && <option value="approved">Approved</option>}
                    {isEdit && <option value="rejected">Rejected</option>}
                  </select>
                </div>
                <div>
                  <Label>CC phones (WhatsApp)</Label>
                  <Input className="mt-1" value={form.cc_phones}
                    onChange={(e) => setForm({ ...form, cc_phones: e.target.value })}
                    placeholder="+237…, +237…" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#0A2540]">Products</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_LINE }] })}>
                    <Plus className="h-4 w-4 mr-1" /> Add line
                  </Button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="p-2">Product</th>
                        <th className="p-2 w-24">Qty</th>
                        <th className="p-2 w-32">Price</th>
                        <th className="p-2 w-28">Discount</th>
                        <th className="p-2 w-28">Tax</th>
                        <th className="p-2 w-32 text-right">Subtotal</th>
                        <th className="p-2 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <select className="w-full border rounded-md h-9 px-2" value={item.product_id}
                              onChange={(e) => {
                                const p = products.find((x) => x.id === e.target.value);
                                const next = [...form.items];
                                next[idx] = { ...item, product_id: e.target.value, net_unit_price: p?.price || 0 };
                                setForm({ ...form, items: next });
                              }}>
                              <option value="">Select product…</option>
                              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <Input type="number" step="0.001" value={item.qty}
                              onChange={(e) => {
                                const next = [...form.items];
                                next[idx] = { ...item, qty: e.target.value };
                                setForm({ ...form, items: next });
                              }} />
                          </td>
                          <td className="p-2">
                            <Input type="number" step="0.01" value={item.net_unit_price}
                              onChange={(e) => {
                                const next = [...form.items];
                                next[idx] = { ...item, net_unit_price: e.target.value };
                                setForm({ ...form, items: next });
                              }} />
                          </td>
                          <td className="p-2">
                            <Input type="number" step="0.01" value={item.discount}
                              onChange={(e) => {
                                const next = [...form.items];
                                next[idx] = { ...item, discount: e.target.value };
                                setForm({ ...form, items: next });
                              }} />
                          </td>
                          <td className="p-2">
                            <Input type="number" step="0.01" value={item.tax}
                              onChange={(e) => {
                                const next = [...form.items];
                                next[idx] = { ...item, tax: e.target.value };
                                setForm({ ...form, items: next });
                              }} />
                          </td>
                          <td className="p-2 text-right font-medium">{money(lineSubtotal(item))}</td>
                          <td className="p-2">
                            <Button type="button" size="icon" variant="ghost" disabled={form.items.length <= 1}
                              onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Order discount</Label>
                  <Input type="number" step="0.01" className="mt-1" value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                </div>
                <div>
                  <Label>Shipping</Label>
                  <Input type="number" step="0.01" className="mt-1" value={form.shipping}
                    onChange={(e) => setForm({ ...form, shipping: e.target.value })} />
                </div>
                <div>
                  <Label>Order tax</Label>
                  <Input type="number" step="0.01" className="mt-1" value={form.tax}
                    onChange={(e) => setForm({ ...form, tax: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Note</Label>
                <Textarea className="mt-1" rows={3} value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="text-lg font-bold text-[#0A2540]">Grand Total: {money(formGrand)}</div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={goList}>Cancel</Button>
                  <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isEdit ? 'Update Quotation' : 'Save Quotation'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </form>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#0A2540]">{detail.reference}</h3>
                <p className="text-sm text-slate-600">{showDate(detail.created_at)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>Close</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div>Customer: <strong>{detail.customer_name || '—'}</strong></div>
              <div>Biller: <strong>{detail.biller_name || '—'}</strong></div>
              <div>Supplier: <strong>{detail.supplier_name || '—'}</strong></div>
              <div>Warehouse: <strong>{detail.warehouse_name || '—'}</strong></div>
              <div>Status: <strong>{statusLabel(detail.status)}</strong></div>
              <div className="sm:col-span-2">Client comment: {detail.client_comment || '—'}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-2">Product</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Discount</th>
                    <th className="p-2 text-right">Tax</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-500">No line items.</td></tr>
                  )}
                  {(detail.items || []).map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="p-2">
                        {i.product_name}
                        {i.product_code ? <span className="block text-xs text-slate-400">{i.product_code}</span> : null}
                      </td>
                      <td className="p-2 text-right">{num(i.qty)}</td>
                      <td className="p-2 text-right">{money(i.net_unit_price)}</td>
                      <td className="p-2 text-right">{money(i.discount)}</td>
                      <td className="p-2 text-right">{money(i.tax)}</td>
                      <td className="p-2 text-right">{money(i.subtotal ?? lineSubtotal(i))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full sm:w-72 text-sm space-y-1">
              <div className="flex justify-between"><span>Items subtotal</span><span>{money(detailItemsTotal)}</span></div>
              <div className="flex justify-between"><span>Order discount</span><span>- {money(detail.discount)}</span></div>
              <div className="flex justify-between"><span>Order tax</span><span>{money(detail.tax)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{money(detail.shipping)}</span></div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold text-[#003D82]">
                <span>Grand Total</span><span>{money(detail.grand_total)}</span>
              </div>
            </div>

            {detail.note && (
              <div className="rounded-lg bg-slate-50 border p-3 text-sm whitespace-pre-wrap">
                <span className="font-semibold text-[#0A2540]">Note: </span>{detail.note}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={docBusy} onClick={() => printQuotation(detail)}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
              <Button type="button" variant="outline" disabled={docBusy} onClick={() => downloadQuotationPdf(detail)}>
                {docBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                Download PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await sendQuotationWhatsApp(detail.id);
                    toast.success(res.link ? 'WhatsApp approval link sent' : 'WhatsApp sent');
                    setDetail(null);
                    loadList();
                  } catch (e) { toast.error(e.message); }
                }}
              >
                <MessageCircle className="h-4 w-4 mr-1" /> Send WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await convertQuotation(detail.id);
                    toast.success('Converted to sale');
                    setDetail(null);
                    loadList();
                  } catch (e) { toast.error(e.message); }
                }}
              >
                Convert to sale
              </Button>
              <Button
                type="button"
                className="bg-[#003D82] hover:bg-[#002855]"
                onClick={() => { const id = detail.id; setDetail(null); goAdd(id); }}
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
