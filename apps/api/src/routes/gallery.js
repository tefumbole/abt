import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'director']);
const FILE_TYPES = new Set(['image', 'video', 'audio']);
const URL_TYPES = new Set(['youtube', 'youtube_short', 'tiktok', 'instagram', 'facebook']);
const ALL_TYPES = new Set([...FILE_TYPES, ...URL_TYPES]);
const oembedCache = new Map();

function youtubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }
    const fromQuery = parsed.searchParams.get('v');
    if (fromQuery) return fromQuery;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex((part) => part === 'embed' || part === 'shorts');
    if (marker >= 0) return parts[marker + 1] || null;
  } catch {
    /* ignore */
  }
  const match = String(url).match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/
  );
  return match?.[1] || null;
}

function tiktokVideoId(url) {
  if (!url) return null;
  return String(url).match(/\/video\/(\d+)/)?.[1] || null;
}

function instagramPath(url) {
  if (!url) return null;
  const match = String(url).match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? `${match[1]}/${match[2]}` : null;
}

async function tiktokThumbnail(url) {
  if (!url) return null;
  if (oembedCache.has(url)) return oembedCache.get(url);
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    const json = res.ok ? await res.json() : {};
    const thumb = json.thumbnail_url || null;
    oembedCache.set(url, thumb);
    return thumb;
  } catch {
    oembedCache.set(url, null);
    return null;
  }
}

async function enrichPreview(item) {
  if (item.type === 'youtube' || item.type === 'youtube_short') {
    const id = youtubeId(item.media_url);
    return {
      ...item,
      embed_src: id ? `https://www.youtube.com/embed/${id}` : null,
      thumbnail_url: id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null,
    };
  }
  if (item.type === 'tiktok') {
    const id = tiktokVideoId(item.media_url);
    return {
      ...item,
      embed_src: id ? `https://www.tiktok.com/player/v1/${id}` : null,
      thumbnail_url: await tiktokThumbnail(item.media_url),
    };
  }
  if (item.type === 'instagram') {
    const path = instagramPath(item.media_url);
    return {
      ...item,
      embed_src: path ? `https://www.instagram.com/${path}/embed` : null,
      thumbnail_url: null,
    };
  }
  if (item.type === 'facebook') {
    return {
      ...item,
      embed_src: item.media_url
        ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.media_url)}&show_text=false`
        : null,
      thumbnail_url: null,
    };
  }
  return { ...item, embed_src: null, thumbnail_url: null };
}

function requireAdmin(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function mapItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    file_path: row.file_path,
    media_url: row.media_url,
    sort_order: Number(row.sort_order) || 0,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Public published gallery items */
router.get('/', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM gallery_items
       WHERE is_published = 1
       ORDER BY sort_order ASC, created_at DESC`
    );
    const data = await Promise.all(rows.map((row) => enrichPreview(mapItem(row))));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Admin: all items */
router.get('/admin', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM gallery_items ORDER BY sort_order ASC, created_at DESC`
    );
    const data = await Promise.all(rows.map((row) => enrichPreview(mapItem(row))));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      type,
      title = null,
      description = null,
      file_path = null,
      media_url = null,
      is_published = true,
      sort_order,
    } = req.body || {};

    if (!ALL_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid gallery item type' });
    }
    if (FILE_TYPES.has(type) && !file_path) {
      return res.status(400).json({ error: 'file_path is required for file uploads' });
    }
    if (URL_TYPES.has(type) && !media_url) {
      return res.status(400).json({ error: 'media_url is required for social / embed links' });
    }

    const pool = getPool();
    let order = Number(sort_order);
    if (!Number.isFinite(order)) {
      const [maxRows] = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM gallery_items'
      );
      order = Number(maxRows[0]?.max_order || 0) + 1;
    }

    const id = randomUUID();
    await pool.query(
      `INSERT INTO gallery_items
        (id, type, title, description, file_path, media_url, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        type,
        title || null,
        description || null,
        file_path || null,
        media_url || null,
        order,
        is_published ? 1 : 0,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM gallery_items WHERE id = ? LIMIT 1', [id]);
    res.status(201).json({ data: mapItem(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const pool = getPool();
    const [existing] = await pool.query('SELECT * FROM gallery_items WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });

    const current = existing[0];
    const type = req.body.type ?? current.type;
    if (!ALL_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid gallery item type' });
    }

    const title = req.body.title !== undefined ? req.body.title : current.title;
    const description = req.body.description !== undefined ? req.body.description : current.description;
    const file_path = req.body.file_path !== undefined ? req.body.file_path : current.file_path;
    const media_url = req.body.media_url !== undefined ? req.body.media_url : current.media_url;
    const sort_order = req.body.sort_order !== undefined ? Number(req.body.sort_order) : current.sort_order;
    const is_published =
      req.body.is_published !== undefined ? (req.body.is_published ? 1 : 0) : current.is_published;

    if (FILE_TYPES.has(type) && !file_path) {
      return res.status(400).json({ error: 'file_path is required for file uploads' });
    }
    if (URL_TYPES.has(type) && !media_url) {
      return res.status(400).json({ error: 'media_url is required for social / embed links' });
    }

    await pool.query(
      `UPDATE gallery_items
       SET type = ?, title = ?, description = ?, file_path = ?, media_url = ?,
           sort_order = ?, is_published = ?
       WHERE id = ?`,
      [type, title || null, description || null, file_path || null, media_url || null, sort_order, is_published, id]
    );

    const [rows] = await pool.query('SELECT * FROM gallery_items WHERE id = ? LIMIT 1', [id]);
    res.json({ data: mapItem(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: 'ids array required' });

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < ids.length; i += 1) {
        await conn.query('UPDATE gallery_items SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM gallery_items WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
