/**
 * Held (suspended) POS carts, persisted per browser in localStorage.
 *
 * A hold is `{ id, label, created_at, payload }` where `payload` is the whole
 * cart context (items, customer, biller, warehouse, order-level charges).
 */

export const HOLDS_KEY = 'erp.pos.holds';
export const MAX_HOLDS = 50;

export function readHolds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOLDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((h) => h && h.id && h.payload) : [];
  } catch {
    return [];
  }
}

function persist(holds) {
  const capped = holds.slice(0, MAX_HOLDS);
  try {
    localStorage.setItem(HOLDS_KEY, JSON.stringify(capped));
  } catch {
    // Private mode / quota exceeded — holds stay in memory for this session only.
  }
  return capped;
}

export function addHold({ label, payload }) {
  const hold = {
    id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    label: label || 'Held sale',
    created_at: new Date().toISOString(),
    payload,
  };
  return persist([hold, ...readHolds()]);
}

export function removeHold(id) {
  return persist(readHolds().filter((h) => h.id !== id));
}
