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
