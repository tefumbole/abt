import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown, Loader2, Plus, Search, Trash2, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PAYING_METHODS, PAYMENT_STATUS_META, PURCHASE_STATUS_META,
  formatErpDate, makeMoney, num, payingMethodLabel, toDateTimeLocal, toMysqlDateTime,
} from '@/lib/erpFormat';
import { getSystemSettings } from '@/services/settingsService';
import {
  createPurchase, createPurchasePayment, deletePurchase, deletePurchasePayment,
  getPurchase, listProducts, listPurchasePayments, listPurchases, listSuppliers,
  listWarehouses, toQuery, updatePurchase,
} from '@/services/erpService';

const SELECT_CLASS = 'w-full border rounded-md h-10 px-2 mt-1 text-sm bg-white';

const EMPTY_FILTERS = {
  q: '',
  warehouse_id: '',
  purchase_status: '',
  payment_status: '',
  from: '',
  to: '',
};

const EMPTY_LINE = () => ({
  product_id: '',
  product_name: '',
  product_code: '',
  qty: 1,
  net_unit_cost: 0,
  discount: 0,
  tax: 0,
});

function lineSubtotal(line) {
  return num(line.qty) * num(line.net_unit_cost) - num(line.discount) + num(line.tax);
}

function emptyForm(warehouseId = '') {
  return {
    warehouse_id: warehouseId,
    supplier_id: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_status: 'received',
    note: '',
    paid_amount: 0,
    paying_method: 'cash',
    items: [EMPTY_LINE()],
  };
}

