import React from 'react';
import { Download, Pencil, Printer, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  PAYMENT_STATUS_META, SALE_STATUS_META, formatErpDate, num, payingMethodLabel,
} from '@/lib/erpFormat';

function Field({ label, children }) {
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800">{children || '—'}</div>
    </div>
  );
}

/** Read-only invoice view for a single sale, with print / PDF / payment actions. */
export default function SaleDetailsModal({
  sale,
  money,
  dateFormat = 'd-m-Y',
  onClose,
  onPrint,
  onDownload,
  onAddPayment,
  onEdit,
}) {
  if (!sale) return null;

  const items = sale.items || [];
  const payments = sale.payments || [];
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + num(item.subtotal ?? num(item.qty) * num(item.net_unit_price)),
    0
  );
  const due = num(sale.due_amount ?? num(sale.grand_total) - num(sale.paid_amount));
  const saleMeta = SALE_STATUS_META[sale.sale_status] || SALE_STATUS_META.draft;
  const payMeta = PAYMENT_STATUS_META[sale.payment_status] || PAYMENT_STATUS_META.pending;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#003D82]">Sale Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-slate-50 p-4">
            <div>
              <div className="text-lg font-bold text-[#003D82]">{sale.reference}</div>
              <div className="text-sm text-slate-600">
                {formatErpDate(sale.sale_date || sale.created_at, dateFormat, { withTime: true })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn('border', saleMeta.className)}>{saleMeta.label}</Badge>
              <Badge variant="outline" className={cn('border', payMeta.className)}>{payMeta.label}</Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 rounded-lg border p-4">
              <div className="text-sm font-semibold text-[#003D82]">Customer</div>
              <Field label="Name">{sale.customer_name}</Field>
              <Field label="Phone">{sale.customer_phone}</Field>
              <Field label="Email">{sale.customer_email}</Field>
              <Field label="Address">{sale.customer_address}</Field>
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <div className="text-sm font-semibold text-[#003D82]">Sale Info</div>
              <Field label="Warehouse">{sale.warehouse_name}</Field>
              <Field label="Biller">{sale.biller_name}</Field>
              <Field label="Sale Status">{saleMeta.label}</Field>
              <Field label="Payment Status">{payMeta.label}</Field>
            </div>
            <div className="space-y-2 rounded-lg border p-4 sm:col-span-2 lg:col-span-1">
              <div className="text-sm font-semibold text-[#003D82]">Totals</div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Items Subtotal</span><span>{money(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Order Discount</span><span>- {money(sale.discount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Order Tax</span><span>{money(sale.tax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Shipping</span><span>{money(sale.shipping)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-[#003D82]">
                <span>Grand Total</span><span>{money(sale.grand_total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Paid</span><span>{money(sale.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-rose-600">
                <span>Due</span><span>{money(due > 0 ? due : 0)}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-2 w-10">#</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Code</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Unit Price</th>
                  <th className="p-2 text-right">Discount</th>
                  <th className="p-2 text-right">Tax</th>
                  <th className="p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500">No items on this sale</td></tr>
                )}
                {items.map((item, index) => (
                  <tr key={item.id || `${item.product_id}-${index}`} className="border-t">
                    <td className="p-2 text-slate-500">{index + 1}</td>
                    <td className="p-2 font-medium">{item.product_name || '—'}</td>
                    <td className="p-2 text-slate-500">{item.product_code || '—'}</td>
                    <td className="p-2 text-right">{num(item.qty)}</td>
                    <td className="p-2 text-right">{money(item.net_unit_price)}</td>
                    <td className="p-2 text-right">{money(item.discount)}</td>
                    <td className="p-2 text-right">{money(item.tax)}</td>
                    <td className="p-2 text-right font-medium">
                      {money(item.subtotal ?? num(item.qty) * num(item.net_unit_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-[#003D82]">Payments</div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Reference</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Note</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">No payments recorded</td></tr>
                  )}
                  {payments.map((p) => (
                    <tr key={p.id || p.reference} className="border-t">
                      <td className="p-2 whitespace-nowrap">{formatErpDate(p.paid_at || p.created_at, dateFormat)}</td>
                      <td className="p-2">{p.reference || '—'}</td>
                      <td className="p-2">{payingMethodLabel(p.paying_method)}</td>
                      <td className="p-2 max-w-[220px] truncate">{p.note || '—'}</td>
                      <td className="p-2 text-right font-medium">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {sale.note ? (
            <div className="rounded-lg border bg-amber-50/60 p-3 text-sm">
              <span className="font-semibold text-[#003D82]">Note: </span>
              <span className="whitespace-pre-wrap">{sale.note}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onPrint?.(sale)}>
            <Printer className="h-4 w-4 mr-2" /> Print Invoice
          </Button>
          <Button type="button" variant="outline" onClick={() => onDownload?.(sale)}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => onAddPayment?.(sale)}>
            <Wallet className="h-4 w-4 mr-2" /> Add Payment
          </Button>
          <Button type="button" className="bg-[#D4AF37] text-[#003D82] hover:bg-[#c19f2f]" onClick={() => onEdit?.(sale)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button type="button" className="bg-[#003D82] hover:bg-[#002855]" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
