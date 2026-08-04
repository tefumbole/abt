import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSale, listCustomers, listProducts, listSales, listWarehouses } from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

export default function SalesPage() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    warehouse_id: '', customer_id: '', paid_amount: 0, product_id: '', qty: 1, net_unit_price: 0,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [s, w, c] = await Promise.all([listSales('?is_pos=0'), listWarehouses(), listCustomers()]);
      setRows(s);
      setWarehouses(w);
      setCustomers(c);
      const def = w.find((x) => x.is_default) || w[0];
      const wid = form.warehouse_id || def?.id || '';
      if (!form.warehouse_id && wid) setForm((f) => ({ ...f, warehouse_id: wid }));
      setProducts(await listProducts(wid || undefined));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.warehouse_id) return;
    listProducts(form.warehouse_id).then(setProducts).catch(() => {});
  }, [form.warehouse_id]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createSale({
        warehouse_id: form.warehouse_id,
        customer_id: form.customer_id || null,
        paid_amount: Number(form.paid_amount),
        items: [{ product_id: form.product_id, qty: Number(form.qty), net_unit_price: Number(form.net_unit_price) }],
      });
      toast.success('Sale created — stock decremented');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Sales" tabs={COMMERCE_TABS}>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4">
        <div>
          <Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} required>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Customer</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Walk-in</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Product</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.product_id} onChange={(e) => {
            const p = products.find((x) => x.id === e.target.value);
            setForm({ ...form, product_id: e.target.value, net_unit_price: p?.price || 0 });
          }} required>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock {p.stock_qty})</option>)}
          </select>
        </div>
        <div><Label>Qty</Label><Input type="number" step="0.001" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} required /></div>
        <div><Label>Unit price</Label><Input type="number" step="0.01" value={form.net_unit_price} onChange={(e) => setForm({ ...form, net_unit_price: e.target.value })} required /></div>
        <div><Label>Paid</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Create sale</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Customer</th><th className="p-3">Warehouse</th>
              <th className="p-3">Total</th><th className="p-3">Payment</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.customer_name || '—'}</td>
                  <td className="p-3">{r.warehouse_name}</td>
                  <td className="p-3">{Number(r.grand_total).toFixed(2)}</td>
                  <td className="p-3">{r.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ErpShell>
  );
}
