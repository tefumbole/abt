/**
 * WhatsApp message templates — Beyond Enterprise layout, Alpha Bridge branding.
 */
import { COMPANY_NAME } from '../constants/branding.js';

export function companyName() {
  return String(COMPANY_NAME || 'Alpha Bridge Technologies').trim() || 'Alpha Bridge Technologies';
}

export function statusBlock(emoji, title) {
  return `${emoji} *${String(title).toUpperCase()}*\n━━━━━━━━━━━━━━━━\n`;
}

export function greeting(name) {
  const n = String(name || '').trim();
  return n ? `Hello *${n}*,\n\n` : '';
}

export function bullet(label, value) {
  return `◾ *${label}:* ${value}\n`;
}

export function actionLink(label, url) {
  return `\n👉 *${label}:*\n${url}\n`;
}

export function footer() {
  return `\n_${companyName()}_`;
}

export function otpPurposeLabel(purpose = null) {
  const key = String(purpose || '').toLowerCase().trim();
  const map = {
    login: 'Login verification',
    'login verification': 'Login verification',
    password_reset: 'Password reset',
    'password reset': 'Password reset',
    reset: 'Password reset',
    register: 'Account registration',
    registration: 'Account registration',
    verify: 'Account verification',
    customer: 'Account registration',
  };
  if (map[key]) return map[key];
  if (!purpose) return 'Login verification';
  return String(purpose)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Standard OTP / authentication WhatsApp template (matches Beyond layout).
 */
export function otpMessage(otp, purpose = 'login', expiresMinutes = 10) {
  const company = companyName();
  const purposeLabel = otpPurposeLabel(purpose);
  const minutes = Math.max(1, Number(expiresMinutes) || 10);

  let msg = statusBlock('🔐', 'Authentication');
  msg += `Welcome to *${company}*.\n\n`;
  msg += 'Your one-time passcode (OTP) is:\n\n';
  msg += `👉 *${otp}*\n\n`;
  msg += '━━━━━━━━━━━━━━━━\n';
  msg += bullet('Purpose', purposeLabel);
  msg += bullet('Expires in', `${minutes} minutes`);
  msg += '\n⚠️ *Security notice:* Never share this code with anyone. Our team will never ask for your OTP.';
  msg += footer();
  return msg;
}

/** Generic status message with greeting, body, optional bullets, optional link */
export function buildStatusMessage({
  emoji = '📩',
  title,
  name = null,
  body = '',
  bullets = [],
  linkLabel = null,
  linkUrl = null,
  extra = '',
}) {
  let msg = statusBlock(emoji, title);
  if (name) msg += greeting(name);
  if (body) msg += `${body}${body.endsWith('\n') ? '' : '\n'}`;
  for (const [label, value] of bullets) {
    if (value != null && value !== '') msg += bullet(label, value);
  }
  if (linkLabel && linkUrl) msg += actionLink(linkLabel, linkUrl);
  if (extra) msg += `\n${extra}`;
  msg += footer();
  return msg;
}
