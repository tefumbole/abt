import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

/** Shared overlay + card used by every POS dialog so they stack and scroll alike. */
export default function PosModal({ title, subtitle, size = 'md', onClose, footer, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className={cn('bg-white rounded-2xl shadow-xl w-full flex flex-col max-h-[90vh]', WIDTHS[size] || WIDTHS.md)}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b">
          <div>
            <h3 className="text-lg font-bold text-[#003D82]">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
          </div>
          {onClose ? (
            <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="px-5 py-4 overflow-auto space-y-4">{children}</div>
        {footer ? (
          <div className="border-t px-5 py-3 flex flex-wrap justify-end gap-2 bg-slate-50 rounded-b-2xl">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
