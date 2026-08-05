import React from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PosModal from './PosModal';

/** Post-checkout summary with the reference, the change owed and print actions. */
export default function SaleCompleteModal({ sale, money, onPrint, onNewSale }) {
  const row = (label, value, strong) => (
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? 'font-bold text-[#003D82]' : 'font-medium'}>{value}</span>
    </div>
  );

  return (
    <PosModal
      title="Sale completed"
      subtitle={sale.reference}
      onClose={onNewSale}
      footer={(
        <>
          <Button variant="outline" onClick={onPrint}>
            <Printer className="h-4 w-4 mr-1" /> Print receipt
          </Button>
          <Button className="bg-[#003D82]" onClick={onNewSale}>New sale</Button>
        </>
      )}
    >
      <div className="flex items-center gap-3 text-emerald-700">
        <CheckCircle2 className="h-9 w-9" />
        <div>
          <div className="font-semibold">Payment recorded</div>
          <div className="text-xs text-slate-500">{sale.payment_status_label}</div>
        </div>
      </div>
      <div className="rounded-xl border bg-slate-50 p-3 space-y-1.5">
        {row('Reference', sale.reference)}
        {row('Grand total', money(sale.grand_total), true)}
        {row('Paid', money(sale.paid_amount))}
        {row('Change', money(sale.change_amount))}
        {row('Method', sale.method_label)}
      </div>
    </PosModal>
  );
}
