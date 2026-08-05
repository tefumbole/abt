import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  PAYING_METHODS, formatErpDate, num, payingMethodLabel, toDateTimeLocal, toMysqlDateTime,
} from '@/lib/erpFormat';
import { createSalePayment, deleteSalePayment, listSalePayments } from '@/services/erpService';

const SELECT_CLASS = 'w-full border rounded-md h-10 px-2 mt-1 text-sm bg-white';

/** Records a payment against an outstanding sale. */
export function AddPaymentModal({ sale, money, onClose, onSaved }) {
  const due = Math.max(0, num(sale?.due_amount ?? num(sale?.grand_total) - num(sale?.paid_amount)));
  const [form, setForm] = useState({
    amount: due,
    paying_method: 'cash',
    note: '',
    paid_at: toDateTimeLocal(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, amount: due, paid_at: toDateTimeLocal() }));
  }, [sale?.id, due]);

  if (!sale) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (num(form.amount) <= 0) return toast.error('Amount must be greater than zero');
    setSaving(true);
    try {
      await createSalePayment(sale.id, {
        amount: num(form.amount),
        paying_method: form.paying_method,
        note: form.note || null,
        paid_at: toMysqlDateTime(form.paid_at),
      });
      toast.success('Payment recorded');
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#003D82]">Add Payment — {sale.reference}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-slate-50 p-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Grand Total</div>
              <div className="font-semibold">{money(sale.grand_total)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Paid</div>
              <div className="font-semibold">{money(sale.paid_amount)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Due</div>
              <div className="font-semibold text-rose-600">{money(due)}</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number" step="0.01" min="0.01" className="mt-1" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Paying Method</Label>
              <select
                className={SELECT_CLASS}
                value={form.paying_method}
                onChange={(e) => setForm({ ...form, paying_method: e.target.value })}
              >
                {PAYING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Date</Label>
              <Input
                type="datetime-local" className="mt-1" value={form.paid_at}
                onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Payment Note</Label>
              <Textarea
                rows={3} className="mt-1" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lists the payments already recorded on a sale, with per-row delete. */
export function ViewPaymentsModal({ sale, money, dateFormat = 'd-m-Y', onClose, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!sale?.id) return;
    setLoading(true);
    try {
      setRows((await listSalePayments(sale.id)) || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sale?.id]);

  if (!sale) return null;

  const remove = async (payment) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await deleteSalePayment(sale.id, payment.id);
      toast.success('Payment deleted');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#003D82]">Payments — {sale.reference}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[#003D82]" /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Reference</th>
                  <th className="p-2">Method</th>
                  <th className="p-2">Note</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No payments recorded</td></tr>
                )}
                {rows.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{formatErpDate(p.paid_at || p.created_at, dateFormat)}</td>
                    <td className="p-2">{p.reference || '—'}</td>
                    <td className="p-2">{payingMethodLabel(p.paying_method)}</td>
                    <td className="p-2 max-w-[220px] truncate">{p.note || '—'}</td>
                    <td className="p-2 text-right font-medium">{money(p.amount)}</td>
                    <td className="p-2">
                      <Button type="button" size="icon" variant="ghost" title="Delete payment" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end border-t pt-4">
          <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
