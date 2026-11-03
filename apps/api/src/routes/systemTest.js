import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { allChecks, checkMap, moduleSummary, pages } from '../../../../src/config/systemTestCatalog.js';

const router = Router();
let tablesReady = null;

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');
const shotDir = path.join(uploadRoot, 'system-test');
fs.mkdirSync(shotDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, shotDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '.jpg').toLowerCase() || '.jpg';
      cb(null, `shot_${Date.now()}_${randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function newToken() {
  return randomBytes(24).toString('hex');
}

async function ensureTables() {
  if (!tablesReady) {
    const pool = getPool();
    tablesReady = pool.query(`CREATE TABLE IF NOT EXISTS system_test_drafts (
      token VARCHAR(64) NOT NULL PRIMARY KEY,
      tester_name VARCHAR(120) NOT NULL,
      tester_phone VARCHAR(30) NOT NULL,
      payload JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).then(() => pool.query(`CREATE TABLE IF NOT EXISTS system_test_reports (
      id VARCHAR(40) NOT NULL PRIMARY KEY,
      tester_name VARCHAR(120) NOT NULL,
      tester_phone VARCHAR(30) NOT NULL,
      payload JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`));
  }
  await tablesReady;
}

function parsePayload(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function blankDraft(name, phone) {
  return {
    tester_name: name,
    tester_phone: phone,
    checks: {},
    notes: {},
    screenshots: {},
    summary: '',
    page: 1,
  };
}

function buildRows(draft) {
  const map = checkMap();
  const pageList = pages();
  return allChecks().map((item, index) => {
    const page = pageList.findIndex((chunk) => chunk.checks.some((row) => row.id === item.id)) + 1;
    const result = draft.checks?.[item.id] || '';
    return {
      id: item.id,
      number: index + 1,
      page,
      module: item.module || item.section,
      label: map[item.id]?.text || item.text,
      text: item.text,
      result,
      note: draft.notes?.[item.id] || '',
      screenshot: draft.screenshots?.[item.id] || null,
    };
  });
}

function counts(rows) {
  return {
    works: rows.filter((row) => row.result === 'works').length,
    fails: rows.filter((row) => row.result === 'fails').length,
    skipped: rows.filter((row) => row.result === 'skipped').length,
    pending: rows.filter((row) => !row.result).length,
    total: rows.length,
  };
}

async function loadDraft(token) {
  if (!token) return null;
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM system_test_drafts WHERE token = ? LIMIT 1', [token]);
  if (!rows[0]) return null;
  return { ...rows[0], payload: parsePayload(rows[0].payload) || blankDraft(rows[0].tester_name, rows[0].tester_phone) };
}

router.get('/catalog', async (_req, res) => {
  res.json({
    pages: pages(),
    total: allChecks().length,
    modules: moduleSummary({}),
  });
});

router.post('/start', async (req, res) => {
  try {
    await ensureTables();
    const name = String(req.body?.tester_name || '').trim();
    const phone = String(req.body?.tester_phone || '').trim();
    if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
    if (phone.length < 8) return res.status(400).json({ error: 'Enter a WhatsApp number so we can find this test later.' });

    const pool = getPool();
    const token = newToken();
    const payload = blankDraft(name, phone);
    await pool.query(
      `INSERT INTO system_test_drafts (token, tester_name, tester_phone, payload) VALUES (?, ?, ?, ?)`,
      [token, name, phone, JSON.stringify(payload)]
    );
    res.json({ token, draft: payload, pages: pages(), total: allChecks().length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/retrieve', async (req, res) => {
  try {
    await ensureTables();
    const phone = String(req.body?.tester_phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'Enter the same WhatsApp number.' });
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM system_test_drafts WHERE tester_phone = ? ORDER BY updated_at DESC LIMIT 1',
      [phone]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No saved test for that number.' });
    res.json({
      token: rows[0].token,
      draft: parsePayload(rows[0].payload) || blankDraft(rows[0].tester_name, rows[0].tester_phone),
      pages: pages(),
      total: allChecks().length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    await ensureTables();
    const token = String(req.body?.token || '');
    const existing = await loadDraft(token);
    if (!existing) return res.status(404).json({ error: 'Test not found. Start again.' });

    const incoming = existing.payload || {};
    const payload = {
      ...incoming,
      tester_name: existing.tester_name,
      tester_phone: existing.tester_phone,
      checks: { ...(incoming.checks || {}), ...(req.body?.checks || {}) },
      notes: { ...(incoming.notes || {}), ...(req.body?.notes || {}) },
      screenshots: { ...(incoming.screenshots || {}), ...(req.body?.screenshots || {}) },
      summary: req.body?.summary !== undefined ? String(req.body.summary) : incoming.summary || '',
      page: Number(req.body?.page) || incoming.page || 1,
    };

    const pool = getPool();
    await pool.query('UPDATE system_test_drafts SET payload = ? WHERE token = ?', [JSON.stringify(payload), token]);
    res.json({ draft: payload, modules: moduleSummary(payload.checks) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/screenshot', upload.single('file'), async (req, res) => {
  try {
    await ensureTables();
    const token = String(req.body?.token || req.query.token || '');
    const checkId = String(req.body?.checkId || '');
    const existing = await loadDraft(token);
    if (!existing) return res.status(404).json({ error: 'Test not found.' });
    if (!req.file) return res.status(400).json({ error: 'Paste or choose a screenshot.' });
    if (!checkId) return res.status(400).json({ error: 'Missing check.' });

    const url = `/api/upload/system-test/${encodeURIComponent(req.file.filename)}`;
    const payload = existing.payload || blankDraft(existing.tester_name, existing.tester_phone);
    payload.screenshots = { ...(payload.screenshots || {}), [checkId]: url };
    const pool = getPool();
    await pool.query('UPDATE system_test_drafts SET payload = ? WHERE token = ?', [JSON.stringify(payload), token]);
    res.json({ url, draft: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/submit', async (req, res) => {
  try {
    await ensureTables();
    const token = String(req.body?.token || '');
    const existing = await loadDraft(token);
    if (!existing) return res.status(404).json({ error: 'Test not found.' });

    const payload = {
      ...(existing.payload || {}),
      summary: req.body?.summary !== undefined ? String(req.body.summary) : existing.payload?.summary || '',
      checks: { ...(existing.payload?.checks || {}), ...(req.body?.checks || {}) },
      notes: { ...(existing.payload?.notes || {}), ...(req.body?.notes || {}) },
    };
    const rows = buildRows(payload);
    const report = {
      id: randomUUID(),
      tester_name: existing.tester_name,
      tester_phone: existing.tester_phone,
      counts: counts(rows),
      modules: moduleSummary(payload.checks),
      rows,
      summary: payload.summary || '',
    };

    const pool = getPool();
    await pool.query(
      'INSERT INTO system_test_reports (id, tester_name, tester_phone, payload) VALUES (?, ?, ?, ?)',
      [report.id, report.tester_name, report.tester_phone, JSON.stringify({ ...payload, report })]
    );
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function publicReport(row) {
  const payload = parsePayload(row.payload) || {};
  const report = payload.report || {
    id: row.id,
    tester_name: row.tester_name,
    tester_phone: row.tester_phone,
    rows: buildRows(payload),
    summary: payload.summary || '',
  };
  report.counts = report.counts || counts(report.rows || []);
  report.modules = report.modules || moduleSummary(payload.checks || {});
  report.created_at = row.created_at;
  return report;
}

router.get('/reports', requireAuth, async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM system_test_reports ORDER BY created_at DESC LIMIT 100');
    res.json({ reports: rows.map(publicReport) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/:id', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM system_test_reports WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ report: publicReport(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
