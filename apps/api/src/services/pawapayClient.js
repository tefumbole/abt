/**
 * PawaPay API for Alpha Bridge (Rwanda). Bearer JWT from PAWAPAY_API_TOKEN.
 * Never treat a browser redirect as paid — only COMPLETED after GET confirm.
 */
const LIVE = 'https://api.pawapay.io';
const SANDBOX = 'https://api.sandbox.pawapay.io';

export function pawapayConfigured() {
  return Boolean(String(process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_TOKEN || '').trim());
}

export function token() {
  return String(process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_TOKEN || '').trim();
}

export function baseUrl() {
  const env = String(process.env.PAWAPAY_ENVIRONMENT || 'production').toLowerCase();
  if (env === 'sandbox' || env === 'test') {
    return String(process.env.PAWAPAY_SANDBOX_BASE_URL || SANDBOX).replace(/\/$/, '');
  }
  return String(process.env.PAWAPAY_LIVE_BASE_URL || process.env.PAWAPAY_BASE_URL || LIVE).replace(/\/$/, '');
}

export function formatRwf(n) {
  const num = Math.round(Number(n) || 0);
  return `${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} RWF`;
}

/** @deprecated use formatRwf — Alpha is Rwanda, not Cameroon. */
export function formatXaf(n) {
  return formatRwf(n);
}

export function momoNumber(phone, defaultCountry = '250') {
  let digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && (digits[0] === '7' || digits[0] === '6')) {
    digits = `${digits[0] === '7' ? '250' : defaultCountry}${digits}`;
  }
  if (digits.length === 10 && digits[0] === '0') {
    digits = `${defaultCountry}${digits.slice(1)}`;
  }
  return digits;
}

export function currencyForPhone(msisdn) {
  return String(msisdn || '').startsWith('237') ? 'XAF' : 'RWF';
}

export function providerForPhone(msisdn, hint = 'auto') {
  const n = String(msisdn || '');
  const h = String(hint || 'auto').toLowerCase();
  const rwanda = !n.startsWith('237');
  if (['mtn', 'momo', 'mtn_momo'].includes(h)) return rwanda ? 'MTN_MOMO_RWA' : 'MTN_MOMO_CMR';
  if (['airtel', 'airtel_money'].includes(h)) return 'AIRTEL_RWA';
  if (['orange', 'om'].includes(h)) return rwanda ? 'AIRTEL_RWA' : 'ORANGE_CMR';
  if (n.startsWith('250')) {
    const p2 = n.slice(3, 5);
    if (['72', '73'].includes(p2)) return 'AIRTEL_RWA';
    return 'MTN_MOMO_RWA';
  }
  if (n.startsWith('237')) {
    const p2 = n.slice(3, 5);
    const p3 = n.slice(3, 6);
    if (p2 === '69' || ['655', '656', '657', '658', '659'].includes(p3)) return 'ORANGE_CMR';
    return 'MTN_MOMO_CMR';
  }
  return 'MTN_MOMO_RWA';
}

export function payingMethodLabel(provider) {
  const p = String(provider || '');
  if (p.includes('ORANGE')) return 'Orange Money';
  if (p.includes('AIRTEL')) return 'Airtel Money';
  return 'MTN MoMo';
}

export function customerMessage(description) {
  const cleaned = String(description || '').replace(/[^A-Za-z0-9 .\-]/g, '').trim();
  return (cleaned || 'Alpha Bridge').slice(0, 22);
}

function appHost() {
  try {
    return new URL(process.env.APP_URL || process.env.APP_BASE_URL || 'https://alpha-bridge.net').host;
  } catch {
    return 'alpha-bridge.net';
  }
}

/** Only accept callback hosts on alpha-bridge.net — never mulemagc/manukeza. */
export function depositCallbackUrl() {
  const fallback = `https://${appHost()}/api/payments/pawapay/deposits/callback`;
  const url = String(process.env.PAWAPAY_DEPOSIT_CALLBACK_URL || '').trim();
  if (!url.startsWith('http')) return fallback;
  try {
    if (new URL(url).host.toLowerCase() !== appHost().toLowerCase()) return fallback;
  } catch {
    return fallback;
  }
  return url;
}

function unwrap(payload) {
  if (Array.isArray(payload) && payload[0] && typeof payload[0] === 'object') return payload[0];
  return payload && typeof payload === 'object' ? payload : {};
}

function envelopeStatus(status) {
  const upper = String(status || '').toUpperCase();
  return !upper || /^\d+$/.test(upper) || ['FOUND', 'NOT_FOUND', 'OK'].includes(upper);
}

export function extractStatus(payload) {
  if (!payload || typeof payload !== 'object') return 'PENDING';
  const body = unwrap(payload);
  const candidates = [
    body.data?.status,
    body.deposit?.status,
    body.payout?.status,
    body.depositStatus,
    body.payoutStatus,
  ];
  if (!envelopeStatus(body.status)) candidates.push(body.status);
  for (const status of candidates) {
    const upper = String(status || '').toUpperCase().trim();
    if (upper && !envelopeStatus(upper) && upper !== 'PENDING') return upper;
  }
  return 'PENDING';
}

