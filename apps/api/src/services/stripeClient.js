/**
 * Stripe REST helper. Secret key lives in STRIPE_SECRET_KEY on the Alpha API server.
 * RWF / XAF are zero-decimal — do not multiply by 100.
 */
const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

export function stripeConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim());
}

export function stripeAmount(amount, currency = 'RWF') {
  const n = Math.round(Number(amount) || 0);
  const code = String(currency || 'RWF').toUpperCase();
  return ZERO_DECIMAL.has(code) ? n : Math.round(n * 100);
}

async function stripeRequest(method, path, params) {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Stripe is not configured');
  const body = params
    ? new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (
        Array.isArray(v) ? v.map((item) => [k, String(item)]) : [[k, String(v)]]
      ))
    )
    : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${String(path).replace(/^\//, '')}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(25_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe error ${res.status}`);
  }
  return json;
}

export async function createCardIntent({ amount, currency = 'RWF', description }) {
  const cents = stripeAmount(amount, currency);
  if (cents < 1) throw new Error('Amount must be at least 1');
  return stripeRequest('POST', 'payment_intents', {
    amount: String(cents),
    currency: String(currency || 'RWF').toLowerCase(),
    'payment_method_types[]': ['card'],
    description: description || 'Alpha Bridge sale',
  });
}

export async function getPaymentIntent(id) {
  if (!id) return null;
  return stripeRequest('GET', `payment_intents/${encodeURIComponent(id)}`);
}

export function intentPaid(intent, expected, currency = 'RWF') {
  if (!intent || intent.status !== 'succeeded') return false;
  const want = stripeAmount(expected, currency);
  const got = Number(intent.amount_received ?? intent.amount);
  return Number.isFinite(got) && got === want;
}
