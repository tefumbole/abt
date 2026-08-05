import React, { useEffect, useState } from 'react';
import { Eye, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  createDelivery, deleteDelivery, getDelivery, listDeliveries, listSales,
  sendDeliverySignLink, updateDelivery,
} from '@/services/erpService';
import ErpShell from './ErpShell';

const STATUS_OPTIONS = ['packing', 'delivering', 'delivered', 'returned'];
const SIGNATURE_FILTERS = ['', 'pending', 'signed'];

export default function DeliveriesPage() {
  const [rows, setRows] = useState([]);
  const [sales, setSales] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [signatureFilter, setSignatureFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ sale_id: '', address: '', note: '' });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (signatureFilter) params.set('signature_status', signatureFilter);
      const q = params.toString() ? `?${params}` : '';
      const [d, s] = await Promise.all([listDeliveries(q), listSales()]);
      setRows(d);
      setSales(s);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, signatureFilter]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      setDetail(await getDelivery(id));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const setStatus = async (id, status) => {
    setBusyId(id);
    try {
      await updateDelivery(id, { status });
      toast.success(`Status → ${status}`);
      load();
      if (detail?.id === id) openDetail(id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Deliveries & e-signature">
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs text-slate-500 self-center mr-1">Status</span>
        {['', ...STATUS_OPTIONS].map((f) => (
          <Button key={`st-${f || 'all'}`} size="sm" variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)}>
            {f || 'All'}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-slate-500 self-center mr-1">Signature</span>
        {SIGNATURE_FILTERS.map((f) => (
          <Button key={`sg-${f || 'all'}`} size="sm" variant={signatureFilter === f ? 'default' : 'outline'} onClick={() => setSignatureFilter(f)}>
            {f || 'All'}
          </Button>
        ))}
      </div>

      <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3 mb-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await createDelivery(form);
          toast.success('Delivery created');
          setForm({ sale_id: '', address: '', note: '' });
          load();
        } catch (err) { toast.error(err.message); }
      }}>
        <div>
          <Label>Sale</Label>
          <select className="w-full border rounded-md h-10 px-2" value={form.sale_id} onChange={(e) => setForm({ ...form, sale_id: e.target.value })} required>
            <option value="">Select…</option>
            {sales.map((s) => <option key={s.id} value={s.id}>{s.reference} — {s.customer_name || 'Walk-in'}</option>)}
          </select>
        </div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Note</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        <div className="md:col-span-2"><Button type="submit">Create delivery</Button></div>
      </form>

      <div className="rounded-xl border bg-white overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Ref</th><th className="p-3">Sale</th><th className="p-3">Customer</th>
              <th className="p-3">Status</th><th className="p-3">Signature</th><th className="p-3">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.sale_reference}</td>
                  <td className="p-3">{r.customer_name || '—'}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">{r.signature_status}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {STATUS_OPTIONS.filter((st) => st !== r.status).map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant="ghost"
                          disabled={busyId === r.id}
                          onClick={() => setStatus(r.id, st)}
                        >
                          {st}
                        </Button>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => openDetail(r.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          const res = await sendDeliverySignLink(r.id);
                          toast.success(res.link || 'Sign link sent');
                        } catch (e) { toast.error(e.message); }
                      }}>WA sign link</Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm('Delete this delivery?')) return;
                        try {
                          await deleteDelivery(r.id);
                          toast.success('Deleted');
                          load();
                        } catch (e) { toast.error(e.message); }
                      }}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No deliveries</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!detail || detailLoading} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery {detail?.reference || ''}</DialogTitle>
          </DialogHeader>
          {detailLoading && !detail ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : detail ? (
            <div className="space-y-4 text-sm">
              <div className="grid sm:grid-cols-2 gap-3">
                <div><span className="text-slate-500">Sale</span><div className="font-medium">{detail.sale_reference || '—'}</div></div>
                <div><span className="text-slate-500">Customer</span><div className="font-medium">{detail.customer_name || '—'}</div></div>
                <div><span className="text-slate-500">Phone</span><div>{detail.customer_phone || '—'}</div></div>
                <div><span className="text-slate-500">Status</span><div className="font-medium">{detail.status} · {detail.signature_status}</div></div>
                <div className="sm:col-span-2"><span className="text-slate-500">Address</span><div>{detail.address || '—'}</div></div>
                {detail.note != null && detail.note !== '' && (
                  <div className="sm:col-span-2"><span className="text-slate-500">Note</span><div className="whitespace-pre-wrap">{detail.note}</div></div>
                )}
                {detail.delivered_at && (
                  <div><span className="text-slate-500">Delivered at</span><div>{detail.delivered_at}</div></div>
                )}
                {detail.signed_at && (
                  <div><span className="text-slate-500">Signed at</span><div>{detail.signed_at}</div></div>
                )}
              </div>
              {(detail.items || []).length > 0 && (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left"><tr>
                      <th className="p-2">Product</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Subtotal</th>
                    </tr></thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2">{it.product_name || it.product_code || '—'}</td>
                          <td className="p-2 text-right">{it.qty}</td>
                          <td className="p-2 text-right">{Number(it.subtotal || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((st) => (
                  <Button key={st} size="sm" variant={detail.status === st ? 'default' : 'outline'} onClick={() => setStatus(detail.id, st)}>
                    {st}
                  </Button>
                ))}
              </div>
              <form className="space-y-2 border-t pt-3" onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await updateDelivery(detail.id, {
                    address: fd.get('address'),
                    note: fd.get('note'),
                    courier: fd.get('courier'),
                  });
                  toast.success('Updated');
                  openDetail(detail.id);
                  load();
                } catch (err) { toast.error(err.message); }
              }}>
                <div><Label>Address</Label><Input name="address" defaultValue={detail.address || ''} /></div>
                <div><Label>Courier</Label><Input name="courier" defaultValue={detail.courier || ''} /></div>
                <div><Label>Note</Label><Textarea name="note" rows={2} defaultValue={detail.note || ''} /></div>
                <Button type="submit" size="sm">Save details</Button>
              </form>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </ErpShell>
  );
}
