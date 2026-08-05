import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Package, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  PAYING_METHODS, num, toDateTimeLocal, toMysqlDateTime,
} from '@/lib/erpFormat';

const SELECT_CLASS = 'w-full border rounded-md h-10 px-2 mt-1 text-sm bg-white';

function emptyForm() {
  return {
    sale_date: toDateTimeLocal(),
    reference: '',
    customer_id: '',
    warehouse_id: '',
    biller_id: '',
    sale_status: 'completed',
    items: [],
    discount: 0,
    tax: 0,
    shipping: 0,
    note: '',
    paid_amount: 0,
    paying_method: 'cash',
  };
}

function lineSubtotal(line) {
  return num(line.qty) * num(line.net_unit_price) - num(line.discount) + num(line.tax);
}

/**
 * Add / edit sale form: header fields, product picker, editable line items,
 * order totals and (create only) the initial payment block.
 */
export default function SaleFormFields({
  mode = 'create',
  initialSale = null,
  warehouses = [],
  customers = [],
  billers = [],
  products = [],
  money,
  saving = false,
  onWarehouseChange,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // Default warehouse / biller once the masters land (create mode only).
  useEffect(() => {
    if (mode !== 'create' || form.warehouse_id) return;
    const warehouse = warehouses.find((w) => w.is_default) || warehouses[0];
    const biller = billers.find((b) => b.is_default) || billers[0];
    if (!warehouse && !biller) return;
    setForm((prev) => (prev.warehouse_id ? prev : {
      ...prev,
      warehouse_id: warehouse?.id || '',
      biller_id: prev.biller_id || biller?.id || '',
    }));
  }, [mode, warehouses, billers, form.warehouse_id]);

  useEffect(() => {
    if (!initialSale) return;
    setForm({
      sale_date: toDateTimeLocal(initialSale.sale_date || initialSale.created_at),
      reference: initialSale.reference || '',
      customer_id: initialSale.customer_id || '',
      warehouse_id: initialSale.warehouse_id || '',
      biller_id: initialSale.biller_id || '',
      sale_status: initialSale.sale_status || 'completed',
      items: (initialSale.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name || '',
        product_code: item.product_code || '',
        qty: num(item.qty, 1),
        net_unit_price: num(item.net_unit_price),
        discount: num(item.discount),
        tax: num(item.tax),
      })),
      discount: num(initialSale.discount),
      tax: num(initialSale.tax),
      shipping: num(initialSale.shipping),
      note: initialSale.note || '',
      paid_amount: num(initialSale.paid_amount),
      paying_method: initialSale.paying_method || 'cash',
    });
  }, [initialSale]);

  useEffect(() => {
    const close = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => [p.name, p.code, p.barcode]
        .some((field) => String(field || '').toLowerCase().includes(q)))
      .slice(0, 12);
  }, [products, query]);

  const itemsSubtotal = useMemo(
    () => form.items.reduce((sum, line) => sum + lineSubtotal(line), 0),
    [form.items]
  );
  const grandTotal = itemsSubtotal - num(form.discount) + num(form.tax) + num(form.shipping);
  const balance = grandTotal - num(form.paid_amount);

  const patch = (changes) => setForm((prev) => ({ ...prev, ...changes }));

  const updateLine = (index, changes) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    }));
  };

  const removeLine = (index) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const addProduct = (product) => {
    if (!product) return;
    setForm((prev) => {
      const index = prev.items.findIndex((line) => line.product_id === product.id);
      if (index >= 0) {
        return {
          ...prev,
          items: prev.items.map((line, i) => (
            i === index ? { ...line, qty: num(line.qty) + 1 } : line
          )),
        };
      }
      return {
        ...prev,
        items: [...prev.items, {
          product_id: product.id,
          product_name: product.name,
          product_code: product.code || product.barcode || '',
          qty: 1,
          net_unit_price: num(product.price),
          discount: 0,
          tax: 0,
        }],
      };
    });
    setQuery('');
    setPickerOpen(false);
  };

  const handlePickerKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((p) => String(p.code || '').toLowerCase() === q
      || String(p.barcode || '').toLowerCase() === q);
    const picked = exact || (matches.length === 1 ? matches[0] : null);
    if (picked) addProduct(picked);
    else toast.error('No matching product — pick one from the list');
  };

  const changeWarehouse = (warehouseId) => {
    patch({ warehouse_id: warehouseId });
    onWarehouseChange?.(warehouseId);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.warehouse_id) return toast.error('Warehouse is required');
    if (!form.customer_id) return toast.error('Customer is required');
    const items = form.items.filter((line) => line.product_id && num(line.qty) > 0);
    if (!items.length) return toast.error('Add at least one product with a quantity');

    const body = {
      warehouse_id: form.warehouse_id,
      customer_id: form.customer_id,
      biller_id: form.biller_id || null,
      sale_status: form.sale_status,
      sale_date: toMysqlDateTime(form.sale_date),
      discount: num(form.discount),
      shipping: num(form.shipping),
      tax: num(form.tax),
      note: form.note || null,
      items: items.map((line) => ({
        product_id: line.product_id,
        qty: num(line.qty),
        net_unit_price: num(line.net_unit_price),
        discount: num(line.discount),
        tax: num(line.tax),
      })),
    };
    if (mode === 'create') {
      body.paid_amount = num(form.paid_amount);
      body.paying_method = form.paying_method || 'cash';
    }
    return onSubmit?.(body);
  };

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white shadow-sm p-4 sm:p-5 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Date *</Label>
          <Input
            type="datetime-local"
            className="mt-1"
            value={form.sale_date}
            onChange={(e) => patch({ sale_date: e.target.value })}
          />
        </div>
        <div>
          <Label>Reference</Label>
          <Input
            className="mt-1 bg-slate-50"
            readOnly
            value={form.reference}
            placeholder="auto generated"
          />
        </div>
        <div>
          <Label>Customer *</Label>
          <select
            className={SELECT_CLASS}
            value={form.customer_id}
            onChange={(e) => patch({ customer_id: e.target.value })}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Warehouse *</Label>
          <select
            className={SELECT_CLASS}
            value={form.warehouse_id}
            onChange={(e) => changeWarehouse(e.target.value)}
          >
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Biller</Label>
          <select
            className={SELECT_CLASS}
            value={form.biller_id}
            onChange={(e) => patch({ biller_id: e.target.value })}
          >
            <option value="">—</option>
            {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Sale Status *</Label>
          <select
            className={SELECT_CLASS}
            value={form.sale_status}
            onChange={(e) => patch({ sale_status: e.target.value })}
          >
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div ref={pickerRef} className="relative max-w-xl">
          <Label>Add Product</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              value={query}
              placeholder="Scan/Search product by name, code or barcode"
              onChange={(e) => { setQuery(e.target.value); setPickerOpen(true); }}
              onFocus={() => setPickerOpen(true)}
              onKeyDown={handlePickerKeyDown}
            />
          </div>
          {pickerOpen && query.trim() && (
            <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-white shadow-lg">
              {matches.length === 0 && (
                <div className="p-3 text-sm text-slate-500">No product matches “{query}”</div>
              )}
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 shrink-0 text-[#003D82]" />
                    <span className="truncate">
                      {p.name}
                      {p.code ? <span className="text-slate-400"> · {p.code}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-600">
                    {money ? money(p.price) : num(p.price)}
                    <span className="ml-2 text-xs text-slate-400">stock {num(p.stock_qty)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-2 w-10">#</th>
                <th className="p-2">Product</th>
                <th className="p-2 w-28">Qty</th>
                <th className="p-2 w-32">Net Unit Price</th>
                <th className="p-2 w-28">Discount</th>
                <th className="p-2 w-28">Tax</th>
                <th className="p-2 w-32 text-right">Subtotal</th>
                <th className="p-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">No products added</td>
                </tr>
              )}
              {form.items.map((line, index) => (
                <tr key={`${line.product_id}-${index}`} className="border-t align-top">
                  <td className="p-2 text-slate-500">{index + 1}</td>
                  <td className="p-2">
                    <div className="font-medium text-slate-800">{line.product_name || '—'}</div>
                    {line.product_code ? (
                      <div className="text-xs text-slate-400">{line.product_code}</div>
                    ) : null}
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.qty}
                      onChange={(e) => updateLine(index, { qty: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.net_unit_price}
                      onChange={(e) => updateLine(index, { net_unit_price: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discount}
                      onChange={(e) => updateLine(index, { discount: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.tax}
                      onChange={(e) => updateLine(index, { tax: e.target.value })}
                    />
                  </td>
                  <td className="p-2 text-right font-medium whitespace-nowrap">
                    {money ? money(lineSubtotal(line)) : lineSubtotal(line).toFixed(2)}
                  </td>
                  <td className="p-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Remove line"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-3 content-start">
          <div>
            <Label>Order Discount</Label>
            <Input
              type="number" step="0.01" className="mt-1" value={form.discount}
              onChange={(e) => patch({ discount: e.target.value })}
            />
          </div>
          <div>
            <Label>Order Tax</Label>
            <Input
              type="number" step="0.01" className="mt-1" value={form.tax}
              onChange={(e) => patch({ tax: e.target.value })}
            />
          </div>
          <div>
            <Label>Shipping</Label>
            <Input
              type="number" step="0.01" className="mt-1" value={form.shipping}
              onChange={(e) => patch({ shipping: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Items Subtotal</span>
            <span className="font-medium">{money ? money(itemsSubtotal) : itemsSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Order Discount</span>
            <span>- {money ? money(form.discount) : num(form.discount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Order Tax</span>
            <span>{money ? money(form.tax) : num(form.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Shipping</span>
            <span>{money ? money(form.shipping) : num(form.shipping).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold text-[#003D82]">
            <span>Grand Total</span>
            <span>{money ? money(grandTotal) : grandTotal.toFixed(2)}</span>
          </div>
          {mode === 'edit' && (
            <div className="space-y-1 border-t pt-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Paid</span>
                <span>{money ? money(form.paid_amount) : num(form.paid_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-600">Due</span>
                <span>
                  {money
                    ? money(Math.max(0, grandTotal - num(form.paid_amount)))
                    : Math.max(0, grandTotal - num(form.paid_amount)).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Payments are managed from the sale list (Add Payment).
              </p>
            </div>
          )}
        </div>
      </div>

      {mode === 'create' && (
        <div className="grid gap-4 sm:grid-cols-3 rounded-lg border p-4">
          <div>
            <Label>Paid Amount</Label>
            <Input
              type="number" step="0.01" className="mt-1" value={form.paid_amount}
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
              {PAYING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <span className="text-sm text-slate-600">{balance >= 0 ? 'Balance Due' : 'Change'}</span>
            <span className={cn(
              'text-lg font-bold',
              balance > 0 ? 'text-rose-600' : 'text-emerald-600'
            )}>
              {money ? money(Math.abs(balance)) : Math.abs(balance).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div>
        <Label>Note</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={form.note}
          placeholder="Optional note shown on the invoice"
          onChange={(e) => patch({ note: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          {mode === 'edit' ? 'Update Sale' : 'Save Sale'}
        </Button>
      </div>
    </form>
  );
}
