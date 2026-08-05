import React, { useEffect, useMemo, useState } from 'react';
import {
  Fullscreen, Loader2, Lock, Minus, Package, Plus, Search, Settings2, Trash2, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  closeRegister, createCustomer, createPosSale, getPosSettings,
  listBillers, listBrands, listCategories, listCustomers, listProducts,
  listRegisters, listWarehouses, openRegister,
} from '@/services/erpService';

/** Beyond Tech paid_by_id → storage name */
const PAY_METHODS = [
  { id: 3, key: 'je', label: 'JE', className: 'bg-[#0b3f90] hover:bg-[#072f6b] text-white' },
  { id: 1, key: 'cash', label: 'Cash', className: 'bg-teal-600 hover:bg-teal-700 text-white' },
  { id: 10, key: 'credit', label: 'Credit', className: 'bg-purple-600 hover:bg-purple-700 text-white' },
  { id: 11, key: 'group_credit', label: 'Group Credit', className: 'bg-green-600 hover:bg-green-700 text-white' },
  { id: 8, key: 'orange_money', label: 'Orange Money', className: 'bg-[#da7828] hover:bg-[#c06820] text-white' },
  { id: 8, key: 'mtn_momo', label: 'MTN momo', className: 'bg-[#fd7272] hover:bg-[#e85a5a] text-white' },
  { id: 6, key: 'deposit', label: 'Deposit', className: 'bg-[#7b2d3b] hover:bg-[#642430] text-white' },
];

