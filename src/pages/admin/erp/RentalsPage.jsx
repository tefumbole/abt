import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, ClipboardCheck, FileSignature, PackageCheck, Send } from 'lucide-react';
import { makeMoney, num } from '@/lib/erpFormat';
import { getSystemSettings } from '@/services/settingsService';
import BookingForm from '@/pages/admin/erp/rentals/BookingForm';
import BookingListPanel from '@/pages/admin/erp/rentals/BookingListPanel';
import BookedProductsPanel from '@/pages/admin/erp/rentals/BookedProductsPanel';
import BookingReminderPanel from '@/pages/admin/erp/rentals/BookingReminderPanel';
import BookingCalendar from '@/pages/admin/erp/rentals/BookingCalendar';
import BookingDetailsModal from '@/components/erp/rentals/BookingDetailsModal';

const TABS = [
  'booking-create', 'booking-list', 'booking-request', 'booked-products', 'booking-reminder',
  'awaiting-signature', 'pending-review', 'signed-contracts', 'booking-calendar',
];

const LIST_VIEWS = {
  'booking-list': {
    view: 'list',
    title: 'Booking List',
    description: 'Every equipment rental booking.',
  },
  'booking-request': {
    view: 'request',
    title: 'Booking Request',
    description: 'Requests waiting to be accepted or rejected.',
  },
  'awaiting-signature': {
    view: 'awaiting-signature',
    title: 'Awaiting Signature',
    description: 'Contracts sent to the client but not signed yet.',
  },
  'pending-review': {
    view: 'pending-review',
    title: 'Pending Review',
    description: 'Signed by the client, waiting for your approval.',
  },
  'signed-contracts': {
    view: 'signed',
    title: 'Signed Contracts',
    description: 'Signed and approved rental contracts.',
  },
};

/** Queue sizes shown above the panels — the tab row itself lives in AdminLayout. */
const SUMMARY = [
  { key: 'request', label: 'Requests', icon: ClipboardCheck, className: 'text-violet-600' },
  { key: 'awaiting_signature', label: 'Awaiting signature', icon: FileSignature, className: 'text-amber-600' },
  { key: 'pending_review', label: 'Pending review', icon: PackageCheck, className: 'text-blue-600' },
  { key: 'reminder', label: 'Reminders due', icon: Send, className: 'text-rose-600' },
  { key: 'ongoing', label: 'Out on rent', icon: CalendarClock, className: 'text-teal-600' },
];

export default function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab = TABS.includes(raw) ? raw : 'booking-create';
  const editId = tab === 'booking-create' ? searchParams.get('id') : null;

  const [settings, setSettings] = useState({});
  const [counts, setCounts] = useState({});
  const [detailId, setDetailId] = useState(null);

  const money = useMemo(() => makeMoney(settings), [settings]);
  const dateFormat = settings.date_format || 'd-m-Y';

  useEffect(() => {
    getSystemSettings().then((s) => setSettings(s || {})).catch(() => setSettings({}));
  }, []);

  const goTab = useCallback((next, id) => {
    const params = { tab: next };
    if (id) params.id = id;
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Identity-stable so panels can safely list it as an effect dependency.
  const handleCounts = useCallback((next) => {
    if (next && typeof next === 'object') setCounts(next);
  }, []);

  const listConfig = LIST_VIEWS[tab];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {SUMMARY.map(({ key, label, icon: Icon, className }) => (
          <div key={key} className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon className={`h-4 w-4 ${className}`} />
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold text-[#003D82]">{num(counts[key])}</div>
          </div>
        ))}
      </div>

      {tab === 'booking-create' && (
        <BookingForm
          key={editId || 'new'}
          bookingId={editId}
          onSaved={() => goTab('booking-list')}
          onCancel={() => goTab('booking-list')}
        />
      )}

      {listConfig && (
        <BookingListPanel
          key={listConfig.view}
          view={listConfig.view}
          title={listConfig.title}
          description={listConfig.description}
          money={money}
          dateFormat={dateFormat}
          onEdit={(id) => goTab('booking-create', id)}
          onCountsChange={handleCounts}
        />
      )}

      {tab === 'booked-products' && (
        <BookedProductsPanel money={money} dateFormat={dateFormat} />
      )}

      {tab === 'booking-reminder' && (
        <BookingReminderPanel money={money} dateFormat={dateFormat} onCountsChange={handleCounts} />
      )}

      {tab === 'booking-calendar' && (
        <BookingCalendar money={money} dateFormat={dateFormat} onOpenBooking={setDetailId} />
      )}

      {detailId && (
        <BookingDetailsModal
          bookingId={detailId}
          money={money}
          dateFormat={dateFormat}
          onClose={() => setDetailId(null)}
          onEdit={(id) => { setDetailId(null); goTab('booking-create', id); }}
        />
      )}
    </div>
  );
}
