import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Searchable combobox for POS / sales fields.
 * options: [{ value, label, hint? }]
 */
export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Search…',
  emptyLabel = 'No matches',
  className,
  allowClear = true,
  size = 'md',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value)) || null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options.filter((o) => (
      String(o.label || '').toLowerCase().includes(q)
      || String(o.hint || '').toLowerCase().includes(q)
    )).slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = (option) => {
    onChange?.(option.value);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 border border-slate-200 bg-white px-3 text-left text-sm shadow-sm',
          size === 'sm' ? 'h-9 rounded-lg' : 'h-11 rounded-xl',
          'hover:border-[#003D82]/40 focus:outline-none focus:ring-2 focus:ring-[#003D82]/20'
        )}
      >
        <span className={cn('truncate', selected ? 'text-slate-900' : 'text-slate-400')}>
          {selected ? (
            <>
              {selected.label}
              {selected.hint ? <span className="text-slate-400"> · {selected.hint}</span> : null}
            </>
          ) : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-slate-400">
          {allowClear && selected ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded-full p-0.5 hover:bg-slate-100 hover:text-slate-700"
              onClick={(e) => { e.stopPropagation(); onChange?.(''); }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="relative border-b">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full h-10 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!matches.length && (
              <div className="px-3 py-6 text-center text-sm text-slate-500">{emptyLabel}</div>
            )}
            {matches.map((option) => {
              const active = String(option.value) === String(value);
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => pick(option)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm',
                    active ? 'bg-[#003D82]/5 text-[#003D82]' : 'hover:bg-slate-50'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.hint ? <span className="block truncate text-xs text-slate-400">{option.hint}</span> : null}
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
