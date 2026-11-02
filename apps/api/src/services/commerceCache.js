const store = new Map();

export function cacheGet(key) {
  const row = store.get(key);
  if (!row) return undefined;
  if (row.expiresAt && Date.now() > row.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return row.value;
}

export function cachePut(key, value, ttlMs) {
  store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : 0 });
  return value;
}
