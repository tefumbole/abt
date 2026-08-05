import React from 'react';
import { PlayCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatErpDate } from '@/lib/erpFormat';
import PosModal from './PosModal';
import { cartGrandTotal } from './posDocs';

/** Suspended carts stored in localStorage — resume or discard. */
export default function HeldSalesModal({ holds, money, dateFormat, onResume, onDelete, onClose }) {
  return (
    <PosModal
      title="Held sales"
      subtitle={`${holds.length} suspended cart${holds.length === 1 ? '' : 's'} on this device`}
      size="lg"
      onClose={onClose}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {!holds.length ? (
        <p className="py-8 text-center text-slate-400 text-sm">No held sales.</p>
      ) : (
        <ul className="divide-y">
          {holds.map((hold) => {
            const items = hold.payload?.items || [];
            return (
              <li key={hold.id} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{hold.label}</div>
                  <div className="text-xs text-slate-500">
                    {formatErpDate(hold.created_at, dateFormat, { withTime: true })}
                    {' · '}
                    {items.length} line{items.length === 1 ? '' : 's'}
                    {' · '}
                    {money(cartGrandTotal(hold.payload || {}))}
                  </div>
                </div>
                <Button size="sm" className="bg-[#003D82]" onClick={() => onResume(hold)}>
                  <PlayCircle className="h-4 w-4 mr-1" /> Resume
                </Button>
                <Button size="icon" variant="ghost" title="Delete" onClick={() => onDelete(hold.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </PosModal>
  );
}
