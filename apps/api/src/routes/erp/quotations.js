import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { nextErpReference } from '../../services/erp/referenceNumbers.js';
import { num, requireErpAdmin } from './helpers.js';
import { QSTATUS, parseCreateStatus, slugFor, codeFor } from '../../services/erp/quotationStatus.js';
import {
  loadQuotation,
  healSignedAwaiting,
  sendForSignature,
  markNoSignature,
  deliverOfficialPdf,
  acceptClientQuote,
  rejectClientQuote,
} from '../../services/erp/quotationApproval.js';

const router = Router();

function quotationReference() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `qr-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function actorId(req) {
  return req.user?.sub || req.user?.id || null;
}

function lineTotals(items, extras) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
  }
  const discount = num(extras.discount);
  const shipping = num(extras.shipping);
  const tax = num(extras.tax);
  return {
    total_price: Number(subtotal.toFixed(2)),
    total_discount: discount,
    total_tax: tax,
    grand_total: Number((subtotal - discount + shipping + tax).toFixed(2)),
  };
}

function tabWhere(tab) {
  if (!tab || tab === 'all') return { sql: '1=1', params: [] };
  if (tab === 'awaiting' || tab === 'awaiting_approval') {
    return {
      sql: `(q.quotation_status = ? OR q.status = 'awaiting_approval') AND q.client_signed_at IS NULL AND q.client_responded_at IS NULL
            AND (q.client_signature_path IS NULL OR q.client_signature_path = '')`,
      params: [QSTATUS.AWAITING],
    };
  }
  if (tab === 'approved') {
    return {
      sql: `(q.quotation_status IN (?, ?) OR (q.client_signature_path IS NOT NULL AND q.client_signature_path <> ''))`,
      params: [QSTATUS.APPROVED, QSTATUS.NO_SIGNATURE],
    };
  }
  if (tab === 'rejected') return { sql: 'q.quotation_status = ?', params: [QSTATUS.REJECTED] };
  if (tab === 'draft') return { sql: 'q.quotation_status = ?', params: [QSTATUS.DRAFT] };
  if (tab === 'quoted' || tab === 'client_quote') return { sql: 'q.quotation_status = ?', params: [QSTATUS.CLIENT_QUOTE] };
  if (tab === 'no_signature') return { sql: 'q.quotation_status = ?', params: [QSTATUS.NO_SIGNATURE] };
  return { sql: 'q.status = ?', params: [tab] };
}

router.get('/', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [signedStuck] = await pool.query(
      `SELECT id FROM quotations
       WHERE quotation_status = ? AND (client_signature_path IS NOT NULL AND client_signature_path <> '')`,
      [QSTATUS.AWAITING]
    );
    for (const row of signedStuck) {
      await healSignedAwaiting({ id: row.id, quotation_status: QSTATUS.AWAITING, client_signature_path: 'x' });
    }

    const params = [];
    const tab = String(req.query.status || req.query.tab || '');
    const filter = tabWhere(tab);
    let where = filter.sql;
    params.push(...filter.params);
    if (req.query.q) {
      where += ' AND (q.reference LIKE ? OR c.name LIKE ? OR b.name LIKE ? OR s.name LIKE ?)';
      const like = `%${req.query.q}%`;
      params.push(like, like, like, like);
    }
    const [rows] = await pool.query(
      `SELECT q.*, c.name AS customer_name, w.name AS warehouse_name,
              b.name AS biller_name, s.name AS supplier_name
       FROM quotations q
       LEFT JOIN erp_customers c ON c.id = q.customer_id
       LEFT JOIN warehouses w ON w.id = q.warehouse_id
       LEFT JOIN erp_billers b ON b.id = q.biller_id
       LEFT JOIN erp_suppliers s ON s.id = q.supplier_id
       WHERE ${where}
       ORDER BY q.created_at DESC`,
      params
    );
    const [counts] = await pool.query(
      `SELECT
         COUNT(*) AS all_count,
         SUM(quotation_status = 2 AND client_signed_at IS NULL AND client_responded_at IS NULL
             AND (client_signature_path IS NULL OR client_signature_path = '')) AS awaiting,
         SUM(quotation_status IN (3, 5) OR (client_signature_path IS NOT NULL AND client_signature_path <> '')) AS approved,
         SUM(quotation_status = 4) AS rejected,
         SUM(quotation_status = 1) AS draft,
         SUM(quotation_status = 6) AS client_quote
       FROM quotations`
    );
    const c = counts[0] || {};
    res.json({
      data: rows,
      statusCounts: {
        all: Number(c.all_count) || 0,
        awaiting: Number(c.awaiting) || 0,
        awaiting_approval: Number(c.awaiting) || 0,
        approved: Number(c.approved) || 0,
        rejected: Number(c.rejected) || 0,
        draft: Number(c.draft) || 0,
        client_quote: Number(c.client_quote) || 0,
        quoted: Number(c.client_quote) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json({ data: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function persistItems(conn, quotationId, items) {
  await conn.query(`DELETE FROM product_quotations WHERE quotation_id = ?`, [quotationId]);
  for (const item of items) {
    const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
    await conn.query(
      `INSERT INTO product_quotations (id, quotation_id, product_id, qty, net_unit_price, discount, tax, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), quotationId, item.product_id, num(item.qty), num(item.net_unit_price), num(item.discount), num(item.tax), line]
    );
  }
}

