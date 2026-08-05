import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { sendTextMessage, formatPhoneNumber, isWasenderConfigured } from '../../services/wasenderWhatsAppService.js';
import { mysqlDateTime, num, requireErpAdmin } from './helpers.js';

const router = Router();

const BOOKING_STATUSES = new Set([
  'requested', 'pending', 'confirmed', 'ongoing', 'completed', 'cancelled', 'rejected',
]);
const SIGNATURE_STATUSES = new Set(['none', 'pending', 'signed', 'declined']);
const REVIEW_STATUSES = new Set(['none', 'pending', 'approved', 'rejected']);

const BOOKING_SORT_COLUMNS = {
  from_datetime: 'b.from_datetime',
  to_datetime: 'b.to_datetime',
  reference: 'b.reference',
  grand_total: 'b.grand_total',
  created_at: 'b.created_at',
};

/** Starts within the next 7 days and not reminded in the last 24h. */
const REMINDER_PREDICATE = `(b.booking_status IN ('pending', 'confirmed')
  AND b.from_datetime BETWEEN NOW() AND (NOW() + INTERVAL 7 DAY)
  AND (b.reminder_sent_at IS NULL OR b.reminder_sent_at < (NOW() - INTERVAL 1 DAY)))`;

const UPCOMING_PREDICATE = `(b.booking_status IN ('pending', 'confirmed') AND b.from_datetime > NOW())`;
const ONGOING_PREDICATE = `((NOW() BETWEEN b.from_datetime AND b.to_datetime)
  AND b.booking_status NOT IN ('cancelled', 'rejected', 'completed'))`;

/** Named tab presets layered on top of the ad-hoc filters. */
const VIEW_PREDICATES = {
  list: null,
  request: `b.booking_status = 'requested'`,
  'awaiting-signature': `b.signature_status = 'pending'`,
  'pending-review': `b.signature_status = 'signed' AND b.review_status = 'pending'`,
  signed: `b.signature_status = 'signed' AND b.review_status = 'approved'`,
  reminder: REMINDER_PREDICATE,
  upcoming: UPCOMING_PREDICATE,
  ongoing: ONGOING_PREDICATE,
};

const BOOKING_JOINS = `FROM erp_bookings b
  LEFT JOIN erp_customers c ON c.id = b.customer_id
  LEFT JOIN warehouses w ON w.id = b.warehouse_id
  LEFT JOIN erp_billers bil ON bil.id = b.biller_id`;

function dayStart(value) {
  return `${String(value).slice(0, 10)} 00:00:00`;
}

function dayEnd(value) {
  return `${String(value).slice(0, 10)} 23:59:59`;
}

/** `YYYY-MM-DD` in server-local time, so default ranges never slip a day near midnight. */
function localDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function shiftMonths(date, months) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function normaliseCcRecipients(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return { name: null, phone: entry.trim() };
      const name = entry.name ? String(entry.name).trim() : null;
      const phone = entry.phone ? String(entry.phone).trim() : null;
      if (!name && !phone) return null;
      return { name: name || null, phone: phone || null };
    })
    .filter(Boolean);
}

function serialiseCcRecipients(value) {
  const list = normaliseCcRecipients(value);
  return list.length ? JSON.stringify(list) : null;
}

/**
 * Line total. Mirrors `bookingLineSubtotal` in src/lib/rentalFormat.js:
 * `flat` ignores the duration, every other method multiplies by it.
 */
function lineSubtotal(item = {}) {
  const qty = num(item.qty, 1);
  const price = num(item.net_unit_price);
  const duration = item.booking_method === 'flat' ? 1 : num(item.duration_hours, 1) || 1;
  return Math.max(0, qty * price * duration - num(item.discount) + num(item.tax));
}

/** Order total from lines plus order-level tax, discount and shipping. */
function bookingGrandTotal(items = [], order = {}) {
  const lines = items.reduce((sum, item) => sum + lineSubtotal(item), 0);
  return Math.max(0, lines + num(order.order_tax) - num(order.order_discount) + num(order.shipping));
}

