/** Integer quotation_status codes from the Beyond quotation algorithm. */

export const QSTATUS = {
  DRAFT: 1,
  AWAITING: 2,
  APPROVED: 3,
  REJECTED: 4,
  NO_SIGNATURE: 5,
  CLIENT_QUOTE: 6,
};

export const STATUS_SLUG = {
  [QSTATUS.DRAFT]: 'draft',
  [QSTATUS.AWAITING]: 'awaiting_approval',
  [QSTATUS.APPROVED]: 'approved',
  [QSTATUS.REJECTED]: 'rejected',
  [QSTATUS.NO_SIGNATURE]: 'no_signature',
  [QSTATUS.CLIENT_QUOTE]: 'client_quote',
};

const SLUG_TO_CODE = {
  draft: QSTATUS.DRAFT,
  awaiting: QSTATUS.AWAITING,
  awaiting_approval: QSTATUS.AWAITING,
  approved: QSTATUS.APPROVED,
  rejected: QSTATUS.REJECTED,
  no_signature: QSTATUS.NO_SIGNATURE,
  client_quote: QSTATUS.CLIENT_QUOTE,
};

export function slugFor(code) {
  return STATUS_SLUG[Number(code)] || 'draft';
}

export function codeFor(value, fallback = QSTATUS.DRAFT) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (Number.isInteger(n) && STATUS_SLUG[n]) return n;
  const slug = String(value).trim().toLowerCase();
  return SLUG_TO_CODE[slug] ?? fallback;
}

/** Create accepts only 1, 2, or 5. Anything else is forced to 2. Missing → draft. */
export function parseCreateStatus(body = {}) {
  const raw = body.quotation_status ?? body.status;
  if (raw === undefined || raw === null || raw === '') return QSTATUS.DRAFT;
  const code = codeFor(raw, QSTATUS.AWAITING);
  return code === QSTATUS.DRAFT || code === QSTATUS.AWAITING || code === QSTATUS.NO_SIGNATURE
    ? code
    : QSTATUS.AWAITING;
}

export function hasClientSignature(row) {
  return Boolean(row?.client_signature_path || row?.client_signed_at);
}

export function isLinkLive(row) {
  return (
    Number(row?.quotation_status) === QSTATUS.AWAITING &&
    Boolean(row?.client_approval_token || row?.approval_token) &&
    !row?.client_responded_at &&
    !hasClientSignature(row)
  );
}

export function money(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function stampDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}
