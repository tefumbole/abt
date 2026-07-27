import { getStoragePublicUrl } from '@/utils/storageUrl';

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

function withFileUrl(item) {
  if (!item) return item;
  return {
    ...item,
    file_url: item.file_path
      ? getStoragePublicUrl('gallery', item.file_path, null)
      : null,
  };
}

export async function listPublishedGalleryItems() {
  const json = await apiJson('/gallery');
  return (json.data || []).map(withFileUrl);
}

export async function listAdminGalleryItems() {
  const json = await apiJson('/gallery/admin');
  return (json.data || []).map(withFileUrl);
}

export async function createGalleryItem(payload) {
  const json = await apiJson('/gallery', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return withFileUrl(json.data);
}

export async function updateGalleryItem(id, payload) {
  const json = await apiJson(`/gallery/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return withFileUrl(json.data);
}

export async function deleteGalleryItem(id) {
  await apiJson(`/gallery/${id}`, { method: 'DELETE' });
}

export async function reorderGalleryItems(ids) {
  await apiJson('/gallery/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function uploadGalleryFile(file, type = 'image') {
  const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '');
  const filePath = `gallery_${type}_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const form = new FormData();
  form.append('file', file);
  form.append('path', filePath);

  const res = await fetch(`${API_BASE}/upload/gallery?path=${encodeURIComponent(filePath)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || 'Upload failed');
  }
  return json.path || filePath;
}
