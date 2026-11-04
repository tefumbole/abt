/**
 * Shared ERP formatting helpers (money, dates, status labels).
 * Currency and date preferences come from system_settings.
 */

export const CURRENCY_SYMBOLS = {
  RWF: 'FRw',
  USD: '$',
  EUR: '€',
  GBP: '£',
  XAF: 'FCFA',
  KES: 'KSh',
  UGX: 'USh',
  TZS: 'TSh',
  NGN: '₦',
  ZAR: 'R',
};

export function currencySymbol(code) {
  if (!code) return '';
  return CURRENCY_SYMBOLS[String(code).toUpperCase()] || String(code).toUpperCase();
}

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Builds a money formatter bound to the tenant's currency settings.
 * @param {{currency?: string, currency_position?: 'prefix'|'suffix'}} settings
 */
export function makeMoney(settings = {}) {
  const symbol = currencySymbol(settings.currency || 'RWF');
  const suffix = String(settings.currency_position || 'prefix').toLowerCase() === 'suffix';
  return (value, { decimals = 0 } = {}) => {
    const amount = num(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return suffix ? `${amount} ${symbol}` : `${symbol} ${amount}`;
  };
}

/** Whole units by default — 2,000 not 2,000.00 */
export function amount(value, decimals = 0) {
  return num(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** `d-m-Y`, `m-d-Y`, `Y-m-d` (system_settings.date_format) with optional time. */
export function formatErpDate(value, format = 'd-m-Y', { withTime = false } = {}) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  let out;
  if (format === 'm-d-Y') out = `${m}-${d}-${y}`;
  else if (format === 'Y-m-d') out = `${y}-${m}-${d}`;
  else out = `${d}-${m}-${y}`;
  if (!withTime) return out;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${out} ${hh}:${mm}`;
}

/** MySQL DATETIME string for API payloads. */
export function toMysqlDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** `YYYY-MM-DDTHH:mm` for <input type="datetime-local">. */
export function toDateTimeLocal(value) {
  const date = value ? new Date(String(value).replace(' ', 'T')) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const SALE_STATUS_META = {
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  ordered: { label: 'Ordered', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  returned: { label: 'Returned', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const PURCHASE_STATUS_META = {
  received: { label: 'Received', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ordered: { label: 'Ordered', className: 'bg-blue-100 text-blue-800 border-blue-200' },
};

export const PAYMENT_STATUS_META = {
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  partial: { label: 'Partial', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  pending: { label: 'Pending', className: 'bg-rose-100 text-rose-800 border-rose-200' },
  due: { label: 'Due', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const PAYING_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'momo_mtn', label: 'MoMo' },
  { value: 'visa', label: 'Visa' },
];

/** Sale create methods — Due payment leaves the balance on Payments → Awaiting. */
export const SALE_PAYING_METHODS = [
  ...PAYING_METHODS,
  { value: 'due', label: 'Due payment' },
];

const PAYING_METHOD_LABELS = {
  cash: 'Cash',
  visa: 'Visa',
  card: 'Visa',
  momo_mtn: 'MoMo',
  momo_orange: 'MoMo',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  je: 'Journal Entry',
  deposit: 'Deposit',
  credit: 'Credit',
  group_credit: 'Group Credit',
  pay_later: 'Pay Later',
  due: 'Due payment',
};

export function payingMethodLabel(value) {
  return PAYING_METHOD_LABELS[value] || PAYING_METHODS.find((m) => m.value === value)?.label || value || 'Cash';
}