function itemRow(bookingId, item, fallbackFrom, fallbackTo) {
  const method = item.booking_method ? String(item.booking_method) : 'duration';
  return [
    randomUUID(),
    bookingId,
    item.product_id,
    num(item.qty, 1),
    num(item.net_unit_price),
    num(item.duration_hours, 1) || 1,
    num(item.discount),
    num(item.tax),
    lineSubtotal(item),
    item.from_datetime ? mysqlDateTime(item.from_datetime) : fallbackFrom,
    item.to_datetime ? mysqlDateTime(item.to_datetime) : fallbackTo,
    item.batch_no ? String(item.batch_no) : null,
    method,
    item.number ? String(item.number) : null,
  ];
}

const ITEM_INSERT_SQL = `INSERT INTO erp_booking_products
  (id, booking_id, product_id, qty, net_unit_price, duration_hours, discount, tax, subtotal,
   from_datetime, to_datetime, batch_no, booking_method, \`number\`)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** Tab badge counters — deliberately unfiltered so they never follow the active view. */
async function bookingCounts(db) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS all_count,
       COALESCE(SUM(b.booking_status = 'requested'), 0) AS request,
       COALESCE(SUM(b.signature_status = 'pending'), 0) AS awaiting_signature,
       COALESCE(SUM(b.signature_status = 'signed' AND b.review_status = 'pending'), 0) AS pending_review,
       COALESCE(SUM(b.signature_status = 'signed' AND b.review_status = 'approved'), 0) AS signed,
       COALESCE(SUM(${REMINDER_PREDICATE}), 0) AS reminder,
       COALESCE(SUM(${UPCOMING_PREDICATE}), 0) AS upcoming,
       COALESCE(SUM(${ONGOING_PREDICATE}), 0) AS ongoing
     FROM erp_bookings b`
  );
  const r = rows[0] || {};

  // Per-status tallies so every filter pill can carry a number.
  const [byStatus] = await db.query(
    `SELECT booking_status, COUNT(*) AS total FROM erp_bookings GROUP BY booking_status`
  );
  const statuses = Object.fromEntries([...BOOKING_STATUSES].map((key) => [key, 0]));
  for (const row of byStatus) {
    if (BOOKING_STATUSES.has(row.booking_status)) statuses[row.booking_status] = num(row.total);
  }

  return {
    ...statuses,
    all: num(r.all_count),
    request: num(r.request),
    awaiting_signature: num(r.awaiting_signature),
    pending_review: num(r.pending_review),
    signed: num(r.signed),
    reminder: num(r.reminder),
    upcoming: num(r.upcoming),
    ongoing: num(r.ongoing),
  };
}

function mapBookingRow(row) {
  return {
    ...row,
    grand_total: num(row.grand_total),
    order_tax: num(row.order_tax),
    order_discount: num(row.order_discount),
    shipping: num(row.shipping),
    items_count: num(row.items_count),
    note: row.note ?? null,
    staff_note: row.staff_note ?? null,
    cc_recipients: normaliseCcRecipients(row.cc_recipients),
  };
}

async function loadBooking(db, id) {
  const [rows] = await db.query(
    `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone
     FROM erp_bookings b
     LEFT JOIN erp_customers c ON c.id = b.customer_id
     WHERE b.id = ?`,
    [id]
  );
  return rows[0] || null;
}

function actorId(req) {
  return req.user?.sub || req.user?.id || null;
}

