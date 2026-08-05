import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, CalendarRange, CalendarX2, ChevronLeft, ChevronRight, List, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatErpDate, makeMoney, num } from '@/lib/erpFormat';
import { BOOKING_STATUS_META, SIGNATURE_STATUS_META, statusMeta } from '@/lib/rentalFormat';
import { listBookingCalendar, listWarehouses } from '@/services/erpService';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MAX_CHIPS = 3;

/** Cancelled and rejected never reach the calendar — the API filters them out. */
const LEGEND_STATUSES = ['requested', 'pending', 'confirmed', 'ongoing', 'completed'];

/**
 * Solid chip colours keyed by the hue the badge meta already uses, so a chip and
 * its badge always read as the same status even if the meta palette changes.
 */
const TONE_BY_HUE = {
  violet: { chip: 'bg-violet-500 hover:bg-violet-600', dot: 'bg-violet-500' },
  amber: { chip: 'bg-amber-500 hover:bg-amber-600', dot: 'bg-amber-500' },
  blue: { chip: 'bg-blue-500 hover:bg-blue-600', dot: 'bg-blue-500' },
  teal: { chip: 'bg-teal-500 hover:bg-teal-600', dot: 'bg-teal-500' },
  emerald: { chip: 'bg-emerald-500 hover:bg-emerald-600', dot: 'bg-emerald-500' },
  rose: { chip: 'bg-rose-500 hover:bg-rose-600', dot: 'bg-rose-500' },
  slate: { chip: 'bg-slate-500 hover:bg-slate-600', dot: 'bg-slate-500' },
};

function bookingTone(status) {
  const meta = statusMeta(BOOKING_STATUS_META, status, 'pending');
  const hue = /bg-([a-z]+)-\d{2,3}/.exec(meta.className || '')?.[1];
  return TONE_BY_HUE[hue] || TONE_BY_HUE.slate;
}

