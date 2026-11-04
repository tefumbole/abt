import { money } from './quotationStatus.js';

function itemsBlock(items = []) {
  const lines = (items || [])
    .map((item, i) => {
      const name = item.product_name || item.name || 'Item';
      const unit = item.net_unit_price != null && item.net_unit_price !== '' ? ` @ ${money(item.net_unit_price)}` : '';
      const qty = item.qty != null && item.qty !== '' ? ` × ${item.qty}` : '';
      return `${i + 1}) ${name}${unit}${qty}`;
    })
    .join('\n');
  return lines ? `*Items:*\n${lines}\n` : '';
}

function amountBlock(q = {}) {
  const subtotal = Number(q.total_price ?? q.subtotal ?? 0);
  const discount = Number(q.discount ?? q.total_discount ?? 0);
  const tax = Number(q.tax ?? q.total_tax ?? 0);
  const shipping = Number(q.shipping ?? 0);
  const grand = Number(q.grand_total ?? 0);
  const implied = subtotal + tax + shipping - grand;
  const shownDiscount = discount > 0.009 ? discount : implied > 0.009 ? implied : 0;
  const rows = ['*Amount:*'];
  if (subtotal > 0) rows.push(`◾ *Subtotal:* ${money(subtotal)}`);
  if (shownDiscount > 0.009) rows.push(`◾ *Discount:* -${money(shownDiscount)}`);
  if (tax > 0) rows.push(`◾ *Tax:* ${money(tax)}`);
  if (shipping > 0) rows.push(`◾ *Shipping:* ${money(shipping)}`);
  rows.push(`◾ *Total due:* ${money(grand)}`);
  return `${rows.join('\n')}\n`;
}

function commentBlock(comment) {
  const text = String(comment || '').trim();
  return text ? `\n*Client comment:*\n${text}\n` : '';
}

export function quotationApprovalRequest({ company, customer, reference, items, quotation, approvalUrl }) {
  return [
    '📋 *QUOTATION FOR SIGNATURE*',
    '━━━━━━━━━━━━━━━━',
    `Hello *${customer}*,`,
    '',
    `Please review and sign your quotation from *${company}*.`,
    '',
    `◾ *Reference:* ${reference}`,
    '',
    itemsBlock(items),
    amountBlock(quotation),
    '',
    'This is a *quotation* (not a receipt). Open the link to *Sign & Approve*, *Reject*, or *Quote* (propose your own amounts).',
    '*The official PDF quotation will be sent to you only after you sign.*',
    '',
    '👉 *Review quotation:*',
    approvalUrl,
    '',
    `_${company}_`,
  ].join('\n');
}

export function quotationSignedPdf({ company, customer, reference, grandTotal }) {
  return [
    '✅ *SIGNED QUOTATION*',
    '━━━━━━━━━━━━━━━━',
    `Hello *${customer}*,`,
    '',
    `Thank you for signing. Please find your official quotation PDF from *${company}*.`,
    '',
    `◾ *Reference:* ${reference}`,
    `◾ *Total:* ${money(grandTotal)}`,
    '',
    `_${company}_`,
  ].join('\n');
}

export function quotationNoSignaturePdf({ company, customer, reference, grandTotal }) {
  return [
    '📄 *QUOTATION*',
    '━━━━━━━━━━━━━━━━',
    `Hello *${customer}*,`,
    '',
    `Please find your quotation PDF from *${company}*.`,
    '',
    `◾ *Reference:* ${reference}`,
    `◾ *Total:* ${money(grandTotal)}`,
    '',
    `_${company}_`,
  ].join('\n');
}

export function quotationStaffPdfCopy({ company, staff, reference, customer, grandTotal }) {
  return [
    '📄 *YOUR QUOTATION COPY*',
    '━━━━━━━━━━━━━━━━',
    `Hello *${staff}*,`,
    '',
    `A copy of quotation *${reference}* for *${customer}* is attached.`,
    '',
    `◾ *Reference:* ${reference}`,
    `◾ *Client:* ${customer}`,
    `◾ *Total:* ${money(grandTotal)}`,
    '',
    `_${company}_`,
  ].join('\n');
}

