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

let publicCache = null;
let publicCacheAt = 0;
const PUBLIC_TTL_MS = 30_000;

export async function getPublicSiteContent({ force = false } = {}) {
  const now = Date.now();
  if (!force && publicCache && now - publicCacheAt < PUBLIC_TTL_MS) {
    return publicCache;
  }
  const json = await apiJson('/site-content/public');
  publicCache = json.data || { landingMenu: [], pages: {} };
  publicCacheAt = now;
  return publicCache;
}

export function clearPublicSiteContentCache() {
  publicCache = null;
  publicCacheAt = 0;
}

export async function getAdminSiteContent() {
  const json = await apiJson('/site-content');
  return json.data;
}

export async function saveLandingMenuOrder(order) {
  const json = await apiJson('/site-content/menus/landing', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
  clearPublicSiteContentCache();
  return json.data;
}

export async function saveSideMenuOrder(order) {
  const json = await apiJson('/site-content/menus/side', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
  return json.data;
}

export async function saveSettingsMenuOrder(order) {
  const json = await apiJson('/site-content/menus/settings', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
  return json.data;
}

export async function saveContentTabsOrder(order) {
  const json = await apiJson('/site-content/menus/content-tabs', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
  return json.data;
}

export async function savePageContent(page, values) {
  const json = await apiJson(`/site-content/pages/${page}`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
  clearPublicSiteContentCache();
  return json.data;
}

/** Resolve a page field with fallback default. */
export function pageField(pages, page, field, fallback = '') {
  const val = pages?.[page]?.fields?.[field];
  if (val === null || val === undefined || val === '') return fallback;
  return val;
}

export async function uploadSiteContentImage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '');
  const filePath = `site_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const form = new FormData();
  form.append('file', file);
  form.append('path', filePath);

  const res = await fetch(`${API_BASE}/upload/site-content?path=${encodeURIComponent(filePath)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || 'Upload failed');
  }
  const path = json.path || filePath;
  const publicUrl = json.publicUrl || json.url || null;
  return { path, publicUrl };
}
