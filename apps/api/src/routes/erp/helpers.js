const ADMIN_ROLES = new Set(['super_admin', 'admin', 'director']);

export function requireErpAdmin(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function bool(v, def = true) {
  if (v === undefined || v === null) return def;
  return Boolean(v === true || v === 1 || v === '1' || v === 'true');
}

export function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Normalises browser date inputs (`datetime-local`, ISO with Z/ms) to a MySQL
 * DATETIME literal. Falls back to now when the value cannot be parsed.
 */
export function mysqlDateTime(value) {
  const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (!value) return now();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? now() : value.toISOString().slice(0, 19).replace('T', ' ');
  }
  const raw = String(value).trim();
  // Already a plain `YYYY-MM-DD HH:MM[:SS]` — keep the caller's wall-clock time.
  const plain = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  if (plain) return `${plain[1]} ${plain[2]}${plain[3] || ':00'}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00:00`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return now();
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
