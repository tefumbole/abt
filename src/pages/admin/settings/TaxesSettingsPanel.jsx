import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createTax,
  deleteTax,
  listTaxes,
  setDefaultTax,
  updateTax,
} from '@/services/erpService';

const EMPTY = { name: '', rate: '0', is_active: true };

export default function TaxesSettingsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listTaxes());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const rate = Number(form.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error('Enter a valid rate');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), rate, is_active: !!form.is_active };
      if (editId) await updateTax(editId, payload);
      else await createTax(payload);
      toast.success(editId ? 'Tax updated' : 'Tax created');
      setForm(EMPTY);
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id) => {
    try {
      await setDefaultTax(id);
      toast.success('Default tax rate updated');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (row) => {
    if (row.is_default) {
      toast.error('Set another tax as default before deleting this one');
      return;
    }
    if (!confirm('Delete this tax rate?')) return;
    try {
      await deleteTax(row.id);
      toast.success('Deleted');
      if (editId === row.id) {
        setEditId(null);
        setForm(EMPTY);
      }
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Tax Rates</h2>
        <p className="text-sm text-slate-600">
          Create the tax rates used on products and invoice lines. The default rate is what new sales and
          quotations pre-fill.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Name *</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. VAT 19.25%"
          />
        </div>
        <div>
          <Label>Rate (%) *</Label>
          <Input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update tax' : 'Add tax'}
          </Button>
          {editId && (
            <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(EMPTY); }}>
              Cancel
            </Button>
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
                <th className="p-3">Rate (%)</th>
                <th className="p-3">Default</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{Number(r.rate) || 0}%</td>
                  <td className="p-3">
                    {r.is_default ? (
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#003D82]">
                        Default
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        r.is_active !== false
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {r.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    {!r.is_default && r.is_active !== false ? (
                      <Button size="sm" variant="outline" onClick={() => makeDefault(r.id)}>
                        Set default
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(r.id);
                        setForm({
                          name: r.name || '',
                          rate: String(r.rate ?? 0),
                          is_active: r.is_active !== false,
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No taxes yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
