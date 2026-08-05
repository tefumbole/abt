/**
 * Printable ERP documents: A4 invoice / quotation and 80mm POS receipt.
 *
 * Builders return plain HTML strings so they work with both `openPrintWindow`
 * and `downloadHtmlPdf` without mounting React.
 */
import { getSystemSettings } from '@/services/settingsService';
import { amount, currencySymbol, formatErpDate, num, payingMethodLabel } from '@/lib/erpFormat';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Reads branding + currency once so documents match the Settings hub. */
export async function loadErpCompany() {
  try {
    const s = (await getSystemSettings()) || {};
    return {
      name: s.application_name || 'Alpha Bridge Technologies',
      logoUrl: s.logo_url || null,
      headerUrl: s.pdf_header_url || null,
      footerUrl: s.pdf_footer_url || null,
      headerText: s.pdf_header_text || '',
      footerText: s.pdf_footer_text || '',
      currency: s.currency || 'RWF',
      currencyPosition: s.currency_position || 'prefix',
      dateFormat: s.date_format || 'd-m-Y',
      developedBy: s.developed_by || '',
      copyright: s.copyright_text || '',
    };
  } catch {
    return {
      name: 'Alpha Bridge Technologies',
      currency: 'RWF',
      currencyPosition: 'prefix',
      dateFormat: 'd-m-Y',
    };
  }
}

function money(company, value) {
  const symbol = currencySymbol(company?.currency || 'RWF');
  const text = amount(value);
  return String(company?.currencyPosition).toLowerCase() === 'suffix'
    ? `${text} ${symbol}`
    : `${symbol} ${text}`;
}

