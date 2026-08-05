import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createWarehouse, deleteWarehouse, listWarehouses, updateWarehouse } from '@/services/erpService';
import ErpShell from './ErpShell';

const EMPTY = { name: '', phone: '', email: '', address: '', is_active: true, is_default: false };

export default function WarehousesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listWarehouses());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await updateWarehouse(editId, form);
      else await createWarehouse(form);
      toast.success(editId ? 'Warehouse updated' : 'Warehouse created');
      setForm(EMPTY);
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Warehouses">
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Default warehouse
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update' : 'Add warehouse'}
          </Button>
          {editId && (
            <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</Button>
          )}
        </div>
      </form>

      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Address</th>
                <th className="p-3">Flags</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{r.phone || '—'}</td>
                  <td className="p-3">{r.address || '—'}</td>
                  <td className="p-3">
                    {r.is_default ? 'Default · ' : ''}{r.is_active ? 'Active' : 'Inactive'}
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditId(r.id); setForm({ name: r.name, phone: r.phone || '', email: r.email || '', address: r.address || '', is_active: r.is_active, is_default: r.is_default }); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete warehouse?')) return;
                      try { await deleteWarehouse(r.id); toast.success('Deleted'); load(); }
                      catch (e) { toast.error(e.message); }
                    }}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
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
