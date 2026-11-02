const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  try {
    const raw = localStorage.getItem('alpha_supabase_auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const productService = {
  list: (q) => api(`/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  lookups: () => api('/products/lookups'),
  get: (id) => api(`/products/${id}`),
  gencode: () => api('/products/gencode'),
  create: (body) => api('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (id, body) => api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSelection: (ids) => api('/products/delete-selection', { method: 'POST', body: JSON.stringify({ ids }) }),
};

export const paymentService = {
  me: () => api('/payments/me'),
  wallet: () => api('/payments/wallet'),
  walletLive: () => api('/payments/wallet/live'),
  lookups: () => api('/payments/lookups'),
  awaiting: () => api('/payments/awaiting'),
  deleteAwaiting: (ids) => api('/payments/awaiting/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  requestPayment: (ids) => api('/payments/awaiting/request', { method: 'POST', body: JSON.stringify({ ids }) }),
  momo: () => api('/payments/momo'),
  withdrawals: () => api('/payments/withdrawals'),
  searchPeople: (q) => api(`/payments/withdrawals/search?q=${encodeURIComponent(q)}`),
  createWithdrawal: (body) => api('/payments/withdrawals', { method: 'POST', body: JSON.stringify(body) }),
  deleteWithdrawal: (id) => api(`/payments/withdrawals/${id}/delete`, { method: 'POST' }),
  deposits: () => api('/payments/deposits'),
  depositsLive: () => api('/payments/deposits/live'),
  createDeposit: (body) => api('/payments/deposits', { method: 'POST', body: JSON.stringify(body) }),
  deleteDeposits: (ids) => api('/payments/deposits/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
};

export const posService = {
  bootstrap: () => api('/pos/bootstrap'),
  products: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/pos/products${q ? `?${q}` : ''}`);
  },
  checkout: (body) => api('/pos/sales', { method: 'POST', body: JSON.stringify(body) }),
  recent: () => api('/pos/recent'),
};

export function formatXaf(n) {
  const num = Math.round(Number(n) || 0);
  return `${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XAF`;
}

export function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
