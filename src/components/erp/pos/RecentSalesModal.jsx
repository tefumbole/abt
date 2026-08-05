import React from 'react';
import { Loader2, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatErpDate, PAYMENT_STATUS_META } from '@/lib/erpFormat';
import PosModal from './PosModal';

/** Last POS sales for this warehouse, with a receipt reprint action. */
export default function RecentSalesModal({
  sales, loading, money, dateFormat, reprintingId, onReprint, onRefresh, onClose,
}) {
  return (
    <PosModal
      title="Recent sales"
      subtitle="Last 15 POS sales for this warehouse"
      size="xl"
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button className="bg-[#003D82]" onClick={onClose}>Close</Button>
        </>
      )}
    >
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-2">Reference</th>
                <th className="p-2">Time</th>
                <th className="p-2">Customer</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2">Status</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const meta = PAYMENT_STATUS_META[sale.payment_status] || PAYMENT_STATUS_META.pending;
                return (
                  <tr key={sale.id} className="border-t">
                    <td className="p-2 font-medium">{sale.reference}</td>
                    <td className="p-2 text-slate-600">
                      {formatErpDate(sale.sale_date, dateFormat, { withTime: true })}
                    </td>
                    <td className="p-2 text-slate-600">{sale.customer_name || 'Walk-in Customer'}</td>
                    <td className="p-2 text-right font-medium">{money(sale.grand_total)}</td>
                    <td className="p-2">
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.className)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Reprint receipt"
                        disabled={reprintingId === sale.id}
                        onClick={() => onReprint(sale)}
                      >
                        {reprintingId === sale.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Printer className="h-4 w-4 text-[#003D82]" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!sales.length ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">No POS sales yet</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </PosModal>
  );
}
