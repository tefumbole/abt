/** Canonical brand assets and contact details — single source of truth */

export const COMPANY_NAME =
  import.meta.env.VITE_COMPANY_NAME || 'Alpha Bridge Technologies';

export const COMPANY_NAME_SHORT =
  import.meta.env.VITE_COMPANY_NAME_SHORT || 'Alpha Bridge';

export const WHATSAPP_PHONE =
  import.meta.env.VITE_ADMIN_PHONE_NUMBER || '+250794006160';

/** Digits only — for wa.me links */
export const WHATSAPP_WA_ME = WHATSAPP_PHONE.replace(/\D/g, '');

export const CONTACT_PHONE_DISPLAY =
  import.meta.env.VITE_CONTACT_PHONE_DISPLAY || '+250 794 006 160';

export const WEBSITE_URL =
  import.meta.env.VITE_SITE_URL || 'https://alpha-bridge.net';

export const WEBSITE_HOST =
  import.meta.env.VITE_WEBSITE_HOST || 'www.alpha-bridge.net';

export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL || 'info@alpha-bridge.net';

/** Local transparent PNG — CDN original had an opaque black background */
export const LOCAL_LOGO_URL = '/branding/alpha-bridge-logo.png';

/** Old Hostinger asset with solid black background (not suitable on blue UI) */
const LEGACY_OPAQUE_LOGO_URLS = new Set([
  'https://horizons-cdn.hostinger.com/81ef3422-3855-479e-bfe8-28a4ceb0df39/a742e501955dd22251276e445b31816d.png',
]);

function isLegacyOpaqueLogoUrl(url) {
  return typeof url === 'string' && LEGACY_OPAQUE_LOGO_URLS.has(url.trim());
}

const envLogo = import.meta.env.VITE_LOGO_URL;
export const DEFAULT_LOGO_URL =
  envLogo && !isLegacyOpaqueLogoUrl(envLogo) ? envLogo : LOCAL_LOGO_URL;

export const HERO_IMAGE_URL =
  import.meta.env.VITE_HERO_IMAGE_URL ||
  'https://horizons-cdn.hostinger.com/81ef3422-3855-479e-bfe8-28a4ceb0df39/dd5d2c583a8b091d7529cd8c4e5ff3ea.png';

export function whatsAppUrl(message) {
  const text = typeof message === 'string' ? message : '';
  return `https://wa.me/${WHATSAPP_WA_ME}?text=${encodeURIComponent(text)}`;
}

export function isValidLogoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (isLegacyOpaqueLogoUrl(trimmed)) return false;
  return /^https?:\/\/.+/i.test(trimmed) || trimmed.startsWith('/');
}

/** Prefer transparent local logo when env/settings still point at the opaque CDN file */
export function resolveLogoUrl(url) {
  if (!isValidLogoUrl(url)) return DEFAULT_LOGO_URL;
  return url.trim();
}
