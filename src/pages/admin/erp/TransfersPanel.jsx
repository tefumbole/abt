import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  completeTransfer, createTransfer, deleteTransfer, listProducts, listTransfers, listWarehouses,
} from '@/services/erpService';
import ErpShell from './ErpShell';

const emptyLine = () => ({ product_id: '', qty: 1 });

export default function TransfersPanel() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    note: '',
    status: 'completed',
    items: [emptyLine()],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [t, w, p] = await Promise.all([listTransfers(), listWarehouses(), listProducts()]);
      setRows(t);
      setWarehouses(w);
      setProducts(p);
      setForm((f) => {
        if (f.from_warehouse_id || !w[0]) return f;
        return {
          ...f,
          from_warehouse_id: w[0].id,
          to_warehouse_id: w[1]?.id || w[0].id,
        };
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setItem = (idx, patch) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const items = form.items
      .filter((i) => i.product_id)
      .map((i) => ({ product_id: i.product_id, qty: Number(i.qty) }));
    if (!items.length) {
      toast.error('Add at least one product line');
      return;
    }
    if (form.from_warehouse_id === form.to_warehouse_id) {
      toast.error('From and To warehouses must differ');
      return;
    }
    setSaving(true);
    try {
      await createTransfer({
        from_warehouse_id: form.from_warehouse_id,
        to_warehouse_id: form.to_warehouse_id,
        note: form.note || null,
        status: form.status,
        items,
      });
      toast.success(form.status === 'pending' ? 'Transfer saved as pending' : 'Transfer completed');
      setForm((f) => ({ ...f, note: '', items: [emptyLine()] }));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this transfer and reverse stock if completed?')) return;
    try {
      await deleteTransfer(id);
      toast.success('Transfer deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onComplete = async (id) => {
    try {
      await completeTransfer(id);
      toast.success('Transfer completed — stock moved');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Stock transfers">
      <form className="rounded-xl border bg-white p-4 space-y-3 mb-4" onSubmit={submit}>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>From warehouse</Label>
            <select
              className="w-full border rounded-md h-10 px-2"
              value={form.from_warehouse_id}
              onChange={(e) => setForm({ ...form, from_warehouse_id: e.target.value })}
              required
            >
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <Label>To warehouse</Label>
            <select
              className="w-full border rounded-md h-10 px-2"
              value={form.to_warehouse_id}
              onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })}
              required
            >
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Lines</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setForm({ ...form, items: [...form.items, emptyLine()] })}
            >
              <Plus className="h-4 w-4 mr-1" /> Add line
            </Button>
          </div>
          {form.items.map((line, idx) => (
            <div key={idx} className="grid md:grid-cols-[1fr_120px_40px] gap-2 items-end">
              <div>
                <Label className="text-xs text-slate-500">Product</Label>
                <select
                  className="w-full border rounded-md h-10 px-2"
                  value={line.product_id}
                  onChange={(e) => setItem(idx, { product_id: e.target.value })}
                  required={idx === 0}
                >
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Qty</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={line.qty}
                  onChange={(e) => setItem(idx, { qty: e.target.value })}
                  required
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={form.items.length <= 1}
                onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Status</Label>
            <select
              className="w-full border rounded-md h-10 px-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="completed">Complete now (move stock)</option>
              <option value="pending">Pending (move stock later)</option>
            </select>
          </div>
          <div>
            <Label>Note</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create transfer
        </Button>
      </form>

      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Ref</th>
                <th className="p-3">From</th>
                <th className="p-3">To</th>
                <th className="p-3">Items</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.from_warehouse_name || '—'}</td>
                  <td className="p-3">{r.to_warehouse_name || '—'}</td>
                  <td className="p-3">{r.items_count ?? '—'}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3 flex gap-2">
                    {r.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => onComplete(r.id)}>Complete</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No transfers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </ErpShell>
  );
}
