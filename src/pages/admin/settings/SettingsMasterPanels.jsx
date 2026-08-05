import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  createBiller,
  createBrand,
  createCurrency,
  createCustomerGroup,
  createUnit,
  createWarehouse,
  deleteBiller,
  deleteBrand,
  deleteCurrency,
  deleteCustomerGroup,
  deleteUnit,
  deleteWarehouse,
  getPosSettings,
  listBillers,
  listBrands,
  listCurrencies,
  listCustomerGroups,
  listCustomers,
  listUnits,
  listWarehouses,
  savePosSettings,
  setDefaultCurrency,
  setDefaultUnit,
  updateBiller,
  updateBrand,
  updateCurrency,
  updateCustomerGroup,
  updateUnit,
  updateWarehouse,
} from '@/services/erpService';

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
              {(rows || []).map((r) => (
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
              {!rows?.length && (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No warehouses yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const EMPTY_BILLER = {
  name: '', email: '', phone: '', company_name: '', address: '', warehouse_id: '', is_default: false,
};

export function BillersSettingsPanel() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_BILLER);
  const [editId, setEditId] = useState(null);

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
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company_name: form.company_name.trim(),
        address: form.address.trim(),
        warehouse_id: form.warehouse_id || null,
        is_default: !!form.is_default,
      };
      if (editId) await updateBiller(editId, payload);
      else await createBiller(payload);
      toast.success(editId ? 'Biller updated' : 'Biller created');
      setForm(EMPTY_BILLER);
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name || '—';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Billers</h2>
        <p className="text-sm text-slate-600">Default billers used on invoices, quotations, and POS.</p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div>
          <Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2 bg-white" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
            <option value="">—</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Default biller
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update biller' : 'Add biller'}
          </Button>
          {editId && (
            <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(EMPTY_BILLER); }}>
              Cancel
            </Button>
          )}
        </div>
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
                <th className="p-3">Address</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">
                    {r.name}
                    {r.is_default ? <span className="ml-2 text-xs font-semibold text-[#003D82]">(Default)</span> : null}
                  </td>
                  <td className="p-3">{r.phone || '—'}</td>
                  <td className="p-3">{r.email || '—'}</td>
                  <td className="p-3">{r.company_name || '—'}</td>
                  <td className="p-3">{r.address || '—'}</td>
                  <td className="p-3">{warehouseName(r.warehouse_id)}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(r.id);
                        setForm({
                          name: r.name || '',
                          email: r.email || '',
                          phone: r.phone || '',
                          company_name: r.company_name || '',
                          address: r.address || '',
                          warehouse_id: r.warehouse_id || '',
                          is_default: !!r.is_default,
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete biller?')) return;
                      try {
                        await deleteBiller(r.id);
                        toast.success('Deleted');
                        if (editId === r.id) {
                          setEditId(null);
                          setForm(EMPTY_BILLER);
                        }
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
              {!rows?.length && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">No billers yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function CustomerGroupsSettingsPanel() {
  const EMPTY = { name: '', percentage: '0', credit_limit: '', is_active: true };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listCustomerGroups());
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
      const payload = {
        name: form.name.trim(),
        percentage: Number(form.percentage) || 0,
        credit_limit: form.credit_limit === '' ? null : Number(form.credit_limit),
        is_active: !!form.is_active,
      };
      if (editId) await updateCustomerGroup(editId, payload);
      else await createCustomerGroup(payload);
      toast.success(editId ? 'Customer group updated' : 'Customer group created');
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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Customer Groups</h2>
        <p className="text-sm text-slate-600">
          Price adjustment groups for customers (percentage applied on sales/quotations).
        </p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Group name *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wholesale" />
        </div>
        <div>
          <Label>Percentage (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.percentage}
            onChange={(e) => setForm({ ...form, percentage: e.target.value })}
          />
        </div>
        <div>
          <Label>Credit limit</Label>
          <Input
            type="number"
            step="0.01"
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <label className="flex items-center gap-2 text-sm self-end pb-2">
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
            {editId ? 'Update group' : 'Add customer group'}
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
                <th className="p-3">Percentage</th>
                <th className="p-3">Credit limit</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{Number(r.percentage) || 0}%</td>
                  <td className="p-3">{r.credit_limit != null ? Number(r.credit_limit).toLocaleString() : '—'}</td>
                  <td className="p-3">{r.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(r.id);
                        setForm({
                          name: r.name || '',
                          percentage: String(r.percentage ?? 0),
                          credit_limit: r.credit_limit != null ? String(r.credit_limit) : '',
                          is_active: !!r.is_active,
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm('Delete this customer group?')) return;
                        try {
                          await deleteCustomerGroup(r.id);
                          toast.success('Deleted');
                          load();
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">No customer groups yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function BrandsSettingsPanel() {
  const EMPTY = { name: '', image_url: '' };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listBrands());
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
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), image_url: form.image_url.trim() || null };
      if (editId) await updateBrand(editId, payload);
      else await createBrand(payload);
      toast.success(editId ? 'Brand updated' : 'Brand created');
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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Brands</h2>
        <p className="text-sm text-slate-600">Product brands available when creating catalog items.</p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Name *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Samsung" />
        </div>
        <div>
          <Label>Logo URL</Label>
          <Input
            type="url"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://… (optional)"
          />
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update brand' : 'Add brand'}
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
                <th className="p-3">Logo</th>
                <th className="p-3">Name</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="h-8 w-8 rounded object-contain border bg-white" />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(r.id);
                        setForm({ name: r.name || '', image_url: r.image_url || '' });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm('Delete this brand?')) return;
                        try {
                          await deleteBrand(r.id);
                          toast.success('Deleted');
                          if (editId === r.id) {
                            setEditId(null);
                            setForm(EMPTY);
                          }
                          load();
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr><td colSpan={3} className="p-6 text-center text-slate-500">No brands yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function UnitsSettingsPanel() {
  const EMPTY = { name: '', code: '', is_active: true, is_default: false };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listUnits());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        is_active: !!form.is_active,
        is_default: !!form.is_default,
      };
      if (editId) await updateUnit(editId, payload);
      else await createUnit(payload);
      toast.success(editId ? 'Unit updated' : 'Unit created');
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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Units</h2>
        <p className="text-sm text-slate-600">
          Units of measure (pcs, kg, box, etc.). Set one as default for General Settings and new products.
        </p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Name *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Piece" />
        </div>
        <div>
          <Label>Code</Label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="pc" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Set as default
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update unit' : 'Add unit'}
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
                <th className="p-3">Code</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">
                    {r.name}
                    {r.is_default ? <span className="ml-2 text-xs font-semibold text-[#003D82]">(Default)</span> : null}
                  </td>
                  <td className="p-3">{r.code || '—'}</td>
                  <td className="p-3">{r.is_active !== false ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right space-x-1">
                    {!r.is_default ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await setDefaultUnit(r.id);
                            toast.success('Default unit updated');
                            load();
                          } catch (e) {
                            toast.error(e.message);
                          }
                        }}
                      >
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
                          code: r.code || '',
                          is_active: r.is_active !== false,
                          is_default: !!r.is_default,
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!r.is_default}
                      onClick={async () => {
                        if (!confirm('Delete this unit?')) return;
                        try {
                          await deleteUnit(r.id);
                          toast.success('Deleted');
                          load();
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500">No units yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function CurrencySettingsPanel() {
  const EMPTY = { name: '', code: '', symbol: '', exchange_rate: '1', is_active: true, is_default: false };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listCurrencies());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        symbol: form.symbol.trim() || form.code.trim().toUpperCase(),
        exchange_rate: Number(form.exchange_rate) || 1,
        is_active: !!form.is_active,
        is_default: !!form.is_default,
      };
      if (editId) await updateCurrency(editId, payload);
      else await createCurrency(payload);
      toast.success(editId ? 'Currency updated' : 'Currency created');
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
      await setDefaultCurrency(id);
      toast.success('Default currency updated');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">Currencies</h2>
        <p className="text-sm text-slate-600">
          Create currencies and choose which one is the system default for invoices and reports.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-xl border bg-white p-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label>Name *</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. US Dollar" />
        </div>
        <div>
          <Label>Code *</Label>
          <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="USD" maxLength={16} />
        </div>
        <div>
          <Label>Symbol</Label>
          <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="$" maxLength={16} />
        </div>
        <div>
          <Label>Exchange rate</Label>
          <Input
            type="number"
            step="0.000001"
            value={form.exchange_rate}
            onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Set as default
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editId ? 'Update currency' : 'Add currency'}
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
                <th className="p-3">Code</th>
                <th className="p-3">Symbol</th>
                <th className="p-3">Exchange rate</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">
                    {r.name}
                    {r.is_default ? <span className="ml-2 text-xs font-semibold text-[#003D82]">(Default)</span> : null}
                  </td>
                  <td className="p-3 font-mono">{r.code}</td>
                  <td className="p-3">{r.symbol || '—'}</td>
                  <td className="p-3">{Number(r.exchange_rate) || 1}</td>
                  <td className="p-3">{r.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="p-3 text-right space-x-1">
                    {!r.is_default && r.is_active ? (
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
                          code: r.code || '',
                          symbol: r.symbol || '',
                          exchange_rate: String(r.exchange_rate ?? 1),
                          is_active: !!r.is_active,
                          is_default: !!r.is_default,
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!r.is_default}
                      onClick={async () => {
                        if (!confirm('Delete this currency?')) return;
                        try {
                          await deleteCurrency(r.id);
                          toast.success('Deleted');
                          load();
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No currencies yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const POS_PAYING_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'momo_mtn', label: 'MTN MoMo' },
  { value: 'momo_orange', label: 'Orange Money' },
];

const POS_DEFAULTS = {
  default_paying_method: 'cash',
  default_tax_rate: 0,
  products_per_row: 4,
  show_stock: true,
  block_out_of_stock: true,
  enable_keyboard_shortcuts: true,
  auto_print_receipt: false,
  receipt_show_logo: true,
  receipt_header: '',
  receipt_footer: 'Thank you for your business!',
};

const posBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 1 || value === '1' || value === 'true';
};

/** The stored blob has arrived as `settings` or as a JSON-encoded `settings_json` column. */
function readPosExtras(pos) {
  const raw = pos?.settings ?? pos?.settings_json;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

export function PosSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [billers, setBillers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    warehouse_id: '',
    biller_id: '',
    customer_id: '',
    ...POS_DEFAULTS,
    default_tax_rate: String(POS_DEFAULTS.default_tax_rate),
    products_per_row: String(POS_DEFAULTS.products_per_row),
  });

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
        const extras = readPosExtras(pos);
        setForm({
          warehouse_id: pos?.warehouse_id || '',
          biller_id: pos?.biller_id || '',
          customer_id: pos?.customer_id || '',
          default_paying_method: extras.default_paying_method || POS_DEFAULTS.default_paying_method,
          default_tax_rate: String(extras.default_tax_rate ?? POS_DEFAULTS.default_tax_rate),
          products_per_row: String(extras.products_per_row ?? POS_DEFAULTS.products_per_row),
          show_stock: posBool(extras.show_stock, POS_DEFAULTS.show_stock),
          block_out_of_stock: posBool(extras.block_out_of_stock, POS_DEFAULTS.block_out_of_stock),
          enable_keyboard_shortcuts: posBool(extras.enable_keyboard_shortcuts, POS_DEFAULTS.enable_keyboard_shortcuts),
          auto_print_receipt: posBool(extras.auto_print_receipt, POS_DEFAULTS.auto_print_receipt),
          receipt_show_logo: posBool(extras.receipt_show_logo, POS_DEFAULTS.receipt_show_logo),
          receipt_header: extras.receipt_header ?? POS_DEFAULTS.receipt_header,
          receipt_footer: extras.receipt_footer ?? POS_DEFAULTS.receipt_footer,
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const settings = {
        default_paying_method: form.default_paying_method,
        default_tax_rate: Number(form.default_tax_rate) || 0,
        products_per_row: Number(form.products_per_row) || POS_DEFAULTS.products_per_row,
        show_stock: !!form.show_stock,
        block_out_of_stock: !!form.block_out_of_stock,
        enable_keyboard_shortcuts: !!form.enable_keyboard_shortcuts,
        auto_print_receipt: !!form.auto_print_receipt,
        receipt_show_logo: !!form.receipt_show_logo,
        receipt_header: form.receipt_header,
        receipt_footer: form.receipt_footer,
      };
      await savePosSettings({
        warehouse_id: form.warehouse_id || null,
        biller_id: form.biller_id || null,
        customer_id: form.customer_id || null,
        settings,
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

  const toggleRow = (key, label, hint) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label className="text-sm font-semibold">{label}</Label>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      <Switch checked={!!form[key]} onCheckedChange={(v) => setField(key, v)} />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-[#003D82]">POS Settings</CardTitle>
          <CardDescription>Defaults applied when opening the point-of-sale screen.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Default warehouse</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-white"
              value={form.warehouse_id}
              onChange={(e) => setField('warehouse_id', e.target.value)}
            >
              <option value="">—</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Default biller</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-white"
              value={form.biller_id}
              onChange={(e) => setField('biller_id', e.target.value)}
            >
              <option value="">—</option>
              {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Default walk-in customer</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-white"
              value={form.customer_id}
              onChange={(e) => setField('customer_id', e.target.value)}
            >
              <option value="">—</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#003D82]">Register &amp; receipt</CardTitle>
          <CardDescription>How the register behaves and what prints on the customer receipt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Default paying method</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.default_paying_method}
                onChange={(e) => setField('default_paying_method', e.target.value)}
              >
                {POS_PAYING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Default tax rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.default_tax_rate}
                onChange={(e) => setField('default_tax_rate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Products per row</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.products_per_row}
                onChange={(e) => setField('products_per_row', e.target.value)}
              >
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={String(n)}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {toggleRow('show_stock', 'Show stock quantity', 'Display remaining stock on product tiles.')}
            {toggleRow('block_out_of_stock', 'Block out-of-stock items', 'Prevent adding products with no stock.')}
            {toggleRow('enable_keyboard_shortcuts', 'Keyboard shortcuts', 'Fast keys for pay, hold, and search.')}
            {toggleRow('auto_print_receipt', 'Auto-print receipt', 'Print immediately after a sale completes.')}
            {toggleRow('receipt_show_logo', 'Show logo on receipt', 'Uses the system logo from General Setting.')}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="receipt_header">Receipt header</Label>
              <Input
                id="receipt_header"
                value={form.receipt_header}
                onChange={(e) => setField('receipt_header', e.target.value)}
                placeholder="e.g. Alpha Bridge Technologies — Douala"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt_footer">Receipt footer</Label>
              <Textarea
                id="receipt_footer"
                rows={3}
                value={form.receipt_footer}
                onChange={(e) => setField('receipt_footer', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="bg-[#003D82]">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save POS settings
      </Button>
    </div>
  );
}
