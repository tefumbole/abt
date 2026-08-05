import React, { useEffect, useState } from 'react';
import { Download, Loader2, Pencil, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PAYMENT_STATUS_META, formatErpDate, makeMoney, num } from '@/lib/erpFormat';
import {
  BOOKING_STATUS_META, REVIEW_STATUS_META, SIGNATURE_STATUS_META,
  bookingLineSubtotal, bookingMethodLabel, durationUnitLabel, normaliseBookingMethod, statusMeta,
} from '@/lib/rentalFormat';
import { DOCUMENT_STYLES, buildDocumentHtml, loadErpCompany } from '@/lib/erpDocuments';
import { downloadHtmlPdf, openPrintWindow } from '@/lib/erpExport';
import { getBooking } from '@/services/erpService';

/** "12-05-2026 08:00 → 14-05-2026 17:00" */
export function bookingPeriod(booking, dateFormat = 'd-m-Y') {
  const from = formatErpDate(booking?.from_datetime, dateFormat, { withTime: true });
  const to = formatErpDate(booking?.to_datetime, dateFormat, { withTime: true });
  if (!from && !to) return '';
  return `${from || '—'} → ${to || '—'}`;
}

/** CC entries may arrive as plain strings or as `{ name, email, phone }` rows. */
export function ccLabel(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return entry.email || entry.phone || entry.name || '';
}

export function bookingItemsSubtotal(items = []) {
  return items.reduce((sum, line) => sum + bookingLineSubtotal(line), 0);
}

/** Shapes a booking for the shared ERP document builder. */
export function bookingToDocument(booking = {}, dateFormat = 'd-m-Y') {
  const signature = statusMeta(SIGNATURE_STATUS_META, booking.signature_status, 'none');
  const review = statusMeta(REVIEW_STATUS_META, booking.review_status, 'none');
  const noteLines = [
    `Rental period: ${bookingPeriod(booking, dateFormat) || '—'}`,
    `Signature: ${signature.label} · Review: ${review.label}`,
    booking.contract_type ? `Contract: ${booking.contract_type}` : '',
    booking.note || '',
  ].filter(Boolean);

  return {
    reference: booking.reference,
    date: booking.from_datetime || booking.created_at,
    status_label: statusMeta(BOOKING_STATUS_META, booking.booking_status, 'pending').label,
    warehouse_name: booking.warehouse_name,
    biller_name: booking.biller_name,
    customer: {
      name: booking.customer_name,
      company_name: booking.customer_company,
      phone: booking.customer_phone,
      email: booking.customer_email,
      address: booking.customer_address,
    },
    items: (booking.items || []).map((line) => ({
      product_name: [
        line.product_name || '',
        normaliseBookingMethod(line.booking_method) === 'flat'
          ? bookingMethodLabel(line.booking_method)
          : `${bookingMethodLabel(line.booking_method)} × ${num(line.duration_hours, 1) || 1} ${durationUnitLabel(line.booking_method)}`,
      ].filter(Boolean).join(' — '),
      product_code: line.product_code,
      qty: line.qty,
      net_unit_price: line.net_unit_price,
      discount: line.discount,
      tax: line.tax,
      subtotal: bookingLineSubtotal(line),
    })),
    discount: booking.order_discount,
    tax: booking.order_tax,
    shipping: booking.shipping,
    grand_total: booking.grand_total,
  };
}

export async function buildBookingSheetHtml(booking, dateFormat = 'd-m-Y') {
  const company = await loadErpCompany();
  return buildDocumentHtml({
    kind: 'booking',
    doc: bookingToDocument(booking, company.dateFormat || dateFormat),
    company,
  });
}

export async function printBookingSheet(booking, dateFormat = 'd-m-Y') {
  const html = await buildBookingSheetHtml(booking, dateFormat);
  openPrintWindow(html, {
    title: `Booking ${booking?.reference || ''}`,
    styles: DOCUMENT_STYLES,
  });
}