export default function PurchasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'add' ? 'add' : 'list';
  const editId = tab === 'add' ? searchParams.get('id') : null;

  const [settings, setSettings] = useState({});
  const money = useMemo(() => makeMoney(settings), [settings]);
  const dateFormat = settings.date_format || 'd-m-Y';

  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');

  const [form, setForm] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);

  const [detail, setDetail] = useState(null);
  const [paymentPurchase, setPaymentPurchase] = useState(null);
  const [paymentsPurchase, setPaymentsPurchase] = useState(null);

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
        /* defaults fine */
      }
      try {
        const [w, s] = await Promise.all([listWarehouses(), listSuppliers()]);
        setWarehouses(w || []);
        setSuppliers(s || []);
        const def = (w || []).find((x) => x.is_default) || (w || [])[0];
        if (def?.id) {
          setForm((f) => (f.warehouse_id ? f : { ...f, warehouse_id: def.id }));
          await loadProducts(def.id);
        }
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, [loadProducts]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPurchases(toQuery({
        q: filters.q || undefined,
        warehouse_id: filters.warehouse_id || undefined,
        purchase_status: filters.purchase_status || undefined,
        payment_status: filters.payment_status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }));
      setRows(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (tab === 'list') loadList();
  }, [tab, loadList]);

  useEffect(() => {
    if (tab !== 'add') {
      setEditLoaded(false);
      return;
    }
    if (!editId) {
      setForm((prev) => {
        if (prev.warehouse_id) return emptyForm(prev.warehouse_id);
        const def = warehouses.find((w) => w.is_default) || warehouses[0];
        return emptyForm(def?.id || '');
      });
      setEditLoaded(true);
      return;
    }
    (async () => {
      setEditLoaded(false);
      try {
        const purchase = await getPurchase(editId);
        if (purchase?.warehouse_id) await loadProducts(purchase.warehouse_id);
        setForm({
          warehouse_id: purchase.warehouse_id || '',
          supplier_id: purchase.supplier_id || '',
          purchase_date: String(purchase.purchase_date || '').slice(0, 10)
            || new Date().toISOString().slice(0, 10),
          purchase_status: purchase.purchase_status || 'received',
          note: purchase.note || '',
          paid_amount: num(purchase.paid_amount),
          paying_method: 'cash',
          items: (purchase.items || []).length
            ? purchase.items.map((item) => ({
              product_id: item.product_id,
              product_name: item.product_name || '',
              product_code: item.product_code || '',
              qty: num(item.qty, 1),
              net_unit_cost: num(item.net_unit_cost),
              discount: num(item.discount),
              tax: num(item.tax),
            }))
            : [EMPTY_LINE()],
        });
        setEditLoaded(true);
      } catch (err) {
        toast.error(err.message);
        goTab('list');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editId, loadProducts]);

  // Fill default warehouse once masters arrive (create mode only).
  useEffect(() => {
    if (tab !== 'add' || editId || form.warehouse_id || !warehouses.length) return;
    const def = warehouses.find((w) => w.is_default) || warehouses[0];
    if (def?.id) setForm((prev) => (prev.warehouse_id ? prev : { ...prev, warehouse_id: def.id }));
  }, [tab, editId, warehouses, form.warehouse_id]);

  const grandTotal = useMemo(
    () => form.items.reduce((sum, line) => sum + lineSubtotal(line), 0),
    [form.items]
  );

  const patch = (changes) => setForm((prev) => ({ ...prev, ...changes }));

  const updateLine = (index, changes) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...changes };
        if (changes.product_id !== undefined) {
          const product = products.find((p) => p.id === changes.product_id);
          next.product_name = product?.name || '';
          next.product_code = product?.code || '';
          if (product && changes.net_unit_cost === undefined) {
            next.net_unit_cost = num(product.cost);
          }
        }
        return next;
      }),
    }));
  };

  const addLine = () => setForm((prev) => ({ ...prev, items: [...prev.items, EMPTY_LINE()] }));
  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length <= 1 ? [EMPTY_LINE()] : prev.items.filter((_, i) => i !== index),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.warehouse_id) return toast.error('Warehouse is required');
    const items = form.items.filter((line) => line.product_id && num(line.qty) > 0);
    if (!items.length) return toast.error('Add at least one product with a quantity');

    const body = {
      warehouse_id: form.warehouse_id,
      supplier_id: form.supplier_id || null,
      purchase_date: form.purchase_date,
      purchase_status: form.purchase_status,
      note: form.note || null,
      items: items.map((line) => ({
        product_id: line.product_id,
        qty: num(line.qty),
        net_unit_cost: num(line.net_unit_cost),
        discount: num(line.discount),
        tax: num(line.tax),
      })),
    };
    if (!editId) {
      body.paid_amount = num(form.paid_amount);
      body.paying_method = form.paying_method || 'cash';
    }

    setSaving(true);
    try {
      if (editId) {
        await updatePurchase(editId, body);
        toast.success('Purchase updated');
      } else {
        await createPurchase(body);
        toast.success('Purchase saved');
      }
      goTab('list');
      loadList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const openDetails = async (row) => {
    try {
      setDetail(await getPurchase(row.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openPayment = async (row) => {
    try {
      setPaymentPurchase(row.items ? row : await getPurchase(row.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removePurchase = async (row) => {
    if (!window.confirm(`Delete purchase ${row.reference}? Received stock will be reversed.`)) return;
    try {
      await deletePurchase(row.id);
      toast.success('Purchase deleted');
      loadList();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const applySearch = (event) => {
    event.preventDefault();
    setFilters((f) => ({ ...f, q: searchInput.trim() }));
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#003D82]">
          {tab === 'add' ? (editId ? 'Edit Purchase' : 'Add Purchase') : 'Purchase List'}
        </h1>
        {tab === 'list' && (
          <Button className="bg-[#003D82] hover:bg-[#002855]" onClick={() => goTab('add')}>
            <Plus className="h-4 w-4 mr-1" /> Add Purchase
          </Button>
        )}
      </div>

      {tab === 'list' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <form onSubmit={applySearch} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[180px]">
                <Label>Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Reference or supplier…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-40">
                <Label>Warehouse</Label>
                <select
                  className={SELECT_CLASS}
                  value={filters.warehouse_id}
                  onChange={(e) => setFilters((f) => ({ ...f, warehouse_id: e.target.value }))}
                >
                  <option value="">All</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="w-36">
                <Label>Status</Label>
                <select
                  className={SELECT_CLASS}
                  value={filters.purchase_status}
                  onChange={(e) => setFilters((f) => ({ ...f, purchase_status: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="ordered">Ordered</option>
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                </select>
              </div>
              <div className="w-36">
                <Label>Payment</Label>
                <select
                  className={SELECT_CLASS}
                  value={filters.payment_status}
                  onChange={(e) => setFilters((f) => ({ ...f, payment_status: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="w-36">
                <Label>From</Label>
                <Input
                  type="date" className="mt-1" value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div className="w-36">
                <Label>To</Label>
                <Input
                  type="date" className="mt-1" value={filters.to}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
              <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]">Filter</Button>
              <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
            </form>
          </div>

          <div className="rounded-xl border bg-white overflow-x-auto">
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#003D82]" />
              </div>
            ) : (
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Warehouse</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Due</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">No purchases found</td>
                    </tr>
                  )}
                  {rows.map((row) => {
                    const statusMeta = PURCHASE_STATUS_META[row.purchase_status] || PURCHASE_STATUS_META.pending;
                    const payMeta = PAYMENT_STATUS_META[row.payment_status] || PAYMENT_STATUS_META.pending;
                    const due = Math.max(0, num(row.due_amount ?? num(row.grand_total) - num(row.paid_amount)));
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">
                          {formatErpDate(row.purchase_date, dateFormat)}
                        </td>
                        <td className="p-3 font-medium">{row.reference}</td>
                        <td className="p-3">{row.supplier_name || '—'}</td>
                        <td className="p-3">{row.warehouse_name || '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={payMeta.className}>{payMeta.label}</Badge>
                        </td>
                        <td className="p-3 text-right">{money(row.grand_total)}</td>
                        <td className="p-3 text-right">{money(row.paid_amount)}</td>
                        <td className="p-3 text-right">{money(due)}</td>
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" size="sm" variant="outline">
                                Action <ChevronDown className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetails(row)}>View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => goTab('add', row.id)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPayment(row)}>
                                <Wallet className="h-4 w-4 mr-2" /> Add payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPaymentsPurchase(row)}>
                                View payments
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => removePurchase(row)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'add' && (
        !editLoaded && editId ? (
          <div className="rounded-xl border bg-white p-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#003D82]" />
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-xl border bg-white shadow-sm p-4 sm:p-5 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date" className="mt-1" value={form.purchase_date}
                  onChange={(e) => patch({ purchase_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Warehouse *</Label>
                <select
                  className={SELECT_CLASS}
                  value={form.warehouse_id}
                  onChange={(e) => {
                    patch({ warehouse_id: e.target.value });
                    loadProducts(e.target.value);
                  }}
                  required
                >
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Supplier</Label>
                <select
                  className={SELECT_CLASS}
                  value={form.supplier_id}
                  onChange={(e) => patch({ supplier_id: e.target.value })}
                >
                  <option value="">—</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Purchase Status *</Label>
                <select
                  className={SELECT_CLASS}
                  value={form.purchase_status}
                  onChange={(e) => patch({ purchase_status: e.target.value })}
                >
                  <option value="ordered">Ordered</option>
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Note</Label>
                <Textarea
                  className="mt-1" rows={2} value={form.note}
                  onChange={(e) => patch({ note: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" /> Add line
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="p-2 w-10">#</th>
                      <th className="p-2">Product</th>
                      <th className="p-2 w-28">Qty</th>
                      <th className="p-2 w-32">Unit Cost</th>
                      <th className="p-2 w-28">Discount</th>
                      <th className="p-2 w-28">Tax</th>
                      <th className="p-2 w-32 text-right">Subtotal</th>
                      <th className="p-2 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((line, index) => (
                      <tr key={`line-${index}`} className="border-t align-top">
                        <td className="p-2 text-slate-500">{index + 1}</td>
                        <td className="p-2">
                          <select
                            className={SELECT_CLASS}
                            value={line.product_id}
                            onChange={(e) => updateLine(index, { product_id: e.target.value })}
                            required
                          >
                            <option value="">Select product…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.code ? ` (${p.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number" step="0.001" min="0" value={line.qty}
                            onChange={(e) => updateLine(index, { qty: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number" step="0.01" min="0" value={line.net_unit_cost}
                            onChange={(e) => updateLine(index, { net_unit_cost: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number" step="0.01" min="0" value={line.discount}
                            onChange={(e) => updateLine(index, { discount: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number" step="0.01" min="0" value={line.tax}
                            onChange={(e) => updateLine(index, { tax: e.target.value })}
                          />
                        </td>
                        <td className="p-2 text-right font-medium pt-3">{money(lineSubtotal(line))}</td>
                        <td className="p-2">
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(index)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t pt-4">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Grand Total</div>
                <div className="text-lg font-semibold text-[#003D82]">{money(grandTotal)}</div>
              </div>
              {!editId && (
                <>
                  <div>
                    <Label>Paid Amount</Label>
                    <Input
                      type="number" step="0.01" min="0" className="mt-1" value={form.paid_amount}
                      onChange={(e) => patch({ paid_amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Paying Method</Label>
                    <select
                      className={SELECT_CLASS}
                      value={form.paying_method}
                      onChange={(e) => patch({ paying_method: e.target.value })}
                    >
                      {PAYING_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => goTab('list')}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        )
      )}

      {detail && (
        <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#003D82]">Purchase — {detail.reference}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div><span className="text-slate-500">Date:</span> {formatErpDate(detail.purchase_date, dateFormat)}</div>
              <div><span className="text-slate-500">Supplier:</span> {detail.supplier_name || '—'}</div>
              <div><span className="text-slate-500">Warehouse:</span> {detail.warehouse_name || '—'}</div>
              <div>
                <span className="text-slate-500">Status:</span>{' '}
                {PURCHASE_STATUS_META[detail.purchase_status]?.label || detail.purchase_status}
              </div>
              <div>
                <span className="text-slate-500">Payment:</span>{' '}
                {PAYMENT_STATUS_META[detail.payment_status]?.label || detail.payment_status}
              </div>
              <div><span className="text-slate-500">Grand Total:</span> {money(detail.grand_total)}</div>
              <div><span className="text-slate-500">Paid:</span> {money(detail.paid_amount)}</div>
              <div>
                <span className="text-slate-500">Due:</span>{' '}
                {money(Math.max(0, num(detail.grand_total) - num(detail.paid_amount)))}
              </div>
              {detail.note ? (
                <div className="sm:col-span-2"><span className="text-slate-500">Note:</span> {detail.note}</div>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-lg border mt-3">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-2">Product</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((item) => (
                    <tr key={item.id || item.product_id} className="border-t">
                      <td className="p-2">
                        {item.product_name || '—'}
                        {item.product_code ? (
                          <span className="text-slate-400"> · {item.product_code}</span>
                        ) : null}
                      </td>
                      <td className="p-2 text-right">{num(item.qty)}</td>
                      <td className="p-2 text-right">{money(item.net_unit_cost)}</td>
                      <td className="p-2 text-right">{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => { setDetail(null); goTab('add', detail.id); }}>
                Edit
              </Button>
              <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {paymentPurchase && (
        <AddPurchasePaymentModal
          purchase={paymentPurchase}
          money={money}
          onClose={() => setPaymentPurchase(null)}
          onSaved={loadList}
        />
      )}

      {paymentsPurchase && (
        <ViewPurchasePaymentsModal
          purchase={paymentsPurchase}
          money={money}
          dateFormat={dateFormat}
          onClose={() => setPaymentsPurchase(null)}
          onChanged={loadList}
        />
      )}
    </div>
  );
}

function AddPurchasePaymentModal({ purchase, money, onClose, onSaved }) {
  const due = Math.max(0, num(purchase?.due_amount ?? num(purchase?.grand_total) - num(purchase?.paid_amount)));
  const [form, setForm] = useState({
    amount: due,
    paying_method: 'cash',
    note: '',
    paid_at: toDateTimeLocal(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, amount: due, paid_at: toDateTimeLocal() }));
  }, [purchase?.id, due]);

  if (!purchase) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (num(form.amount) <= 0) return toast.error('Amount must be greater than zero');
    setSaving(true);
    try {
      await createPurchasePayment(purchase.id, {
        amount: num(form.amount),
        paying_method: form.paying_method,
        note: form.note || null,
        paid_at: toMysqlDateTime(form.paid_at),
      });
      toast.success('Payment recorded');
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#003D82]">Add Payment — {purchase.reference}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-slate-50 p-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Grand Total</div>
              <div className="font-semibold">{money(purchase.grand_total)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Paid</div>
              <div className="font-semibold">{money(purchase.paid_amount)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Due</div>
              <div className="font-semibold text-rose-600">{money(due)}</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number" step="0.01" min="0.01" className="mt-1" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Paying Method</Label>
              <select
                className={SELECT_CLASS}
                value={form.paying_method}
                onChange={(e) => setForm({ ...form, paying_method: e.target.value })}
              >
                {PAYING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Date</Label>
              <Input
                type="datetime-local" className="mt-1" value={form.paid_at}
                onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Payment Note</Label>
              <Textarea
                rows={3} className="mt-1" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewPurchasePaymentsModal({ purchase, money, dateFormat = 'd-m-Y', onClose, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!purchase?.id) return;
    setLoading(true);
    try {
      setRows((await listPurchasePayments(purchase.id)) || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [purchase?.id]);

  if (!purchase) return null;

  const remove = async (payment) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await deletePurchasePayment(purchase.id, payment.id);
      toast.success('Payment deleted');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#003D82]">Payments — {purchase.reference}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#003D82]" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Reference</th>
                  <th className="p-2">Method</th>
                  <th className="p-2">Note</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No payments recorded</td></tr>
                )}
                {rows.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{formatErpDate(p.paid_at, dateFormat)}</td>
                    <td className="p-2">{p.reference || '—'}</td>
                    <td className="p-2">{payingMethodLabel(p.paying_method)}</td>
                    <td className="p-2 max-w-[220px] truncate">{p.note || '—'}</td>
                    <td className="p-2 text-right font-medium">{money(p.amount)}</td>
                    <td className="p-2">
                      <Button type="button" size="icon" variant="ghost" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end border-t pt-4">
          <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
