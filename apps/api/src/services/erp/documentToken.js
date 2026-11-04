import { createHmac, timingSafeEqual } from 'node:crypto';

function secret() {
  return process.env.JWT_SECRET || process.env.APP_KEY || 'alphabridge-document';
}

export function publicOrigin() {
  return String(process.env.APP_URL || process.env.APP_BASE_URL || 'https://alpha-bridge.net').replace(/\/$/, '');
}

export function documentToken(kind, id, reference) {
  return createHmac('sha256', secret())
    .update(`${kind}|${id}|${reference || ''}`)
    .digest('hex')
    .slice(0, 24);
}

export function isValidDocumentToken(kind, id, reference, token) {
  const expected = documentToken(kind, id, reference);
  const got = String(token || '');
  if (!got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

export function documentShareUrl(kind, id, reference, origin = publicOrigin()) {
  const token = documentToken(kind, id, reference);
  const path = kind === 'invoice' ? `/invoice/${id}/${token}` : `/quotation/${id}/${token}`;
  return `${String(origin).replace(/\/$/, '')}${path}`;
}

export function withShareUrl(kind, row) {
  if (!row?.id) return row;
  return { ...row, share_url: documentShareUrl(kind, row.id, row.reference) };
}
