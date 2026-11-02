/**
 * Campay client. Uses Alpha env if present; otherwise every call is a stub.
 * Never mark a payout paid from a browser redirect or an unconfirmed status.
 */
const BASE = (process.env.CAMPAY_BASE_URL || 'https://www.campay.net/api').replace(/\/$/, '');

function configured() {
  return Boolean(
    process.env.CAMPAY_TOKEN
    || process.env.MOMO_TOKEN
    || (process.env.CAMPAY_USERNAME && process.env.CAMPAY_PASSWORD)
  );
}

async function token() {
  if (process.env.CAMPAY_USERNAME && process.env.CAMPAY_PASSWORD) {
    const res = await fetch(`${BASE}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.CAMPAY_USERNAME,
        password: process.env.CAMPAY_PASSWORD,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.token) return body.token;
  }
  return process.env.CAMPAY_TOKEN || process.env.MOMO_TOKEN || '';
}

async function request(path, options = {}) {
  if (!configured()) {
    return { stub: true, status: 'PENDING', message: 'Campay is not configured' };
  }
  const auth = await token();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Token ${auth}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return body;
}

export function campayConfigured() {
  return configured();
}

export function formatXaf(n) {
  const num = Math.round(Number(n) || 0);
  return `${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XAF`;
}

export function momoNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length >= 12) return digits;
  if (digits.length === 9) return `237${digits}`;
  return digits;
}

/** Campay payout is paid only when operator_reference exists and amount matches (fee <= 3%). */
export function payoutDelivered(body, expected) {
  const reference = String(body?.operator_reference || '').trim();
  if (!reference) return false;
  const status = String(body?.status || '').toUpperCase();
  if (status && status !== 'SUCCESSFUL') return false;
  const currency = String(body?.currency || '').toUpperCase();
  if (currency && currency !== 'XAF') return false;
  const received = Number(body?.amount);
  const want = Number(expected);
  if (!Number.isFinite(received) || !Number.isFinite(want)) return Boolean(reference && status === 'SUCCESSFUL');
  if (received === want) return true;
  if (received > want) return false;
  return want - received <= Math.ceil(want * 0.03);
}

export function collectionPaid(body, expected, phone) {
  const status = String(body?.status || '').toUpperCase();
  if (status !== 'SUCCESSFUL') return false;
  if (!String(body?.operator_reference || '').trim()) return false;
  const currency = String(body?.currency || '').toUpperCase();
  if (currency && currency !== 'XAF') return false;
  if (phone) {
    const a = momoNumber(phone).slice(-9);
    const b = momoNumber(body.phone_number || body.phone || '').slice(-9);
    if (a && b && a !== b) return false;
  }
  const received = Number(body?.amount);
  const want = Number(expected);
  if (Number.isFinite(received) && Number.isFinite(want) && received !== want) {
    if (received > want) return false;
    if (want - received > Math.ceil(want * 0.03)) return false;
  }
  return true;
}

export async function getBalance() {
  const body = await request('/balance/');
  if (body.stub) return { total: '', raw: body };
  const total = body.total_balance ?? body.balance ?? body.amount ?? '';
  return { total: total === '' ? '' : formatXaf(total), raw: body };
}

export async function collect({ amount, phone, description, external_reference }) {
  return request('/collect/', {
    method: 'POST',
    body: JSON.stringify({
      amount: String(Math.round(Number(amount))),
      from: momoNumber(phone),
      description: description || 'Payment',
      external_reference,
    }),
  });
}

export async function getTransaction(reference) {
  return request(`/transaction/${encodeURIComponent(reference)}/`);
}

export async function getHistory(days = 45) {
  if (!configured()) return [];
  const items = [];
  let page = 1;
  let lastPage = 0;
  while (page <= 8 && page !== lastPage) {
    lastPage = page;
    const body = await request(`/history/?page=${page}&days=${days}`);
    const rows = body.results || body.data || [];
    if (!Array.isArray(rows) || !rows.length) break;
    items.push(...rows);
    const next = Number(body.next_page || body.next || 0);
    page = next && next !== page ? next : page + 1;
    if (!body.next && !body.next_page) break;
  }
  return items;
}
