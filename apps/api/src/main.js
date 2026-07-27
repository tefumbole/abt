import './env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { checkDatabaseConnection, getPool } from './db/pool.js';
import authRoutes, { seedAdminUser } from './routes/auth.js';
import otpRoutes from './routes/otp.js';
import dataRoutes from './routes/data.js';
import uploadRoutes from './routes/upload.js';
import usersRoutes from './routes/users.js';
import registerRoutes from './routes/register.js';
import tasksRoutes, { runProcessScheduled, runProcessReminders } from './routes/tasks.js';
import whatsappRoutes from './routes/whatsapp.js';
import systemRoutes from './routes/system.js';
import hrRoutes from './routes/hr.js';
import hrLettersRoutes from './routes/hr-letters.js';
import activityLogsRoutes from './routes/activityLogs.js';
import galleryRoutes from './routes/gallery.js';
import { APP_VERSION } from './constants/appVersion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3003);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

app.set('trust proxy', true);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    const wasenderConfigured = Boolean(
      process.env.WASENDER_API_KEY && !String(process.env.WASENDER_API_KEY).startsWith('your_')
    );
    let wasenderStatus = null;
    if (wasenderConfigured) {
      try {
        const base = String(process.env.WASENDER_BASE_URL || 'https://wasenderapi.com/api').replace(/\/$/, '');
        const statusRes = await fetch(`${base}/status`, {
          headers: {
            Authorization: `Bearer ${process.env.WASENDER_API_KEY}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        });
        const statusJson = await statusRes.json().catch(() => ({}));
        wasenderStatus = statusJson?.status || (statusRes.ok ? 'ok' : 'error');
      } catch {
        wasenderStatus = 'unreachable';
      }
    }
    res.json({
      ok: true,
      service: 'alphabridge-api',
      version: APP_VERSION,
      database: process.env.DB_NAME,
      backend: 'mysql',
      wasender: wasenderConfigured,
      wasenderStatus,
    });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use('/auth', authRoutes);
app.use('/auth/register', registerRoutes);
app.use('/auth/otp', otpRoutes);
app.use('/tasks', tasksRoutes);
app.use('/users', usersRoutes);
app.use('/data', dataRoutes);
app.use('/upload', uploadRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/system', systemRoutes);
app.use('/hr', hrRoutes);
app.use('/hr/letters', hrLettersRoutes);
app.use('/activity-logs', activityLogsRoutes);
app.use('/gallery', galleryRoutes);

app.use((err, _req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'Uploaded file is too large.' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

await checkDatabaseConnection();
await seedAdminUser();

app.listen(PORT, () => {
  console.log(`Alpha Bridge API listening on port ${PORT}`);
  console.log(`Uploads: ${uploadDir}`);
  console.log(`Wasender: ${process.env.WASENDER_API_KEY ? 'configured' : 'NOT configured'}`);

  const TASK_CRON_MS = 60_000;
  const runTaskCron = async () => {
    try {
      await runProcessScheduled();
      await runProcessReminders();
    } catch (err) {
      console.error('[task-cron]', err.message);
    }
  };
  runTaskCron();
  setInterval(runTaskCron, TASK_CRON_MS);
});
