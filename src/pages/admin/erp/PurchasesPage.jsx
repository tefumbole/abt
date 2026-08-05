import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPurchase, listProducts, listPurchases, listSuppliers, listWarehouses } from '@/services/erpService';
import ErpShell from './ErpShell';

export default function PurchasesPage() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    warehouse_id: '', supplier_id: '', paid_amount: 0, product_id: '', qty: 1, net_unit_cost: 0, note: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [p, w, s, pr] = await Promise.all([listPurchases(), listWarehouses(), listSuppliers(), listProducts()]);
      setRows(p);
      setWarehouses(w);
      setSuppliers(s);
      setProducts(pr);
      const def = w.find((x) => x.is_default) || w[0];
      if (def && !form.warehouse_id) setForm((f) => ({ ...f, warehouse_id: def.id }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createPurchase({
        warehouse_id: form.warehouse_id,
        supplier_id: form.supplier_id || null,
        paid_amount: Number(form.paid_amount),
        note: form.note,
        items: [{ product_id: form.product_id, qty: Number(form.qty), net_unit_cost: Number(form.net_unit_cost) }],
      });
      toast.success('Purchase recorded — stock updated');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Purchases">
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4">
        <div>
          <Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} required>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Supplier</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Product</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.product_id} onChange={(e) => {
            const p = products.find((x) => x.id === e.target.value);
            setForm({ ...form, product_id: e.target.value, net_unit_cost: p?.cost || 0 });
          }} required>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label>Qty</Label><Input type="number" step="0.001" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} required /></div>
        <div><Label>Unit cost</Label><Input type="number" step="0.01" value={form.net_unit_cost} onChange={(e) => setForm({ ...form, net_unit_cost: e.target.value })} required /></div>
        <div><Label>Paid amount</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Receive purchase</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Date</th><th className="p-3">Warehouse</th><th className="p-3">Supplier</th>
              <th className="p-3">Total</th><th className="p-3">Payment</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.purchase_date}</td>
                  <td className="p-3">{r.warehouse_name}</td>
                  <td className="p-3">{r.supplier_name || '—'}</td>
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
