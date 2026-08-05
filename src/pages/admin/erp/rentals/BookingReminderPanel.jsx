import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Loader2, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { bookingPeriod } from '@/components/erp/rentals/BookingDetailsModal';
import { formatErpDate, makeMoney, num } from '@/lib/erpFormat';
import { BOOKING_STATUS_META, statusMeta } from '@/lib/rentalFormat';
import { queryBookings, sendBookingReminder } from '@/services/erpService';

const REMINDER_PAGE_SIZE = 100;

/** Bookings starting soon, with one-click (or bulk) reminder sending. */
export default function BookingReminderPanel({ money, dateFormat = 'd-m-Y', onCountsChange = () => {} }) {
  const fmtMoney = useMemo(() => money || makeMoney({}), [money]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);

  // Ref keeps an inline parent callback from restarting the load effect.
  const countsCallback = useRef(onCountsChange);
  useEffect(() => { countsCallback.current = onCountsChange; }, [onCountsChange]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await queryBookings({ view: 'reminder', page: 1, per_page: REMINDER_PAGE_SIZE });
      if (!alive.current) return;
      setRows(res?.data || []);
      countsCallback.current?.(res?.counts || {});
    } catch (err) {
      if (!alive.current) return;
      setRows([]);
      setError(err.message || 'Reminders could not be loaded.');
      toast.error(err.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendOne = async (row) => {
    setSendingId(row.id);
    try {
      await sendBookingReminder(row.id, {});
      toast.success(`Reminder sent to ${row.customer_name || 'the customer'}`);
      await load();
    } catch (err) {
      toast.error(err.message || 'The reminder could not be sent.');
    } finally {
      if (alive.current) setSendingId(null);
    }
  };

  const sendAll = async () => {
    if (!rows.length) return;
    if (!window.confirm(`Send a reminder for all ${rows.length} listed booking(s)?`)) return;
    setSendingAll(true);
    let ok = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        // Sequential so the WhatsApp/SMS gateway is not flooded with parallel sends.
        await sendBookingReminder(row.id, {});
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    if (ok) toast.success(`${ok} reminder(s) sent`);
    if (failed) toast.error(`${failed} reminder(s) failed`);
    if (alive.current) setSendingAll(false);
    await load();
  };

  const busy = sendingAll || sendingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#003D82]">Booking Reminder</h2>
          <p className="text-sm text-slate-500">Bookings starting soon that may still need a nudge.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading || busy}>
            <RotateCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#D4AF37] text-[#003D82] hover:bg-[#c19f2f]"
            onClick={sendAll}
            disabled={busy || loading || rows.length === 0}
          >
            {sendingAll
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <BellRing className="h-4 w-4 mr-1" />}
            Send to all listed ({rows.length})
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#003D82]" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-3">Reference</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Reminder</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={8} className="p-10 text-center">
                    <div className="text-rose-600">{error}</div>
                    <Button type="button" size="sm" variant="outline" className="mt-3" onClick={load}>
                      Try again
                    </Button>
                  </td>
                </tr>
              )}
              {!error && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    No bookings need a reminder right now.
                  </td>
                </tr>
              )}
              {!error && rows.map((row) => {
                const badge = statusMeta(BOOKING_STATUS_META, row.booking_status, 'pending');
                return (
                  <tr key={row.id} className="border-t hover:bg-slate-50/80">
                    <td className="p-3 font-medium text-[#003D82] whitespace-nowrap">{row.reference || `#${row.id}`}</td>
                    <td className="p-3">{row.customer_name || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{row.customer_phone || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{bookingPeriod(row, dateFormat) || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={cn('border whitespace-nowrap', badge.className)}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {row.reminder_sent_at
                        ? formatErpDate(row.reminder_sent_at, dateFormat, { withTime: true })
                        : <span className="text-slate-400">Never</span>}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">{fmtMoney(num(row.grand_total))}</td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#003D82] hover:bg-[#002855]"
                        disabled={busy}
                        onClick={() => sendOne(row)}
                      >
                        {sendingId === row.id
                          ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          : <Send className="h-4 w-4 mr-1" />}
                        Send Reminder
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