export function quotationCcPdfCopy({ company, ccName, customer, reference, grandTotal, signed = true }) {
  if (signed) {
    return [
      '📄 *SIGNED QUOTATION COPY*',
      '━━━━━━━━━━━━━━━━',
      `Hello *${ccName}*,`,
      '',
      `You are copied on the signed quotation for *${customer}* (*${reference}*).`,
      '',
      'The signed quotation PDF is attached.',
      '',
      `◾ *Reference:* ${reference}`,
      `◾ *Client:* ${customer}`,
      `◾ *Total:* ${money(grandTotal)}`,
      '',
      `_${company}_`,
    ].join('\n');
  }
  return [
    '📄 *QUOTATION COPY*',
    '━━━━━━━━━━━━━━━━',
    `Hello *${ccName}*,`,
    '',
    `You are copied on quotation *${reference}* for *${customer}*.`,
    '',
    'The quotation PDF is attached.',
    '',
    `◾ *Reference:* ${reference}`,
    `◾ *Client:* ${customer}`,
    `◾ *Total:* ${money(grandTotal)}`,
    '',
    `_${company}_`,
  ].join('\n');
}

const LIFECYCLE = {
  sent: { emoji: '📤', title: 'QUOTATION SENT FOR APPROVAL', body: (r, c) => `Quotation *${r}* was sent to *${c}* for approval.` },
  approved: { emoji: '✅', title: 'QUOTATION APPROVED', body: (r, c) => `*${c}* approved quotation *${r}*.` },
  rejected: { emoji: '❌', title: 'QUOTATION REJECTED', body: (r, c) => `*${c}* rejected quotation *${r}*.` },
  quoted: { emoji: '💬', title: 'CLIENT QUOTE', body: (r, c) => `*${c}* submitted a quote on quotation *${r}*.` },
  quote_accepted: { emoji: '✅', title: 'QUOTE ACCEPTED', body: (r) => `Client quote on *${r}* was accepted. Updated quotation sent for signature.` },
  quote_rejected: { emoji: '❌', title: 'QUOTE REJECTED', body: (r) => `Client quote on *${r}* was rejected. Original amounts kept.` },
};

const TAB_FOR_EVENT = {
  sent: 'awaiting',
  approved: 'approved',
  rejected: 'rejected',
  quoted: 'quoted',
  quote_accepted: 'awaiting',
  quote_rejected: 'awaiting',
};

export function quotationStakeholderNotify({
  company,
  reference,
  customer,
  items,
  quotation,
  comment,
  event,
  approvalUrl,
  adminListUrl,
}) {
  const meta = LIFECYCLE[event] || LIFECYCLE.sent;
  const lines = [
    `${meta.emoji} *${meta.title}*`,
    '━━━━━━━━━━━━━━━━',
    meta.body(reference, customer),
    '',
    `◾ *Reference:* ${reference}`,
    `◾ *Client:* ${customer}`,
    itemsBlock(items),
    amountBlock(quotation),
    commentBlock(comment),
  ];
  if ((event === 'sent' || event === 'quote_accepted') && approvalUrl) {
    lines.push('', '👉 *Client approval link:*', approvalUrl);
  }
  if (adminListUrl) {
    const tab = TAB_FOR_EVENT[event] || 'awaiting';
    const sep = adminListUrl.includes('?') ? '&' : '?';
    lines.push('', '👉 *Open quotations:*', `${adminListUrl}${sep}status=${tab}`);
  }
  lines.push('', `_${company}_`);
  return lines.join('\n');
}

export function quotationClientQuoteSubmitted({
  company,
  staff,
  customer,
  reference,
  mode,
  original,
  proposed,
  note,
  reviewUrl,
}) {
  const modeLabel = mode === 'lines' ? 'Item prices' : 'Overall total';
  const noteText = String(note || '').trim();
  return [
    '💬 *CLIENT QUOTE SUBMITTED*',
    '━━━━━━━━━━━━━━━━',
    `Hello *${staff}*,`,
    '',
    `*${customer}* submitted a quote on quotation *${reference}*.`,
    '',
    `◾ *Reference:* ${reference}`,
    `◾ *Mode:* ${modeLabel}`,
    `◾ *Original total:* ${money(original)}`,
    `◾ *Proposed total:* ${money(proposed)}`,
    noteText ? `\n*Client note:*\n${noteText}\n` : '',
    '👉 *Review client quote:*',
    reviewUrl,
    '',
    `_${company}_`,
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}
