import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Must match src/utils/storageUrl.js sanitizeStorageKey */
function sanitizeStorageKey(input) {
  return String(input || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const bucket = (req.params.bucket || 'default').replace(/[^a-z0-9_-]/gi, '');
    const dir = path.join(uploadRoot, bucket);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const custom = req.query.path || req.body?.path;
    cb(null, sanitizeStorageKey(custom || file.originalname || 'file'));
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/:bucket', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 50MB).' : err.message;
      return res.status(400).json({ error: message });
    }
    next();
  });
}, (req, res) => {
  const bucket = req.params.bucket.replace(/[^a-z0-9_-]/gi, '');
  const storedPath = req.file?.filename;
  if (!req.file || !storedPath) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ path: storedPath, Key: storedPath, bucket });
});

router.get('/:bucket/:filename', (req, res) => {
  const bucket = req.params.bucket.replace(/[^a-z0-9_-]/gi, '');
  const safe = sanitizeStorageKey(path.basename(req.params.filename));
  const filePath = path.join(uploadRoot, bucket, safe);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const ext = path.extname(safe).toLowerCase();
  if (ext === '.pdf') res.type('application/pdf');
  else if (ext === '.png') res.type('image/png');
  else if (ext === '.jpg' || ext === '.jpeg') res.type('image/jpeg');
  else if (ext === '.webp') res.type('image/webp');
  else if (ext === '.gif') res.type('image/gif');
  else if (ext === '.mp4') res.type('video/mp4');
  else if (ext === '.webm') res.type('video/webm');
  else if (ext === '.mov') res.type('video/quicktime');
  else if (ext === '.mp3') res.type('audio/mpeg');
  else if (ext === '.wav') res.type('audio/wav');
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(filePath);
});

export default router;
