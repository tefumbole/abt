import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  closeRegister, createPosSale, listCustomers, listProducts, listRegisters, listWarehouses, openRegister,
} from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

export default function PosPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [register, setRegister] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = async (wid) => {
    setLoading(true);
    try {
      const w = await listWarehouses();
      setWarehouses(w);
      const def = wid || warehouseId || w.find((x) => x.is_default)?.id || w[0]?.id;
      setWarehouseId(def || '');
      if (!def) return;
      const [p, c, regs] = await Promise.all([
        listProducts(def),
        listCustomers(),
        listRegisters(`?warehouse_id=${def}&status=open`),
      ]);
      setProducts(p);
      setCustomers(c);
      setRegister(regs[0] || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q));
  }, [products, search]);

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  const addToCart = (p) => {
    setCart((prev) => {
      const ex = prev.find((x) => x.product_id === p.id);
      if (ex) return prev.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...prev, { product_id: p.id, name: p.name, qty: 1, price: Number(p.price) }];
    });
  };

  const checkout = async () => {
    if (!register) return toast.error('Open a cash register first');
    if (!cart.length) return toast.error('Cart is empty');
    setPaying(true);
    try {
      const res = await createPosSale({
        warehouse_id: warehouseId,
        customer_id: customerId || null,
        paid_amount: total,
        paying_method: 'cash',
        items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty, net_unit_price: i.price })),
      });
      toast.success(`POS sale ${res.data?.reference || res.reference || ''} complete`);
      setCart([]);
      load(warehouseId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Point of Sale" tabs={COMMERCE_TABS}>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select className="border rounded-md h-10 px-2" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); load(e.target.value); }}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="border rounded-md h-10 px-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!register ? (
          <Button onClick={async () => {
            try {
              await openRegister({ warehouse_id: warehouseId, cash_in_hand: 0 });
              toast.success('Register opened');
              load(warehouseId);
            } catch (e) { toast.error(e.message); }
          }}>Open register</Button>
        ) : (
          <Button variant="outline" onClick={async () => {
            try {
              await closeRegister(register.id);
              toast.success('Register closed');
              load(warehouseId);
            } catch (e) { toast.error(e.message); }
          }}>Close register</Button>
        )}
        <span className="text-sm text-slate-600">{register ? `Register open` : 'No open register'}</span>
      </div>

      {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map((p) => (
                <button key={p.id} type="button" onClick={() => addToCart(p)} className="text-left border rounded-xl p-3 bg-white hover:border-amber-400">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-slate-500">Stock {p.stock_qty}</div>
                  <div className="font-semibold mt-1">{Number(p.price).toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h3 className="font-semibold">Cart</h3>
            {cart.map((i) => (
              <div key={i.product_id} className="flex items-center gap-2 text-sm border-b pb-2">
                <div className="flex-1">
                  <div>{i.name}</div>
                  <div className="text-slate-500">{(i.qty * i.price).toFixed(2)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.map((x) => x.product_id === i.product_id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}><Minus className="h-3 w-3" /></Button>
                <span>{i.qty}</span>
                <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.map((x) => x.product_id === i.product_id ? { ...x, qty: x.qty + 1 } : x))}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((x) => x.product_id !== i.product_id))}><Trash2 className="h-3 w-3 text-red-600" /></Button>
              </div>
            ))}
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{total.toFixed(2)}</span></div>
            <Button className="w-full" disabled={paying || !cart.length} onClick={checkout}>
              {paying ? <Loader2 className="animate-spin h-4 w-4" /> : 'Pay cash'}
            </Button>
          </div>
        </div>
      )}
    </ErpShell>
  );
}
