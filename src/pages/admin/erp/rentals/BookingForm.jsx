import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Package, Plus, ScanLine, Search, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  makeMoney, num, toDateTimeLocal, toMysqlDateTime,
} from '@/lib/erpFormat';
import {
  BOOKING_METHODS, bookingGrandTotal, bookingLineSubtotal, bookingMethodLabel, hoursBetween,
} from '@/lib/rentalFormat';
import { getSystemSettings } from '@/services/settingsService';
import {
  createBooking, createCustomer, getBooking, listBillers, listCustomers,
  listProducts, listWarehouses, updateBooking,
} from '@/services/erpService';

const SELECT_CLASS = 'w-full border rounded-md h-10 px-2 mt-1 text-sm bg-white';
const CELL_SELECT_CLASS = 'w-full border rounded-md h-9 px-1.5 text-sm bg-white';
const CELL_INPUT_CLASS = 'h-9 text-sm';

const CONTRACT_TYPES = [
  { value: 'none', label: 'No contract' },
  { value: 'standard', label: 'Standard rental contract' },
  { value: 'equipment', label: 'Equipment handover' },
  { value: 'custom', label: 'Custom' },
];

const BOOKING_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'requested', label: 'Requested' },
];

function emptyForm() {
  return {
    warehouse_id: '',
    customer_id: '',
    customer_name: '',
    biller_id: '',
    from_datetime: toDateTimeLocal(),
    to_datetime: toDateTimeLocal(new Date(Date.now() + 24 * 3600 * 1000)),
    contract_type: 'none',
    booking_status: 'pending',
    note: '',
    staff_note: '',
    cc_recipients: [],
    order_tax: 0,
    order_discount: 0,
    shipping: 0,
    items: [],
  };
}

function newLine(product, from, to) {
  return {
    product_id: product.id,
    product_name: product.name || '',
    product_code: product.code || product.barcode || '',
    qty: 1,
    batch_no: product.batch_no || '',
    booking_method: 'duration',
    number: '',
    net_unit_price: num(product.price),
    duration_hours: hoursBetween(from, to),
    discount: 0,
    tax: 0,
    from_datetime: from,
    to_datetime: to,
  };
}

function normaliseCc(entry) {
  if (typeof entry === 'string') return { name: entry, phone: '' };
  return {
    name: entry?.name || entry?.customer_name || '',
    phone: entry?.phone || entry?.mobile || '',
  };
}

/** cc_recipients may arrive as an array or as a JSON string column. */
function parseCcRecipients(value) {
  let raw = value;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      raw = JSON.parse(raw);
    } catch {
      return raw.split(',').map((part) => ({ name: part.trim(), phone: '' })).filter((c) => c.name);
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(normaliseCc).filter((c) => c.name || c.phone);
}

function hydrate(booking) {
  const from = toDateTimeLocal(booking.from_datetime || booking.from_date || booking.created_at);
  const to = toDateTimeLocal(booking.to_datetime || booking.to_date || booking.from_datetime);
  return {
    warehouse_id: booking.warehouse_id || '',
    customer_id: booking.customer_id || '',
    // Kept only so the picker can label a customer missing from the active list.
    customer_name: booking.customer_name || '',
    biller_id: booking.biller_id || '',
    from_datetime: from,
    to_datetime: to,
    contract_type: booking.contract_type || 'none',
    booking_status: booking.booking_status || 'pending',
    note: booking.note || '',
    staff_note: booking.staff_note || '',
    cc_recipients: parseCcRecipients(booking.cc_recipients),
    order_tax: num(booking.order_tax),
    order_discount: num(booking.order_discount),
    shipping: num(booking.shipping),
    items: (booking.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name || '',
      product_code: item.product_code || item.code || '',
      qty: num(item.qty, 1),
      batch_no: item.batch_no || '',
      booking_method: item.booking_method || 'duration',
      number: item.number || '',
      net_unit_price: num(item.net_unit_price),
      duration_hours: num(item.duration_hours, 1),
      discount: num(item.discount),
      tax: num(item.tax),
      from_datetime: toDateTimeLocal(item.from_datetime || booking.from_datetime) || from,
      to_datetime: toDateTimeLocal(item.to_datetime || booking.to_datetime) || to,
    })),
  };
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-xl border bg-white shadow-sm p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-[#D4AF37]" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#003D82]">{title}</h3>
      </div>
      {description ? <p className="mt-2 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Closes a popover on outside click without re-subscribing on every render. */
function useDismiss(ref, onDismiss) {
  const handler = useRef(onDismiss);
  handler.current = onDismiss;
  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler.current();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ref]);
}