router.post('/', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.warehouse_id) return res.status(400).json({ error: 'warehouse_id required' });
    if (!items.length) return res.status(400).json({ error: 'items required' });
    const code = parseCreateStatus(b);
    const totals = lineTotals(items, b);

    await conn.beginTransaction();
    const id = randomUUID();
    let reference = quotationReference();
    const [dup] = await conn.query(`SELECT id FROM quotations WHERE reference = ? LIMIT 1`, [reference]);
    if (dup.length) reference = await nextErpReference('qr-', 'quotations');

    await conn.query(
      `INSERT INTO quotations (id, reference, warehouse_id, customer_id, biller_id, supplier_id, status, quotation_status,
        grand_total, discount, shipping, tax, total_price, total_discount, total_tax, note, cc_phones, cc_customer_ids,
        show_client_discount, quotation_source, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null, b.supplier_id || null,
        slugFor(code), code, totals.grand_total, num(b.discount), num(b.shipping), num(b.tax),
        totals.total_price, totals.total_discount, totals.total_tax, b.note || null,
        b.cc_phones || null, b.cc_customer_ids || null,
        b.show_client_discount === false || b.show_client_discount === 0 ? 0 : 1,
        b.quotation_source || 'admin', actorId(req),
      ]
    );
    await persistItems(conn, id, items);
    await conn.commit();

    let quotation = await loadQuotation(id);
    let link = null;
    let warning = null;
    if (code === QSTATUS.AWAITING) {
      const sent = await sendForSignature(req, quotation, actorId(req));
      quotation = sent.quotation;
      link = sent.link;
      warning = sent.whatsappError;
    } else if (code === QSTATUS.NO_SIGNATURE) {
      quotation = await markNoSignature(req, quotation, actorId(req));
    }
    res.status(201).json({
      data: { id, reference, status: quotation.status, quotation_status: quotation.quotation_status, grand_total: quotation.grand_total, link },
      warning,
    });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    const current = await loadQuotation(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });
    if (!items.length) return res.status(400).json({ error: 'items required' });
    const requested = b.quotation_status ?? b.status;
    const code = requested == null || requested === ''
      ? Number(current.quotation_status) || codeFor(current.status)
      : parseCreateStatus({ status: requested });
    const totals = lineTotals(items, {
      discount: b.discount !== undefined ? b.discount : current.discount,
      shipping: b.shipping !== undefined ? b.shipping : current.shipping,
      tax: b.tax !== undefined ? b.tax : current.tax,
    });

    await conn.beginTransaction();
    await persistItems(conn, req.params.id, items);
    await conn.query(
      `UPDATE quotations SET warehouse_id = ?, customer_id = ?, biller_id = ?, supplier_id = ?,
        status = ?, quotation_status = ?, grand_total = ?, discount = ?, shipping = ?, tax = ?,
        total_price = ?, total_discount = ?, total_tax = ?, note = ?, cc_phones = ?, cc_customer_ids = ?
       WHERE id = ?`,
      [
        b.warehouse_id || current.warehouse_id,
        b.customer_id !== undefined ? b.customer_id || null : current.customer_id,
        b.biller_id !== undefined ? b.biller_id || null : current.biller_id,
        b.supplier_id !== undefined ? b.supplier_id || null : current.supplier_id,
        slugFor(code), code, totals.grand_total,
        b.discount !== undefined ? num(b.discount) : num(current.discount),
        b.shipping !== undefined ? num(b.shipping) : num(current.shipping),
        b.tax !== undefined ? num(b.tax) : num(current.tax),
        totals.total_price, totals.total_discount, totals.total_tax,
        b.note !== undefined ? b.note || null : current.note,
        b.cc_phones !== undefined ? b.cc_phones || null : current.cc_phones,
        b.cc_customer_ids !== undefined ? b.cc_customer_ids || null : current.cc_customer_ids,
        req.params.id,
      ]
    );
    await conn.commit();

    let quotation = await loadQuotation(req.params.id);
    let link = null;
    let warning = null;
    if (code === QSTATUS.AWAITING) {
      const sent = await sendForSignature(req, quotation, actorId(req));
      quotation = sent.quotation;
      link = sent.link;
      warning = sent.whatsappError;
    } else if (code === QSTATUS.NO_SIGNATURE) {
      quotation = await markNoSignature(req, quotation, actorId(req));
    }
    res.json({
      data: { id: req.params.id, reference: current.reference, grand_total: quotation.grand_total, status: quotation.status, link },
      warning,
    });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const [ex] = await pool.query(`SELECT id FROM quotations WHERE id = ?`, [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    const [quotes] = await pool.query(`SELECT id FROM quotation_quotes WHERE quotation_id = ?`, [req.params.id]);
    for (const quote of quotes) {
      await pool.query(`DELETE FROM quotation_quote_lines WHERE quotation_quote_id = ?`, [quote.id]);
    }
    await pool.query(`DELETE FROM quotation_quotes WHERE quotation_id = ?`, [req.params.id]);
    await pool.query(`DELETE FROM product_quotations WHERE quotation_id = ?`, [req.params.id]);
    await pool.query(`DELETE FROM quotations WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/send-for-signature', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const sent = await sendForSignature(req, q, actorId(req), { resend: true });
    res.json({
      ok: true,
      link: sent.link,
      warning: sent.whatsappError,
      message: sent.whatsappError
        ? `Saved as awaiting signature, but WhatsApp failed: ${sent.whatsappError}. Use Send for Signature again.`
        : 'Approval link sent',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/send-whatsapp', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const sent = await sendForSignature(req, q, actorId(req), { resend: true });
    res.json({ ok: true, link: sent.link, warning: sent.whatsappError });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/send-pdf', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    if (Number(q.quotation_status) === QSTATUS.REJECTED) {
      return res.status(400).json({ error: 'A rejected quotation cannot be sent as a PDF' });
    }
    await deliverOfficialPdf(req, q, { context: Number(q.quotation_status) === QSTATUS.NO_SIGNATURE ? 'no_signature' : 'signed', actorId: actorId(req) });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id/pdf', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const { buildQuotationPdfBuffer } = await import('../../services/erp/quotationPdf.js');
    const buffer = await buildQuotationPdfBuffer(q);
    const fileName = `${q.reference || 'quotation'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/accept-quote', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const result = await acceptClientQuote(req, req.params.id, actorId(req), req.body || {});
    res.json({ ok: true, data: result.quotation, link: result.link });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/reject-quote', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const result = await rejectClientQuote(req, req.params.id, actorId(req), req.body || {});
    res.json({ ok: true, data: result.quotation });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id/status', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const code = parseCreateStatus(req.body || {});
    if (code === QSTATUS.AWAITING) {
      const sent = await sendForSignature(req, q, actorId(req), { resend: true });
      return res.json({ ok: true, status: sent.quotation.status, quotation_status: QSTATUS.AWAITING, link: sent.link, warning: sent.whatsappError });
    }
    if (code === QSTATUS.NO_SIGNATURE) {
      await markNoSignature(req, q, actorId(req));
      return res.json({ ok: true, status: 'no_signature', quotation_status: QSTATUS.NO_SIGNATURE });
    }
    await getPool().query(`UPDATE quotations SET quotation_status = ?, status = ? WHERE id = ?`, [code, slugFor(code), q.id]);
    res.json({ ok: true, status: slugFor(code), quotation_status: code });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/convert-sale', requireAuth, requireErpAdmin, async (req, res) => {
  try {
    const q = await loadQuotation(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    if (Number(q.quotation_status) === QSTATUS.REJECTED || q.status === 'rejected') {
      return res.status(400).json({ error: 'A rejected quotation cannot become a sale' });
    }
    const createRes = await createSaleFromQuotation(req, {
      warehouse_id: q.warehouse_id,
      customer_id: q.customer_id,
      biller_id: q.biller_id,
      discount: q.discount,
      shipping: q.shipping,
      tax: q.tax,
      note: `From quotation ${q.reference}`,
      paid_amount: 0,
      items: q.items.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        net_unit_price: i.net_unit_price,
        discount: i.discount,
        tax: i.tax,
      })),
    }, q.id);
    res.status(201).json(createRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function createSaleFromQuotation(req, b, quotationId) {
  const pool = getPool();
  const { adjustStock, getNonStockProductIds, getStock } = await import('../../services/erp/stock.js');
  const nonStockIds = await getNonStockProductIds(pool, b.items.map((i) => i.product_id));
  for (const item of b.items) {
    if (nonStockIds.has(item.product_id)) continue;
    const stock = await getStock(item.product_id, b.warehouse_id);
    if (stock < num(item.qty)) throw new Error(`Insufficient stock for product ${item.product_id}`);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = randomUUID();
    const { nextErpReference: nextRef } = await import('../../services/erp/referenceNumbers.js');
    const reference = await nextRef('sr-', 'sales');
    let subtotal = 0;
    for (const item of b.items) {
      subtotal += num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
    }
    const grand = subtotal - num(b.discount) + num(b.shipping) + num(b.tax);
    const sale_date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.query(
      `INSERT INTO sales (id, reference, warehouse_id, customer_id, biller_id, sale_status, payment_status,
        grand_total, paid_amount, discount, shipping, tax, note, is_pos, sale_date, created_by)
       VALUES (?, ?, ?, ?, ?, 'completed', 'pending', ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id, reference, b.warehouse_id, b.customer_id || null, b.biller_id || null, grand,
        num(b.discount), num(b.shipping), num(b.tax), b.note || null, sale_date,
        req.user?.sub || req.user?.id || null,
      ]
    );
    for (const item of b.items) {
      const line = num(item.qty) * num(item.net_unit_price) - num(item.discount) + num(item.tax);
      await conn.query(
        `INSERT INTO product_sales (id, sale_id, product_id, qty, net_unit_price, discount, tax, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, item.product_id, num(item.qty), num(item.net_unit_price), num(item.discount), num(item.tax), line]
      );
      if (!nonStockIds.has(item.product_id)) {
        await adjustStock(conn, { productId: item.product_id, warehouseId: b.warehouse_id, delta: -num(item.qty) });
      }
    }
    await conn.query(
      `UPDATE quotations SET sale_id = ? WHERE id = ? AND quotation_status <> 4 AND status <> 'rejected'`,
      [id, quotationId]
    );
    await conn.commit();
    return { data: { id, reference, grand_total: grand } };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export default router;