export const DOCUMENT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
  .sheet { max-width: 780px; margin: 0 auto; }
  .band { width: 100%; max-height: 120px; object-fit: contain; margin-bottom: 12px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #003D82; padding-bottom: 14px; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand img { height: 56px; width: auto; }
  .brand h2 { margin: 0; font-size: 18px; color: #003D82; }
  .brand p { margin: 2px 0 0; font-size: 11px; color: #64748b; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 24px; letter-spacing: 2px; color: #003D82; text-transform: uppercase; }
  .title .ref { font-size: 12px; color: #475569; margin-top: 4px; }
  .meta { display: flex; gap: 24px; margin: 18px 0; }
  .meta > div { flex: 1; }
  .meta h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  .meta p { margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { background: #003D82; color: #fff; padding: 8px; text-align: left; font-weight: 600; }
  td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
  td.r, th.r { text-align: right; }
  .totals { margin-top: 14px; margin-left: auto; width: 300px; font-size: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #003D82; margin-top: 6px; padding-top: 8px; font-size: 15px; font-weight: 700; color: #003D82; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #eef2ff; color: #3730a3; }
  .note { margin-top: 18px; font-size: 11px; color: #475569; white-space: pre-wrap; }
  .payments { margin-top: 18px; }
  .payments h4 { font-size: 12px; margin: 0 0 6px; color: #003D82; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; font-size: 11px; color: #475569; }
  .sign div { width: 200px; border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; }
  .footnote { margin-top: 22px; text-align: center; font-size: 10px; color: #94a3b8; }
  @page { margin: 12mm; }
`;

export const RECEIPT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; color: #000; margin: 0; padding: 6px; width: 80mm; font-size: 12px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  img.logo { max-width: 52mm; max-height: 18mm; object-fit: contain; margin-bottom: 4px; }
  h2 { font-size: 14px; margin: 2px 0; }
  .muted { font-size: 10px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  td { padding: 1px 0; vertical-align: top; }
  .tot td { padding: 2px 0; }
  .grand td { font-size: 13px; font-weight: 700; border-top: 1px solid #000; padding-top: 4px; }
  @page { margin: 3mm; size: 80mm auto; }
`;

function itemRows(company, items = []) {
  if (!items.length) {
    return '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:18px;">No items</td></tr>';
  }
  return items
    .map((item, index) => {
      const qty = num(item.qty);
      const price = num(item.net_unit_price ?? item.price);
      const subtotal = num(item.subtotal ?? qty * price - num(item.discount) + num(item.tax));
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.product_name || item.name || '')}${item.product_code ? `<br /><span style="color:#94a3b8;font-size:10px;">${escapeHtml(item.product_code)}</span>` : ''}</td>
        <td class="r">${amount(qty, 2)}</td>
        <td class="r">${money(company, price)}</td>
        <td class="r">${money(company, num(item.discount))}</td>
        <td class="r">${money(company, subtotal)}</td>
      </tr>`;
    })
    .join('');
}

/**
 * @param {'invoice'|'quotation'} kind
 * @param {object} doc  normalised sale/quotation (see SalesPage / QuotationsPage)
 * @param {object} company from loadErpCompany()
 */
export function buildDocumentHtml({ kind = 'invoice', doc = {}, company = {} }) {
  const isQuotation = kind === 'quotation';
  const heading = isQuotation ? 'Quotation' : 'Invoice';
  const customer = doc.customer || {};
  const itemsTotal = (doc.items || []).reduce(
    (sum, item) => sum + num(item.subtotal ?? num(item.qty) * num(item.net_unit_price)),
    0
  );
  const due = num(doc.grand_total) - num(doc.paid_amount);

  const payments = (doc.payments || []).length
    ? `<div class="payments"><h4>Payments received</h4><table>
        <thead><tr><th>Date</th><th>Reference</th><th>Method</th><th class="r">Amount</th></tr></thead>
        <tbody>${doc.payments
          .map((p) => `<tr>
            <td>${escapeHtml(formatErpDate(p.paid_at, company.dateFormat))}</td>
            <td>${escapeHtml(p.reference || '')}</td>
            <td>${escapeHtml(payingMethodLabel(p.paying_method))}</td>
            <td class="r">${money(company, p.amount)}</td>
          </tr>`)
          .join('')}</tbody></table></div>`
    : '';

  return `<div class="sheet">
  ${company.headerUrl ? `<img class="band" src="${escapeHtml(company.headerUrl)}" alt="" />` : ''}
  <div class="top">
    <div class="brand">
      ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="" />` : ''}
      <div>
        <h2>${escapeHtml(company.name || '')}</h2>
        ${company.headerText ? `<p>${escapeHtml(company.headerText)}</p>` : ''}
        ${doc.warehouse_name ? `<p>${escapeHtml(doc.warehouse_name)}</p>` : ''}
      </div>
    </div>
    <div class="title">
      <h1>${heading}</h1>
      <div class="ref">${escapeHtml(doc.reference || '')}</div>
      <div class="ref">${escapeHtml(formatErpDate(doc.date || doc.sale_date || doc.created_at, company.dateFormat, { withTime: true }))}</div>
      ${doc.status_label ? `<div class="ref"><span class="badge">${escapeHtml(doc.status_label)}</span></div>` : ''}
    </div>
  </div>

  <div class="meta">
    <div>
      <h4>${isQuotation ? 'Quotation for' : 'Bill to'}</h4>
      <p class="b">${escapeHtml(customer.name || 'Walk-in Customer')}</p>
      ${customer.company_name ? `<p>${escapeHtml(customer.company_name)}</p>` : ''}
      ${customer.phone ? `<p>${escapeHtml(customer.phone)}</p>` : ''}
      ${customer.email ? `<p>${escapeHtml(customer.email)}</p>` : ''}
      ${customer.address ? `<p>${escapeHtml(customer.address)}</p>` : ''}
    </div>
    <div>
      <h4>Details</h4>
      ${doc.biller_name ? `<p>Biller: ${escapeHtml(doc.biller_name)}</p>` : ''}
      ${doc.warehouse_name ? `<p>Warehouse: ${escapeHtml(doc.warehouse_name)}</p>` : ''}
      ${doc.supplier_name ? `<p>Supplier: ${escapeHtml(doc.supplier_name)}</p>` : ''}
      ${!isQuotation && doc.payment_status ? `<p>Payment: ${escapeHtml(doc.payment_status)}</p>` : ''}
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:32px;">#</th><th>Product</th><th class="r">Qty</th>
      <th class="r">Unit price</th><th class="r">Discount</th><th class="r">Subtotal</th>
    </tr></thead>
    <tbody>${itemRows(company, doc.items)}</tbody>
  </table>

  <div class="totals">
    <div><span>Items subtotal</span><span>${money(company, itemsTotal)}</span></div>
    <div><span>Order discount</span><span>- ${money(company, doc.discount)}</span></div>
    <div><span>Order tax</span><span>${money(company, doc.tax)}</span></div>
    <div><span>Shipping</span><span>${money(company, doc.shipping)}</span></div>
    <div class="grand"><span>Grand total</span><span>${money(company, doc.grand_total)}</span></div>
    ${isQuotation ? '' : `<div><span>Paid</span><span>${money(company, doc.paid_amount)}</span></div>
    <div class="b"><span>Balance due</span><span>${money(company, due > 0 ? due : 0)}</span></div>`}
  </div>

  ${payments}
  ${doc.note ? `<div class="note"><strong>Note:</strong> ${escapeHtml(doc.note)}</div>` : ''}

  <div class="sign">
    <div>Customer signature</div>
    <div>For ${escapeHtml(company.name || '')}</div>
  </div>

  ${company.footerUrl ? `<img class="band" src="${escapeHtml(company.footerUrl)}" alt="" />` : ''}
  <div class="footnote">${escapeHtml(company.footerText || company.copyright || '')}</div>
</div>`;
}

/** 80mm thermal receipt for POS checkout. */
export function buildReceiptHtml({ doc = {}, company = {}, settings = {} }) {
  const customer = doc.customer || {};
  const lines = (doc.items || [])
    .map((item) => {
      const qty = num(item.qty);
      const price = num(item.net_unit_price ?? item.price);
      const sub = num(item.subtotal ?? qty * price - num(item.discount));
      return `<tr>
        <td colspan="3">${escapeHtml(item.product_name || item.name || '')}</td>
      </tr>
      <tr>
        <td>${amount(qty, 2)} x ${amount(price)}</td>
        <td></td>
        <td class="r">${amount(sub)}</td>
      </tr>`;
    })
    .join('');

  return `<div>
  <div class="c">
    ${company.logoUrl && settings.receipt_show_logo !== false ? `<img class="logo" src="${escapeHtml(company.logoUrl)}" alt="" />` : ''}
    <h2>${escapeHtml(company.name || '')}</h2>
    ${settings.receipt_header ? `<div class="muted">${escapeHtml(settings.receipt_header)}</div>` : ''}
    ${doc.warehouse_name ? `<div class="muted">${escapeHtml(doc.warehouse_name)}</div>` : ''}
  </div>
  <hr />
  <div class="muted">
    <div>Receipt: <span class="b">${escapeHtml(doc.reference || '')}</span></div>
    <div>Date: ${escapeHtml(formatErpDate(doc.date || doc.sale_date, company.dateFormat, { withTime: true }))}</div>
    <div>Customer: ${escapeHtml(customer.name || 'Walk-in Customer')}</div>
    ${doc.cashier ? `<div>Served by: ${escapeHtml(doc.cashier)}</div>` : ''}
  </div>
  <hr />
  <table>${lines}</table>
  <hr />
  <table class="tot">
    <tr><td>Subtotal</td><td class="r">${amount(doc.subtotal ?? doc.grand_total)}</td></tr>
    <tr><td>Discount</td><td class="r">-${amount(doc.discount)}</td></tr>
    <tr><td>Tax</td><td class="r">${amount(doc.tax)}</td></tr>
    <tr><td>Shipping</td><td class="r">${amount(doc.shipping)}</td></tr>
    <tr class="grand"><td>TOTAL</td><td class="r">${amount(doc.grand_total)}</td></tr>
    <tr><td>Paid (${escapeHtml(payingMethodLabel(doc.paying_method))})</td><td class="r">${amount(doc.paid_amount)}</td></tr>
    <tr><td>Change</td><td class="r">${amount(doc.change_amount)}</td></tr>
  </table>
  <hr />
  <div class="c muted">
    ${escapeHtml(settings.receipt_footer || 'Thank you for your business!')}
  </div>
</div>`;
}