function publicBaseUrl(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
  if (env && env !== '*') return String(env).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

/** Unique, WhatsApp-formatted recipient list built from a primary phone plus CC entries. */
function recipientPhones(primary, ccRecipients) {
  const phones = [];
  const seen = new Set();
  const push = (phone) => {
    const formatted = formatPhoneNumber(phone);
    if (!formatted || seen.has(formatted)) return;
    seen.add(formatted);
    phones.push(formatted);
  };
  push(primary);
  for (const cc of normaliseCcRecipients(ccRecipients)) push(cc.phone);
  return phones;
}

async function broadcast(phones, message, messageType) {
  const sent = [];
  const failed = [];
  for (const phone of phones) {
    try {
      const result = await sendTextMessage(phone, message, messageType);
      if (result?.success === false) failed.push({ phone, error: result.error || 'Send failed' });
      else sent.push(phone);
    } catch (err) {
      failed.push({ phone, error: err.message });
    }
  }
  return { sent, failed };
}

router.get('/bookings', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    let where = '1=1';

    if (req.query.q) {
      where += ' AND (b.reference LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }
    if (req.query.warehouse_id) {
      where += ' AND b.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }
    if (req.query.customer_id) {
      where += ' AND b.customer_id = ?';
      params.push(req.query.customer_id);
    }
    if (req.query.booking_status) {
      if (!BOOKING_STATUSES.has(String(req.query.booking_status))) {
        return res.status(400).json({ error: `Invalid booking_status: ${req.query.booking_status}` });
      }
      where += ' AND b.booking_status = ?';
      params.push(req.query.booking_status);
    }
    if (req.query.signature_status) {
      if (!SIGNATURE_STATUSES.has(String(req.query.signature_status))) {
        return res.status(400).json({ error: `Invalid signature_status: ${req.query.signature_status}` });
      }
      where += ' AND b.signature_status = ?';
      params.push(req.query.signature_status);
    }
    if (req.query.review_status) {
      if (!REVIEW_STATUSES.has(String(req.query.review_status))) {
        return res.status(400).json({ error: `Invalid review_status: ${req.query.review_status}` });
      }
      where += ' AND b.review_status = ?';
      params.push(req.query.review_status);
    }
    if (req.query.from) {
      where += ' AND b.from_datetime >= ?';
      params.push(dayStart(req.query.from));
    }
    if (req.query.to) {
      where += ' AND b.from_datetime <= ?';
      params.push(dayEnd(req.query.to));
    }

    const view = String(req.query.view || 'list').toLowerCase();
    const viewPredicate = VIEW_PREDICATES[view];
    if (viewPredicate) where += ` AND (${viewPredicate})`;

    const [aggRows] = await pool.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(b.grand_total), 0) AS grand_total
       ${BOOKING_JOINS}
       WHERE ${where}`,
      params
    );
    const total = num(aggRows[0]?.total);

    const sortBy = BOOKING_SORT_COLUMNS[String(req.query.sort_by || '')] || BOOKING_SORT_COLUMNS.from_datetime;
    const sortDir = String(req.query.sort_dir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const page = Math.max(1, Math.trunc(num(req.query.page, 1)) || 1);
    const perPage = Math.min(100, Math.max(1, Math.trunc(num(req.query.per_page, 10)) || 10));
    const offset = (page - 1) * perPage;

    const [rows] = await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone,
        w.name AS warehouse_name, bil.name AS biller_name,
        (SELECT COUNT(*) FROM erp_booking_products bp WHERE bp.booking_id = b.id) AS items_count
       ${BOOKING_JOINS}
       WHERE ${where}
       ORDER BY ${sortBy} ${sortDir}, b.reference DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({
      data: rows.map(mapBookingRow),
      total,
      page,
      per_page: perPage,
      totals: { grand_total: num(aggRows[0]?.grand_total) },
      counts: await bookingCounts(pool),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Must stay above `/bookings/:id` so "counts" is not read as an id.
router.get('/bookings/counts', requireAuth, requireErpAdmin, async (_req, res) => {
  try {
    res.json({ data: await bookingCounts(getPool()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bookings/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT b.*, w.name AS warehouse_name,
        c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
        c.address AS customer_address, c.company_name AS customer_company,
        bil.name AS biller_name
       ${BOOKING_JOINS}
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const booking = rows[0];
    const [items] = await pool.query(
      `SELECT bp.*, p.name AS product_name, p.code AS product_code
       FROM erp_booking_products bp
       LEFT JOIN products p ON p.id = bp.product_id
       WHERE bp.booking_id = ?`,
      [req.params.id]
    );
    res.json({
      data: {
        ...mapBookingRow(booking),
        items_count: items.length,
        items: items.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          product_name: i.product_name || null,
          product_code: i.product_code || null,
          qty: num(i.qty),
          net_unit_price: num(i.net_unit_price),
          duration_hours: num(i.duration_hours, 1),
          booking_method: i.booking_method || 'duration',
          number: i.number ?? null,
          batch_no: i.batch_no ?? null,
          discount: num(i.discount),
          tax: num(i.tax),
          subtotal: num(i.subtotal),
          from_datetime: i.from_datetime,
          to_datetime: i.to_datetime,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id || !b.from_datetime || !b.to_datetime) {
      return res.status(400).json({ error: 'warehouse_id, from_datetime, to_datetime required' });
    }
    const bookingStatus = b.booking_status ? String(b.booking_status) : 'pending';
    if (!BOOKING_STATUSES.has(bookingStatus)) {
      return res.status(400).json({ error: `Invalid booking_status: ${bookingStatus}` });
    }

    let reference = b.reference ? String(b.reference).trim() : '';
    if (reference) {
      const [dupe] = await pool.query(`SELECT id FROM erp_bookings WHERE reference = ?`, [reference]);
      if (dupe.length) return res.status(400).json({ error: 'reference already in use' });
    } else {
      reference = await nextErpReference('bk-', 'erp_bookings');
    }

    const id = randomUUID();
    const token = randomBytes(24).toString('hex');
    const from = mysqlDateTime(b.from_datetime);
    const to = mysqlDateTime(b.to_datetime);
    const contractType = b.contract_type ? String(b.contract_type) : 'none';
    const signatureStatus = contractType && contractType !== 'none' ? 'pending' : 'none';
    const grand = bookingGrandTotal(items, b);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO erp_bookings (id, reference, warehouse_id, customer_id, biller_id, from_datetime, to_datetime,
        booking_status, payment_status, contract_type, grand_total, note, staff_note, signature_token,
        signature_status, review_status, cc_recipients, order_tax, order_discount, shipping, source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null, from, to,
        bookingStatus, b.payment_status || 'pending', contractType, grand, b.note || null, b.staff_note || null,
        token, signatureStatus, 'none', serialiseCcRecipients(b.cc_recipients), num(b.order_tax),
        num(b.order_discount), num(b.shipping), b.source === 'customer' ? 'customer' : 'admin', actorId(req),
      ]
    );
    for (const item of items) {
      await conn.query(ITEM_INSERT_SQL, itemRow(id, item, from, to));
    }
    await conn.commit();
    res.status(201).json({ data: { id, reference, grand_total: grand, signature_token: token } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/bookings/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const existing = await loadBooking(pool, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const bookingStatus = b.booking_status ? String(b.booking_status) : existing.booking_status;
    if (!BOOKING_STATUSES.has(bookingStatus)) {
      return res.status(400).json({ error: `Invalid booking_status: ${bookingStatus}` });
    }

    const from = b.from_datetime ? mysqlDateTime(b.from_datetime) : existing.from_datetime;
    const to = b.to_datetime ? mysqlDateTime(b.to_datetime) : existing.to_datetime;
    const order = {
      order_tax: b.order_tax !== undefined ? num(b.order_tax) : num(existing.order_tax),
      order_discount: b.order_discount !== undefined ? num(b.order_discount) : num(existing.order_discount),
      shipping: b.shipping !== undefined ? num(b.shipping) : num(existing.shipping),
    };
    const grand = bookingGrandTotal(items, order);

    await conn.beginTransaction();
    await conn.query(`DELETE FROM erp_booking_products WHERE booking_id = ?`, [req.params.id]);
    for (const item of items) {
      await conn.query(ITEM_INSERT_SQL, itemRow(req.params.id, item, from, to));
    }
    await conn.query(
      `UPDATE erp_bookings SET warehouse_id = ?, customer_id = ?, biller_id = ?, from_datetime = ?, to_datetime = ?,
        booking_status = ?, payment_status = ?, contract_type = ?, grand_total = ?, note = ?, staff_note = ?,
        cc_recipients = ?, order_tax = ?, order_discount = ?, shipping = ?, source = ?
       WHERE id = ?`,
      [
        b.warehouse_id || existing.warehouse_id,
        b.customer_id !== undefined ? b.customer_id || null : existing.customer_id,
        b.biller_id !== undefined ? b.biller_id || null : existing.biller_id,
        from,
        to,
        bookingStatus,
        b.payment_status || existing.payment_status,
        b.contract_type !== undefined ? b.contract_type || 'none' : existing.contract_type,
        grand,
        b.note !== undefined ? b.note || null : existing.note,
        b.staff_note !== undefined ? b.staff_note || null : existing.staff_note,
        b.cc_recipients !== undefined ? serialiseCcRecipients(b.cc_recipients) : existing.cc_recipients,
        order.order_tax,
        order.order_discount,
        order.shipping,
        b.source === 'customer' || b.source === 'admin' ? b.source : existing.source,
        req.params.id,
      ]
    );
    await conn.commit();
    res.json({ data: { id: req.params.id, grand_total: grand } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/bookings/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [ex] = await pool.query(`SELECT id FROM erp_bookings WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await conn.beginTransaction();
    await conn.query(`DELETE FROM erp_booking_products WHERE booking_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM erp_bookings WHERE id = ?`, [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.post('/bookings/:id/status', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const bookingStatus = String(req.body?.booking_status || '');
    if (!BOOKING_STATUSES.has(bookingStatus)) {
      return res.status(400).json({ error: `Invalid booking_status: ${bookingStatus || '(empty)'}` });
    }
    const [ex] = await pool.query(`SELECT id FROM erp_bookings WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    await pool.query(`UPDATE erp_bookings SET booking_status = ? WHERE id = ?`, [bookingStatus, req.params.id]);
    res.json({ data: { id: req.params.id, booking_status: bookingStatus } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings/:id/review', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const action = String(req.body?.action || '').toLowerCase();
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    const booking = await loadBooking(pool, req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    const reviewStatus = action === 'approve' ? 'approved' : 'rejected';
    const promote = action === 'approve' && ['pending', 'requested'].includes(booking.booking_status);
    const bookingStatus = promote ? 'confirmed' : booking.booking_status;

    await pool.query(
      `UPDATE erp_bookings SET review_status = ?, review_note = ?, reviewed_at = NOW(), reviewed_by = ?,
        booking_status = ?
       WHERE id = ?`,
      [reviewStatus, req.body?.note || null, actorId(req), bookingStatus, req.params.id]
    );
    res.json({ data: { id: req.params.id, review_status: reviewStatus, booking_status: bookingStatus } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings/:id/send-sign-link', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const booking = await loadBooking(pool, req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    let token = booking.signature_token;
    if (!token) token = randomBytes(24).toString('hex');
    // review_status stays untouched — the public sign handler sets it to 'pending' on signing.
    await pool.query(
      `UPDATE erp_bookings SET signature_token = ?, signature_status = 'pending' WHERE id = ?`,
      [token, booking.id]
    );
    const link = `${publicBaseUrl(req)}/erp/public/booking/${token}`;

    if (!isWasenderConfigured()) {
      return res.status(503).json({ error: 'WhatsApp not configured', link });
    }

    const phones = recipientPhones(req.body?.phone || booking.customer_phone, booking.cc_recipients);
    if (!phones.length) return res.status(400).json({ error: 'Phone required', link });

    const message = `Rental booking ${booking.reference}: please sign.\n${link}`;
    const { sent, failed } = await broadcast(phones, message, 'erp-booking-sign');
    res.json({ ok: true, link, sent_to: sent, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings/:id/reminder', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone, w.name AS warehouse_name
       ${BOOKING_JOINS}
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const booking = rows[0];

    if (!isWasenderConfigured()) return res.status(503).json({ error: 'WhatsApp not configured' });

    const phones = recipientPhones(req.body?.phone || booking.customer_phone, booking.cc_recipients);
    if (!phones.length) return res.status(400).json({ error: 'Phone required' });

    const message = req.body?.message
      ? String(req.body.message)
      : [
          `Reminder: rental booking ${booking.reference}`,
          booking.customer_name ? `Customer: ${booking.customer_name}` : null,
          `From: ${booking.from_datetime}`,
          `To: ${booking.to_datetime}`,
          booking.warehouse_name ? `Location: ${booking.warehouse_name}` : null,
        ]
          .filter(Boolean)
          .join('\n');

    const { sent, failed } = await broadcast(phones, message, 'erp-booking-reminder');
    // Only mark as reminded when something actually went out, so the reminder queue stays truthful.
    if (!sent.length) {
      return res.status(502).json({ error: failed[0]?.error || 'Reminder could not be sent', failed });
    }
    await pool.query(`UPDATE erp_bookings SET reminder_sent_at = NOW() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true, sent_to: sent, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/booked-products', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const now = new Date();
    const from = dayStart(req.query.from || localDate(now));
    const to = dayEnd(req.query.to || localDate(shiftDays(now, 30)));

    const params = [to, from];
    let where = `b.booking_status NOT IN ('cancelled', 'rejected')
      AND b.from_datetime <= ? AND b.to_datetime >= ?`;
    if (req.query.warehouse_id) {
      where += ' AND b.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }

    const [rows] = await getPool().query(
      `SELECT bp.product_id, p.name AS product_name, p.code AS product_code,
        COALESCE(SUM(bp.qty), 0) AS total_qty,
        COUNT(DISTINCT b.id) AS bookings_count,
        MIN(COALESCE(bp.from_datetime, b.from_datetime)) AS next_from,
        MAX(COALESCE(bp.to_datetime, b.to_datetime)) AS next_to
       FROM erp_booking_products bp
       JOIN erp_bookings b ON b.id = bp.booking_id
       LEFT JOIN products p ON p.id = bp.product_id
       WHERE ${where}
       GROUP BY bp.product_id, p.name, p.code
       ORDER BY total_qty DESC`,
      params
    );

    res.json({
      data: rows.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name || null,
        product_code: r.product_code || null,
        total_qty: num(r.total_qty),
        bookings_count: num(r.bookings_count),
        next_from: r.next_from,
        next_to: r.next_to,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/calendar', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = dayStart(req.query.from || localDate(monthStart));
    const to = dayEnd(req.query.to || localDate(shiftMonths(monthStart, 2)));

    const params = [to, from];
    let where = `b.booking_status NOT IN ('cancelled', 'rejected')
      AND b.from_datetime <= ? AND b.to_datetime >= ?`;
    if (req.query.warehouse_id) {
      where += ' AND b.warehouse_id = ?';
      params.push(req.query.warehouse_id);
    }

    const [rows] = await getPool().query(
      `SELECT b.id, b.reference, c.name AS customer_name, w.name AS warehouse_name,
        b.from_datetime, b.to_datetime, b.booking_status, b.signature_status, b.grand_total,
        (SELECT COUNT(*) FROM erp_booking_products bp WHERE bp.booking_id = b.id) AS items_count
       ${BOOKING_JOINS}
       WHERE ${where}
       ORDER BY b.from_datetime ASC`,
      params
    );

    res.json({
      data: rows.map((r) => ({
        ...r,
        grand_total: num(r.grand_total),
        items_count: num(r.items_count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