/**
 * Create / edit an equipment rental booking: client & location, default rental
 * period, equipment lines with per-line booking method, totals and contract notes.
 */
export default function BookingForm({ bookingId = null, onSaved = () => {}, onCancel = () => {} }) {
  const isEdit = Boolean(bookingId);

  const [form, setForm] = useState(emptyForm);
  const [settings, setSettings] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [billers, setBillers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const money = useMemo(() => makeMoney(settings), [settings]);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerRef = useRef(null);
  useDismiss(customerRef, () => setCustomerOpen(false));

  const [ccQuery, setCcQuery] = useState('');
  const [ccOpen, setCcOpen] = useState(false);
  const [ccManual, setCcManual] = useState({ name: '', phone: '' });
  const ccRef = useRef(null);
  useDismiss(ccRef, () => setCcOpen(false));

  const [productQuery, setProductQuery] = useState('');
  const [productOpen, setProductOpen] = useState(false);
  const productRef = useRef(null);
  useDismiss(productRef, () => setProductOpen(false));

  const [customerDialog, setCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const sys = await getSystemSettings();
        if (!cancelled && sys) setSettings(sys);
      } catch {
        /* currency/date defaults are fine when settings are unavailable */
      }
      try {
        const [w, c, b] = await Promise.all([
          listWarehouses(), listCustomers('?active=1'), listBillers(),
        ]);
        if (cancelled) return;
        setWarehouses(w || []);
        setCustomers(c || []);
        setBillers(b || []);
        if (!bookingId) {
          const warehouse = (w || []).find((x) => x.is_default) || (w || [])[0];
          const biller = (b || []).find((x) => x.is_default) || (b || [])[0];
          setForm((prev) => ({
            ...prev,
            warehouse_id: prev.warehouse_id || warehouse?.id || '',
            biller_id: prev.biller_id || biller?.id || '',
          }));
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Could not load booking master data');
      }
      if (bookingId) {
        try {
          const booking = await getBooking(bookingId);
          if (!cancelled && booking) setForm(hydrate(booking));
        } catch (err) {
          if (!cancelled) toast.error(err.message || 'Could not load the booking');
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  // Rentable stock is per warehouse, so the catalogue reloads with the selection.
  useEffect(() => {
    const warehouseId = form.warehouse_id;
    if (!warehouseId) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listProducts(warehouseId);
        if (!cancelled) setProducts(rows || []);
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Could not load products');
      }
    })();
    return () => { cancelled = true; };
  }, [form.warehouse_id]);

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

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(form.customer_id)) || null,
    [customers, form.customer_id]
  );

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const pool = q
      ? customers.filter((c) => [c.name, c.phone, c.email, c.company_name]
        .some((field) => String(field || '').toLowerCase().includes(q)))
      : customers;
    return pool.slice(0, 30);
  }, [customers, customerQuery]);

  const ccMatches = useMemo(() => {
    const q = ccQuery.trim().toLowerCase();
    const taken = new Set(form.cc_recipients.map((c) => `${c.name}|${c.phone}`.toLowerCase()));
    return customers
      .filter((c) => !taken.has(`${c.name || ''}|${c.phone || ''}`.toLowerCase()))
      .filter((c) => (q
        ? [c.name, c.phone, c.company_name].some((f) => String(f || '').toLowerCase().includes(q))
        : true))
      .slice(0, 20);
  }, [customers, ccQuery, form.cc_recipients]);

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => [p.name, p.code, p.barcode]
        .some((field) => String(field || '').toLowerCase().includes(q)))
      .slice(0, 12);
  }, [products, productQuery]);

  const addCcRecipient = (entry) => {
    const contact = normaliseCc(entry);
    if (!contact.name && !contact.phone) return;
    setForm((prev) => {
      const key = `${contact.name}|${contact.phone}`.toLowerCase();
      const exists = prev.cc_recipients.some((c) => `${c.name}|${c.phone}`.toLowerCase() === key);
      return exists ? prev : { ...prev, cc_recipients: [...prev.cc_recipients, contact] };
    });
    setCcQuery('');
  };

  const removeCcRecipient = (index) => {
    setForm((prev) => ({
      ...prev,
      cc_recipients: prev.cc_recipients.filter((_, i) => i !== index),
    }));
  };

  const addManualCc = () => {
    if (!ccManual.name.trim() && !ccManual.phone.trim()) {
      toast.error('Enter a name or phone for the CC contact');
      return;
    }
    addCcRecipient({ name: ccManual.name.trim(), phone: ccManual.phone.trim() });
    setCcManual({ name: '', phone: '' });
  };

  const addProduct = (product) => {
    if (!product) return;
    setForm((prev) => {
      const index = prev.items.findIndex((line) => String(line.product_id) === String(product.id));
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
        items: [...prev.items, newLine(product, prev.from_datetime, prev.to_datetime)],
      };
    });
    setProductQuery('');
    setProductOpen(false);
  };

  const addTypedProduct = () => {
    const q = productQuery.trim().toLowerCase();
    if (!q) {
      toast.error('Type a product name, code or barcode first');
      return;
    }
    const exact = products.find((p) => String(p.code || '').toLowerCase() === q
      || String(p.barcode || '').toLowerCase() === q);
    const picked = exact || (productMatches.length === 1 ? productMatches[0] : null);
    if (picked) addProduct(picked);
    else toast.error('No matching product — pick one from the list');
  };

  const handleProductKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTypedProduct();
  };

  const applyDatesToAll = () => {
    if (!form.from_datetime || !form.to_datetime) {
      toast.error('Set both the from and to date & time first');
      return;
    }
    if (new Date(form.to_datetime) <= new Date(form.from_datetime)) {
      toast.error('The to date must be after the from date');
      return;
    }
    if (!form.items.length) {
      toast.error('Add equipment lines before applying dates');
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line) => ({
        ...line,
        from_datetime: prev.from_datetime,
        to_datetime: prev.to_datetime,
        duration_hours: hoursBetween(prev.from_datetime, prev.to_datetime),
      })),
    }));
    toast.success(`Rental period applied to ${form.items.length} item(s)`);
  };

  const saveCustomer = async () => {
    const name = newCustomer.name.trim();
    if (!name) {
      toast.error('Customer name is required');
      return;
    }
    setCreatingCustomer(true);
    try {
      const res = await createCustomer({
        name,
        phone: newCustomer.phone.trim() || null,
        email: newCustomer.email.trim() || null,
      });
      const created = (res && res.id) ? res : res?.data;
      const row = created?.id
        ? created
        : { id: res?.id || res?.insertId, name, phone: newCustomer.phone.trim() };
      setCustomers((prev) => [row, ...prev.filter((c) => String(c.id) !== String(row.id))]);
      if (row.id) patch({ customer_id: row.id, customer_name: row.name || name });
      setCustomerDialog(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      toast.success('Customer created');
    } catch (err) {
      toast.error(err.message || 'Could not create the customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const lineTotals = useMemo(() => form.items.reduce((acc, line) => ({
    qty: acc.qty + num(line.qty),
    discount: acc.discount + num(line.discount),
    tax: acc.tax + num(line.tax),
    subtotal: acc.subtotal + bookingLineSubtotal(line),
  }), { qty: 0, discount: 0, tax: 0, subtotal: 0 }), [form.items]);

  const grandTotal = useMemo(() => bookingGrandTotal(form.items, {
    order_tax: form.order_tax,
    order_discount: form.order_discount,
    shipping: form.shipping,
  }), [form.items, form.order_tax, form.order_discount, form.shipping]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.warehouse_id) {
      toast.error('Warehouse is required');
      return;
    }
    if (!form.customer_id) {
      toast.error('Customer is required');
      return;
    }
    if (!form.from_datetime || !form.to_datetime) {
      toast.error('From and to date & time are required');
      return;
    }
    if (new Date(form.to_datetime) <= new Date(form.from_datetime)) {
      toast.error('The to date must be after the from date');
      return;
    }
    const items = form.items.filter((line) => line.product_id && num(line.qty) > 0);
    if (!items.length) {
      toast.error('Add at least one equipment line with a quantity');
      return;
    }

    const payload = {
      warehouse_id: form.warehouse_id,
      customer_id: form.customer_id,
      biller_id: form.biller_id || null,
      from_datetime: toMysqlDateTime(form.from_datetime),
      to_datetime: toMysqlDateTime(form.to_datetime),
      contract_type: form.contract_type,
      booking_status: form.booking_status,
      note: form.note || null,
      staff_note: form.staff_note || null,
      cc_recipients: form.cc_recipients.map((c) => ({ name: c.name, phone: c.phone })),
      order_tax: num(form.order_tax),
      order_discount: num(form.order_discount),
      shipping: num(form.shipping),
      items: items.map((line) => ({
        product_id: line.product_id,
        qty: num(line.qty, 1),
        net_unit_price: num(line.net_unit_price),
        duration_hours: line.booking_method === 'flat'
          ? 1
          : Math.max(1, num(line.duration_hours, 1)),
        booking_method: line.booking_method || 'duration',
        number: line.number || null,
        batch_no: line.batch_no || null,
        discount: num(line.discount),
        tax: num(line.tax),
        from_datetime: toMysqlDateTime(line.from_datetime || form.from_datetime),
        to_datetime: toMysqlDateTime(line.to_datetime || form.to_datetime),
      })),
    };

    setSaving(true);
    try {
      const result = isEdit
        ? await updateBooking(bookingId, payload)
        : await createBooking(payload);
      toast.success(isEdit ? 'Booking updated' : 'Booking created');
      onSaved(result);
    } catch (err) {
      toast.error(err.message || 'Could not save the booking');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border bg-white p-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#003D82]" />
        <span className="text-sm">Loading booking form…</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-2">
      <SectionCard title="Client & Location">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div ref={customerRef} className="relative">
            <Label>Customer *</Label>
            <div className="mt-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search customer by name or phone…"
                  value={customerOpen
                    ? customerQuery
                    : (selectedCustomer?.name || form.customer_name || '')}
                  onFocus={() => { setCustomerQuery(''); setCustomerOpen(true); }}
                  onChange={(e) => { setCustomerQuery(e.target.value); setCustomerOpen(true); }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Create customer"
                className="shrink-0 border-[#003D82] text-[#003D82]"
                onClick={() => setCustomerDialog(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {customerOpen && (
              <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-white shadow-lg">
                {customerMatches.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">No customer matches</div>
                )}
                {customerMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      patch({ customer_id: c.id, customer_name: c.name || '' });
                      setCustomerQuery('');
                      setCustomerOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50',
                      String(c.id) === String(form.customer_id) && 'bg-slate-50 font-medium'
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.phone ? <span className="shrink-0 text-xs text-slate-400">{c.phone}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Warehouse *</Label>
            <select
              className={SELECT_CLASS}
              value={form.warehouse_id}
              onChange={(e) => patch({ warehouse_id: e.target.value })}
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <Label>Biller *</Label>
            <select
              className={SELECT_CLASS}
              value={form.biller_id}
              onChange={(e) => patch({ biller_id: e.target.value })}
            >
              <option value="">Select biller…</option>
              {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div ref={ccRef} className="relative">
          <Label>CC (Engineer / Company Copy)</Label>
          <div
            role="presentation"
            className="mt-1 flex min-h-10 flex-wrap items-center gap-2 rounded-md border bg-white p-2"
            onClick={() => setCcOpen(true)}
          >
            {form.cc_recipients.map((c, index) => (
              <Badge
                key={`${c.name}-${c.phone}-${index}`}
                variant="secondary"
                className="gap-1 border-[#003D82]/20 bg-[#003D82]/5 text-[#003D82]"
              >
                <Users className="h-3 w-3" />
                <span className="max-w-[12rem] truncate">
                  {c.name || c.phone}
                  {c.name && c.phone ? <span className="text-slate-400"> · {c.phone}</span> : null}
                </span>
                <button
                  type="button"
                  title="Remove CC contact"
                  onClick={(e) => { e.stopPropagation(); removeCcRecipient(index); }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              className="min-w-[10rem] flex-1 border-0 bg-transparent text-sm outline-none"
              placeholder={form.cc_recipients.length ? 'Add another contact…' : 'Search contacts to CC…'}
              value={ccQuery}
              onFocus={() => setCcOpen(true)}
              onChange={(e) => { setCcQuery(e.target.value); setCcOpen(true); }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            CC contacts receive the equipment list via WhatsApp without pricing.
          </p>
          {ccOpen && (
            <div className="absolute z-30 mt-1 w-full rounded-md border bg-white shadow-lg">
              <div className="max-h-56 overflow-y-auto">
                {ccMatches.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">No contact matches</div>
                )}
                {ccMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addCcRecipient(c)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.phone ? <span className="shrink-0 text-xs text-slate-400">{c.phone}</span> : null}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2 border-t bg-slate-50 p-2">
                <Input
                  className="h-9 min-w-[8rem] flex-1 bg-white"
                  placeholder="Name"
                  value={ccManual.name}
                  onChange={(e) => setCcManual((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  className="h-9 min-w-[8rem] flex-1 bg-white"
                  placeholder="Phone"
                  value={ccManual.phone}
                  onChange={(e) => setCcManual((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <Button type="button" variant="outline" className="h-9" onClick={addManualCc}>
                  <UserPlus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Default Rental Period"
        description='New items inherit these dates. Use "Apply to All Items" to update existing rows.'
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>From Date &amp; Time *</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={form.from_datetime}
              onChange={(e) => patch({ from_datetime: e.target.value })}
            />
          </div>
          <div>
            <Label>To Date &amp; Time *</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={form.to_datetime}
              onChange={(e) => patch({ to_datetime: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#D4AF37] text-[#8a6d1f] hover:bg-[#D4AF37]/10"
              onClick={applyDatesToAll}
            >
              Apply to All Items
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Default duration:{' '}
          <span className="font-medium text-slate-700">
            {hoursBetween(form.from_datetime, form.to_datetime)} hour(s)
          </span>
        </p>
      </SectionCard>

      <SectionCard title="Equipment Selection">
        <div ref={productRef} className="relative max-w-2xl">
          <Label>Select Product</Label>
          <div className="mt-1 flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Please type product code and select..."
                value={productQuery}
                onFocus={() => setProductOpen(true)}
                onChange={(e) => { setProductQuery(e.target.value); setProductOpen(true); }}
                onKeyDown={handleProductKeyDown}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Add the typed product"
              className="shrink-0 border-[#003D82] text-[#003D82]"
              onClick={addTypedProduct}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {productOpen && productQuery.trim() && (
            <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-white shadow-lg">
              {productMatches.length === 0 && (
                <div className="p-3 text-sm text-slate-500">
                  No product matches “{productQuery}”
                </div>
              )}
              {productMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-[#003D82]" />
                    <span className="truncate">
                      {p.name}
                      {p.code ? <span className="text-slate-400"> · {p.code}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-600">
                    {money(p.price)}
                    <span className="ml-2 text-xs text-slate-400">stock {num(p.stock_qty)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {!form.warehouse_id && (
            <p className="mt-1 text-xs text-amber-600">
              Select a warehouse to load its rentable equipment.
            </p>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2 w-28">Code</th>
                <th className="p-2 w-20">Qty</th>
                <th className="p-2 w-28">Batch No</th>
                <th className="p-2 w-36">Booking Method</th>
                <th className="p-2 w-28">Number</th>
                <th className="p-2 w-32">Net Unit Price</th>
                <th className="p-2 w-24">Duration</th>
                <th className="p-2 w-24">Discount</th>
                <th className="p-2 w-24">Tax</th>
                <th className="p-2 w-32 text-right">SubTotal</th>
                <th className="p-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-slate-500">
                    No equipment added yet
                  </td>
                </tr>
              )}
              {form.items.map((line, index) => {
                const flat = line.booking_method === 'flat';
                return (
                  <tr key={`${line.product_id}-${index}`} className="border-t align-middle">
                    <td className="p-2">
                      <div className="font-medium text-slate-800">{line.product_name || '—'}</div>
                    </td>
                    <td className="p-2 text-slate-500">{line.product_code || '—'}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className={CELL_INPUT_CLASS}
                        value={line.qty}
                        onChange={(e) => updateLine(index, { qty: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className={CELL_INPUT_CLASS}
                        value={line.batch_no}
                        onChange={(e) => updateLine(index, { batch_no: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <select
                        className={CELL_SELECT_CLASS}
                        value={line.booking_method}
                        onChange={(e) => updateLine(index, { booking_method: e.target.value })}
                      >
                        {BOOKING_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        className={CELL_INPUT_CLASS}
                        placeholder="Serial / plate"
                        value={line.number}
                        onChange={(e) => updateLine(index, { number: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={CELL_INPUT_CLASS}
                        value={line.net_unit_price}
                        onChange={(e) => updateLine(index, { net_unit_price: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        disabled={flat}
                        className={cn(CELL_INPUT_CLASS, flat && 'bg-slate-100 text-slate-400')}
                        title={flat
                          ? `${bookingMethodLabel('flat')} — duration is not applied`
                          : 'Duration in hours'}
                        value={line.duration_hours}
                        onChange={(e) => updateLine(index, { duration_hours: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={CELL_INPUT_CLASS}
                        value={line.discount}
                        onChange={(e) => updateLine(index, { discount: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={CELL_INPUT_CLASS}
                        value={line.tax}
                        onChange={(e) => updateLine(index, { tax: e.target.value })}
                      />
                    </td>
                    <td className="whitespace-nowrap p-2 text-right font-medium">
                      {money(bookingLineSubtotal(line))}
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
                );
              })}
            </tbody>
            {form.items.length > 0 && (
              <tfoot className="border-t bg-slate-50 font-medium text-slate-700">
                <tr>
                  <td className="p-2" colSpan={2}>{form.items.length} line(s)</td>
                  <td className="p-2">{lineTotals.qty}</td>
                  <td className="p-2" colSpan={5} />
                  <td className="p-2">{money(lineTotals.discount)}</td>
                  <td className="p-2">{money(lineTotals.tax)}</td>
                  <td className="whitespace-nowrap p-2 text-right">{money(lineTotals.subtotal)}</td>
                  <td className="p-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Order Totals">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-4 sm:grid-cols-3">
            <div>
              <Label>Order Tax</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={form.order_tax}
                onChange={(e) => patch({ order_tax: e.target.value })}
              />
            </div>
            <div>
              <Label>Order Discount</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={form.order_discount}
                onChange={(e) => patch({ order_discount: e.target.value })}
              />
            </div>
            <div>
              <Label>Shipping Cost</Label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={form.shipping}
                onChange={(e) => patch({ shipping: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Items</span>
              <span className="font-medium">{lineTotals.qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Lines Subtotal</span>
              <span className="font-medium">{money(lineTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Order Tax</span>
              <span>{money(form.order_tax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Order Discount</span>
              <span>- {money(form.order_discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Shipping</span>
              <span>{money(form.shipping)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold text-[#003D82]">
              <span>Grand Total</span>
              <span>{money(grandTotal)}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Notes & Contract">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Contract Type</Label>
            <select
              className={SELECT_CLASS}
              value={form.contract_type}
              onChange={(e) => patch({ contract_type: e.target.value })}
            >
              {CONTRACT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Booking Status</Label>
            <select
              className={SELECT_CLASS}
              value={form.booking_status}
              onChange={(e) => patch({ booking_status: e.target.value })}
            >
              {BOOKING_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Visible to the customer on the booking document"
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </div>
          <div>
            <Label>Staff Note</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Internal only — not shared with the customer"
              value={form.staff_note}
              onChange={(e) => patch({ staff_note: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="text-sm text-slate-600">
          Grand Total <span className="ml-1 font-bold text-[#003D82]">{money(grandTotal)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
            {saving
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Plus className="mr-2 h-4 w-4" />}
            {isEdit ? 'Update Booking' : 'Create Booking'}
          </Button>
        </div>
      </div>

      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                className="mt-1"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                className="mt-1"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomerDialog(false)}
              disabled={creatingCustomer}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#003D82] hover:bg-[#002855]"
              onClick={saveCustomer}
              disabled={creatingCustomer}
            >
              {creatingCustomer
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <UserPlus className="mr-2 h-4 w-4" />}
              Save Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
