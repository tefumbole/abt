/**
 * Shared vocabulary for the rental booking pipeline.
 * Status values here must match apps/api/src/routes/erp/rentals.js.
 */
import { num } from '@/lib/erpFormat';

export const BOOKING_STATUS_META = {
  requested: { label: 'Requested', className: 'bg-violet-100 text-violet-800 border-violet-200' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  ongoing: { label: 'Ongoing', className: 'bg-teal-100 text-teal-800 border-teal-200' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const SIGNATURE_STATUS_META = {
  none: { label: 'Not required', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending: { label: 'Awaiting signature', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  signed: { label: 'Signed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  declined: { label: 'Declined', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const REVIEW_STATUS_META = {
  none: { label: '—', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending: { label: 'Pending review', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const BOOKING_STATUSES = Object.keys(BOOKING_STATUS_META);

/**
 * How a line is priced. Each method maps to the matching rent price on the
 * product (hour / day / month); `flat` is a one-off charge with no duration.
 */
export const BOOKING_METHODS = [
  { value: 'hourly', label: 'Per hour', unit: 'hour', priceField: 'rent_price_hour', hours: 1 },
  { value: 'daily', label: 'Per day', unit: 'day', priceField: 'rent_price_day', hours: 24 },
  { value: 'monthly', label: 'Per month', unit: 'month', priceField: 'rent_price_month', hours: 24 * 30 },
  { value: 'flat', label: 'Flat rate', unit: null, priceField: null, hours: null },
];

/** Bookings created before hour/day/month pricing stored a generic `duration`. */
const LEGACY_METHODS = { duration: 'hourly' };

export function normaliseBookingMethod(value) {
  const candidate = LEGACY_METHODS[value] || value;
  return BOOKING_METHODS.some((m) => m.value === candidate) ? candidate : 'daily';
}

export function bookingMethod(value) {
  const key = normaliseBookingMethod(value);
  return BOOKING_METHODS.find((m) => m.value === key);
}

export function bookingMethodLabel(value) {
  return bookingMethod(value).label;
}

/** Short unit for duration cells: `hour(s)`, `day(s)`, `month(s)` or `—` for flat. */
export function durationUnitLabel(value) {
  const { unit } = bookingMethod(value);
  return unit ? `${unit}(s)` : '—';
}

export function isRentable(product = {}) {
  if (product.is_rentable != null) return Boolean(product.is_rentable);
  return ['rent_price_hour', 'rent_price_day', 'rent_price_month'].some((f) => num(product[f]) > 0);
}

/** The method a product is normally rented by, based on which rent price it carries. */
export function defaultBookingMethod(product = {}) {
  if (num(product.rent_price_day) > 0) return 'daily';
  if (num(product.rent_price_hour) > 0) return 'hourly';
  if (num(product.rent_price_month) > 0) return 'monthly';
  return 'daily';
}

/** Rent price for a method, falling back to the product's sale price. */
export function rentPriceFor(product = {}, method) {
  const { priceField } = bookingMethod(method);
  const rent = priceField ? num(product[priceField]) : 0;
  return rent > 0 ? rent : num(product.price);
}

/** Billable units between two datetimes for the given method, rounded up, minimum 1. */
export function durationFor(method, from, to) {
  const { hours } = bookingMethod(method);
  if (!hours) return 1;
  return Math.max(1, Math.ceil(hoursBetween(from, to) / hours));
}

export function statusMeta(map, value, fallback) {
  return map[value] || map[fallback] || { label: value || '—', className: 'bg-slate-100 text-slate-700 border-slate-200' };
}

/** Line total. `flat` ignores duration; every other method multiplies by it. */
export function bookingLineSubtotal(line = {}) {
  const qty = num(line.qty, 1);
  const price = num(line.net_unit_price);
  const duration = normaliseBookingMethod(line.booking_method) === 'flat'
    ? 1
    : num(line.duration_hours, 1) || 1;
  return Math.max(0, qty * price * duration - num(line.discount) + num(line.tax));
}

/** Order total from lines plus order-level tax, discount and shipping. */
export function bookingGrandTotal(items = [], order = {}) {
  const lines = items.reduce((sum, line) => sum + bookingLineSubtotal(line), 0);
  return Math.max(0, lines + num(order.order_tax) - num(order.order_discount) + num(order.shipping));
}

/** Hours between two datetime strings, rounded up, minimum 1. */
export function hoursBetween(from, to) {
  if (!from || !to) return 1;
  const a = new Date(String(from).replace(' ', 'T'));
  const b = new Date(String(to).replace(' ', 'T'));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return Math.max(1, Math.ceil((b - a) / 3600000));
}
