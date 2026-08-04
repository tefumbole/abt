import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createBiller,
  createBrand,
  createUnit,
  createWarehouse,
  deleteBiller,
  deleteWarehouse,
  getPosSettings,
  listBillers,
  listBrands,
  listCustomers,
  listUnits,
  listWarehouses,
  savePosSettings,
  updateWarehouse,
} from '@/services/erpService';
import { getSystemSettings, updateSystemSettings } from '@/services/settingsService';

const EMPTY_WH = { name: '', phone: '', email: '', address: '', is_active: true, is_default: false };

export function WarehousesSettingsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_WH);
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
      setForm(EMPTY_WH);
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Warehouses</h2>
        <p className="text-sm text-slate-600">Manage stock locations and defaults used by POS and sales.</p>
      </div>
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
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update' : 'Add warehouse'}
          </Button>
          {editId && (
            <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(EMPTY_WH); }}>Cancel</Button>
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
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditId(r.id);
                      setForm({
                        name: r.name,
                        phone: r.phone || '',
                        email: r.email || '',
                        address: r.address || '',
                        is_active: !!r.is_active,
                        is_default: !!r.is_default,
                      });
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete warehouse?')) return;
                      try {
                        await deleteWarehouse(r.id);
                        toast.success('Deleted');
                        load();
                      } catch (e) {
                        toast.error(e.message);
                      }
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
    </div>
  );
}

export function BillersSettingsPanel() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company_name: '', address: '', warehouse_id: '', is_default: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [billers, wh] = await Promise.all([listBillers(), listWarehouses()]);
      setRows(billers || []);
      setWarehouses(wh || []);
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
      await createBiller(form);
      toast.success('Biller created');
      setForm({ name: '', email: '', phone: '', company_name: '', address: '', warehouse_id: '', is_default: false });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Billers</h2>
        <p className="text-sm text-slate-600">Default billers used on invoices, quotations, and POS.</p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3">
        <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
        <div className="md:col-span-2"><Button type="submit" className="bg-[#003D82]"><Plus className="h-4 w-4" /> Add biller</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Email</th>
                <th className="p-3">Company</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name}{r.is_default ? ' (Default)' : ''}</td>
                  <td className="p-3">{r.phone || '—'}</td>
                  <td className="p-3">{r.email || '—'}</td>
                  <td className="p-3">{r.company_name || '—'}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete biller?')) return;
                      try {
                        await deleteBiller(r.id);
                        toast.success('Deleted');
                        load();
                      } catch (e) {
                        toast.error(e.message);
                      }
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
    </div>
  );
}

function SimpleNameMaster({ title, subtitle, listFn, createFn }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listFn());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createFn({ name: name.trim() });
      toast.success(`${title} added`);
      setName('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">{title}</h2>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <Button type="submit" disabled={saving} className="bg-[#003D82]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr><th className="p-3">Name</th></tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name}</td>
                </tr>
              ))}
              {!rows?.length && (
                <tr><td className="p-6 text-slate-500 text-center">No {title.toLowerCase()} yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function BrandsSettingsPanel() {
  return (
    <SimpleNameMaster
      title="Brands"
      subtitle="Product brands available when creating catalog items."
      listFn={listBrands}
      createFn={createBrand}
    />
  );
}

export function UnitsSettingsPanel() {
  return (
    <SimpleNameMaster
      title="Units"
      subtitle="Units of measure (pcs, kg, box, etc.) used on products and invoices."
      listFn={listUnits}
      createFn={createUnit}
    />
  );
}

export function CurrencySettingsPanel() {
  const [currency, setCurrency] = useState('XAF');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sys = await getSystemSettings();
        setCurrency(sys?.currency || 'XAF');
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateSystemSettings({ currency: currency.trim().toUpperCase() });
      toast.success('Currency saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#003D82]">Currency</CardTitle>
        <CardDescription>Default currency code shown on invoices and reports (e.g. XAF, USD, EUR).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="currency">Currency code *</Label>
          <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={10} />
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#003D82]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save currency
        </Button>
      </CardContent>
    </Card>
  );
}

export function PosSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [billers, setBillers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ warehouse_id: '', biller_id: '', customer_id: '' });

  useEffect(() => {
    (async () => {
      try {
        const [pos, wh, bl, cu] = await Promise.all([
          getPosSettings(),
          listWarehouses(),
          listBillers(),
          listCustomers(),
        ]);
        setWarehouses(wh || []);
        setBillers(bl || []);
        setCustomers(cu || []);
        setForm({
          warehouse_id: pos?.warehouse_id || '',
          biller_id: pos?.biller_id || '',
          customer_id: pos?.customer_id || '',
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await savePosSettings({
        warehouse_id: form.warehouse_id || null,
        biller_id: form.biller_id || null,
        customer_id: form.customer_id || null,
      });
      toast.success('POS settings saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#003D82]">POS Settings</CardTitle>
        <CardDescription>Defaults applied when opening the point-of-sale screen.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 max-w-3xl">
        <div className="space-y-2">
          <Label>Default warehouse</Label>
          <select
            className="w-full border rounded-md h-10 px-2"
            value={form.warehouse_id}
            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
          >
            <option value="">—</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Default biller</Label>
          <select
            className="w-full border rounded-md h-10 px-2"
            value={form.biller_id}
            onChange={(e) => setForm({ ...form, biller_id: e.target.value })}
          >
            <option value="">—</option>
            {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Default walk-in customer</Label>
          <select
            className="w-full border rounded-md h-10 px-2"
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
          >
            <option value="">—</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <Button onClick={save} disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save POS settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
