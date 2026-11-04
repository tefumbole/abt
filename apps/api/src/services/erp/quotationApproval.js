import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getPool } from '../../db/pool.js';
import {
  formatPhoneNumber,
  isWasenderConfigured,
  sendTextMessage,
  sendTextThenDocumentBuffer,
} from '../wasenderWhatsAppService.js';
import { num } from '../../routes/erp/helpers.js';
import {
  QSTATUS,
  slugFor,
  hasClientSignature,
  isLinkLive,
  phoneDigits,
} from './quotationStatus.js';
import {
  quotationApprovalRequest,
  quotationSignedPdf,
  quotationNoSignaturePdf,
  quotationStaffPdfCopy,
  quotationCcPdfCopy,
  quotationStakeholderNotify,
  quotationClientQuoteSubmitted,
} from './quotationMessages.js';
import { buildQuotationPdfBuffer } from './quotationPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads'));

export function publicBaseUrl(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.APP_URL || process.env.CORS_ORIGIN;
  if (env && env !== '*') return String(env).replace(/\/$/, '');
  const proto = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https';
  const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host');
  return host ? `${proto}://${host}` : 'https://alpha-bridge.net';
}

export function approvalUrl(req, token) {
  return `${publicBaseUrl(req)}/quotation-approval/${token}`;
}

export function adminQuotationsUrl(req, status = 'awaiting') {
  return `${publicBaseUrl(req)}/admin/erp/quotations?status=${status}`;
}

export function reviewUrl(req, id) {
  return `${publicBaseUrl(req)}/admin/erp/quotations?review=${id}`;
}

async function companyName() {
  try {
    const [rows] = await getPool().query(`SELECT application_name FROM system_settings LIMIT 1`);
    return process.env.COMPANY_NAME || rows[0]?.application_name || 'Alpha Bridge';
  } catch {
    return process.env.COMPANY_NAME || 'Alpha Bridge';
  }
}

export function newApprovalToken() {
  return randomBytes(24).toString('hex');
}

export async function loadQuotation(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT q.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
            c.address AS customer_address, c.company_name AS customer_company,
            w.name AS warehouse_name, b.name AS biller_name, s.name AS supplier_name,
            u.name AS created_by_name, u.email AS created_by_email
     FROM quotations q
     LEFT JOIN erp_customers c ON c.id = q.customer_id
     LEFT JOIN warehouses w ON w.id = q.warehouse_id
     LEFT JOIN erp_billers b ON b.id = q.biller_id
     LEFT JOIN erp_suppliers s ON s.id = q.supplier_id
     LEFT JOIN users u ON u.id = q.created_by
     WHERE q.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [items] = await pool.query(
    `SELECT pq.*, p.name AS product_name, p.code AS product_code FROM product_quotations pq
     LEFT JOIN products p ON p.id = pq.product_id WHERE pq.quotation_id = ?`,
    [id]
  );
  let quotes = [];
  let pendingQuote = null;
  try {
    const [quoteRows] = await pool.query(
      `SELECT * FROM quotation_quotes WHERE quotation_id = ? ORDER BY created_at DESC`,
      [id]
    );
    quotes = quoteRows;
    pendingQuote = quotes.find((q) => q.status === 'pending') || null;
    if (pendingQuote) {
      const [lines] = await pool.query(
        `SELECT qql.*, pq.qty, pq.product_id, p.name AS product_name
         FROM quotation_quote_lines qql
         LEFT JOIN product_quotations pq ON pq.id = qql.product_quotation_id
         LEFT JOIN products p ON p.id = pq.product_id
         WHERE qql.quotation_quote_id = ?`,
        [pendingQuote.id]
      );
      pendingQuote = { ...pendingQuote, lines };
    }
  } catch {
    quotes = [];
  }
  return { ...rows[0], items, pending_quote: pendingQuote, quotes };
}

export async function findByToken(token) {
  if (!token) return null;
  const [rows] = await getPool().query(
    `SELECT id FROM quotations WHERE client_approval_token = ? OR approval_token = ? LIMIT 1`,
    [token, token]
  );
  if (!rows.length) return null;
  return loadQuotation(rows[0].id);
}

