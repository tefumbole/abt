import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createExpense, createExpenseCategory, createErpPayment, deleteExpense,
  listAccounts, listExpenseCategories, listExpenses, listErpPayments, listWarehouses,
} from '@/services/erpService';
import AccountingPanels from './AccountingPanels';
import ErpShell from './ErpShell';
import TransfersPanel from './TransfersPanel';
import ReturnsPanel from './ReturnsPanel';

export function TransfersPage() {
  return <TransfersPanel />;
}

export function ReturnsPage() {
  return <ReturnsPanel />;
}

export function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '' });
  const [form, setForm] = useState({
    warehouse_id: '', category_id: '', account_id: '', amount: 0, note: '', expense_date: '', catName: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.from) q.set('from', filters.from);
      if (filters.to) q.set('to', filters.to);
      const qs = q.toString() ? `?${q}` : '';
      const [e, c, w, a] = await Promise.all([
        listExpenses(qs), listExpenseCategories(), listWarehouses(), listAccounts(),
      ]);
      setRows(e); setCategories(c); setWarehouses(w);
      const active = (a || []).filter((x) => Number(x.is_active) !== 0);
      setAccounts(active);
      if (active[0] && !form.account_id) setForm((f) => ({ ...f, account_id: active[0].id }));
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filters.from, filters.to]);

  return (
    <ErpShell title="ERP Commerce" subtitle="Expenses">
      <form className="flex gap-2 mb-3" onSubmit={async (e) => {
        e.preventDefault();
        try { await createExpenseCategory({ name: form.catName }); toast.success('Category added'); setForm({ ...form, catName: '' }); load(); }
        catch (err) { toast.error(err.message); }
      }}>
        <Input placeholder="New category" value={form.catName} onChange={(e) => setForm({ ...form, catName: e.target.value })} required />
        <Button type="submit">Add category</Button>
      </form>
      <div className="rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-end mb-4">
        <div><Label>From</Label><Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
        <div><Label>To</Label><Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
        <Button type="button" variant="outline" onClick={() => setFilters({ from: '', to: '' })}>Clear dates</Button>
      </div>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!form.account_id) { toast.error('Account is required'); return; }
        try {
          await createExpense({
            warehouse_id: form.warehouse_id || null,
            category_id: form.category_id || null,
            account_id: form.account_id,
            amount: Number(form.amount),
            note: form.note,
            expense_date: form.expense_date || undefined,
          });
          toast.success('Expense saved'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Account *</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
            <option value="">Select account…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
            <option value="">—</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><Label>Category</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
        <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
        <div className="md:col-span-3"><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Add expense</Button></div>
      </form>
      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Ref</th>
                <th className="p-3">Account</th>
                <th className="p-3">Category</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.account_name || '—'}</td>
                  <td className="p-3">{r.category_name || '—'}</td>
                  <td className="p-3">{r.warehouse_name || '—'}</td>
                  <td className="p-3">{Number(r.amount || 0).toFixed(2)}</td>
                  <td className="p-3">{r.expense_date || '—'}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={async () => {
                      if (!window.confirm(`Delete expense ${r.reference}? Account balance will be restored.`)) return;
                      try {
                        await deleteExpense(r.id);
                        toast.success('Expense deleted');
                        load();
                      } catch (err) { toast.error(err.message); }
                    }}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ErpShell>
  );
}

export function PaymentsPage() {
  const [rows, setRows] = useState([]);
  const [awaiting, setAwaiting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ payable_type: 'sale', payable_id: '', amount: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([listErpPayments(), listErpPayments('?awaiting=1')]);
      setRows(p);
      setAwaiting(a?.awaiting || []);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Commerce" subtitle="Payments ledger">
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createErpPayment({ ...form, amount: Number(form.amount) });
          toast.success('Payment recorded'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Type</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.payable_type} onChange={(e) => setForm({ ...form, payable_type: e.target.value })}>
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="deposit">Deposit</option>
          </select>
        </div>
        <div><Label>Payable ID</Label><Input value={form.payable_id} onChange={(e) => setForm({ ...form, payable_id: e.target.value })} required /></div>
        <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
        <div className="md:col-span-3"><Button type="submit">Record payment</Button></div>
      </form>
      <h3 className="font-semibold mb-2">Awaiting payment</h3>
      <ListTable loading={false} rows={awaiting} cols={[['reference', 'Ref'], ['type', 'Type'], ['grand_total', 'Total'], ['paid_amount', 'Paid'], ['due', 'Due']]} />
      <h3 className="font-semibold mb-2 mt-6">Payment history</h3>
      <ListTable loading={loading} rows={Array.isArray(rows) ? rows : []} cols={[['reference', 'Ref'], ['payable_type', 'Type'], ['amount', 'Amount'], ['paying_method', 'Method']]} />
    </ErpShell>
  );
}

export function AccountingPage() {
  return <AccountingPanels />;
}

function ListTable({ loading, rows, cols }) {
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  return (
    <div className="rounded-xl border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>{cols.map(([k, label]) => <th key={k} className="p-3">{label}</th>)}</tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.id || r.reference} className="border-t">
              {cols.map(([k]) => (
                <td key={k} className="p-3">{r[k] != null && typeof r[k] === 'number' ? Number(r[k]).toFixed(2) : (r[k] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
