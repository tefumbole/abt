import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  FileText, Loader2, MessageCircle, Plus, Printer, Search, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  convertQuotation, createQuotation, deleteQuotation, getQuotation,
  listBillers, listCustomers, listProducts, listQuotations, listSuppliers,
  listWarehouses, sendQuotationWhatsApp, setQuotationStatus,
} from '@/services/erpService';

const STATUS_META = {
  awaiting_approval: {
    label: 'Awaiting Client Approval',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    pill: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100',
    pillActive: 'bg-orange-500 text-white border-orange-500',
    Icon: Clock3,
  },
  approved: {
    label: 'Approved',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    pill: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    pillActive: 'bg-emerald-600 text-white border-emerald-600',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-red-100 text-red-800 border-red-300',
    pill: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
    pillActive: 'bg-red-600 text-white border-red-600',
    Icon: Ban,
  },
  draft: {
    label: 'Drafts',
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    pill: 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200',
    pillActive: 'bg-slate-600 text-white border-slate-600',
    Icon: FileText,
  },
};

function formatMoney(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const EMPTY_LINE = { product_id: '', qty: 1, net_unit_price: 0, discount: 0, tax: 0 };

export default function QuotationsPage() {
  const [tab, setTab] = useState('list');
  const [status, setStatus] = useState('awaiting_approval');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ awaiting_approval: 0, approved: 0, rejected: 0, draft: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [billers, setBillers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
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
      if (status) params.set('status', status);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString() ? `?${params}` : '';
      const res = await listQuotations(qs);
      setRows(res.data || []);
      setCounts(res.statusCounts || counts);
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
  }, []);

  useEffect(() => {
    if (tab === 'list') loadList();
  }, [tab, status]);

  const filtered = useMemo(() => rows, [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageTotal = pageRows.reduce((sum, r) => sum + Number(r.grand_total || 0), 0);
  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));

  const formGrand = useMemo(() => {
    const lines = form.items.reduce((sum, item) => {
      return sum + Number(item.qty || 0) * Number(item.net_unit_price || 0) - Number(item.discount || 0) + Number(item.tax || 0);
    }, 0);
    return lines - Number(form.discount || 0) + Number(form.shipping || 0) + Number(form.tax || 0);
  }, [form]);

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (allSelected) setSelected((prev) => prev.filter((id) => !pageRows.some((r) => r.id === id)));
    else setSelected((prev) => [...new Set([...prev, ...pageRows.map((r) => r.id)])]);
  };

  const openAdd = () => {
    setTab('add');
    setDetail(null);
  };

  const submitQuotation = async (e) => {
    e.preventDefault();
    const items = form.items.filter((i) => i.product_id);
    if (!form.warehouse_id) return toast.error('Warehouse is required');
    if (!items.length) return toast.error('Add at least one product line');
    setSaving(true);
    try {
      await createQuotation({
        warehouse_id: form.warehouse_id,
        customer_id: form.customer_id || null,
        biller_id: form.biller_id || null,
        supplier_id: form.supplier_id || null,
        discount: Number(form.discount || 0),
        shipping: Number(form.shipping || 0),
        tax: Number(form.tax || 0),
        note: form.note || null,
        cc_phones: form.cc_phones || null,
        status: form.status || 'draft',
        items: items.map((i) => ({
          product_id: i.product_id,
          qty: Number(i.qty || 0),
          net_unit_price: Number(i.net_unit_price || 0),
          discount: Number(i.discount || 0),
          tax: Number(i.tax || 0),
        })),
      });
      toast.success('Quotation created');
      setForm((f) => ({ ...f, note: '', cc_phones: '', items: [{ ...EMPTY_LINE }], discount: 0, shipping: 0, tax: 0, status: 'draft' }));
      setTab('list');
      setStatus(form.status === 'awaiting_approval' ? 'awaiting_approval' : 'draft');
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-wide text-[#0A2540]">QUOTATION</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-semibold border transition-colors',
            tab === 'list'
              ? 'bg-[#003D82] text-white border-[#003D82]'
              : 'bg-white text-[#D4AF37] border-[#D4AF37] hover:bg-amber-50'
          )}
        >
          Quotation List
        </button>
        <button
          type="button"
          onClick={openAdd}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border transition-colors',
            tab === 'add'
              ? 'bg-[#003D82] text-white border-[#003D82]'
              : 'bg-white text-[#D4AF37] border-[#D4AF37] hover:bg-amber-50'
          )}
        >
          <FileText className="h-4 w-4" />
          Add Quotation
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-[#003D82] hover:bg-[#002855]" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add Quotation
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_META).map(([key, meta]) => {
              const active = status === key;
              const Icon = meta.Icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? meta.pillActive : meta.pill
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                  <span className={cn(
                    'min-w-[1.5rem] rounded-full px-1.5 text-xs font-bold text-center',
                    active ? 'bg-white/25 text-white' : 'bg-white/80'
                  )}>
                    {counts[key] || 0}
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
                onSubmit={(e) => { e.preventDefault(); loadList(); }}
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
              </form>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="text-pink-600" title="Print"
                  onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>

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
                          <td className="p-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                          <td className="p-3 font-medium text-[#003D82]">{r.reference}</td>
                          <td className="p-3">{r.biller_name || '—'}</td>
                          <td className="p-3">{r.customer_name || '—'}</td>
                          <td className="p-3">{r.supplier_name || '—'}</td>
                          <td className="p-3">
                            <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold', meta.badge)}>
                              {meta.label.replace('Drafts', 'Draft')}
                            </span>
                          </td>
                          <td className="p-3 max-w-[180px] truncate">{r.client_comment || '—'}</td>
                          <td className="p-3 text-right font-medium">{formatMoney(r.grand_total)}</td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-1">
                                  Action <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => viewQuote(r.id)}>View</DropdownMenuItem>
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
                      <td className="p-3 text-right">{formatMoney(pageTotal)}</td>
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
            <h2 className="text-xl font-semibold text-[#0A2540]">Add Quotation</h2>
            <Button type="button" variant="outline" onClick={() => setTab('list')}>Back to list</Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {form.items.map((item, idx) => {
                    const sub = Number(item.qty || 0) * Number(item.net_unit_price || 0) - Number(item.discount || 0) + Number(item.tax || 0);
                    return (
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
                        <td className="p-2 text-right font-medium">{formatMoney(sub)}</td>
                        <td className="p-2">
                          <Button type="button" size="icon" variant="ghost" disabled={form.items.length <= 1}
                            onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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
            <div className="text-lg font-bold text-[#0A2540]">Grand Total: {formatMoney(formGrand)}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setTab('list')}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Quotation
              </Button>
            </div>
          </div>
        </form>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#0A2540]">{detail.reference}</h3>
                <p className="text-sm text-slate-600">{formatDateTime(detail.created_at)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>Close</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div>Customer: <strong>{detail.customer_name || '—'}</strong></div>
              <div>Biller: <strong>{detail.biller_name || '—'}</strong></div>
              <div>Supplier: <strong>{detail.supplier_name || '—'}</strong></div>
              <div>Status: <strong>{STATUS_META[detail.status]?.label || detail.status}</strong></div>
              <div className="sm:col-span-2">Client comment: {detail.client_comment || '—'}</div>
            </div>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-2">Product</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Price</th>
                  <th className="p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-2">{i.product_name}</td>
                    <td className="p-2">{i.qty}</td>
                    <td className="p-2">{formatMoney(i.net_unit_price)}</td>
                    <td className="p-2 text-right">{formatMoney(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-bold text-lg">Grand Total: {formatMoney(detail.grand_total)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
