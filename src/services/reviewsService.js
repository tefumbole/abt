const API_BASE = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  try {
    const raw = localStorage.getItem('alpha_supabase_auth');
    const parsed = raw ? JSON.parse(raw) : null;
    const token = parsed?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text || res.statusText };
  }
  if (!res.ok) {
    throw new Error(json.error || json.message || `Request failed (${res.status})`);
  }
  return json;
}

export const REVIEW_CRITERIA = [
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'time_score', label: 'Time' },
  { key: 'quality', label: 'Quality of work' },
  { key: 'after_sales', label: 'After sales support' },
];

export const REVIEW_COUNTRIES = [
  'Rwanda', 'Kenya', 'Uganda', 'Tanzania', 'Burundi', 'DR Congo', 'Cameroon',
  'Nigeria', 'Ghana', 'South Africa', 'Ethiopia', 'United States', 'United Kingdom',
  'Canada', 'Germany', 'France', 'Belgium', 'Netherlands', 'India', 'China',
  'United Arab Emirates', 'Other',
];

export async function listPublishedReviews() {
  const json = await apiJson('/reviews');
  return { reviews: json.data || [], summary: json.summary || { count: 0, average: 0 } };
}

export async function sendReviewOtp(phone) {
  return apiJson('/reviews/otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function submitPublicReview(payload) {
  return apiJson('/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listAdminReviews() {
  const json = await apiJson('/reviews/admin');
  return json.data || [];
}

export async function createAdminReview(payload) {
  const json = await apiJson('/reviews/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function setReviewPublished(id, isPublished) {
  const json = await apiJson(`/reviews/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_published: isPublished }),
  });
  return json.data;
}

export async function deleteReview(id) {
  return apiJson(`/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
