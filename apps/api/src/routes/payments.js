import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendTextMessage, formatPhoneNumber } from '../services/wasenderWhatsAppService.js';
import { COMPANY_NAME as BRAND } from '../constants/branding.js';
import { cacheGet, cachePut } from '../services/commerceCache.js';
import {
  formatRwf,
  getBalance,
  momoNumber,
  pawapayConfigured,
} from '../services/pawapayClient.js';
import { handleCallback, refreshAndApply, startDeposit } from '../services/pawapayPayments.js';

const router = Router();

async function pawapayCallback(req, res) {
  try {
    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).length
      ? req.body
      : {};
    await handleCallback(payload);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('PawaPay callback error', err.message);
    res.status(200).json({ status: 'ok' });
  }
}

router.post('/pawapay/deposits/callback', pawapayCallback);
router.post('/pawapay/checkouts/callback', pawapayCallback);
router.post('/pawapay/payouts/callback', pawapayCallback);
router.post('/pawapay/refunds/callback', pawapayCallback);
router.post('/pawapay/callback', pawapayCallback);

router.use(requireAuth);

router.get('/pawapay/:depositId/status', async (req, res) => {
  try {
    const row = await refreshAndApply(req.params.depositId);
    if (!row) return res.status(404).json({ status: 'missing' });
    const confirmed = row.status === 'completed' && row.applied_at;
    res.json({
      status: confirmed ? 'completed' : (row.status === 'failed' ? 'failed' : 'pending'),
      raw: row.raw_status,
      purpose: row.purpose,
      purpose_id: row.purpose_id,
      message: confirmed
        ? 'Payment received.'
        : row.status === 'failed'
          ? 'Payment was not approved. No money was taken.'
          : 'Waiting for the customer to approve on the phone.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const FINANCE_ROLES = new Set(['super_admin', 'admin', 'administrator']);

function isFinanceAdmin(req) {
  return FINANCE_ROLES.has(String(req.user?.role || '').toLowerCase());
}

function requireFinance(req, res, next) {
  if (isFinanceAdmin(req)) return next();
  return res.status(403).json({ error: 'Only administrators can manage withdrawals and MoMo payouts' });
}

function unpaidClause() {
  return `payment_status NOT IN ('paid', '4', 4)`;
}

function dueOf(sale) {
  return Math.max(0, Number(sale.grand_total || 0) - Number(sale.paid_amount || 0));
}

function statusLabel(value) {
  const v = String(value);
  if (v === '4' || v === 'paid') return { label: 'Paid', tone: 'ok' };
  if (v === '3' || v === 'partial') return { label: 'Partial', tone: 'wait' };
  if (v === '1' || v === 'pending') return { label: 'Pending', tone: 'wait' };
  return { label: 'Due', tone: 'no' };
}

router.get('/wallet', async (_req, res) => {
  const cached = cacheGet('abt.pawapay.wallet_label');
  res.json({
    total: cached || '',
    configured: pawapayConfigured(),
  });
});

router.get('/wallet/live', async (_req, res) => {
  try {
    const cached = cacheGet('abt.pawapay.wallet_label');
    if (cached) return res.json({ total: cached, configured: pawapayConfigured(), cached: true });
    if (!pawapayConfigured()) return res.json({ total: '', configured: false });
    const { total } = await getBalance();
    cachePut('abt.pawapay.wallet_label', total, 90_000);
    res.json({ total, configured: true, cached: false });
  } catch (err) {
    res.json({ total: cacheGet('abt.pawapay.wallet_label') || '', error: err.message, configured: pawapayConfigured() });
  }
});

router.get('/awaiting', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT s.id, s.reference, s.customer_id, s.grand_total, s.paid_amount, s.payment_status,
              s.created_at, s.customer_name, s.customer_phone,
              c.name AS customer, c.phone AS customer_phone_lookup
       FROM sales s
       LEFT JOIN erp_customers c ON c.id = s.customer_id
       WHERE ${unpaidClause()}
       ORDER BY s.created_at DESC
       LIMIT 250`
    );
    res.json({
      data: rows.map((row) => {
        const due = dueOf(row);
        return {
          ...row,
          unique_id: row.id,
          order_id: row.reference,
          customer_name: row.customer_name || row.customer || 'Walk-in Customer',
          phone: row.customer_phone || row.customer_phone_lookup || '',
          amount: Number(row.grand_total || 0),
          paid_amount: Number(row.paid_amount || 0),
          due,
          status: statusLabel(row.payment_status),
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/awaiting/delete', requireFinance, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ error: 'No sales selected' });
    const pool = getPool();
    const [paid] = await pool.query(
      `SELECT id FROM sales WHERE id IN (${ids.map(() => '?').join(',')}) AND payment_status IN ('paid','4',4)`,
      ids
    );
    if (paid.length) return res.status(400).json({ error: 'Paid sales cannot be deleted' });
    await pool.query(`DELETE FROM product_sales WHERE sale_id IN (${ids.map(() => '?').join(',')})`, ids);
    await pool.query(`DELETE FROM sales WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/awaiting/request', requireFinance, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean).slice(0, 30) : [];
    if (!ids.length) return res.status(400).json({ error: 'Select up to 30 unpaid sales' });
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT s.*, c.phone AS lookup_phone, c.name AS lookup_name
       FROM sales s LEFT JOIN erp_customers c ON c.id = s.customer_id
       WHERE s.id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    const appUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'https://alpha-bridge.net';
    let sent = 0;
    const errors = [];
    for (const sale of rows) {
      const due = dueOf(sale);
      const phone = sale.customer_phone || sale.lookup_phone;
      if (!phone || due < 100) {
        errors.push(`${sale.reference}: needs a phone and at least 100 RWF still due`);
        continue;
      }
      const link = `${appUrl}/pay/${sale.id}`;
      const text = `${BRAND}\nPayment request for ${sale.reference}\nAmount due: ${formatRwf(due)}\nPay here: ${link}`;
      const result = await sendTextMessage(formatPhoneNumber(phone), text);
      if (result?.success === false || result?.error) {
        errors.push(`${sale.reference}: ${result.error || 'WhatsApp failed'}`);
      } else {
        sent += 1;
      }
    }
    res.json({ success: true, sent, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/momo', requireFinance, async (_req, res) => {
  try {
    const pool = getPool();
    const [deposits] = await pool.query(
      'SELECT id, customer_name, phone, amount, status, note, created_at, campay_reference FROM deposits WHERE payment_method = 3 ORDER BY created_at DESC'
    );
    const [donations] = await pool.query(
      `SELECT id, person_name AS customer_name, phone, amount, status, note, created_at, campay_reference
       FROM public_donations
       WHERE method = 'momo' AND status = 'paid'`
    );
    const [payouts] = await pool.query(
      'SELECT id, person_name AS customer_name, phone, amount, status, note, created_at, campay_reference FROM campay_payouts ORDER BY created_at DESC'
    );
    const depositRefs = new Set(deposits.map((d) => d.campay_reference).filter(Boolean));
    const rows = [
      ...deposits.map((d) => ({ ...d, type: 'Deposit', person: d.customer_name, tone: d.status === 1 ? 'ok' : d.status === 0 ? 'wait' : 'no' })),
      ...donations
        .filter((d) => !d.campay_reference || !depositRefs.has(d.campay_reference))
        .map((d) => ({ ...d, type: 'Deposit', person: d.customer_name, tone: 'ok' })),
      ...payouts.map((d) => ({
        ...d,
        type: 'Withdrawal',
        person: d.customer_name,
        tone: d.status === 'paid' ? 'ok' : d.status === 'pending' ? 'wait' : 'no',
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function rankWithdrawal(batch) {
  const lines = batch.lines || [];
  const pendingEmpty = lines.some((l) => l.status === 'pending' && !l.campay_reference);
  const pending = lines.some((l) => l.status === 'pending');
  const allPaid = lines.length && lines.every((l) => l.status === 'paid');
  if (pendingEmpty) return 0;
  if (pending) return 1;
  if (!allPaid) return 2;
  return 3;
}

router.get('/withdrawals', requireFinance, async (_req, res) => {
  try {
    const pool = getPool();
    const [requests] = await pool.query('SELECT * FROM campay_payout_requests ORDER BY created_at DESC');
    const [lines] = await pool.query('SELECT * FROM campay_payouts ORDER BY created_at DESC');
    const byRequest = new Map(requests.map((r) => [r.id, { ...r, lines: [] }]));
    for (const line of lines) {
      if (line.request_id && byRequest.has(line.request_id)) {
        byRequest.get(line.request_id).lines.push(line);
      }
    }
    const data = [...byRequest.values()]
      .filter((b) => b.lines.length)
      .sort((a, b) => {
        const ra = rankWithdrawal(a);
        const rb = rankWithdrawal(b);
        if (ra !== rb) return ra - rb;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/withdrawals/search', requireFinance, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const like = `%${q}%`;
    const [customers] = await getPool().query(
      `SELECT id, name, phone FROM erp_customers
       WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?) LIMIT 20`,
      [like, like]
    );
    const [users] = await getPool().query(
      `SELECT id, COALESCE(name, email) AS name, phone FROM users
       WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?) LIMIT 20`,
      [like, like, like]
    );
    res.json({
      data: [
        ...customers.map((r) => ({ ...r, kind: 'customer' })),
        ...users.map((r) => ({ ...r, kind: 'user' })),
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/withdrawals', requireFinance, async (req, res) => {
  try {
    const note = String(req.body.note || '').trim();
    const lines = Array.isArray(req.body.lines) ? req.body.lines.slice(0, 40) : [];
    if (!lines.length) return res.status(400).json({ error: 'Add at least one payout line' });

    const pool = getPool();
    const requester = req.user?.name || req.user?.email || 'Admin';
    const [dup] = await pool.query(
      `SELECT r.id FROM campay_payout_requests r
       JOIN campay_payouts p ON p.request_id = r.id
       WHERE r.requester_name = ? AND COALESCE(r.note,'') = ? AND r.created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
         AND p.status <> 'paid' AND (p.campay_reference IS NULL OR p.campay_reference = '')
       LIMIT 1`,
      [requester, note]
    );
    if (dup.length) return res.status(400).json({ error: 'An identical pending withdrawal was submitted in the last 10 minutes' });

    const requestId = randomUUID();
    await pool.query(
      `INSERT INTO campay_payout_requests (id, requester_name, note, status, created_by)
       VALUES (?, ?, ?, 'pending', ?)`,
      [requestId, requester, note, req.user?.id || null]
    );

    for (const line of lines) {
      const amount = Math.round(Number(line.amount));
      if (amount < 100 || amount > 1_000_000) {
        return res.status(400).json({ error: 'Each amount must be between 100 and 1 000 000 RWF' });
      }
      await pool.query(
        `INSERT INTO campay_payouts
          (id, request_id, customer_id, person_name, phone, amount, momo_name, external_reference, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          randomUUID(),
          requestId,
          line.customer_id || null,
          line.person_name || line.name,
          momoNumber(line.phone),
          amount,
          line.momo_name || null,
          `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          note,
        ]
      );
    }
    res.json({ success: true, id: requestId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/withdrawals/:id/delete', requireFinance, async (req, res) => {
  try {
    const pool = getPool();
    const [paid] = await pool.query(
      "SELECT id FROM campay_payouts WHERE request_id = ? AND status = 'paid' LIMIT 1",
      [req.params.id]
    );
    if (paid.length) return res.status(400).json({ error: 'A paid line cannot be deleted' });
    await pool.query('DELETE FROM campay_payouts WHERE request_id = ?', [req.params.id]);
    await pool.query('DELETE FROM campay_payout_requests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/deposits', async (_req, res) => {
  try {
    const pool = getPool();
    const [deposits] = await pool.query(
      `SELECT d.*, c.name AS client_name, c.phone AS client_phone
       FROM deposits d
       LEFT JOIN erp_customers c ON c.id = d.customer_id
       WHERE d.payment_method = 3
       ORDER BY d.created_at DESC`
    );
    const [donations] = await pool.query(
      `SELECT id, person_name AS customer_name, phone, amount, 0 AS charges, amount AS amount_received,
              'momo' AS method, status, note, campay_reference, created_at
       FROM public_donations WHERE method = 'momo' AND status = 'paid'`
    );
    const refs = new Set(deposits.map((d) => d.campay_reference).filter(Boolean));
    const rows = [
      ...deposits.map((d) => ({
        ...d,
        client: d.customer_name || d.client_name || '—',
        paid: Number(d.amount || 0),
        received: Number(d.amount_received ?? d.amount ?? 0),
        charges: Number(d.charges || 0),
        method: 'PawaPay',
        tone: d.status === 1 ? 'ok' : d.status === 0 ? 'wait' : 'no',
        real_deposit: true,
      })),
      ...donations
        .filter((d) => !d.campay_reference || !refs.has(d.campay_reference))
        .map((d) => ({
          ...d,
          client: d.customer_name,
          paid: Number(d.amount || 0),
          received: Number(d.amount || 0),
          charges: 0,
          method: 'PawaPay',
          tone: 'ok',
          real_deposit: false,
        })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({
      data: rows,
      wallet: cacheGet('abt.pawapay.wallet_label') || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/deposits/live', async (_req, res) => {
  const cached = cacheGet('btw.deposit.live');
  if (cached) return res.json(cached);
  try {
    let total = cacheGet('abt.pawapay.wallet_label') || '';
    if (!total && pawapayConfigured()) {
      const bal = await getBalance();
      total = bal.total;
      cachePut('abt.pawapay.wallet_label', total, 90_000);
    }
    const [rows] = await getPool().query(
      'SELECT id, status FROM deposits WHERE payment_method = 3 ORDER BY created_at DESC LIMIT 80'
    );
    const payload = {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        status: r.status,
        tone: r.status === 1 ? 'ok' : r.status === 0 ? 'wait' : 'no',
      })),
    };
    cachePut('btw.deposit.live', payload, 20_000);
    res.json(payload);
  } catch (err) {
    res.json({ total: cacheGet('abt.pawapay.wallet_label') || '', rows: [], error: err.message });
  }
});

router.post('/deposits', requireFinance, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const method = Number(req.body.payment_method || 3);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Amount is required' });
    if (![1, 3, 4].includes(method)) return res.status(400).json({ error: 'Unsupported payment method' });
    const pool = getPool();
    const id = randomUUID();
    let status = method === 1 ? 1 : 0;
    let pawapayDepositId = null;
    if (method === 3) {
      if (amount < 100) return res.status(400).json({ error: 'MoMo deposits must be at least 100 RWF' });
      if (!req.body.phone) return res.status(400).json({ error: 'A phone number is required for PawaPay' });
      await pool.query(
        `INSERT INTO deposits
          (id, customer_id, customer_name, phone, account_id, amount, amount_received, charges,
           payment_method, status, note, created_by)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, 0, ?, ?)`,
        [
          id,
          req.body.customer_id || null,
          req.body.customer_name || null,
          req.body.phone || null,
          req.body.account_id || null,
          amount,
          method,
          req.body.note || null,
          req.user?.id || null,
        ]
      );
      const started = await startDeposit({
        purpose: 'deposit',
        purposeId: id,
        amount,
        phone: req.body.phone,
        description: req.body.note || `${BRAND} deposit`,
        userId: req.user?.id || null,
      });
      if (!started.ok) {
        await pool.query('DELETE FROM deposits WHERE id = ?', [id]);
        return res.status(400).json({ error: started.message });
      }
      pawapayDepositId = started.deposit?.deposit_id || null;
      if (started.deposit?.status === 'completed') status = 1;
      await pool.query(
        'UPDATE deposits SET campay_reference = ?, pawapay_deposit_id = ?, status = ? WHERE id = ?',
        [pawapayDepositId, pawapayDepositId, status, id]
      );
      return res.json({
        success: true,
        id,
        status,
        deposit_id: pawapayDepositId,
        configured: pawapayConfigured(),
      });
    }
    await pool.query(
      `INSERT INTO deposits
        (id, customer_id, customer_name, phone, account_id, amount, amount_received, charges,
         payment_method, status, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        id,
        req.body.customer_id || null,
        req.body.customer_name || null,
        req.body.phone || null,
        req.body.account_id || null,
        amount,
        status === 1 ? amount : null,
        method,
        status,
        req.body.note || null,
        req.user?.id || null,
      ]
    );
    res.json({ success: true, id, status, configured: pawapayConfigured() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deposits/delete', requireFinance, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ error: 'No deposits selected' });
    await getPool().query(`DELETE FROM deposits WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lookups', async (_req, res) => {
  try {
    const pool = getPool();
    const [customers] = await pool.query('SELECT id, name, phone FROM erp_customers WHERE is_active = 1 ORDER BY name');
    const [accounts] = await pool.query('SELECT id, name, account_no FROM erp_accounts WHERE is_active = 1 ORDER BY name');
    res.json({ customers, accounts, financeAdmin: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PawaPay confirms via callback / GET — no Campay-style history scrape.
router.post('/deposits/import-history', requireFinance, async (_req, res) => {
  res.json({ imported: 0, configured: pawapayConfigured(), provider: 'pawapay' });
});

router.get('/me', (req, res) => {
  res.json({ financeAdmin: isFinanceAdmin(req), role: req.user?.role || null });
});

export default router;