export async function setStatus(id, code, extra = {}) {
  const slug = slugFor(code);
  const sets = ['quotation_status = ?', 'status = ?'];
  const params = [code, slug];
  for (const [key, value] of Object.entries(extra)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }
  params.push(id);
  await getPool().query(`UPDATE quotations SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function healSignedAwaiting(row) {
  if (!row) return row;
  if (Number(row.quotation_status) === QSTATUS.AWAITING && hasClientSignature(row)) {
    await setStatus(row.id, QSTATUS.APPROVED, {
      client_approval_token: null,
      approval_token: null,
    });
    return { ...row, quotation_status: QSTATUS.APPROVED, status: 'approved', client_approval_token: null, approval_token: null };
  }
  return row;
}

export async function rotateToken(id, { clearResponse = false } = {}) {
  const token = newApprovalToken();
  await getPool().query(
    `UPDATE quotations SET client_approval_token = ?, approval_token = ?,
      ${clearResponse ? 'client_comment = NULL, client_signed_at = NULL, client_signature_path = NULL, client_responded_at = NULL,' : ''}
      approval_sent_at = NOW()
     WHERE id = ?`,
    [token, token, id]
  );
  return token;
}

async function loadUser(userId) {
  if (!userId) return null;
  try {
    const [rows] = await getPool().query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, p.full_name, p.phone AS profile_phone
       FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = ? LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

function userPhone(user) {
  return user?.phone || user?.profile_phone || '';
}

function userName(user) {
  return user?.name || user?.full_name || 'Staff';
}

async function staffCopyRecipients(quotation, actorId) {
  const ids = [quotation.created_by, quotation.approval_sent_by, actorId].filter(Boolean);
  const unique = [...new Set(ids.map(String))];
  const users = [];
  for (const id of unique) {
    const user = await loadUser(id);
    if (user) users.push(user);
  }
  return users;
}

async function fallbackAdminStaff() {
  try {
    const [rows] = await getPool().query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, p.full_name, p.phone AS profile_phone
       FROM users u LEFT JOIN profiles p ON p.id = u.id
       WHERE u.status = 'active' AND u.role IN ('super_admin','admin','director')
         AND (u.phone IS NOT NULL AND u.phone <> '' OR p.phone IS NOT NULL AND p.phone <> '')`
    );
    return rows;
  } catch {
    return [];
  }
}

