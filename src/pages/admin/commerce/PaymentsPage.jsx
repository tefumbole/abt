import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Plus, Trash2, Send, Wallet } from 'lucide-react';
import { paymentService, formatXaf, money } from '@/services/commerceService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const TABS = [
  { id: 'awaiting', label: 'Awaiting Payment', all: true },
  { id: 'momo', label: 'Momo Payments', finance: true },
  { id: 'withdrawals', label: 'Withdrawals', finance: true },
  { id: 'deposits', label: 'Deposits', all: true },
];

function Tone({ tone, children }) {
  const variant = tone === 'ok' ? 'success' : tone === 'wait' ? 'warning' : tone === 'no' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{children}</Badge>;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState({ financeAdmin: false });
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(true);
  const visibleTabs = TABS.filter((t) => t.all || me.financeAdmin);
  const tab = visibleTabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'awaiting';

  useEffect(() => {
    paymentService.me().then(setMe).catch(() => {});
    paymentService.wallet().then((r) => setWallet(r.total || '')).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wallet) {
      paymentService.walletLive().then((r) => setWallet(r.total || '')).catch(() => {});
    }
  }, [tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#003D82]">Payments</h1>
          <p className="text-gray-500">Awaiting sales, Campay deposits, and withdrawals.</p>
        </div>
        {wallet && (
          <div className="flex items-center gap-2 rounded-full bg-[#003D82] text-white px-4 py-2 text-sm">
            <Wallet className="w-4 h-4 text-[#D4AF37]" /> {wallet}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams({ tab: t.id })}
            className={`px-4 py-2 rounded-full text-sm font-medium ${tab === t.id ? 'bg-[#003D82] text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'awaiting' && <AwaitingTab toast={toast} setLoading={setLoading} loading={loading} finance={me.financeAdmin} />}
      {tab === 'momo' && me.financeAdmin && <MomoTab toast={toast} />}
      {tab === 'withdrawals' && me.financeAdmin && <WithdrawalsTab toast={toast} />}
      {tab === 'deposits' && <DepositsTab toast={toast} finance={me.financeAdmin} />}
    </div>
  );
}

function AwaitingTab({ toast, finance }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setRows((await paymentService.awaiting()).data || []); }
    catch (err) { toast({ title: 'Load failed', description: err.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {finance && (
          <div className="flex gap-2">
            <Button className="bg-[#003D82]" disabled={!selected.length} onClick={async () => {
              try {
                const r = await paymentService.requestPayment(selected);
                toast({ title: `Requested ${r.sent} payment(s)`, description: r.errors?.join('\n') });
              } catch (err) { toast({ title: 'Request failed', description: err.message, variant: 'destructive' }); }
            }}><Send className="w-4 h-4 mr-2" /> Request for payment</Button>
            <Button variant="outline" className="text-red-600" disabled={!selected.length} onClick={async () => {
              if (!window.confirm('Delete selected unpaid sales?')) return;
              try { await paymentService.deleteAwaiting(selected); setSelected([]); load(); }
              catch (err) { toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }); }
            }}><Trash2 className="w-4 h-4 mr-2" /> Delete selected</Button>
          </div>
        )}
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-[#003D82]" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Customer Name</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} /></TableCell>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell className="font-mono text-sm">{r.order_id}</TableCell>
                  <TableCell>{r.phone || '—'}</TableCell>
                  <TableCell>{money(r.amount)}</TableCell>
                  <TableCell>{money(r.paid_amount)}</TableCell>
                  <TableCell>{money(r.due)}</TableCell>
                  <TableCell><Tone tone={r.status?.tone}>{r.status?.label}</Tone></TableCell>
                  <TableCell className="text-sm text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">No unpaid sales.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MomoTab({ toast }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    paymentService.momo().then((r) => setRows(r.data || [])).catch((err) => toast({ title: err.message, variant: 'destructive' }));
  }, []);
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.type}-${r.id}`}>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.person || '—'}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>{formatXaf(r.amount)}</TableCell>
                <TableCell><Tone tone={r.tone}>{r.tone === 'ok' ? 'Paid' : r.tone === 'wait' ? 'Pending' : 'Not paid'}</Tone></TableCell>
                <TableCell>{r.note || '—'}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">No Campay movements yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WithdrawalsTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState([]);

  const load = () => paymentService.withdrawals().then((r) => setRows(r.data || [])).catch((err) => toast({ title: err.message, variant: 'destructive' }));
  useEffect(() => { load(); }, []);

  const search = async (value) => {
    setQ(value);
    if (value.length < 2) return setHits([]);
    setHits((await paymentService.searchPeople(value)).data || []);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex justify-end">
          <Button className="bg-[#003D82]" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Withdrawal</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>When</TableHead>
              <TableHead>People</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pendingEmpty = r.lines?.some((l) => l.status === 'pending' && !l.campay_reference);
              const allPaid = r.lines?.length && r.lines.every((l) => l.status === 'paid');
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {pendingEmpty && !r.lines.some((l) => l.status === 'paid') && (
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => setSelected((p) => p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id])} />
                    )}
                  </TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {r.lines?.map((l) => <div key={l.id}>{l.person_name} {formatXaf(l.amount)}</div>)}
                    </div>
                  </TableCell>
                  <TableCell>{r.note || '—'}</TableCell>
                  <TableCell><Tone tone={allPaid ? 'ok' : pendingEmpty ? 'wait' : 'no'}>{allPaid ? 'Paid' : pendingEmpty ? 'Awaiting approval' : r.status}</Tone></TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No withdrawals.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {selected.length > 0 && (
          <Button variant="outline" className="text-red-600" onClick={async () => {
            for (const id of selected) await paymentService.deleteWithdrawal(id);
            setSelected([]); load();
          }}>Delete selected</Button>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl !top-6 !translate-y-0">
            <DialogHeader><DialogTitle>New Withdrawal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Search customer or user" value={q} onChange={(e) => search(e.target.value)} />
              {hits.map((h) => (
                <button key={`${h.kind}-${h.id}`} type="button" className="block w-full text-left px-3 py-2 hover:bg-gray-50 rounded" onClick={() => {
                  setLines((p) => [...p, { name: h.name, person_name: h.name, phone: h.phone, amount: 100, customer_id: h.kind === 'customer' ? h.id : null }]);
                  setHits([]); setQ('');
                }}>{h.name} — {h.phone || 'no phone'}</button>
              ))}
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Number</TableHead><TableHead>Amount</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>{l.person_name}</TableCell>
                      <TableCell><Input value={l.phone || ''} onChange={(e) => {
                        const next = [...lines]; next[i] = { ...l, phone: e.target.value }; setLines(next);
                      }} /></TableCell>
                      <TableCell><Input type="number" value={l.amount} onChange={(e) => {
                        const next = [...lines]; next[i] = { ...l, amount: e.target.value }; setLines(next);
                      }} /></TableCell>
                      <TableCell><Button variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>Remove</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div>
                <Label>Reason</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button className="bg-[#003D82]" onClick={async () => {
                try {
                  await paymentService.createWithdrawal({ note, lines });
                  setOpen(false); setLines([]); setNote(''); load();
                  toast({ title: 'Withdrawal saved as pending. Approve and Pay is hidden until you choose to send it from Campay later.' });
                } catch (err) { toast({ title: err.message, variant: 'destructive' }); }
              }}>Save request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function DepositsTab({ toast, finance }) {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ customers: [], accounts: [] });
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', phone: '', customer_id: '', account_id: '', note: '', payment_method: 3 });

  const load = () => paymentService.deposits().then((r) => setRows(r.data || [])).catch((err) => toast({ title: err.message, variant: 'destructive' }));
  useEffect(() => {
    load();
    paymentService.lookups().then(setLookups).catch(() => {});
  }, []);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {finance && (
          <div className="flex justify-end">
            <Button className="bg-[#003D82]" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Deposit</Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Time</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount paid</TableHead>
              <TableHead>Amount received</TableHead>
              <TableHead>Charges</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.real_deposit && <input type="checkbox" checked={selected.includes(r.id)} onChange={() => setSelected((p) => p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id])} />}
                </TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.client}</TableCell>
                <TableCell>{formatXaf(r.paid)}</TableCell>
                <TableCell>{formatXaf(r.received)}</TableCell>
                <TableCell>{formatXaf(r.charges)}</TableCell>
                <TableCell>{r.method}</TableCell>
                <TableCell><Tone tone={r.tone}>{r.tone === 'ok' ? 'Paid' : r.tone === 'wait' ? 'Pending' : 'Not paid'}</Tone></TableCell>
                <TableCell>{r.note || '—'}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">No Campay deposits.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {finance && selected.length > 0 && (
          <Button variant="outline" className="text-red-600" onClick={async () => {
            await paymentService.deleteDeposits(selected); setSelected([]); load();
          }}>Delete selected</Button>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Deposit</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Client</Label>
                <select className="w-full border rounded-md h-10 px-3" value={form.customer_id} onChange={(e) => {
                  const c = lookups.customers.find((x) => x.id === e.target.value);
                  setForm({ ...form, customer_id: e.target.value, phone: c?.phone || form.phone });
                }}>
                  <option value="">Select client</option>
                  {lookups.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Account</Label>
                <select className="w-full border rounded-md h-10 px-3" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                  <option value="">Select account</option>
                  {lookups.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button className="bg-[#003D82]" onClick={async () => {
                try {
                  await paymentService.createDeposit(form);
                  setOpen(false); load();
                } catch (err) { toast({ title: err.message, variant: 'destructive' }); }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