/** MySQL datetimes (`YYYY-MM-DD HH:mm:ss`) need the `T` before Date can parse them. */
function parseDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date, months) {
  // Anchor on the 1st so stepping from a 31st never skips a short month.
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Local `YYYY-MM-DD`; never `toISOString()`, which would shift the day by the UTC offset. */
function dayKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Monday-first column index: `getDay()` is Sunday-first, so rotate it. */
function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function startOfWeek(date) {
  return addDays(startOfDay(date), -mondayIndex(date));
}

function timeLabel(value) {
  const date = parseDateTime(value);
  if (!date) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function BookingCalendar({ money, dateFormat = 'd-m-Y', onOpenBooking = () => {} }) {
  const fallbackMoney = useMemo(() => makeMoney({}), []);
  const fmtMoney = typeof money === 'function' ? money : fallbackMoney;

  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);

  const todayKey = useMemo(() => dayKey(new Date()), []);

  // The week view spans 7 days; month and list share the full 6-row grid range.
  const days = useMemo(() => {
    const start = view === 'week' ? startOfWeek(anchor) : startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const count = view === 'week' ? 7 : 42;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [anchor, view]);

  const fromKey = days.length ? dayKey(days[0]) : '';
  const toKey = days.length ? dayKey(days[days.length - 1]) : '';

  useEffect(() => {
    (async () => {
      try {
        setWarehouses((await listWarehouses()) || []);
      } catch {
        /* the filter simply stays on "All warehouses" */
      }
    })();
  }, []);

  // Guards against a slow earlier request overwriting the rows of a newer range.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!fromKey || !toKey) return;
    const ticket = requestRef.current + 1;
    requestRef.current = ticket;
    setLoading(true);
    try {
      const data = await listBookingCalendar({
        from: fromKey,
        to: toKey,
        warehouse_id: warehouseId || undefined,
      });
      if (requestRef.current !== ticket) return;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestRef.current !== ticket) return;
      setRows([]);
      toast.error(err.message || 'Could not load the booking calendar');
    } finally {
      if (requestRef.current === ticket) setLoading(false);
    }
  }, [fromKey, toKey, warehouseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setExpandedDay(null); }, [fromKey, toKey, view, warehouseId]);

  /**
   * A booking occupies every day between its start and end, so it is indexed once
   * per covered day and clipped to the visible range.
   */
  const byDay = useMemo(() => {
    const map = new Map();
    if (!days.length) return map;
    const rangeStart = days[0];
    const rangeEnd = days[days.length - 1];
    rows.forEach((row) => {
      const start = parseDateTime(row.from_datetime);
      if (!start) return;
      const end = parseDateTime(row.to_datetime) || start;
      let cursor = startOfDay(start < rangeStart ? rangeStart : start);
      const last = startOfDay(end > rangeEnd ? rangeEnd : end);
      if (cursor > last) return;
      while (cursor <= last) {
        const key = dayKey(cursor);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
        cursor = addDays(cursor, 1);
      }
    });
    map.forEach((list) => list.sort((a, b) => String(a.from_datetime || '').localeCompare(String(b.from_datetime || ''))));
    return map;
  }, [rows, days]);

  const visibleRows = useMemo(() => {
    const seen = new Set();
    const out = [];
    byDay.forEach((list) => list.forEach((row) => {
      if (seen.has(row.id)) return;
      seen.add(row.id);
      out.push(row);
    }));
    return out.sort((a, b) => String(a.from_datetime || '').localeCompare(String(b.from_datetime || '')));
  }, [byDay]);

  const title = useMemo(() => {
    if (view !== 'week') return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const start = days[0];
    const end = days[days.length - 1];
    if (!start || !end) return '';
    return `${formatErpDate(start, dateFormat)} — ${formatErpDate(end, dateFormat)}`;
  }, [view, anchor, days, dateFormat]);

  const step = (direction) => {
    setAnchor((prev) => (view === 'week' ? addDays(prev, 7 * direction) : addMonths(prev, direction)));
  };

  const periodLabel = (row) => {
    const from = formatErpDate(row.from_datetime, dateFormat, { withTime: true });
    const to = formatErpDate(row.to_datetime, dateFormat, { withTime: true });
    if (!to || to === from) return from || '—';
    return `${from} → ${to}`;
  };

  const renderChip = (row, { detailed = false } = {}) => {
    const tone = bookingTone(row.booking_status);
    const meta = statusMeta(BOOKING_STATUS_META, row.booking_status, 'pending');
    return (
      <button
        key={`${row.id}-${detailed ? 'w' : 'm'}`}
        type="button"
        onClick={() => onOpenBooking(row.id)}
        title={`${row.reference || ''} · ${row.customer_name || 'Walk-in'} · ${meta.label}`}
        className={cn(
          'w-full rounded px-1.5 py-1 text-left text-[11px] font-medium text-white transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]',
          tone.chip
        )}
      >
        <span className="block truncate">{row.reference || `#${row.id}`}</span>
        <span className="block truncate font-normal text-white/85">
          {row.customer_name || 'Walk-in Customer'}
        </span>
        {detailed && (
          <span className="mt-0.5 block truncate font-normal text-white/85">
            {timeLabel(row.from_datetime)}–{timeLabel(row.to_datetime) || '…'} · {fmtMoney(row.grand_total)}
          </span>
        )}
      </button>
    );
  };

  const renderMonth = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((day) => <div key={day} className="p-2 text-center">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day);
            const list = byDay.get(key) || [];
            const outside = day.getMonth() !== anchor.getMonth();
            const isToday = key === todayKey;
            const expanded = expandedDay === key;
            const shown = expanded ? list : list.slice(0, MAX_CHIPS);
            const hidden = list.length - shown.length;
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[112px] border-b border-r p-1.5 last:border-r-0',
                  outside ? 'bg-slate-50/70' : 'bg-white',
                  isToday && 'bg-[#003D82]/5 ring-1 ring-inset ring-[#003D82]/40'
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setAnchor(startOfDay(day)); setView('week'); }}
                    className={cn(
                      'h-6 min-w-6 rounded-full px-1.5 text-xs font-semibold',
                      outside ? 'text-slate-400' : 'text-slate-700',
                      isToday && 'bg-[#003D82] text-white'
                    )}
                    title="Open this week"
                  >
                    {day.getDate()}
                  </button>
                  {list.length > 0 && (
                    <span className="text-[10px] font-medium text-slate-400">{list.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {shown.map((row) => renderChip(row))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(key)}
                      className="w-full rounded px-1.5 py-0.5 text-left text-[11px] font-semibold text-[#003D82] hover:bg-[#003D82]/10"
                    >
                      +{hidden} more
                    </button>
                  )}
                  {expanded && list.length > MAX_CHIPS && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(null)}
                      className="w-full rounded px-1.5 py-0.5 text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderWeek = () => (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const list = byDay.get(key) || [];
          const isToday = key === todayKey;
          return (
            <div key={key} className="border-r last:border-r-0">
              <div
                className={cn(
                  'border-b px-2 py-2 text-center',
                  isToday ? 'bg-[#003D82] text-white' : 'bg-slate-50 text-slate-600'
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide">
                  {WEEKDAYS[mondayIndex(day)]}
                </div>
                <div className="text-lg font-bold">{day.getDate()}</div>
                <div className={cn('text-[10px]', isToday ? 'text-white/80' : 'text-slate-400')}>
                  {MONTHS[day.getMonth()].slice(0, 3)}
                </div>
              </div>
              <div className="min-h-[220px] space-y-1.5 p-1.5">
                {list.length === 0 && (
                  <p className="pt-6 text-center text-[11px] text-slate-300">No bookings</p>
                )}
                {list.map((row) => renderChip(row, { detailed: true }))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderList = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="p-3 whitespace-nowrap">Date</th>
            <th className="p-3 whitespace-nowrap">Reference</th>
            <th className="p-3 whitespace-nowrap">Customer</th>
            <th className="p-3 whitespace-nowrap">Warehouse</th>
            <th className="p-3 whitespace-nowrap">Period</th>
            <th className="p-3 whitespace-nowrap">Status</th>
            <th className="p-3 text-right whitespace-nowrap">Items</th>
            <th className="p-3 text-right whitespace-nowrap">Grand Total</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const meta = statusMeta(BOOKING_STATUS_META, row.booking_status, 'pending');
            const sign = row.signature_status && row.signature_status !== 'none'
              ? statusMeta(SIGNATURE_STATUS_META, row.signature_status, 'none')
              : null;
            return (
              <tr
                key={row.id}
                className="cursor-pointer border-t hover:bg-slate-50/80"
                onClick={() => onOpenBooking(row.id)}
              >
                <td className="p-3 whitespace-nowrap">{formatErpDate(row.from_datetime, dateFormat)}</td>
                <td className="p-3 whitespace-nowrap font-medium text-[#003D82]">{row.reference || `#${row.id}`}</td>
                <td className="p-3">{row.customer_name || 'Walk-in Customer'}</td>
                <td className="p-3 whitespace-nowrap">{row.warehouse_name || '—'}</td>
                <td className="p-3 whitespace-nowrap text-slate-600">{periodLabel(row)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className={cn('border', meta.className)}>{meta.label}</Badge>
                    {sign && (
                      <Badge variant="outline" className={cn('border text-[10px]', sign.className)}>{sign.label}</Badge>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">{num(row.items_count)}</td>
                <td className="p-3 text-right font-medium">{fmtMoney(row.grand_total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const viewButton = (key, label, Icon) => (
    <Button
      key={key}
      type="button"
      size="sm"
      variant={view === key ? 'default' : 'ghost'}
      className={cn('h-8 gap-1 rounded-md px-3', view === key && 'bg-[#003D82] hover:bg-[#002855]')}
      onClick={() => setView(key)}
    >
      <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
    </Button>
  );

  const isEmpty = !loading && visibleRows.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => step(-1)} title="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => step(1)} title="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-[#D4AF37] text-[#8a6d1f] hover:bg-[#D4AF37]/10"
            onClick={() => setAnchor(startOfDay(new Date()))}
          >
            Today
          </Button>
          <h2 className="ml-1 text-lg font-bold text-[#003D82]">{title}</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#003D82]" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            aria-label="Filter by warehouse"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="flex items-center gap-1 rounded-lg border bg-slate-50 p-1">
            {viewButton('month', 'Month', CalendarDays)}
            {viewButton('week', 'Week', CalendarRange)}
            {viewButton('list', 'List', List)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#003D82]" />
          </div>
        ) : isEmpty && view === 'list' ? (
          <div className="flex flex-col items-center gap-2 p-16 text-center">
            <CalendarX2 className="h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-600">No bookings in this period</p>
            <p className="text-sm text-slate-400">Try another month or clear the warehouse filter.</p>
          </div>
        ) : (
          <>
            {view === 'month' && renderMonth()}
            {view === 'week' && renderWeek()}
            {view === 'list' && renderList()}
            {isEmpty && view !== 'list' && (
              <div className="border-t p-4 text-center text-sm text-slate-400">
                No bookings in this period — try another {view === 'week' ? 'week' : 'month'} or clear the warehouse filter.
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-white p-3 text-xs text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-500">Legend</span>
        {LEGEND_STATUSES.map((key) => {
          const meta = statusMeta(BOOKING_STATUS_META, key, 'pending');
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded-sm', bookingTone(key).dot)} />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