async function ccCustomers(quotation) {
  const ids = String(quotation.cc_customer_ids || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return [];
  const [rows] = await getPool().query(
    `SELECT id, name, phone FROM erp_customers WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  return rows;
}

function extraCcPhones(quotation) {
  return String(quotation.cc_phones || '')
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((phone) => ({ name: 'CC', phone }));
}

export async function sendWhatsAppSafe(phone, text, type) {
  if (!phone || !isWasenderConfigured()) return { success: false, skipped: true };
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return { success: false, error: 'Invalid phone' };
  try {
    return await sendTextMessage(formatted, text, type);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function notifyStakeholders(req, quotation, event, { approvalLink, comment } = {}) {
  const company = await companyName();
  const customer = quotation.customer_name || 'Customer';
  const text = quotationStakeholderNotify({
    company,
    reference: quotation.reference,
    customer,
    items: quotation.items,
    quotation,
    comment: comment ?? quotation.client_comment,
    event,
    approvalUrl: approvalLink,
    adminListUrl: adminQuotationsUrl(req, event === 'quoted' ? 'quoted' : event === 'approved' ? 'approved' : event === 'rejected' ? 'rejected' : 'awaiting'),
  });
  let staff = await staffCopyRecipients(quotation, quotation.approval_sent_by || quotation.created_by);
  if (event === 'quoted' && !staff.some((u) => userPhone(u))) {
    staff = await fallbackAdminStaff();
  }
  const used = new Set();
  const customerDigits = phoneDigits(quotation.customer_phone);
  if (customerDigits) used.add(customerDigits);
  for (const user of staff) {
    const phone = userPhone(user);
    const digits = phoneDigits(phone);
    if (!digits || used.has(digits)) continue;
    used.add(digits);
    await sendWhatsAppSafe(phone, text, `erp-quotation-${event}`);
  }
  const ccs = [...(await ccCustomers(quotation)), ...extraCcPhones(quotation)];
  for (const cc of ccs) {
    const digits = phoneDigits(cc.phone);
    if (!digits || used.has(digits)) continue;
    used.add(digits);
    await sendWhatsAppSafe(cc.phone, text, `erp-quotation-cc-${event}`);
  }
}

export async function sendForSignature(req, quotation, actorId, { resend = false } = {}) {
  if (hasClientSignature(quotation) || Number(quotation.quotation_status) === QSTATUS.APPROVED) {
    const err = new Error('This quotation is already signed. Clone it to send a new approval link.');
    err.status = 400;
    throw err;
  }
  const allowedResend = new Set([QSTATUS.DRAFT, QSTATUS.AWAITING, QSTATUS.REJECTED, QSTATUS.NO_SIGNATURE]);
  if (resend && !allowedResend.has(Number(quotation.quotation_status))) {
    const err = new Error('This quotation cannot be resent. Clone it instead.');
    err.status = 400;
    throw err;
  }
  const token = await rotateToken(quotation.id, { clearResponse: resend });
  await getPool().query(`UPDATE quotations SET approval_sent_by = ? WHERE id = ?`, [actorId || null, quotation.id]);
  await setStatus(quotation.id, QSTATUS.AWAITING);
  const fresh = await loadQuotation(quotation.id);
  const link = approvalUrl(req, token);
  const company = await companyName();
  const customer = fresh.customer_name || 'Customer';
  let whatsappError = null;
  if (fresh.customer_phone && isWasenderConfigured()) {
    const result = await sendWhatsAppSafe(
      fresh.customer_phone,
      quotationApprovalRequest({
        company,
        customer,
        reference: fresh.reference,
        items: fresh.items,
        quotation: fresh,
        approvalUrl: link,
      }),
      'erp-quotation-approval'
    );
    if (!result.success && !result.skipped) whatsappError = result.error;
  } else if (!fresh.customer_phone) {
    whatsappError = 'Customer phone is required to send the approval link';
  } else if (!isWasenderConfigured()) {
    whatsappError = 'WhatsApp is not configured';
  }
  await notifyStakeholders(req, { ...fresh, approval_sent_by: actorId }, 'sent', { approvalLink: link });
  return { quotation: fresh, token, link, whatsappError };
}

export async function deliverOfficialPdf(req, quotation, { context = 'signed', actorId = null } = {}) {
  const fresh = await loadQuotation(quotation.id);
  const company = await companyName();
  const customer = fresh.customer_name || 'Customer';
  const buffer = await buildQuotationPdfBuffer(fresh);
  const fileName = `${fresh.reference || 'quotation'}.pdf`;
  const used = new Set();
  const customerPhone = formatPhoneNumber(fresh.customer_phone);
  if (customerPhone && isWasenderConfigured()) {
    used.add(phoneDigits(customerPhone));
    const caption = context === 'no_signature'
      ? quotationNoSignaturePdf({ company, customer, reference: fresh.reference, grandTotal: fresh.grand_total })
      : quotationSignedPdf({ company, customer, reference: fresh.reference, grandTotal: fresh.grand_total });
    await sendTextThenDocumentBuffer(customerPhone, caption, buffer, fileName);
  }

  const staff = await staffCopyRecipients(fresh, actorId);
  const staffText = (name) => quotationStaffPdfCopy({
    company, staff: name, reference: fresh.reference, customer, grandTotal: fresh.grand_total,
  });
  for (const user of staff) {
    const phone = formatPhoneNumber(userPhone(user));
    const digits = phoneDigits(phone);
    if (!phone || !digits || used.has(digits) || !isWasenderConfigured()) continue;
    used.add(digits);
    await sendTextThenDocumentBuffer(phone, staffText(userName(user)), buffer, fileName);
  }

  const ccs = [...(await ccCustomers(fresh)), ...extraCcPhones(fresh)];
  for (const cc of ccs) {
    const phone = formatPhoneNumber(cc.phone);
    const digits = phoneDigits(phone);
    if (!phone || !digits || used.has(digits) || !isWasenderConfigured()) continue;
    used.add(digits);
    const text = quotationCcPdfCopy({
      company,
      ccName: cc.name || 'Client',
      customer,
      reference: fresh.reference,
      grandTotal: fresh.grand_total,
      signed: context === 'signed',
    });
    await sendTextThenDocumentBuffer(phone, text, buffer, fileName);
  }

  return { buffer, fileName };
}

export async function markNoSignature(req, quotation, actorId) {
  await setStatus(quotation.id, QSTATUS.NO_SIGNATURE, {
    client_approval_token: null,
    approval_token: null,
    approval_sent_at: new Date(),
    approval_sent_by: actorId || null,
  });
  const fresh = await loadQuotation(quotation.id);
  await deliverOfficialPdf(req, fresh, { context: 'no_signature', actorId });
  return fresh;
}

function decodeSignature(signatureData) {
  const raw = String(signatureData || '');
  const match = raw.match(/^data:image\/(png|jpeg);base64,(.+)$/i);
  if (!match) {
    const err = new Error('signature_data must be a PNG or JPEG data URI');
    err.status = 400;
    throw err;
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length < 80) {
    const err = new Error('Signature is too small. Please draw your signature.');
    err.status = 400;
    throw err;
  }
  return buffer;
}

export function saveClientSignature(quotationId, signatureData) {
  const buffer = decodeSignature(signatureData);
  const rand = randomBytes(5).toString('hex');
  const rel = path.join('quotations', 'signatures', `qsig_${quotationId}_${rand}.png`);
  const abs = path.join(uploadRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return rel.replaceAll('\\', '/');
}

export async function approveByToken(req, token, { signature_data, comment } = {}) {
  const quotation = await findByToken(token);
  if (!quotation || !isLinkLive(quotation) || (quotation.client_approval_token !== token && quotation.approval_token !== token)) {
    const err = new Error('This approval link has already been used or replaced. Please ask the company for a new one.');
    err.status = 410;
    throw err;
  }
  const storedPath = saveClientSignature(quotation.id, signature_data);
  const source = String(quotation.quotation_source || '').toLowerCase();
  const fromIntake = source === 'whatsapp' || source === 'website';

  if (fromIntake) {
    await getPool().query(
      `UPDATE quotations SET client_signature_path = ?, client_signed_at = NOW(), client_comment = ?,
        client_responded_at = NOW(), client_approval_token = NULL, approval_token = NULL,
        quotation_status = ?, status = 'draft', workflow_state = 'customer_accepted'
       WHERE id = ?`,
      [storedPath, comment || null, QSTATUS.DRAFT, quotation.id]
    );
    const fresh = await loadQuotation(quotation.id);
    await notifyStakeholders(req, fresh, 'approved', { comment });
    return { quotation: fresh, waitingCompany: true };
  }

  await getPool().query(
    `UPDATE quotations SET client_signature_path = ?, client_signed_at = NOW(), client_comment = ?,
      client_responded_at = NOW(), client_approval_token = NULL, approval_token = NULL,
      quotation_status = 3, status = 'approved'
     WHERE id = ?`,
    [storedPath, comment || null, quotation.id]
  );
  const fresh = await loadQuotation(quotation.id);
  await notifyStakeholders(req, fresh, 'approved', { comment });
  await deliverOfficialPdf(req, fresh, { context: 'signed' });
  return { quotation: fresh, waitingCompany: false };
}

export async function rejectByToken(req, token, { comment } = {}) {
  const quotation = await findByToken(token);
  if (!quotation || !isLinkLive(quotation)) {
    const err = new Error('This approval link has already been used or replaced. Please ask the company for a new one.');
    err.status = 410;
    throw err;
  }
  const note = String(comment || '').trim();
  if (!note) {
    const err = new Error('A comment is required to reject this quotation');
    err.status = 400;
    throw err;
  }
  if (note.length > 2000) {
    const err = new Error('Comment must be 2000 characters or fewer');
    err.status = 400;
    throw err;
  }
  await getPool().query(
    `UPDATE quotations SET quotation_status = 4, status = 'rejected', client_comment = ?,
      client_responded_at = NOW(), client_approval_token = NULL, approval_token = NULL
     WHERE id = ?`,
    [note, quotation.id]
  );
  const fresh = await loadQuotation(quotation.id);
  await notifyStakeholders(req, fresh, 'rejected', { comment: note });
  return fresh;
}

function splitOverall(items, proposedGrand, quotation) {
  const tax = num(quotation.tax);
  const shipping = num(quotation.shipping);
  const discount = num(quotation.discount);
  const target = Math.max(0, proposedGrand - tax - shipping + discount);
  const originalSum = items.reduce((sum, item) => sum + num(item.subtotal), 0);
  const lines = [];
  let allocated = 0;
  items.forEach((item, i) => {
    const last = i === items.length - 1;
    const share = originalSum > 0 ? num(item.subtotal) / originalSum : 1 / items.length;
    const lineTotal = last ? Number((target - allocated).toFixed(2)) : Number((target * share).toFixed(2));
    if (!last) allocated += lineTotal;
    const qty = Math.max(num(item.qty), 0.0001);
    lines.push({
      item,
      proposed_total: lineTotal,
      proposed_net_unit_price: Number((lineTotal / qty).toFixed(4)),
    });
  });
  return lines;
}

export async function quoteByToken(req, token, body = {}) {
  const quotation = await findByToken(token);
  if (!quotation || !isLinkLive(quotation)) {
    const err = new Error('This approval link has already been used or replaced. Please ask the company for a new one.');
    err.status = 410;
    throw err;
  }
  const mode = body.mode === 'lines' ? 'lines' : 'overall';
  const note = String(body.note || body.client_note || '').trim();
  if (note.length > 2000) {
    const err = new Error('Note must be 2000 characters or fewer');
    err.status = 400;
    throw err;
  }
  const items = quotation.items || [];
  if (!items.length) {
    const err = new Error('This quotation has no products to quote');
    err.status = 400;
    throw err;
  }

  let proposedGrand;
  let linePlans;
  if (mode === 'overall') {
    proposedGrand = Number(body.proposed_grand_total);
    if (!(proposedGrand > 0) || Math.abs(proposedGrand - num(quotation.grand_total)) < 0.009) {
      const err = new Error('Proposed total must be greater than 0 and different from the current total');
      err.status = 400;
      throw err;
    }
    linePlans = splitOverall(items, proposedGrand, quotation);
  } else {
    const incoming = Array.isArray(body.lines) ? body.lines : [];
    linePlans = items.map((item) => {
      const found = incoming.find((l) => String(l.product_quotation_id || l.id) === String(item.id));
      if (found?.proposed_net_unit_price == null && found?.unit_price == null) {
        const err = new Error('Every product line needs a proposed unit price');
        err.status = 400;
        throw err;
      }
      const unit = Number(found.proposed_net_unit_price ?? found.unit_price);
      const qty = num(item.qty);
      return {
        item,
        proposed_net_unit_price: unit,
        proposed_total: Number((unit * qty).toFixed(2)),
      };
    });
    if (!linePlans.some((l) => Math.abs(l.proposed_net_unit_price - num(l.item.net_unit_price)) >= 0.009)) {
      const err = new Error('Change at least one item price');
      err.status = 400;
      throw err;
    }
    proposedGrand = Number((
      linePlans.reduce((sum, l) => sum + l.proposed_total, 0)
      + num(quotation.tax)
      + num(quotation.shipping)
      - num(quotation.discount)
    ).toFixed(2));
  }

  const pool = getPool();
  await pool.query(
    `UPDATE quotation_quotes SET status = 'rejected' WHERE quotation_id = ? AND status = 'pending'`,
    [quotation.id]
  );
  const quoteId = randomUUID();
  await pool.query(
    `INSERT INTO quotation_quotes (id, quotation_id, mode, proposed_grand_total, original_grand_total, client_note, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [quoteId, quotation.id, mode, proposedGrand, num(quotation.grand_total), note || null]
  );
  for (const plan of linePlans) {
    await pool.query(
      `INSERT INTO quotation_quote_lines (id, quotation_quote_id, product_quotation_id,
        original_net_unit_price, original_total, proposed_net_unit_price, proposed_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), quoteId, plan.item.id,
        num(plan.item.net_unit_price), num(plan.item.subtotal),
        plan.proposed_net_unit_price, plan.proposed_total,
      ]
    );
  }
  await getPool().query(
    `UPDATE quotations SET quotation_status = 6, status = 'client_quote', client_comment = ?,
      client_responded_at = NOW(), client_approval_token = NULL, approval_token = NULL
     WHERE id = ?`,
    [note || null, quotation.id]
  );
  const fresh = await loadQuotation(quotation.id);
  const company = await companyName();
  const review = reviewUrl(req, fresh.id);
  let staff = await staffCopyRecipients(fresh, fresh.approval_sent_by || fresh.created_by);
  if (!staff.some((u) => userPhone(u))) staff = await fallbackAdminStaff();
  const used = new Set();
  for (const user of staff) {
    const phone = userPhone(user);
    const digits = phoneDigits(phone);
    if (!digits || used.has(digits)) continue;
    used.add(digits);
    await sendWhatsAppSafe(
      phone,
      quotationClientQuoteSubmitted({
        company,
        staff: userName(user),
        customer: fresh.customer_name || 'Customer',
        reference: fresh.reference,
        mode,
        original: fresh.quotes?.[0]?.original_grand_total ?? quotation.grand_total,
        proposed: proposedGrand,
        note,
        reviewUrl: review,
      }),
      'erp-quotation-client-quote'
    );
  }
  await notifyStakeholders(req, fresh, 'quoted', { comment: note });
  return fresh;
}

function recomputeTotals(items, quotation) {
  const totalPrice = items.reduce((sum, item) => sum + num(item.subtotal), 0);
  const grand = Number((totalPrice - num(quotation.discount) + num(quotation.shipping) + num(quotation.tax)).toFixed(2));
  return {
    total_price: Number(totalPrice.toFixed(2)),
    total_discount: num(quotation.discount),
    total_tax: num(quotation.tax),
    grand_total: grand,
  };
}

export async function acceptClientQuote(req, quotationId, actorId, body = {}) {
  const quotation = await loadQuotation(quotationId);
  if (!quotation) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const quote = quotation.pending_quote;
  if (!quote) {
    const err = new Error('No pending client quote to review');
    err.status = 400;
    throw err;
  }

  let plans = (quote.lines || []).map((line) => {
    const override = (body.lines || []).find((l) => String(l.id || l.product_quotation_id) === String(line.id || line.product_quotation_id));
    const unit = override?.proposed_net_unit_price != null ? num(override.proposed_net_unit_price) : num(line.proposed_net_unit_price);
    const qty = Math.max(num(line.qty), 0.0001);
    return {
      product_quotation_id: line.product_quotation_id,
      qty,
      proposed_net_unit_price: unit,
      proposed_total: Number((unit * qty).toFixed(2)),
    };
  });

  if (body.proposed_grand_total != null && Math.abs(num(body.proposed_grand_total) - plans.reduce((s, p) => s + p.proposed_total, 0)) >= 0.009) {
    const fakeItems = plans.map((p) => ({
      id: p.product_quotation_id,
      qty: p.qty,
      subtotal: p.proposed_total,
      net_unit_price: p.proposed_net_unit_price,
    }));
    plans = splitOverall(fakeItems, num(body.proposed_grand_total), quotation).map((p) => ({
      product_quotation_id: p.item.id,
      qty: p.item.qty,
      proposed_net_unit_price: p.proposed_net_unit_price,
      proposed_total: p.proposed_total,
    }));
  }

  for (const plan of plans) {
    await getPool().query(
      `UPDATE product_quotations SET net_unit_price = ?, discount = 0, tax = 0, subtotal = ? WHERE id = ?`,
      [plan.proposed_net_unit_price, plan.proposed_total, plan.product_quotation_id]
    );
  }
  const [items] = await getPool().query(`SELECT * FROM product_quotations WHERE quotation_id = ?`, [quotationId]);
  const totals = recomputeTotals(items, quotation);
  const token = newApprovalToken();
  await getPool().query(
    `UPDATE quotations SET grand_total = ?, total_price = ?, total_discount = ?, total_tax = ?,
      quotation_status = 2, status = 'awaiting_approval', client_comment = NULL,
      client_signature_path = NULL, client_signed_at = NULL, client_responded_at = NULL,
      client_approval_token = ?, approval_token = ?, approval_sent_at = NOW(), approval_sent_by = ?
     WHERE id = ?`,
    [totals.grand_total, totals.total_price, totals.total_discount, totals.total_tax, token, token, actorId || null, quotationId]
  );
  await getPool().query(
    `UPDATE quotation_quotes SET status = 'accepted', admin_note = ?, admin_user_id = ? WHERE id = ?`,
    [body.admin_note || null, actorId || null, quote.id]
  );
  const fresh = await loadQuotation(quotationId);
  const link = approvalUrl(req, token);
  const company = await companyName();
  if (fresh.customer_phone && isWasenderConfigured()) {
    await sendWhatsAppSafe(
      fresh.customer_phone,
      quotationApprovalRequest({
        company,
        customer: fresh.customer_name || 'Customer',
        reference: fresh.reference,
        items: fresh.items,
        quotation: fresh,
        approvalUrl: link,
      }),
      'erp-quotation-approval'
    );
  }
  await notifyStakeholders(req, fresh, 'quote_accepted', { approvalLink: link });
  return { quotation: fresh, link };
}

export async function rejectClientQuote(req, quotationId, actorId, body = {}) {
  const quotation = await loadQuotation(quotationId);
  if (!quotation?.pending_quote) {
    const err = new Error('No pending client quote to review');
    err.status = 400;
    throw err;
  }
  await getPool().query(
    `UPDATE quotation_quotes SET status = 'rejected', admin_note = ?, admin_user_id = ? WHERE id = ?`,
    [body.admin_note || null, actorId || null, quotation.pending_quote.id]
  );
  const token = newApprovalToken();
  await getPool().query(
    `UPDATE quotations SET quotation_status = 2, status = 'awaiting_approval',
      client_responded_at = NULL, client_approval_token = ?, approval_token = ?
     WHERE id = ?`,
    [token, token, quotationId]
  );
  const fresh = await loadQuotation(quotationId);
  await notifyStakeholders(req, fresh, 'quote_rejected', { comment: fresh.client_comment });
  return { quotation: fresh, link: approvalUrl(req, token) };
}

export function publicPayload(quotation, company) {
  const items = (quotation.items || []).map((item) => ({
    id: item.id,
    product_name: item.product_name,
    qty: item.qty,
    net_unit_price: item.net_unit_price,
    subtotal: item.subtotal,
  }));
  const subtotal = items.reduce((sum, item) => sum + num(item.subtotal), 0);
  const discount = num(quotation.discount);
  const tax = num(quotation.tax);
  const shipping = num(quotation.shipping);
  return {
    reference: quotation.reference,
    customer_name: quotation.customer_name,
    note: quotation.note,
    items,
    subtotal,
    discount: discount > 0.009 ? discount : 0,
    tax: tax > 0 ? tax : 0,
    shipping: shipping > 0 ? shipping : 0,
    grand_total: quotation.grand_total,
    company,
    show_client_discount: quotation.show_client_discount !== 0,
  };
}
