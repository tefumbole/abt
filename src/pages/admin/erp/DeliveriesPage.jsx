import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDelivery, listDeliveries, listSales, sendDeliverySignLink } from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

export default function DeliveriesPage() {
  const [rows, setRows] = useState([]);
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ sale_id: '', address: '' });

  const load = async () => {
    setLoading(true);
    try {
      const q = filter ? `?signature_status=${filter}` : '';
      const [d, s] = await Promise.all([listDeliveries(q), listSales()]);
      setRows(d);
      setSales(s);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <ErpShell title="ERP Commerce" subtitle="Deliveries & e-signature" tabs={COMMERCE_TABS}>
      <div className="flex gap-2 mb-4">
        {['', 'pending', 'signed'].map((f) => (
          <Button key={f || 'all'} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f || 'All'}
          </Button>
        ))}
      </div>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createDelivery(form);
          toast.success('Delivery created');
          load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div>
          <Label>Sale</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.sale_id} onChange={(e) => setForm({ ...form, sale_id: e.target.value })} required>
            <option value="">Select…</option>
            {sales.map((s) => <option key={s.id} value={s.id}>{s.reference} — {s.customer_name || 'Walk-in'}</option>)}
          </select>
        </div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="md:col-span-2"><Button type="submit">Create delivery</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Sale</th><th className="p-3">Customer</th>
              <th className="p-3">Status</th><th className="p-3">Signature</th><th className="p-3">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.sale_reference}</td>
                  <td className="p-3">{r.customer_name || '—'}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">{r.signature_status}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const res = await sendDeliverySignLink(r.id);
                        toast.success(res.link || 'Sign link sent');
                      } catch (e) { toast.error(e.message); }
                    }}>WA sign link</Button>
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
