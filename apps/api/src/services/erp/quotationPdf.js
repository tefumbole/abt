import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { getPool } from '../../db/pool.js';
import { money, stampDate } from './quotationStatus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads'));

const NAVY = '#003D82';
const SLATE = '#475569';
const MUTED = '#94a3b8';

async function loadSettings() {
  try {
    const [rows] = await getPool().query(
      `SELECT application_name, logo_url, logo_file_path, pdf_header_text, pdf_footer_text,
              pdf_header_url, pdf_header_file_path, pdf_footer_url, pdf_footer_file_path,
              pdf_watermark_url, pdf_watermark_file_path, admin_signature_path,
              currency, copyright_text
       FROM system_settings LIMIT 1`
    );
    return rows[0] || {};
  } catch {
    return {};
  }
}

function resolveLocalFile(filePath) {
  if (!filePath) return null;
  const raw = String(filePath);
  if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
  const candidates = [
    path.join(uploadRoot, raw),
    path.join(uploadRoot, path.basename(raw)),
    path.resolve(raw),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function loadImage(source) {
  if (!source) return null;
  const local = resolveLocalFile(source);
  if (local) {
    try {
      return fs.readFileSync(local);
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(source)) {
    try {
      const res = await fetch(source);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

async function loadUser(userId) {
  if (!userId) return null;
  try {
    try {
      const [rows] = await getPool().query(
        `SELECT u.id, u.name, u.email, u.phone, u.role, u.signature_path,
                p.full_name, p.phone AS profile_phone
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      return rows[0] || null;
    } catch {
      const [rows] = await getPool().query(
        `SELECT u.id, u.name, u.email, u.phone, u.role,
                p.full_name, p.phone AS profile_phone
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      return rows[0] || null;
    }
  } catch {
    return null;
  }
}

function lineItemsSubtotal(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
}

/**
 * A4 portrait quotation PDF with Alpha letterhead and signature blocks. No QR.
 */
export async function buildQuotationPdfBuffer(quotation) {
  const settings = await loadSettings();
  const company = process.env.COMPANY_NAME || settings.application_name || 'Alpha Bridge';
  const items = quotation.items || [];
  const creator = await loadUser(quotation.created_by);
  const staffSigPath = creator?.signature_path || settings.admin_signature_path || null;
  const staffSig = await loadImage(staffSigPath);
  const clientSig = quotation.client_signature_path
    ? await loadImage(quotation.client_signature_path)
    : quotation.client_signature_data
      ? Buffer.from(String(quotation.client_signature_data).split(',').pop() || '', 'base64')
      : null;
  const headerImg = await loadImage(settings.pdf_header_file_path || settings.pdf_header_url);
  const footerImg = await loadImage(settings.pdf_footer_file_path || settings.pdf_footer_url);
  const logoImg = await loadImage(settings.logo_file_path || settings.logo_url);
  const watermarkImg = await loadImage(settings.pdf_watermark_file_path || settings.pdf_watermark_url);

  const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `Quotation ${quotation.reference}`, Author: company } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const left = 42;
  const right = pageW - 42;
  const width = right - left;

  if (watermarkImg) {
    try {
      doc.save();
      doc.opacity(0.07);
      doc.image(watermarkImg, pageW / 2 - 140, pageH / 2 - 140, { fit: [280, 280], align: 'center' });
      doc.restore();
    } catch { /* ignore */ }
  } else {
    doc.save();
    doc.fillColor('#e2e8f0').opacity(0.35);
    doc.fontSize(42);
    doc.rotate(-32, { origin: [pageW / 2, pageH / 2] });
    doc.text(company, 80, pageH / 2 - 20, { width: pageW - 160, align: 'center' });
    doc.rotate(32, { origin: [pageW / 2, pageH / 2] });
    doc.restore();
  }

  let y = 42;
  if (headerImg) {
    try {
      doc.image(headerImg, left, y, { fit: [width, 70] });
      y += 78;
    } catch { /* ignore */ }
  }

  if (logoImg) {
    try {
      doc.image(logoImg, left, y, { fit: [56, 56] });
    } catch { /* ignore */ }
  }
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16);
  doc.text(company, left + (logoImg ? 68 : 0), y, { width: width / 2 });
  if (settings.pdf_header_text) {
    doc.font('Helvetica').fontSize(9).fillColor(SLATE);
    doc.text(String(settings.pdf_header_text), left + (logoImg ? 68 : 0), y + 20, { width: width / 2 });
  }

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20);
  doc.text('QUOTATION', left + width / 2, y, { width: width / 2, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(SLATE);
  doc.text(quotation.reference || '', left + width / 2, y + 24, { width: width / 2, align: 'right' });
  doc.text(stampDate(quotation.created_at), left + width / 2, y + 38, { width: width / 2, align: 'right' });
  y += 78;

  doc.moveTo(left, y).lineTo(right, y).strokeColor(NAVY).lineWidth(2).stroke();
  y += 16;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('QUOTATION FOR', left, y);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
  doc.text(quotation.customer_name || 'Customer', left, y + 14);
  doc.font('Helvetica').fontSize(9).fillColor(SLATE);
  const customerBits = [
    quotation.customer_company,
    quotation.customer_phone,
    quotation.customer_email,
    quotation.customer_address,
  ].filter(Boolean);
  if (customerBits.length) doc.text(customerBits.join('\n'), left, y + 30, { width: width / 2 - 10 });

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('DETAILS', left + width / 2, y);
  doc.font('Helvetica').fontSize(9).fillColor(SLATE);
  const details = [
    quotation.biller_name ? `Biller: ${quotation.biller_name}` : null,
    quotation.warehouse_name ? `Warehouse: ${quotation.warehouse_name}` : null,
    quotation.supplier_name ? `Supplier: ${quotation.supplier_name}` : null,
  ].filter(Boolean);
  if (details.length) doc.text(details.join('\n'), left + width / 2, y + 14, { width: width / 2 });
  y += 78;

  const cols = [
    { key: '#', w: 22 },
    { key: 'Product', w: width - 22 - 70 - 80 - 80 },
    { key: 'Qty', w: 70 },
    { key: 'Unit price', w: 80 },
    { key: 'Line total', w: 80 },
  ];
  doc.rect(left, y, width, 20).fill(NAVY);
  let x = left + 4;
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
  cols.forEach((col) => {
    doc.text(col.key, x, y + 6, { width: col.w - 6, align: col.key === '#' || col.key === 'Product' ? 'left' : 'right' });
    x += col.w;
  });
  y += 22;

  items.forEach((item, i) => {
    if (y > pageH - 180) {
      doc.addPage();
      y = 42;
    }
    const qty = Number(item.qty || 0);
    const unit = Number(item.net_unit_price || 0);
    const line = Number(item.subtotal ?? qty * unit);
    x = left + 4;
    doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
    const row = [
      String(i + 1),
      item.product_name || 'Item',
      String(qty),
      money(unit),
      money(line),
    ];
    cols.forEach((col, ci) => {
      doc.text(row[ci], x, y, { width: col.w - 6, align: ci < 2 ? 'left' : 'right' });
      x += col.w;
    });
    y += 16;
    doc.moveTo(left, y - 2).lineTo(right, y - 2).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  });

  y += 12;
  const subtotal = Number(quotation.total_price) || lineItemsSubtotal(items);
  const discount = Number(quotation.discount || quotation.total_discount || 0);
  const tax = Number(quotation.tax || quotation.total_tax || 0);
  const shipping = Number(quotation.shipping || 0);
  const totals = [];
  if (subtotal > 0) totals.push(['Subtotal', money(subtotal)]);
  if (discount > 0.009) totals.push(['Discount', `-${money(discount)}`]);
  if (tax > 0) totals.push(['Tax', money(tax)]);
  if (shipping > 0) totals.push(['Shipping', money(shipping)]);
  totals.push(['Total due', money(quotation.grand_total)]);

  const boxW = 220;
  totals.forEach(([label, value], i) => {
    const last = i === totals.length - 1;
    doc.font(last ? 'Helvetica-Bold' : 'Helvetica').fontSize(last ? 11 : 9);
    doc.fillColor(last ? NAVY : SLATE);
    doc.text(label, right - boxW, y, { width: 110 });
    doc.text(value, right - 110, y, { width: 110, align: 'right' });
    y += last ? 18 : 14;
  });

  if (quotation.note) {
    y += 8;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Note', left, y);
    y += 12;
    doc.font('Helvetica').fontSize(9).fillColor(SLATE).text(String(quotation.note), left, y, { width });
    y += doc.heightOfString(String(quotation.note), { width }) + 10;
  }

  y = Math.max(y + 20, pageH - 200);
  const colW = (width - 24) / 2;
  const creatorName = creator?.name || creator?.full_name || 'Staff';
  const creatorEmail = creator?.email || '';

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
  doc.text(`Created By: ${creatorName}`, left, y, { width: colW });
  let leftY = y + 14;
  if (staffSig) {
    try {
      doc.image(staffSig, left, leftY, { fit: [180, 42], height: 42 });
      leftY += 48;
    } catch {
      leftY += 8;
    }
  }
  doc.font('Helvetica').fontSize(8).fillColor(SLATE);
  doc.text(stampDate(quotation.created_at), left, leftY, { width: colW });
  if (creatorEmail) doc.text(creatorEmail, left, leftY + 12, { width: colW });

  if (clientSig || quotation.client_signature_path || quotation.client_signed_at) {
    const rightX = left + colW + 24;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
    doc.text(`Client approved: ${quotation.customer_name || 'Client'}`, rightX, y, { width: colW });
    let rightY = y + 14;
    if (clientSig) {
      try {
        doc.image(clientSig, rightX, rightY, { fit: [180, 42], height: 42 });
        rightY += 48;
      } catch {
        rightY += 8;
      }
    }
    doc.font('Helvetica').fontSize(8).fillColor(SLATE);
    doc.text(stampDate(quotation.client_signed_at), rightX, rightY, { width: colW });
  }

  if (footerImg) {
    try {
      doc.image(footerImg, left, pageH - 70, { fit: [width, 40] });
    } catch { /* ignore */ }
  } else if (settings.pdf_footer_text || settings.copyright_text) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(settings.pdf_footer_text || settings.copyright_text, left, pageH - 52, { width, align: 'center' });
  }

  doc.end();
  return done;
}
