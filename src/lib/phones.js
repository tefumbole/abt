/** Accept +250794… or 250794… (spaces/dashes ignored). Returns stored form or ''. */
export function acceptPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9) return '';
  return plus ? `+${digits}` : digits;
}

export function phoneHint(phone) {
  return acceptPhone(phone) || String(phone || '').trim();
}
