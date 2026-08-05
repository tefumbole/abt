import React from 'react';
import { Loader2, Lock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { num, payingMethodLabel } from '@/lib/erpFormat';
import PosModal from './PosModal';

/** Cash-drawer report shown before a register is closed. */
export default function RegisterCloseModal({
  register, summary, loading, closing, money, onPrint, onConfirm, onClose,
}) {
  const openingFloat = num(register?.cash_in_hand);
  const row = (label, value, strong) => (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? 'font-bold text-[#003D82]' : 'font-medium'}>{value}</span>
    </div>
  );

  return (
    <PosModal
      title="Close cash register"
      subtitle={register?.warehouse_name || ''}
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={closing}>Cancel</Button>
          <Button variant="outline" onClick={onPrint} disabled={loading}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button className="bg-[#003D82]" onClick={onConfirm} disabled={closing}>
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4 mr-1" /> Confirm close</>}
          </Button>
        </>
      )}
    >
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
      ) : (
        <>
          <div className="rounded-xl border bg-slate-50 p-3">
            {row('Opening float', money(openingFloat))}
            {row('Sales count', String(num(summary?.sales_count, 0)))}
            {row('Total sales', money(summary?.total_sales))}
            {row('Total received', money(summary?.total_paid))}
            {row('Expected cash in drawer', money(summary?.expected_cash ?? openingFloat), true)}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">By payment method</h4>
            {(summary?.by_method || []).length ? (
              <ul className="text-sm divide-y border rounded-xl">
                {summary.by_method.map((entry) => (
                  <li key={entry.paying_method} className="flex justify-between px-3 py-1.5">
                    <span>{payingMethodLabel(entry.paying_method)} <span className="text-slate-400">×{num(entry.count, 0)}</span></span>
                    <span className="font-medium">{money(entry.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                {summary ? 'No payments recorded on this register.' : 'Summary unavailable — you can still close the register.'}
              </p>
            )}
          </div>
        </>
      )}
    </PosModal>
  );
}
