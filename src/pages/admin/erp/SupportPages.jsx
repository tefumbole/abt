import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createAccount, createExpense, createExpenseCategory, createMoneyTransfer, createErpPayment,
  createPurchaseReturn, createSaleReturn, createTransfer, getBalanceSheet,
  listAccounts, listExpenseCategories, listExpenses, listErpPayments, listMoneyTransfers,
  listProducts, listPurchaseReturns, listSaleReturns, listTransfers, listWarehouses,
} from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

export function TransfersPage() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', qty: 1 });

  const load = async () => {
    setLoading(true);
    try {
      const [t, w, p] = await Promise.all([listTransfers(), listWarehouses(), listProducts()]);
      setRows(t); setWarehouses(w); setProducts(p);
      if (w[0] && !form.from_warehouse_id) setForm((f) => ({ ...f, from_warehouse_id: w[0].id, to_warehouse_id: w[1]?.id || w[0].id }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Commerce" subtitle="Stock transfers" tabs={COMMERCE_TABS}>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createTransfer({ ...form, items: [{ product_id: form.product_id, qty: Number(form.qty) }] });
          toast.success('Transfer completed'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>From</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.from_warehouse_id} onChange={(e) => setForm({ ...form, from_warehouse_id: e.target.value })}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><Label>To</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.to_warehouse_id} onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><Label>Product</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label>Qty</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
        <div className="md:col-span-2"><Button type="submit">Transfer</Button></div>
      </form>
      <ListTable loading={loading} rows={rows} cols={[
        ['reference', 'Ref'], ['from_warehouse_name', 'From'], ['to_warehouse_name', 'To'], ['status', 'Status'],
      ]} />
    </ErpShell>
  );
}

export function ReturnsPage() {
  const [tab, setTab] = useState('sale');
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ warehouse_id: '', product_id: '', qty: 1, price: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [r, w, p] = await Promise.all([
        tab === 'sale' ? listSaleReturns() : listPurchaseReturns(),
        listWarehouses(), listProducts(),
      ]);
      setRows(r); setWarehouses(w); setProducts(p);
      if (w[0] && !form.warehouse_id) setForm((f) => ({ ...f, warehouse_id: w[0].id }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  return (
    <ErpShell title="ERP Commerce" subtitle="Returns" tabs={COMMERCE_TABS}>
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === 'sale' ? 'default' : 'outline'} onClick={() => setTab('sale')}>Sale returns</Button>
        <Button size="sm" variant={tab === 'purchase' ? 'default' : 'outline'} onClick={() => setTab('purchase')}>Purchase returns</Button>
      </div>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          if (tab === 'sale') {
            await createSaleReturn({
              warehouse_id: form.warehouse_id,
              items: [{ product_id: form.product_id, qty: Number(form.qty), net_unit_price: Number(form.price) }],
            });
          } else {
            await createPurchaseReturn({
              warehouse_id: form.warehouse_id,
              items: [{ product_id: form.product_id, qty: Number(form.qty), net_unit_cost: Number(form.price) }],
            });
          }
          toast.success('Return saved'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><Label>Product</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label>Qty</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
        <div><Label>{tab === 'sale' ? 'Unit price' : 'Unit cost'}</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Save return</Button></div>
      </form>
      <ListTable loading={loading} rows={rows} cols={[['reference', 'Ref'], ['warehouse_name', 'Warehouse'], ['grand_total', 'Total']]} />
    </ErpShell>
  );
}

export function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ warehouse_id: '', category_id: '', amount: 0, note: '', catName: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [e, c, w] = await Promise.all([listExpenses(), listExpenseCategories(), listWarehouses()]);
      setRows(e); setCategories(c); setWarehouses(w);
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Commerce" subtitle="Expenses" tabs={COMMERCE_TABS}>
      <form className="flex gap-2 mb-3" onSubmit={async (e) => {
        e.preventDefault();
        try { await createExpenseCategory({ name: form.catName }); toast.success('Category added'); setForm({ ...form, catName: '' }); load(); }
        catch (err) { toast.error(err.message); }
      }}>
        <Input placeholder="New category" value={form.catName} onChange={(e) => setForm({ ...form, catName: e.target.value })} required />
        <Button type="submit">Add category</Button>
      </form>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createExpense({ warehouse_id: form.warehouse_id || null, category_id: form.category_id || null, amount: Number(form.amount), note: form.note });
          toast.success('Expense saved'); load();
        } catch (err) { toast.error(err.message); }
      }}>
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
        <div className="md:col-span-3"><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Add expense</Button></div>
      </form>
      <ListTable loading={loading} rows={rows} cols={[['reference', 'Ref'], ['category_name', 'Category'], ['warehouse_name', 'Warehouse'], ['amount', 'Amount'], ['expense_date', 'Date']]} />
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
    <ErpShell title="ERP Commerce" subtitle="Payments ledger" tabs={COMMERCE_TABS}>
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
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accForm, setAccForm] = useState({ name: '', account_no: '', balance: 0 });
  const [mtForm, setMtForm] = useState({ from_account_id: '', to_account_id: '', amount: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [a, t, s] = await Promise.all([listAccounts(), listMoneyTransfers(), getBalanceSheet()]);
      setAccounts(a); setTransfers(t); setSheet(s);
      if (a[0] && !mtForm.from_account_id) setMtForm((f) => ({ ...f, from_account_id: a[0].id, to_account_id: a[1]?.id || a[0].id }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Commerce" subtitle="Accounting" tabs={COMMERCE_TABS}>
      {sheet && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            ['Accounts', sheet.accounts_total],
            ['Sales', sheet.sales_total],
            ['Purchases', sheet.purchases_total],
            ['Expenses', sheet.expenses_total],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border bg-white p-4">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-xl font-bold">{Number(val || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try { await createAccount({ ...accForm, balance: Number(accForm.balance) }); toast.success('Account created'); load(); }
        catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Account name</Label><Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} required /></div>
        <div><Label>Account no</Label><Input value={accForm.account_no} onChange={(e) => setAccForm({ ...accForm, account_no: e.target.value })} /></div>
        <div><Label>Opening balance</Label><Input type="number" value={accForm.balance} onChange={(e) => setAccForm({ ...accForm, balance: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Add account</Button></div>
      </form>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try { await createMoneyTransfer({ ...mtForm, amount: Number(mtForm.amount) }); toast.success('Money transferred'); load(); }
        catch (err) { toast.error(err.message); }
      }}>
        <div><Label>From</Label>
          <select className="w-full border rounded-md h-10 px-2" value={mtForm.from_account_id} onChange={(e) => setMtForm({ ...mtForm, from_account_id: e.target.value })}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><Label>To</Label>
          <select className="w-full border rounded-md h-10 px-2" value={mtForm.to_account_id} onChange={(e) => setMtForm({ ...mtForm, to_account_id: e.target.value })}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><Label>Amount</Label><Input type="number" value={mtForm.amount} onChange={(e) => setMtForm({ ...mtForm, amount: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Transfer money</Button></div>
      </form>
      <h3 className="font-semibold mb-2">Accounts</h3>
      <ListTable loading={loading} rows={accounts} cols={[['name', 'Name'], ['account_no', 'No'], ['balance', 'Balance']]} />
      <h3 className="font-semibold mb-2 mt-6">Money transfers</h3>
      <ListTable loading={false} rows={transfers} cols={[['reference', 'Ref'], ['from_account_name', 'From'], ['to_account_name', 'To'], ['amount', 'Amount']]} />
    </ErpShell>
  );
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
