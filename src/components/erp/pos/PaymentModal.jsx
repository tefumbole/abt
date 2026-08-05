import React from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { num, PAYING_METHODS } from '@/lib/erpFormat';

export const MAX_PAYMENT_ROWS = 3;

export function paymentTotals(rows = [], grandTotal = 0) {
  const tendered = rows.reduce((sum, row) => sum + num(row.amount), 0);
  return {
    tendered,
    remaining: Math.max(0, num(grandTotal) - tendered),
    change: Math.max(0, tendered - num(grandTotal)),
  };
}

/** Finalize dialog with up to three payment lines (split payment). */
export default function PaymentModal({
  title,
  grandTotal,
  money,
  rows,
  onRowsChange,
  note,
  onNoteChange,
  paying,
  onClose,
  onSubmit,
}) {
  const { tendered, remaining, change } = paymentTotals(rows, grandTotal);

  const patchRow = (index, patch) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    if (rows.length >= MAX_PAYMENT_ROWS) return;
    const used = new Set(rows.map((r) => r.method));
    const nextMethod = PAYING_METHODS.find((m) => !used.has(m.value))?.value || 'cash';
    onRowsChange([...rows, {
      id: `row-${Date.now()}`,
      method: nextMethod,
      amount: remaining ? remaining.toFixed(2) : '',
    }]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    onRowsChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="px-5 pt-5 pb-3 border-b">
          <h3 className="text-lg font-bold text-[#003D82]">Finalize — {title}</h3>
          <p className="text-sm text-slate-600 mt-1">
            Grand total: <strong className="text-[#003D82]">{money(grandTotal)}</strong>
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-auto">
          {rows.map((row, index) => (
            <div key={row.id || index} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                {index === 0 ? <Label className="text-xs">Method</Label> : null}
                <select
                  className="border rounded-md h-10 px-2 bg-white text-sm w-full"
                  value={row.method}
                  onChange={(e) => patchRow(index, { method: e.target.value })}
                >
                  {PAYING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="w-36 space-y-1">
                {index === 0 ? <Label className="text-xs">Amount</Label> : null}
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  placeholder="0.00"
                  onChange={(e) => patchRow(index, { amount: e.target.value })}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10"
                title="Fill the remaining balance"
                onClick={() => patchRow(index, { amount: (num(row.amount) + remaining).toFixed(2) })}
              >
                Exact
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-9 shrink-0"
                disabled={rows.length <= 1}
                title="Remove payment line"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}

          {rows.length < MAX_PAYMENT_ROWS ? (
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add payment method
            </Button>
          ) : null}

          <div className="rounded-xl border bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total tendered</span><strong>{money(tendered)}</strong></div>
            <div className="flex justify-between">
              <span>Remaining</span>
              <strong className={remaining > 0 ? 'text-amber-700' : 'text-slate-700'}>{money(remaining)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Change</span>
              <strong className={change > 0 ? 'text-emerald-700' : 'text-slate-700'}>{money(change)}</strong>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="Sale note" />
          </div>

          {remaining > 0 ? (
            <p className="text-xs text-amber-700">
              Tendered is below the grand total — the sale will be saved as partially paid.
            </p>
          ) : null}
        </div>

        <div className="border-t px-5 py-3 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">
          <Button variant="outline" onClick={onClose} disabled={paying}>Close</Button>
          <Button className="bg-[#003D82]" disabled={paying} onClick={onSubmit}>
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
