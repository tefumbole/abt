import { getStoragePublicUrl } from '@/utils/storageUrl';

export const PRODUCT_IMAGE_BUCKET = 'products';
export const CATEGORY_IMAGE_BUCKET = 'categories';

/** Product images are stored as upload paths; older rows may hold an absolute URL. */
export function productImageSrc(value) {
  if (!value) return null;
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return value;
  return getStoragePublicUrl(PRODUCT_IMAGE_BUCKET, value);
}

export function categoryImageSrc(value) {
  if (!value) return null;
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return value;
  return getStoragePublicUrl(CATEGORY_IMAGE_BUCKET, value);
}

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

export function imageFileFromClipboard(event) {
  const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
  return item?.getAsFile() || null;
}

export async function uploadErpImage(bucket, file, prefix = 'file') {
  if (!file) throw new Error('No file');
  const ext = (file.name?.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const filePath = `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const form = new FormData();
  form.append('file', file);
  form.append('path', filePath);
  const res = await fetch(`/api/upload/${bucket}?path=${encodeURIComponent(filePath)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Upload failed');
  return json.path || filePath;
}

export function uploadProductImage(file) {
  return uploadErpImage(PRODUCT_IMAGE_BUCKET, file, 'product');
}

export function uploadCategoryImage(file) {
  return uploadErpImage(CATEGORY_IMAGE_BUCKET, file, 'category');
}