export function extractDepositId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const body = unwrap(payload);
  for (const key of ['depositId', 'deposit_id', 'payoutId', 'payout_id']) {
    if (body[key]) return String(body[key]);
    if (body.data?.[key]) return String(body.data[key]);
    if (body.deposit?.[key]) return String(body.deposit[key]);
    if (body.payout?.[key]) return String(body.payout[key]);
  }
  return null;
}

export function extractAmount(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const body = unwrap(payload);
  for (const key of ['depositedAmount', 'amount']) {
    const values = [body.data?.[key], body.deposit?.[key], body[key]];
    for (const value of values) {
      if (value != null && Number.isFinite(Number(value))) return Number(value);
    }
  }
  return null;
}

export function extractFailure(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.failureReason?.failureMessage
    || payload.failureMessage
    || (typeof payload.message === 'string' ? payload.message : null);
}

export function extractFailureCode(payload) {
  if (!payload || typeof payload !== 'object') return '';
  return String(payload.failureReason?.failureCode || payload.failureCode || '').toUpperCase();
}

export function isSuccessStatus(status) {
  return ['COMPLETED', 'SUCCESSFUL', 'SUCCESS'].includes(String(status || '').toUpperCase());
}

export function isFailureStatus(status) {
  return ['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(String(status || '').toUpperCase());
}

export function isAcceptedStatus(status) {
  return ['ACCEPTED', 'DUPLICATE_IGNORED', 'SUBMITTED', 'PENDING', 'IN_RECONCILIATION'].includes(
    String(status || '').toUpperCase()
  );
}

function shouldTryV1(payload) {
  if (!payload || typeof payload !== 'object') return true;
  const code = extractFailureCode(payload);
  if (['UNSUPPORTED_PARAMETER', 'INVALID_SCHEMA', 'NOT_FOUND'].includes(code)) return true;
  const message = String(extractFailure(payload) || '').toLowerCase();
  return message.includes('callbackurl') || message.includes('unsupported parameter');
}

function v1DepositPayload(payload) {
  const phone = payload.payer?.accountDetails?.phoneNumber || payload.payer?.address?.value || '';
  const provider = payload.payer?.accountDetails?.provider || payload.correspondent || 'MTN_MOMO_RWA';
  return {
    depositId: payload.depositId,
    amount: String(payload.amount),
    currency: payload.currency,
    correspondent: provider,
    payer: { type: 'MSISDN', address: { value: phone } },
    customerTimestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    statementDescription: customerMessage(payload.customerMessage),
  };
}

async function request(method, path, payload) {
  if (!pawapayConfigured()) return { stub: true, status: 'PENDING', message: 'PawaPay is not configured' };
  const res = await fetch(`${baseUrl()}/${String(path).replace(/^\//, '')}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status >= 400 && !body.status) {
    console.warn('PawaPay HTTP error', path, res.status, extractFailure(body) || body);
  }
  return body;
}

export async function predictProvider(phone) {
  const body = await request('POST', '/v2/predict-provider', { phoneNumber: phone });
  if (!body || body.stub) return null;
  return body.provider || body.correspondent || null;
}

export async function createDeposit(payload) {
  const clean = { ...payload };
  delete clean.callbackUrl;
  let response = await request('POST', '/v2/deposits', clean);
  if (!response || response.stub || extractFailureCode(response) === 'UNSUPPORTED_PARAMETER') {
    response = await request('POST', '/deposits', v1DepositPayload(payload));
  }
  return response;
}

export async function getDeposit(depositId) {
  if (!depositId) return null;
  let response = await request('GET', `/v2/deposits/${encodeURIComponent(depositId)}`);
  if (!response || response.stub || shouldTryV1(response)) {
    response = await request('GET', `/deposits/${encodeURIComponent(depositId)}`);
  }
  return response;
}

export async function getBalance() {
  if (!pawapayConfigured()) return { total: '', raw: { stub: true } };
  const body = await request('GET', '/v2/wallet-balances');
  const rows = Array.isArray(body) ? body : (body.balances || body.data || []);
  const rwf = (Array.isArray(rows) ? rows : []).find((row) => String(row.currency || '').toUpperCase() === 'RWF')
    || (Array.isArray(rows) ? rows[0] : null);
  const value = rwf?.available ?? rwf?.balance ?? rwf?.amount ?? body.available ?? body.balance ?? '';
  return { total: value === '' ? '' : formatRwf(value), raw: body };
}

export async function collect({ amount, phone, description, depositId, networkHint }) {
  const msisdn = momoNumber(phone);
  const predicted = await predictProvider(msisdn);
  const provider = predicted || providerForPhone(msisdn, networkHint);
  const currency = currencyForPhone(msisdn);
  const id = depositId;
  return createDeposit({
    depositId: id,
    amount: String(Math.round(Number(amount))),
    currency,
    payer: {
      type: 'MMO',
      accountDetails: { phoneNumber: msisdn, provider },
    },
    customerMessage: customerMessage(description),
  });
}

export function collectionPaid(body, expected) {
  if (!isSuccessStatus(extractStatus(body))) return false;
  const received = extractAmount(body);
  const want = Number(expected);
  if (received != null && Number.isFinite(want) && received < 1) return false;
  return true;
}
