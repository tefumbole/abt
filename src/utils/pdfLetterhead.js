import { DEFAULT_LOGO_URL } from '@/constants/branding';
import { getStoragePublicUrl } from '@/utils/storageUrl';

export function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_APP_URL || 'https://www.alpha-bridge.net';
}

export function getAgreementVerifyUrl(shareholderId) {
  if (!shareholderId) return '';
  return `${getAppOrigin()}/verify/agreement/${shareholderId}`;
}

export function normalizeBrandingSettings(settings = {}) {
  const appName = settings.application_name || 'Alpha Bridge';

  return {
    application_name: appName,
    logo_url: getStoragePublicUrl('system-assets', settings.logo_file_path, settings.logo_url) || DEFAULT_LOGO_URL,
    pdf_header_url: getStoragePublicUrl('system-assets', settings.pdf_header_file_path, settings.pdf_header_url),
    pdf_footer_url: getStoragePublicUrl('system-assets', settings.pdf_footer_file_path, settings.pdf_footer_url),
  };
}

export function buildPdfHeaderHtml(settings = {}) {
  const branding = normalizeBrandingSettings(settings);

  if (branding.pdf_header_url) {
    return `
      <div style="margin-bottom: 24px; width: 100%;">
        <img src="${branding.pdf_header_url}" alt="Document header" crossorigin="anonymous"
          style="width: 100%; max-height: 140px; object-fit: contain; display: block;" />
      </div>
    `;
  }

  return `
    <div style="margin-bottom: 24px; text-align: center; border-bottom: 2px solid #003D82; padding-bottom: 12px;">
      <img src="${branding.logo_url}" alt="Logo" crossorigin="anonymous"
        style="max-height: 64px; max-width: 100%; object-fit: contain; margin-bottom: 8px;" />
      <div style="font-size: 18px; font-weight: 700; color: #003D82;">${branding.application_name}</div>
    </div>
  `;
}

export function buildPdfFooterHtml(settings = {}) {
  const branding = normalizeBrandingSettings(settings);

  if (branding.pdf_footer_url) {
    return `
      <div style="margin-top: 32px; width: 100%;">
        <img src="${branding.pdf_footer_url}" alt="Document footer" crossorigin="anonymous"
          style="width: 100%; max-height: 80px; object-fit: contain; display: block;" />
      </div>
    `;
  }

  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #666;">
      ${branding.application_name}
    </div>
  `;
}

export function buildPdfWatermarkHtml(settings = {}) {
  const branding = normalizeBrandingSettings(settings);

  return `
    <div aria-hidden="true" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0;">
      <img src="${branding.logo_url}" alt="" crossorigin="anonymous"
        style="width: 320px; max-width: 70%; opacity: 0.08; object-fit: contain;" />
    </div>
  `;
}

export function buildPdfVerificationBlockHtml({ barcodeDataUrl, qrCodeDataUrl, label = 'Scan to view signed agreement' }) {
  if (!barcodeDataUrl && !qrCodeDataUrl) return '';

  return `
    <div style="margin-top: 28px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
      ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Reference barcode" style="max-width: 100%; height: 56px;" />` : ''}
      ${
        qrCodeDataUrl
          ? `<div style="text-align: center;">
              <img src="${qrCodeDataUrl}" alt="Verification QR Code" style="width: 96px; height: 96px; display: block; margin: 0 auto;" />
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #555;">${label}</p>
            </div>`
          : ''
      }
    </div>
  `;
}

export function wrapPdfContent(contentHtml, settings = {}, options = {}) {
  const { includeWatermark = true } = options;

  return `
    <div style="position: relative; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 32px 40px 24px; max-width: 800px; margin: 0 auto; background: white; overflow: hidden;">
      ${includeWatermark ? buildPdfWatermarkHtml(settings) : ''}
      <div style="position: relative; z-index: 1;">
        ${buildPdfHeaderHtml(settings)}
        ${contentHtml}
        ${buildPdfFooterHtml(settings)}
      </div>
    </div>
  `;
}