function money(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [billers, setBillers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [billerId, setBillerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [reference, setReference] = useState('');
  const [register, setRegister] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('featured'); // featured | category | brand
  const [filterId, setFilterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payModal, setPayModal] = useState(null); // { method }
  const [payingAmount, setPayingAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '', email: '' });
  const [cashInHand, setCashInHand] = useState('0');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const load = async (wid) => {
    setLoading(true);
    try {
      const [w, bl, cats, brs, settings] = await Promise.all([
        listWarehouses(),
        listBillers(),
        listCategories().catch(() => []),
        listBrands().catch(() => []),
        getPosSettings().catch(() => null),
      ]);
      setWarehouses(w || []);
      setBillers(bl || []);
      setCategories(cats || []);
      setBrands(brs || []);

      const defWh = wid
        || warehouseId
        || settings?.warehouse_id
        || w.find((x) => x.is_default)?.id
        || w[0]?.id
        || '';
      setWarehouseId(defWh);
      if (!billerId) {
        setBillerId(settings?.biller_id || bl.find((b) => b.is_default)?.id || bl[0]?.id || '');
      }

      if (!defWh) return;
      const [p, c, regs] = await Promise.all([
        listProducts(defWh),
        // ERP customers only (erp_customers) — never system users
        listCustomers('?active=1'),
        listRegisters(`?warehouse_id=${defWh}&status=open`),
      ]);
      const customerRows = (c || []).filter((row) => row?.id && row?.name);
      setProducts(p || []);
      setCustomers(customerRows);
      setRegister((regs || [])[0] || null);
      if (!(regs || []).length) setShowRegisterModal(true);
      // Prefer POS default customer, else Walk-in, else first customer
      if (!customerId) {
        const walkIn = customerRows.find((x) => /walk[- ]?in/i.test(x.name || ''));
        const preferred = customerRows.find((x) => x.id === settings?.customer_id)
          || walkIn
          || customerRows[0];
        if (preferred?.id) setCustomerId(preferred.id);
      } else if (!customerRows.some((x) => x.id === customerId)) {
        const walkIn = customerRows.find((x) => /walk[- ]?in/i.test(x.name || ''));
        if (walkIn?.id) setCustomerId(walkIn.id);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (filterMode === 'category' && filterId) {
      list = list.filter((p) => String(p.category_id) === String(filterId));
    } else if (filterMode === 'brand' && filterId) {
      list = list.filter((p) => String(p.brand_id) === String(filterId));
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name?.toLowerCase().includes(q)
        || String(p.code || '').toLowerCase().includes(q)
        || String(p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, search, filterMode, filterId]);

  const itemsCount = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price - (i.discount || 0), 0);
  const grandTotal = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0) + Number(shipping || 0));

  const addToCart = (p) => {
    setCart((prev) => {
      const ex = prev.find((x) => x.product_id === p.id);
      if (ex) return prev.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...prev, {
        product_id: p.id,
        name: p.name,
        code: p.code || '',
        qty: 1,
        price: Number(p.price) || 0,
        discount: 0,
        batch: '',
      }];
    });
  };

  const updateCartQty = (productId, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setCart((c) => c.map((x) => (x.product_id === productId ? { ...x, qty: q } : x)));
  };

  const updateCartPrice = (productId, price) => {
    setCart((c) => c.map((x) => (x.product_id === productId ? { ...x, price: Number(price) || 0 } : x)));
  };

  const cancelSale = () => {
    if (!cart.length && !reference) return;
    if (!window.confirm('Cancel this sale and clear the cart?')) return;
    setCart([]);
    setReference('');
    setDiscount(0);
    setTax(0);
    setShipping(0);
    toast.message('Sale cancelled');
  };

  const openPay = (method) => {
    if (!register) {
      toast.error('Open a cash register first');
      setShowRegisterModal(true);
      return;
    }
    if (!cart.length) return toast.error('Cart is empty');
    if (!warehouseId) return toast.error('Select a warehouse');
    if (!customerId) {
      return toast.error('Select a customer (add one with + if the list is empty)');
    }
    setPayModal(method);
    setPayingAmount(String(grandTotal.toFixed(2)));
    setPaidAmount(String(grandTotal.toFixed(2)));
  };

  const confirmPay = async () => {
    if (!payModal) return;
    const paid = Number(paidAmount);
    if (Number.isNaN(paid) || paid < 0) return toast.error('Invalid paid amount');
    setPaying(true);
    try {
      const payingMethod = payModal.key === 'orange_money' || payModal.key === 'mtn_momo'
        ? 'momo_orange'
        : payModal.key;
      const res = await createPosSale({
        warehouse_id: warehouseId,
        customer_id: customerId || null,
        biller_id: billerId || null,
        reference: reference || undefined,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        shipping: Number(shipping) || 0,
        paid_amount: paid,
        paying_amount: Number(payingAmount) || paid,
        paid_by_id: payModal.id,
        paying_method: payingMethod,
        cash_register_id: register?.id || null,
        items: cart.map((i) => ({
          product_id: i.product_id,
          qty: i.qty,
          net_unit_price: i.price,
          discount: i.discount || 0,
          tax: 0,
        })),
      });
      toast.success(`POS sale ${res.data?.reference || res.reference || ''} complete (${payModal.label})`);
      setCart([]);
      setReference('');
      setDiscount(0);
      setTax(0);
      setShipping(0);
      setPayModal(null);
      load(warehouseId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaying(false);
    }
  };

  const saveQuickCustomer = async (e) => {
    e.preventDefault();
    if (!quickCustomer.name.trim()) return toast.error('Name required');
    try {
      const created = await createCustomer({
        name: quickCustomer.name.trim(),
        phone: quickCustomer.phone || null,
        email: quickCustomer.email || null,
        is_active: true,
      });
      const row = created?.data || created;
      toast.success('Customer added');
      setShowQuickCustomer(false);
      setQuickCustomer({ name: '', phone: '', email: '' });
      const list = await listCustomers('?active=1');
      setCustomers((list || []).filter((x) => x?.id && x?.name));
      if (row?.id) setCustomerId(row.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="-m-4 md:-m-6 min-h-[calc(100vh-4rem)] bg-[#eef2f8] flex flex-col">
      {/* POS chrome */}
      <div className="bg-[#003D82] text-white px-3 py-2 flex items-center justify-between gap-2">
        <div className="font-semibold tracking-wide">Point of Sale</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={toggleFullscreen}>
            <Fullscreen className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" asChild>
            <Link to="/admin/general-settings?tab=pos"><Settings2 className="h-4 w-4" /></Link>
          </Button>
          {register ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-300 hover:bg-white/10"
              onClick={async () => {
                if (!confirm('Close cash register?')) return;
                try {
                  await closeRegister(register.id);
                  toast.success('Register closed');
                  load(warehouseId);
                } catch (e) { toast.error(e.message); }
              }}
            >
              <Lock className="h-4 w-4 mr-1" /> Close register
            </Button>
          ) : (
            <Button size="sm" className="bg-[#D4AF37] text-[#003D82] hover:bg-[#c4a030]" onClick={() => setShowRegisterModal(true)}>
              Open register
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-2 p-2 min-h-0">
        {/* LEFT: cart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[520px]">
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b">
            <Input
              placeholder="Type reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <select
              className="border rounded-md h-10 px-2 bg-white text-sm"
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); load(e.target.value); }}
            >
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select
              className="border rounded-md h-10 px-2 bg-white text-sm"
              value={billerId}
              onChange={(e) => setBillerId(e.target.value)}
            >
              <option value="">Select biller</option>
              {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="px-4 pt-4 pb-2 flex gap-2 items-center">
            <select
              className="border rounded-md h-11 px-2 bg-white text-sm flex-1"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.phone ? ` (${c.phone})` : ''}
                </option>
              ))}
            </select>
            <Button type="button" size="icon" className="bg-[#003D82] h-11 w-11" title="Add customer" onClick={() => setShowQuickCustomer(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {!customers.length && (
            <p className="px-4 pb-2 text-xs text-amber-700">
              No customers yet. Use + to add an ERP customer (system users are not customers).
            </p>
          )}

          <div className="px-4 py-4 border-y bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9 h-12 text-base bg-white"
                placeholder="Please type product code and select..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto px-2 py-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="p-3">Product</th>
                  <th className="p-3 w-20">Batch</th>
                  <th className="p-3 w-24">Price</th>
                  <th className="p-3 w-28">Quantity</th>
                  <th className="p-3 w-24">SubTotal</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.map((i) => (
                  <tr key={i.product_id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-slate-500">{i.code || '—'}</div>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8"
                        value={i.batch}
                        onChange={(e) => setCart((c) => c.map((x) => (x.product_id === i.product_id ? { ...x, batch: e.target.value } : x)))}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8"
                        type="number"
                        step="0.01"
                        value={i.price}
                        onChange={(e) => updateCartPrice(i.product_id, e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(i.product_id, i.qty - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          className="h-8 w-14 text-center"
                          type="number"
                          value={i.qty}
                          onChange={(e) => updateCartQty(i.product_id, e.target.value)}
                        />
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(i.product_id, i.qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2 font-medium">{money(i.qty * i.price - (i.discount || 0))}</td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((x) => x.product_id !== i.product_id))}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!cart.length && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">Cart is empty — pick products on the right</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t bg-[#003D82] text-white p-3 text-sm space-y-1">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Items: <strong>{itemsCount}</strong></span>
              <span>Total: <strong>{money(subtotal)}</strong></span>
              <span>Discount: <strong>{money(discount)}</strong></span>
              <span>Tax: <strong>{money(tax)}</strong></span>
              <span>Shipping: <strong>{money(shipping)}</strong></span>
            </div>
            <div className="text-lg font-bold">Grand Total: {money(grandTotal)}</div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Input className="bg-white/10 border-white/30 text-white h-8" type="number" placeholder="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              <Input className="bg-white/10 border-white/30 text-white h-8" type="number" placeholder="Tax" value={tax} onChange={(e) => setTax(e.target.value)} />
              <Input className="bg-white/10 border-white/30 text-white h-8" type="number" placeholder="Shipping" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </div>
          </div>

          <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t bg-slate-50">
            {PAY_METHODS.map((m) => (
              <button
                key={`${m.key}-${m.id}`}
                type="button"
                disabled={paying}
                onClick={() => openPay(m)}
                className={cn('rounded-xl py-3 px-2 text-sm font-bold shadow-sm transition disabled:opacity-50', m.className)}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={cancelSale}
              className="rounded-xl py-3 px-2 text-sm font-bold shadow-sm bg-red-600 hover:bg-red-700 text-white col-span-2 sm:col-span-4"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* RIGHT: products */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[520px]">
          <div className="bg-[#003D82] text-white px-2 py-1 flex flex-wrap gap-1.5 items-center justify-between min-h-0">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className={cn('h-7 px-2.5 text-xs', filterMode === 'category' ? 'bg-white text-[#003D82]' : 'bg-blue-500 hover:bg-blue-600 text-white')}
                onClick={() => { setFilterMode('category'); setFilterId(categories[0]?.id || ''); }}
              >
                Category
              </Button>
              <Button
                size="sm"
                className={cn('h-7 px-2.5 text-xs', filterMode === 'brand' ? 'bg-white text-[#003D82]' : 'bg-blue-500 hover:bg-blue-600 text-white')}
                onClick={() => { setFilterMode('brand'); setFilterId(brands[0]?.id || ''); }}
              >
                Brand
              </Button>
              <Button
                size="sm"
                className={cn('h-7 px-2.5 text-xs', filterMode === 'featured' ? 'bg-red-500 text-white' : 'bg-red-400 hover:bg-red-500 text-white')}
                onClick={() => { setFilterMode('featured'); setFilterId(''); }}
              >
                Featured
              </Button>
            </div>
            <span className="text-[10px] text-blue-100 leading-none">{register ? 'Register open' : 'No open register'}</span>
          </div>

          {(filterMode === 'category' || filterMode === 'brand') && (
            <div className="px-2 py-1.5 border-b">
              <select
                className="w-full border rounded-md h-8 px-2 text-sm"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              >
                <option value="">All {filterMode === 'category' ? 'categories' : 'brands'}</option>
                {(filterMode === 'category' ? categories : brands).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-auto p-3">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="rounded-xl border border-slate-200 bg-[#f5f7fb] hover:border-[#D4AF37] hover:shadow p-2 text-left transition"
                  >
                    <div className="h-20 flex items-center justify-center bg-white rounded-lg border mb-2 overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Package className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 line-clamp-2 min-h-[2.5em]">{p.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.code || p.id.slice(0, 8)}</div>
                    <div className="text-sm font-bold text-[#003D82] mt-1">{money(p.price)}</div>
                    <div className="text-[11px] text-slate-500">Stock {p.stock_qty ?? '—'}</div>
                  </button>
                ))}
                {!filteredProducts.length && (
                  <div className="col-span-full p-10 text-center text-slate-400">No products found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#003D82]">Finalize — {payModal.label}</h3>
              <button type="button" onClick={() => setPayModal(null)}><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-600">Grand total: <strong>{money(grandTotal)}</strong></p>
            <div className="space-y-2">
              <Label>Paying amount</Label>
              <Input type="number" step="0.01" value={payingAmount} onChange={(e) => setPayingAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Paid amount</Label>
              <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
            <div className="text-sm text-slate-600">
              Change: <strong>{money(Math.max(0, Number(payingAmount || 0) - Number(paidAmount || 0)))}</strong>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPayModal(null)}>Close</Button>
              <Button className="bg-[#003D82]" disabled={paying} onClick={confirmPay}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Open register modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-bold text-[#003D82]">Open Cash Register</h3>
            <p className="text-sm text-slate-600">A register must be open for this warehouse before POS sales.</p>
            <div className="space-y-2">
              <Label>Cash in hand</Label>
              <Input type="number" value={cashInHand} onChange={(e) => setCashInHand(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRegisterModal(false)}>Later</Button>
              <Button
                className="bg-[#003D82]"
                onClick={async () => {
                  try {
                    await openRegister({ warehouse_id: warehouseId, cash_in_hand: Number(cashInHand) || 0 });
                    toast.success('Register opened');
                    setShowRegisterModal(false);
                    load(warehouseId);
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Open register
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick customer */}
      {showQuickCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveQuickCustomer} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#003D82]">Add Customer</h3>
              <button type="button" onClick={() => setShowQuickCustomer(false)}><X className="h-5 w-5" /></button>
            </div>
            <div><Label>Name *</Label><Input required value={quickCustomer.name} onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={quickCustomer.phone} onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={quickCustomer.email} onChange={(e) => setQuickCustomer({ ...quickCustomer, email: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]">Save</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
