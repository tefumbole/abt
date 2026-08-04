import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, Plus, Search, Trash2, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import UserManagementForm from '@/components/admin/UserManagementForm';
import { createUser, deleteUser, getAllUsers, updateUser } from '@/services/userService';
import {
  createBiller, createCustomer, createSupplier,
  deleteBiller, deleteCustomer, deleteSupplier,
  listBillers, listCustomerGroups, listCustomers, listSuppliers, listWarehouses,
  updateBiller, updateCustomer, updateSupplier,
} from '@/services/erpService';

const TABS = [
  { id: 'user-list', label: 'User List', color: 'navy' },
  { id: 'add-user', label: 'Add User', color: 'gold' },
  { id: 'customer-list', label: 'Customer List', color: 'purple' },
  { id: 'add-customer', label: 'Add Customer', color: 'pink' },
  { id: 'biller-list', label: 'Biller List', color: 'orange' },
  { id: 'add-biller', label: 'Add Biller', color: 'cyan' },
  { id: 'supplier-list', label: 'Supplier List', color: 'rose' },
  { id: 'add-supplier', label: 'Add Supplier', color: 'indigo' },
];

const EMPTY_PARTY = {
  name: '',
  email: '',
  phone: '',
  company_name: '',
  address: '',
  city: '',
  warehouse_id: '',
  customer_group_id: '',
  is_default: false,
  is_active: true,
};

