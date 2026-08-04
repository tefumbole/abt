import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createBiller, createCustomer, createSupplier,
  deleteBiller, deleteCustomer, deleteSupplier,
  listBillers, listCustomers, listSuppliers, listWarehouses,
} from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

export default function PeoplePage() {
  const [tab, setTab] = useState('customers');
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company_name: '', address: '', warehouse_id: '', is_default: false });

  const load = async () => {
    setLoading(true);
    try {
      const fn = tab === 'customers' ? listCustomers : tab === 'suppliers' ? listSuppliers : listBillers;
      setRows(await fn());
      if (tab === 'billers') setWarehouses(await listWarehouses());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (tab === 'customers') await createCustomer(form);
      else if (tab === 'suppliers') await createSupplier(form);
      else await createBiller(form);
      toast.success('Created');
      setForm({ name: '', email: '', phone: '', company_name: '', address: '', warehouse_id: '', is_default: false });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete?')) return;
    try {
      if (tab === 'customers') await deleteCustomer(id);
      else if (tab === 'suppliers') await deleteSupplier(id);
      else await deleteBiller(id);
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Customers, suppliers & billers" tabs={COMMERCE_TABS}>
      <div className="flex gap-2 mb-4">
        {['customers', 'suppliers', 'billers'].map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)} className="capitalize">{t}</Button>
        ))}
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 mb-4">
        <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        {tab === 'billers' && (
          <>
            <div>
              <Label>Warehouse</Label>
              <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                <option value="">—</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              Default biller
            </label>
          </>
        )}
        <div className="md:col-span-2"><Button type="submit"><Plus className="h-4 w-4" /> Add</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Email</th><th className="p-3">Company</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.phone || '—'}</td>
                  <td className="p-3">{r.email || '—'}</td>
                  <td className="p-3">{r.company_name || '—'}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
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
