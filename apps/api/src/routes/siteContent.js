import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import {
  PAGE_SCHEMA,
  getMenuBundle,
  getPublicSiteContent,
  getPageContent,
  savePageContent,
  setSetting,
  mergeOrder,
  LANDING_MENU_ITEMS,
  SIDE_MENU_ITEMS,
  SETTINGS_MENU_ITEMS,
  contentTabItems,
} from '../services/siteContent.js';

const router = Router();
const ADMIN_ROLES = new Set(['super_admin', 'admin', 'director']);

function requireAdmin(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/** Public: landing menu + page content with defaults */
router.get('/public', async (_req, res) => {
  try {
    const data = await getPublicSiteContent(getPool());
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Admin: full schema + menus + content */
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    const menus = await getMenuBundle(pool);
    const pages = {};
    for (const [key, schema] of Object.entries(PAGE_SCHEMA)) {
      const content = await getPageContent(pool, key);
      pages[key] = {
        ...schema,
        values: content?.fields || {},
      };
    }
    res.json({
      data: {
        schema: PAGE_SCHEMA,
        menus,
        pages,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function saveOrder(res, settingKey, itemsMap, order) {
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array of keys' });
  }
  const merged = mergeOrder(order, itemsMap);
  await setSetting(getPool(), settingKey, merged);
  res.json({ data: { order: merged } });
}

router.put('/menus/landing', requireAuth, requireAdmin, async (req, res) => {
  try {
    await saveOrder(res, 'landing_menu_order', LANDING_MENU_ITEMS, req.body?.order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/menus/side', requireAuth, requireAdmin, async (req, res) => {
  try {
    await saveOrder(res, 'side_menu_order', SIDE_MENU_ITEMS, req.body?.order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/menus/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    await saveOrder(res, 'settings_menu_order', SETTINGS_MENU_ITEMS, req.body?.order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/menus/content-tabs', requireAuth, requireAdmin, async (req, res) => {
  try {
    await saveOrder(res, 'content_tabs_order', contentTabItems(), req.body?.order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/pages/:page', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = String(req.params.page || '');
    if (!PAGE_SCHEMA[page]) {
      return res.status(404).json({ error: 'Unknown page' });
    }
    const saved = await savePageContent(getPool(), page, req.body?.values || req.body || {});
    res.json({ data: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