function roleBadgeClass(role) {
  const r = (role || '').toLowerCase();
  if (r === 'super_admin' || r === 'admin') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (r === 'customer') return 'bg-teal-100 text-teal-800 border-teal-200';
  if (r === 'director' || r === 'manager') return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function PeoplePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const raw = searchParams.get('tab') || 'user-list';
    return TABS.some((t) => t.id === raw) ? raw : 'user-list';
  }, [searchParams]);

  const setTab = (id) => {
    setSearchParams(id === 'user-list' ? {} : { tab: id }, { replace: true });
  };

  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [billers, setBillers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [partyForm, setPartyForm] = useState(EMPTY_PARTY);
  const [editPartyId, setEditPartyId] = useState(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userFormMode, setUserFormMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSubmitting, setUserSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, c, b, s, wh, g] = await Promise.all([
        getAllUsers().catch(() => []),
        listCustomers().catch(() => []),
        listBillers().catch(() => []),
        listSuppliers().catch(() => []),
        listWarehouses().catch(() => []),
        listCustomerGroups().catch(() => []),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setCustomers(c || []);
      setBillers(b || []);
      setSuppliers(s || []);
      setWarehouses(wh || []);
      setGroups(g || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setPage(1);
    setSearch('');
    setEditPartyId(null);
    setPartyForm(EMPTY_PARTY);
    if (tab === 'add-user') {
      setUserFormMode('create');
      setSelectedUser(null);
      setUserFormOpen(true);
    } else {
      setUserFormOpen(false);
    }
  }, [tab]);

  const listKind = tab.includes('customer')
    ? 'customers'
    : tab.includes('biller')
      ? 'billers'
      : tab.includes('supplier')
        ? 'suppliers'
        : 'users';

  const activeRows = useMemo(() => {
    if (listKind === 'users') return users;
    if (listKind === 'customers') return customers;
    if (listKind === 'billers') return billers;
    return suppliers;
  }, [listKind, users, customers, billers, suppliers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((r) => {
      const hay = [
        r.full_name, r.username, r.name, r.email, r.phone, r.company_name, r.role, r.address,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [activeRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const submitParty = async (e) => {
    e.preventDefault();
    if (!partyForm.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...partyForm,
        name: partyForm.name.trim(),
        customer_group_id: partyForm.customer_group_id || null,
        warehouse_id: partyForm.warehouse_id || null,
      };
      if (listKind === 'customers') {
        if (editPartyId) await updateCustomer(editPartyId, payload);
        else await createCustomer(payload);
      } else if (listKind === 'billers') {
        if (editPartyId) await updateBiller(editPartyId, payload);
        else await createBiller(payload);
      } else if (listKind === 'suppliers') {
        if (editPartyId) await updateSupplier(editPartyId, payload);
        else await createSupplier(payload);
      }
      toast.success(editPartyId ? 'Updated' : 'Created');
      setPartyForm(EMPTY_PARTY);
      setEditPartyId(null);
      await load();
      if (listKind === 'customers') setTab('customer-list');
      else if (listKind === 'billers') setTab('biller-list');
      else if (listKind === 'suppliers') setTab('supplier-list');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeParty = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      if (listKind === 'customers') await deleteCustomer(id);
      else if (listKind === 'billers') await deleteBiller(id);
      else await deleteSupplier(id);
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const startEditParty = (row) => {
    setEditPartyId(row.id);
    setPartyForm({
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      company_name: row.company_name || '',
      address: row.address || '',
      city: row.city || '',
      warehouse_id: row.warehouse_id || '',
      customer_group_id: row.customer_group_id || '',
      is_default: !!row.is_default,
      is_active: row.is_active !== false,
    });
    if (listKind === 'customers') setTab('add-customer');
    else if (listKind === 'billers') setTab('add-biller');
    else setTab('add-supplier');
  };

  const handleUserSubmit = async (formData) => {
    setUserSubmitting(true);
    try {
      if (userFormMode === 'create') {
        await createUser(formData);
        toast.success('User created');
      } else if (selectedUser?.id) {
        await updateUser(selectedUser.id, formData);
        toast.success('User updated');
      }
      setUserFormOpen(false);
      setSelectedUser(null);
      await load();
      setTab('user-list');
    } catch (e) {
      toast.error(e.message || 'User save failed');
    } finally {
      setUserSubmitting(false);
    }
  };

  const removeUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      toast.success('User deleted');
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const groupName = (id) => groups.find((g) => g.id === id)?.name || '—';

  const renderToolbar = (title, addTabId, addLabel) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">{title}</h2>
        <p className="text-sm text-slate-600">Showing {filtered.length ? (page - 1) * pageSize + 1 : 0} – {Math.min(page * pageSize, filtered.length)} ({filtered.length})</p>
      </div>
      {addTabId ? (
        <Button className="bg-[#003D82]" onClick={() => setTab(addTabId)}>
          <Plus className="h-4 w-4 mr-1" /> {addLabel}
        </Button>
      ) : null}
    </div>
  );

  const renderSearchBar = () => (
    <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center">
      <div className="flex items-center gap-2 text-sm">
        <span>Records per page</span>
        <select
          className="border rounded-md h-9 px-2 bg-white"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>
    </div>
  );

  const renderPagination = () => (
    <div className="flex items-center justify-between mt-3 text-sm text-slate-600">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPartyForm = (kind) => (
    <form onSubmit={submitParty} className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 max-w-4xl">
      <div className="md:col-span-2">
        <h2 className="text-xl font-bold text-[#003D82]">
          {editPartyId ? 'Edit' : 'Add'} {kind === 'customers' ? 'Customer' : kind === 'billers' ? 'Biller' : 'Supplier'}
        </h2>
      </div>
      <div>
        <Label>Name *</Label>
        <Input required value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" value={partyForm.email} onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })} />
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} />
      </div>
      <div>
        <Label>Company Name</Label>
        <Input value={partyForm.company_name} onChange={(e) => setPartyForm({ ...partyForm, company_name: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>Address</Label>
        <Input value={partyForm.address} onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })} />
      </div>
      {kind === 'customers' && (
        <>
          <div>
            <Label>City</Label>
            <Input value={partyForm.city} onChange={(e) => setPartyForm({ ...partyForm, city: e.target.value })} />
          </div>
          <div>
            <Label>Customer Group</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-white"
              value={partyForm.customer_group_id}
              onChange={(e) => setPartyForm({ ...partyForm, customer_group_id: e.target.value })}
            >
              <option value="">—</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </>
      )}
      {kind === 'billers' && (
        <>
          <div>
            <Label>Warehouse</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-white"
              value={partyForm.warehouse_id}
              onChange={(e) => setPartyForm({ ...partyForm, warehouse_id: e.target.value })}
            >
              <option value="">—</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input
              type="checkbox"
              checked={partyForm.is_default}
              onChange={(e) => setPartyForm({ ...partyForm, is_default: e.target.checked })}
            />
            Default biller
          </label>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={partyForm.is_active}
          onChange={(e) => setPartyForm({ ...partyForm, is_active: e.target.checked })}
        />
        Active
      </label>
      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" disabled={saving} className="bg-[#003D82]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {editPartyId ? 'Update' : 'Submit'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditPartyId(null);
            setPartyForm(EMPTY_PARTY);
            if (kind === 'customers') setTab('customer-list');
            else if (kind === 'billers') setTab('biller-list');
            else setTab('supplier-list');
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003D82]" /></div>
      ) : null}

      {!loading && tab === 'user-list' && (
        <div>
          {renderToolbar('User List', 'add-user', 'Add User')}
          {renderSearchBar()}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">UserName</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3 font-medium">{u.username || u.full_name || '—'}</td>
                    <td className="p-3">{u.email || '—'}</td>
                    <td className="p-3">{u.phone || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={cn('capitalize', roleBadgeClass(u.role || u.primary_role))}>
                        {u.role || u.primary_role || 'user'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">
                        {(u.status || 'active').toString()}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(u);
                          setUserFormMode('edit');
                          setUserFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeUser(u.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </div>
      )}

      {!loading && tab === 'add-user' && (
        <div className="rounded-xl border bg-white p-6 max-w-2xl">
          <h2 className="text-xl font-bold text-[#003D82] mb-2">Add User</h2>
          <p className="text-sm text-slate-600 mb-4">Create a system user with a role and login credentials.</p>
          <Button className="bg-[#003D82]" onClick={() => { setUserFormMode('create'); setSelectedUser(null); setUserFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Open user form
          </Button>
        </div>
      )}

      {!loading && tab === 'customer-list' && (
        <div>
          {renderToolbar('Customer List', 'add-customer', 'Add Customer')}
          {renderSearchBar()}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Customer Group</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">{r.email || '—'}</td>
                    <td className="p-3">{r.company_name || '—'}</td>
                    <td className="p-3">{r.phone || '—'}</td>
                    <td className="p-3">{groupName(r.customer_group_id)}</td>
                    <td className="p-3">
                      <Badge className={r.is_active === false ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'} variant="outline">
                        {r.is_active === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => startEditParty(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeParty(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500">No customers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </div>
      )}

      {!loading && tab === 'add-customer' && renderPartyForm('customers')}

      {!loading && tab === 'biller-list' && (
        <div>
          {renderToolbar('Biller List', 'add-biller', 'Add Biller')}
          {renderSearchBar()}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.name}{r.is_default ? ' (Default)' : ''}</td>
                    <td className="p-3">{r.email || '—'}</td>
                    <td className="p-3">{r.company_name || '—'}</td>
                    <td className="p-3">{r.phone || '—'}</td>
                    <td className="p-3">
                      <Badge className={r.is_active === false ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'} variant="outline">
                        {r.is_active === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => startEditParty(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeParty(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No billers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </div>
      )}

      {!loading && tab === 'add-biller' && renderPartyForm('billers')}

      {!loading && tab === 'supplier-list' && (
        <div>
          {renderToolbar('Supplier List', 'add-supplier', 'Add Supplier')}
          {renderSearchBar()}
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">{r.email || '—'}</td>
                    <td className="p-3">{r.company_name || '—'}</td>
                    <td className="p-3">{r.phone || '—'}</td>
                    <td className="p-3">
                      <Badge className={r.is_active === false ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'} variant="outline">
                        {r.is_active === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => startEditParty(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeParty(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No suppliers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </div>
      )}

      {!loading && tab === 'add-supplier' && renderPartyForm('suppliers')}

      <UserManagementForm
        isOpen={userFormOpen}
        onClose={() => {
          setUserFormOpen(false);
          if (tab === 'add-user') setTab('user-list');
        }}
        mode={userFormMode}
        audience="user"
        initialData={selectedUser}
        onSubmit={handleUserSubmit}
        isSubmitting={userSubmitting}
      />
    </div>
  );
}