export async function downloadBookingSheet(booking, dateFormat = 'd-m-Y') {
  const html = await buildBookingSheetHtml(booking, dateFormat);
  await downloadHtmlPdf(html, {
    filename: `booking-${booking?.reference || booking?.id || 'sheet'}.pdf`,
    styles: DOCUMENT_STYLES,
  });
}

function Field({ label, children }) {
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800">{children || '—'}</div>
    </div>
  );
}

function TotalRow({ label, value, negative = false, strong = false }) {
  return (
    <div className={cn('flex justify-between text-sm', strong && 'border-t pt-2 text-base font-bold text-[#003D82]')}>
      <span className={strong ? '' : 'text-slate-600'}>{label}</span>
      <span>{negative ? `- ${value}` : value}</span>
    </div>
  );
}

/** Read-only booking sheet for a single rental booking, with print / PDF / edit actions. */
export default function BookingDetailsModal({
  bookingId,
  money,
  dateFormat = 'd-m-Y',
  onClose,
  onEdit,
}) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const fmtMoney = money || makeMoney({});

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await getBooking(bookingId);
        if (alive) setBooking(data || null);
      } catch (err) {
        if (alive) setError(err.message || 'This booking could not be loaded.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bookingId]);

  const runDocument = async (kind) => {
    if (!booking) return;
    setBusy(kind);
    try {
      if (kind === 'print') await printBookingSheet(booking, dateFormat);
      else await downloadBookingSheet(booking, dateFormat);
    } catch (err) {
      toast.error(err.message || 'The booking sheet could not be produced.');
    } finally {
      setBusy('');
    }
  };

  const items = booking?.items || [];
  const cc = (booking?.cc_recipients || []).map(ccLabel).filter(Boolean);
  const bookingMeta = statusMeta(BOOKING_STATUS_META, booking?.booking_status, 'pending');
  const signMeta = statusMeta(SIGNATURE_STATUS_META, booking?.signature_status, 'none');
  const reviewMeta = statusMeta(REVIEW_STATUS_META, booking?.review_status, 'none');
  const payMeta = booking?.payment_status
    ? (PAYMENT_STATUS_META[booking.payment_status] || PAYMENT_STATUS_META.pending)
    : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#003D82]">Booking Details</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#003D82]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && booking && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-slate-50 p-4">
              <div>
                <div className="text-lg font-bold text-[#003D82]">{booking.reference || `#${booking.id}`}</div>
                <div className="text-sm text-slate-600">
                  Created {formatErpDate(booking.created_at, dateFormat, { withTime: true }) || '—'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn('border', bookingMeta.className)}>{bookingMeta.label}</Badge>
                <Badge variant="outline" className={cn('border', signMeta.className)}>{signMeta.label}</Badge>
                <Badge variant="outline" className={cn('border', reviewMeta.className)}>{reviewMeta.label}</Badge>
                {payMeta && (
                  <Badge variant="outline" className={cn('border', payMeta.className)}>{payMeta.label}</Badge>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 rounded-lg border p-4">
                <div className="text-sm font-semibold text-[#003D82]">Customer</div>
                <Field label="Name">{booking.customer_name}</Field>
                <Field label="Phone">{booking.customer_phone}</Field>
                <Field label="Email">{booking.customer_email}</Field>
                <Field label="Address">{booking.customer_address}</Field>
                <Field label="Company">{booking.customer_company}</Field>
              </div>

              <div className="space-y-2 rounded-lg border p-4">
                <div className="text-sm font-semibold text-[#003D82]">Booking Info</div>
                <Field label="Warehouse">{booking.warehouse_name}</Field>
                <Field label="Biller">{booking.biller_name}</Field>
                <Field label="Period">{bookingPeriod(booking, dateFormat)}</Field>
                <Field label="Contract Type">{booking.contract_type}</Field>
                <Field label="Last Reminder">
                  {booking.reminder_sent_at
                    ? formatErpDate(booking.reminder_sent_at, dateFormat, { withTime: true })
                    : 'Never'}
                </Field>
              </div>

              <div className="space-y-2 rounded-lg border p-4 sm:col-span-2 lg:col-span-1">
                <div className="text-sm font-semibold text-[#003D82]">Totals</div>
                <TotalRow label="Lines Subtotal" value={fmtMoney(bookingItemsSubtotal(items))} />
                <TotalRow label="Order Tax" value={fmtMoney(booking.order_tax)} />
                <TotalRow label="Order Discount" value={fmtMoney(booking.order_discount)} negative />
                <TotalRow label="Shipping" value={fmtMoney(booking.shipping)} />
                <TotalRow label="Grand Total" value={fmtMoney(booking.grand_total)} strong />
              </div>
            </div>

            {cc.length > 0 && (
              <div className="rounded-lg border p-4">
                <div className="mb-2 text-sm font-semibold text-[#003D82]">CC Recipients</div>
                <div className="flex flex-wrap gap-2">
                  {cc.map((entry, index) => (
                    <Badge key={`${entry}-${index}`} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {entry}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="p-2 w-10">#</th>
                    <th className="p-2">Product</th>
                    <th className="p-2">Code</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Number</th>
                    <th className="p-2">Batch</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Duration</th>
                    <th className="p-2 text-right">Discount</th>
                    <th className="p-2 text-right">Tax</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-slate-500">No items on this booking</td>
                    </tr>
                  )}
                  {items.map((line, index) => (
                    <tr key={line.id || `${line.product_code || line.product_name || 'line'}-${index}`} className="border-t">
                      <td className="p-2 text-slate-500">{index + 1}</td>
                      <td className="p-2 font-medium">
                        {line.product_name || '—'}
                        {(line.from_datetime || line.to_datetime) && (
                          <div className="text-xs font-normal text-slate-400">{bookingPeriod(line, dateFormat)}</div>
                        )}
                      </td>
                      <td className="p-2 text-slate-500">{line.product_code || '—'}</td>
                      <td className="p-2 text-right">{num(line.qty)}</td>
                      <td className="p-2 whitespace-nowrap">{bookingMethodLabel(line.booking_method)}</td>
                      <td className="p-2">{line.number || '—'}</td>
                      <td className="p-2">{line.batch_no || '—'}</td>
                      <td className="p-2 text-right">{fmtMoney(line.net_unit_price)}</td>
                      <td className="p-2 text-right">
                        {normaliseBookingMethod(line.booking_method) === 'flat'
                          ? '—'
                          : `${num(line.duration_hours, 1) || 1} ${durationUnitLabel(line.booking_method)}`}
                      </td>
                      <td className="p-2 text-right">{fmtMoney(line.discount)}</td>
                      <td className="p-2 text-right">{fmtMoney(line.tax)}</td>
                      <td className="p-2 text-right font-medium">
                        {fmtMoney(line.subtotal ?? bookingLineSubtotal(line))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {booking.note ? (
              <div className="rounded-lg border bg-amber-50/60 p-3 text-sm">
                <span className="font-semibold text-[#003D82]">Note: </span>
                <span className="whitespace-pre-wrap">{booking.note}</span>
              </div>
            ) : null}

            {booking.staff_note ? (
              <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                <span className="font-semibold text-[#003D82]">Staff Note: </span>
                <span className="whitespace-pre-wrap">{booking.staff_note}</span>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={!booking || busy === 'print'} onClick={() => runDocument('print')}>
            {busy === 'print'
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Printer className="h-4 w-4 mr-2" />}
            Print
          </Button>
          <Button type="button" variant="outline" disabled={!booking || busy === 'pdf'} onClick={() => runDocument('pdf')}>
            {busy === 'pdf'
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Download className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
          <Button
            type="button"
            className="bg-[#D4AF37] text-[#003D82] hover:bg-[#c19f2f]"
            disabled={!booking}
            onClick={() => onEdit?.(booking?.id ?? bookingId)}
          >
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
