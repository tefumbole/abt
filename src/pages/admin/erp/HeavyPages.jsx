import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createBooking, createContract, createErpLetter, createFixedAsset, createLeader,
  deleteLeader, disposeFixedAsset, listBookings, listContracts, listCustomers,
  listErpLetters, listFixedAssets, listLeaders, listProducts, listWarehouses,
  sendBookingSignLink, updateContract, updateLeader,
} from '@/services/erpService';
import ErpShell from './ErpShell';

const RENTAL_TABS = [
  { label: 'Bookings', path: '/admin/erp/rentals' },
];
const CONTRACT_TABS = [
  { label: 'Contracts', path: '/admin/erp/contracts' },
];
const ASSET_TABS = [
  { label: 'Fixed Assets', path: '/admin/erp/assets' },
  { label: 'Leaders', path: '/admin/erp/leaders' },
  { label: 'ERP Letters', path: '/admin/erp/letters' },
];

export function RentalsPage() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    warehouse_id: '', customer_id: '', product_id: '', qty: 1, net_unit_price: 0, duration_hours: 1,
    from_datetime: '', to_datetime: '', contract_type: 'standard',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [b, w, c, p] = await Promise.all([listBookings(), listWarehouses(), listCustomers(), listProducts()]);
      setRows(b); setWarehouses(w); setCustomers(c); setProducts(p);
      if (w[0] && !form.warehouse_id) setForm((f) => ({ ...f, warehouse_id: w[0].id }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <ErpShell title="ERP Rentals" subtitle="Bookings & WhatsApp signing" tabs={RENTAL_TABS}>
      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-3 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createBooking({
            warehouse_id: form.warehouse_id,
            customer_id: form.customer_id || null,
            from_datetime: form.from_datetime,
            to_datetime: form.to_datetime,
            contract_type: form.contract_type,
            items: [{
              product_id: form.product_id,
              qty: Number(form.qty),
              net_unit_price: Number(form.net_unit_price),
              duration_hours: Number(form.duration_hours),
            }],
          });
          toast.success('Booking created'); load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div><Label>Warehouse</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><Label>Customer</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">—</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>Product</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.product_id} onChange={(e) => {
            const p = products.find((x) => x.id === e.target.value);
            setForm({ ...form, product_id: e.target.value, net_unit_price: p?.price || 0 });
          }} required>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label>From</Label><Input type="datetime-local" value={form.from_datetime} onChange={(e) => setForm({ ...form, from_datetime: e.target.value })} required /></div>
        <div><Label>To</Label><Input type="datetime-local" value={form.to_datetime} onChange={(e) => setForm({ ...form, to_datetime: e.target.value })} required /></div>
        <div><Label>Duration (hrs)</Label><Input type="number" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} /></div>
        <div className="md:col-span-3"><Button type="submit">Create booking</Button></div>
      </form>
      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Customer</th><th className="p-3">Status</th>
              <th className="p-3">Total</th><th className="p-3">Sign</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.customer_name || '—'}</td>
                  <td className="p-3">{r.booking_status}</td>
                  <td className="p-3">{Number(r.grand_total).toFixed(2)}</td>
                  <td className="p-3">{r.signature_status}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const res = await sendBookingSignLink(r.id);
                        toast.success(res.link || 'Sent');
                      } catch (e) { toast.error(e.message); }
                    }}>WA sign</Button>
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
    <ErpShell title="ERP Contracts" subtitle="General contract pipeline" tabs={CONTRACT_TABS}>
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
    <ErpShell title="ERP Letters" subtitle="General letters (separate from HR Letters)" tabs={ASSET_TABS}>
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
    <ErpShell title="Fixed Assets" subtitle="Asset register" tabs={ASSET_TABS}>
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
    <ErpShell title="Leaders" subtitle="Optional leaders list (can link to Members)" tabs={ASSET_TABS}>
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
