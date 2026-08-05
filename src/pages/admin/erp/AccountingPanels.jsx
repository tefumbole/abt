import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createAccount, createMoneyTransfer, deactivateAccount, deleteMoneyTransfer,
  getBalanceSheet, getProfitLoss, listAccounts, listMoneyTransfers, updateAccount,
} from '@/services/erpService';
import ErpShell from './ErpShell';

const TABS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'transfers', label: 'Money transfers' },
  { key: 'pl', label: 'P&L' },
  { key: 'bs', label: 'Balance sheet' },
];

function money(v) {
  return Number(v || 0).toFixed(2);
}

export default function AccountingPanels() {
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [pl, setPl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accForm, setAccForm] = useState({ name: '', account_no: '', balance: 0 });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', account_no: '' });
  const [mtForm, setMtForm] = useState({ from_account_id: '', to_account_id: '', amount: 0, note: '' });
  const [plRange, setPlRange] = useState({ from: '', to: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [a, t, s] = await Promise.all([listAccounts(), listMoneyTransfers(), getBalanceSheet()]);
      setAccounts(a || []);
      setTransfers(t || []);
      setSheet(s);
      if (a?.[0] && !mtForm.from_account_id) {
        setMtForm((f) => ({ ...f, from_account_id: a[0].id, to_account_id: a[1]?.id || a[0].id }));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPl = async () => {
    try {
      const q = new URLSearchParams();
      if (plRange.from) q.set('from', plRange.from);
      if (plRange.to) q.set('to', plRange.to);
      const qs = q.toString() ? `?${q}` : '';
      setPl(await getProfitLoss(qs));
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (tab === 'pl') loadPl();
  }, [tab]);

  const activeAccounts = accounts.filter((a) => Number(a.is_active) !== 0);

  return (
    <ErpShell title="ERP Commerce" subtitle="Accounting">
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'accounts' && (
        <>
          <form
            className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createAccount({ ...accForm, balance: Number(accForm.balance) });
                toast.success('Account created');
                setAccForm({ name: '', account_no: '', balance: 0 });
                load();
              } catch (err) {
                toast.error(err.message);
              }
            }}
          >
            <div><Label>Account name</Label><Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} required /></div>
            <div><Label>Account no</Label><Input value={accForm.account_no} onChange={(e) => setAccForm({ ...accForm, account_no: e.target.value })} /></div>
            <div><Label>Opening balance</Label><Input type="number" value={accForm.balance} onChange={(e) => setAccForm({ ...accForm, balance: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit">Add account</Button></div>
          </form>
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="rounded-xl border bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">No</th>
                    <th className="p-3">Balance</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-3">
                        {editId === a.id ? (
                          <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        ) : a.name}
                      </td>
                      <td className="p-3">
                        {editId === a.id ? (
                          <Input value={editForm.account_no} onChange={(e) => setEditForm({ ...editForm, account_no: e.target.value })} />
                        ) : (a.account_no || '—')}
                      </td>
                      <td className="p-3">{money(a.balance)}</td>
                      <td className="p-3">{Number(a.is_active) ? 'Active' : 'Inactive'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {editId === a.id ? (
                            <>
                              <Button size="sm" onClick={async () => {
                                try {
                                  await updateAccount(a.id, editForm);
                                  toast.success('Account updated');
                                  setEditId(null);
                                  load();
                                } catch (err) { toast.error(err.message); }
                              }}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditId(a.id);
                                setEditForm({ name: a.name || '', account_no: a.account_no || '' });
                              }}><Pencil className="h-3.5 w-3.5" /></Button>
                              {Number(a.is_active) ? (
                                <Button size="sm" variant="outline" onClick={async () => {
                                  if (!window.confirm(`Deactivate ${a.name}?`)) return;
                                  try {
                                    await deactivateAccount(a.id);
                                    toast.success('Account deactivated');
                                    load();
                                  } catch (err) { toast.error(err.message); }
                                }}><Trash2 className="h-3.5 w-3.5" /></Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'transfers' && (
        <>
          <form
            className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await createMoneyTransfer({ ...mtForm, amount: Number(mtForm.amount) });
                toast.success('Money transferred');
                load();
              } catch (err) {
                toast.error(err.message);
              }
            }}
          >
            <div>
              <Label>From</Label>
              <select className="w-full border rounded-md h-10 px-2" value={mtForm.from_account_id} onChange={(e) => setMtForm({ ...mtForm, from_account_id: e.target.value })}>
                {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label>To</Label>
              <select className="w-full border rounded-md h-10 px-2" value={mtForm.to_account_id} onChange={(e) => setMtForm({ ...mtForm, to_account_id: e.target.value })}>
                {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><Label>Amount</Label><Input type="number" value={mtForm.amount} onChange={(e) => setMtForm({ ...mtForm, amount: e.target.value })} required /></div>
            <div className="md:col-span-3"><Label>Note</Label><Input value={mtForm.note} onChange={(e) => setMtForm({ ...mtForm, note: e.target.value })} /></div>
            <div className="md:col-span-3"><Button type="submit">Transfer money</Button></div>
          </form>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Ref</th>
                  <th className="p-3">From</th>
                  <th className="p-3">To</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3">{t.reference}</td>
                    <td className="p-3">{t.from_account_name || '—'}</td>
                    <td className="p-3">{t.to_account_name || '—'}</td>
                    <td className="p-3">{money(t.amount)}</td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!window.confirm(`Void transfer ${t.reference}? Balances will be reversed.`)) return;
                        try {
                          await deleteMoneyTransfer(t.id);
                          toast.success('Transfer voided');
                          load();
                        } catch (err) { toast.error(err.message); }
                      }}>Void</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'pl' && (
        <>
          <form
            className="rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-end mb-4"
            onSubmit={(e) => { e.preventDefault(); loadPl(); }}
          >
            <div><Label>From</Label><Input type="date" value={plRange.from} onChange={(e) => setPlRange({ ...plRange, from: e.target.value })} /></div>
            <div><Label>To</Label><Input type="date" value={plRange.to} onChange={(e) => setPlRange({ ...plRange, to: e.target.value })} /></div>
            <Button type="submit">Run P&amp;L</Button>
          </form>
          {pl ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ['Revenue', pl.revenue],
                ['COGS', pl.cogs],
                ['Gross profit', pl.gross_profit],
                ['Expenses', pl.expenses],
                ['Net profit', pl.net_profit],
                ['Sales count', pl.sale_count],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl border bg-white p-4">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className={`text-xl font-bold ${label === 'Net profit' && Number(val) < 0 ? 'text-rose-600' : ''}`}>
                    {label === 'Sales count' ? Number(val || 0) : money(val)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          )}
        </>
      )}

      {tab === 'bs' && (
        <>
          {sheet ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {[
                  ['Cash / accounts', sheet.cash_accounts_sum ?? sheet.accounts_total],
                  ['Receivables', sheet.receivables],
                  ['Payables', sheet.payables],
                  ['Sales total', sheet.sales_total],
                  ['Purchases total', sheet.purchases_total],
                  ['Expenses total', sheet.expenses_total],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-xl font-bold">{money(val)}</div>
                  </div>
                ))}
              </div>
              <h3 className="font-semibold mb-2">Active accounts</h3>
              <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">No</th>
                      <th className="p-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sheet.accounts || []).map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-3">{a.name}</td>
                        <td className="p-3">{a.account_no || '—'}</td>
                        <td className="p-3">{money(a.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          )}
        </>
      )}
    </ErpShell>
  );
}
