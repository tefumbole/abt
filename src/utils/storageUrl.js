const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Must match apps/api/src/routes/upload.js */
export function sanitizeStorageKey(input) {
  return String(input || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_APP_URL || '';
}

function isExternalAssetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return !url.includes('/api/upload/') && !url.includes('/upload/system-assets');
}

/**
 * Build a browser-reachable URL for a file in the local upload store.
 */
export function getStoragePublicUrl(bucket, filePath, storedUrl = null) {
  if (isExternalAssetUrl(storedUrl)) {
    return storedUrl;
  }

  if (filePath) {
    const key = sanitizeStorageKey(filePath);
    return `${getOrigin()}${API_BASE}/upload/${bucket}/${encodeURIComponent(key)}`;
  }

  return storedUrl || null;
}

export function enrichSystemSettingsAssets(settings = {}) {
  if (!settings || typeof settings !== 'object') return settings;

  return {
    ...settings,
    logo_url: getStoragePublicUrl('system-assets', settings.logo_file_path, settings.logo_url),
    pdf_header_url: getStoragePublicUrl(
      'system-assets',
      settings.pdf_header_file_path,
      settings.pdf_header_url
    ),
    pdf_footer_url: getStoragePublicUrl(
      'system-assets',
      settings.pdf_footer_file_path,
      settings.pdf_footer_url
    ),
    pdf_watermark_url: getStoragePublicUrl(
      'system-assets',
      settings.pdf_watermark_file_path,
      settings.pdf_watermark_url
    ),
  };
}
