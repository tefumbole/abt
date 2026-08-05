import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createContract, createErpLetter, createFixedAsset, createLeader,
  deleteLeader, disposeFixedAsset, listContracts, listCustomers,
  listErpLetters, listFixedAssets, listLeaders, updateContract, updateLeader,
} from '@/services/erpService';
import ErpShell from './ErpShell';

export function ContractsPage() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', customer_id: '', body_html: '', status: 'draft' });

  const load = async () => {
    setLoading(true);
    try {
      const [c, cust] = await Promise.all([listContracts(), listCustomers()]);
      setRows(c); setCustomers(cust);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Contracts" subtitle="General contract pipeline">
      <form className="rounded-xl border bg-white p-4 space-y-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createContract(form);
          toast.success('Contract created');
          setForm({ title: '', customer_id: '', body_html: '', status: 'draft' });
          load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><Label>Customer</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">—</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>Body</Label><Textarea rows={5} value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} /></div>
        <Button type="submit">Create contract</Button>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Title</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.title}</td>
                  <td className="p-3">{r.customer_name || '—'}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3 space-x-1">
                    {['draft', 'awaiting_client', 'awaiting_admin', 'signed'].map((st) => (
                      <Button key={st} size="sm" variant="ghost" onClick={async () => {
                        try { await updateContract(r.id, { status: st }); load(); }
                        catch (e) { toast.error(e.message); }
                      }}>{st}</Button>
                    ))}
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

export function ErpLettersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: '', body_html: '', recipient_name: '', recipient_phone: '' });

  const load = async () => {
    setLoading(true);
    try { setRows(await listErpLetters()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Letters" subtitle="General letters (separate from HR Letters)">
      <form className="rounded-xl border bg-white p-4 space-y-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try { await createErpLetter(form); toast.success('Letter saved'); load(); }
        catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></div>
        <div><Label>Recipient</Label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.recipient_phone} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} /></div>
        <div><Label>Body</Label><Textarea rows={5} value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} /></div>
        <Button type="submit">Save letter</Button>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Subject</th><th className="p-3">Recipient</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.subject}</td>
                  <td className="p-3">{r.recipient_name || '—'}</td>
                  <td className="p-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ErpShell>
  );
}

export function FixedAssetsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', purchase_cost: 0, book_value: 0, purchase_date: '', note: '' });

  const load = async () => {
    setLoading(true);
    try { setRows(await listFixedAssets()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="Fixed Assets" subtitle="Asset register">
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createFixedAsset({
            ...form,
            purchase_cost: Number(form.purchase_cost),
            book_value: Number(form.book_value || form.purchase_cost),
          });
          toast.success('Asset added'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><Label>Purchase cost</Label><Input type="number" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} /></div>
        <div><Label>Book value</Label><Input type="number" value={form.book_value} onChange={(e) => setForm({ ...form, book_value: e.target.value })} /></div>
        <div><Label>Purchase date</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
        <div className="md:col-span-2"><Button type="submit">Add asset</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Name</th><th className="p-3">Cost</th><th className="p-3">Book</th><th className="p-3">Status</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{Number(r.purchase_cost).toFixed(2)}</td>
                  <td className="p-3">{Number(r.book_value).toFixed(2)}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">
                    {r.status !== 'disposed' && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try { await disposeFixedAsset(r.id); toast.success('Disposed'); load(); }
                        catch (e) { toast.error(e.message); }
                      }}>Dispose</Button>
                    )}
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

export function LeadersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', title: '', bio: '', photo_url: '', sort_order: 0 });

  const load = async () => {
    setLoading(true);
    try { setRows(await listLeaders()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="Leaders" subtitle="Optional leaders list (can link to Members)">
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createLeader({ ...form, sort_order: Number(form.sort_order) });
          toast.success('Leader added'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
        <div><Label>Photo URL</Label><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} /></div>
        <div><Label>Sort</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
        <div className="md:col-span-2"><Button type="submit">Add leader</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Name</th><th className="p-3">Title</th><th className="p-3">Order</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">{r.title || '—'}</td>
                  <td className="p-3">{r.sort_order}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { await updateLeader(r.id, { is_active: !r.is_active }); load(); }
                      catch (e) { toast.error(e.message); }
                    }}>{r.is_active ? 'Deactivate' : 'Activate'}</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('Delete?')) return;
                      try { await deleteLeader(r.id); load(); }
                      catch (e) { toast.error(e.message); }
                    }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
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
