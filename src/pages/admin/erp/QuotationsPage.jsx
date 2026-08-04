import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  convertQuotation, createQuotation, listCustomers, listProducts, listQuotations,
  listWarehouses, sendQuotationWhatsApp,
} from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

export default function QuotationsPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    warehouse_id: '', customer_id: '', product_id: '', qty: 1, net_unit_price: 0, cc_phones: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const q = status ? `?status=${status}` : '';
      const [r, w, c, p] = await Promise.all([listQuotations(q), listWarehouses(), listCustomers(), listProducts()]);
      setRows(r);
      setWarehouses(w);
      setCustomers(c);
      setProducts(p);
      const def = w.find((x) => x.is_default) || w[0];
      if (def && !form.warehouse_id) setForm((f) => ({ ...f, warehouse_id: def.id }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  return (
    <ErpShell title="ERP Commerce" subtitle="Quotations + WhatsApp approval" tabs={COMMERCE_TABS}>
      <div className="flex flex-wrap gap-2 mb-4">
        {['', 'draft', 'awaiting_approval', 'approved', 'rejected'].map((s) => (
          <Button key={s || 'all'} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
            {s || 'All'}
          </Button>
        ))}
      </div>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createQuotation({
            warehouse_id: form.warehouse_id,
            customer_id: form.customer_id || null,
            status: 'draft',
            cc_phones: form.cc_phones || null,
            items: [{ product_id: form.product_id, qty: Number(form.qty), net_unit_price: Number(form.net_unit_price) }],
          });
          toast.success('Quotation created');
          load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div>
          <Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} required>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Customer</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">—</option>
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
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label>Qty</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
        <div><Label>Price</Label><Input type="number" step="0.01" value={form.net_unit_price} onChange={(e) => setForm({ ...form, net_unit_price: e.target.value })} /></div>
        <div><Label>CC phones</Label><Input value={form.cc_phones} onChange={(e) => setForm({ ...form, cc_phones: e.target.value })} placeholder="optional" /></div>
        <div className="md:col-span-3"><Button type="submit">Add quotation</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Customer</th><th className="p-3">Status</th>
              <th className="p-3">Total</th><th className="p-3">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.customer_name || '—'}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">{Number(r.grand_total).toFixed(2)}</td>
                  <td className="p-3 space-x-2">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const res = await sendQuotationWhatsApp(r.id);
                        toast.success(res.link ? `Sent: ${res.link}` : 'WhatsApp sent');
                        load();
                      } catch (e) { toast.error(e.message); }
                    }}>WA send</Button>
                    <Button size="sm" onClick={async () => {
                      try {
                        await convertQuotation(r.id);
                        toast.success('Converted to sale');
                        load();
                      } catch (e) { toast.error(e.message); }
                    }}>Convert</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ErpShell>
  );
}
