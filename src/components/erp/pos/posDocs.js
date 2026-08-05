/**
 * Document payloads for the POS screen: thermal receipts and the cash-drawer report.
 *
 * Receipt builders return the `doc` object expected by `buildReceiptHtml`;
 * the register report returns HTML for `openPrintWindow` (PRINT_STYLES).
 */
import { amount, formatErpDate, num, payingMethodLabel } from '@/lib/erpFormat';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** qty * price - discount + tax, the line total used everywhere in the POS. */
export function lineSubtotal(line) {
  return num(line?.qty) * num(line?.price) - num(line?.discount) + num(line?.tax);
}

export function cartSubtotal(items = []) {
  return items.reduce((sum, line) => sum + lineSubtotal(line), 0);
}

/** Grand total for a cart plus its order-level charges. */
export function cartGrandTotal({ items = [], discount = 0, tax = 0, shipping = 0 }) {
  return Math.max(0, cartSubtotal(items) - num(discount) + num(tax) + num(shipping));
}

/** Receipt for a sale completed in this session (cart lines are still in memory). */
export function buildCartReceiptDoc({
  sale = {},
  items = [],
  warehouseName = '',
  customer = {},
  cashier = '',
  discount = 0,
  tax = 0,
  shipping = 0,
  grandTotal = 0,
  paidAmount = 0,
  changeAmount = 0,
  payingMethod = 'cash',
}) {
  return {
    reference: sale.reference || '',
    date: sale.sale_date || new Date(),
    warehouse_name: warehouseName,
    customer: { name: customer.name || 'Walk-in Customer', phone: customer.phone || '' },
    cashier,
    items: items.map((line) => ({
      name: line.name,
      product_name: line.name,
      qty: num(line.qty),
      net_unit_price: num(line.price),
      discount: num(line.discount),
      tax: num(line.tax),
      subtotal: lineSubtotal(line),
    })),
    subtotal: cartSubtotal(items),
    discount: num(discount),
    tax: num(tax),
    shipping: num(shipping),
    grand_total: num(grandTotal),
    paid_amount: num(paidAmount),
    change_amount: num(changeAmount),
    paying_method: payingMethod,
  };
}

/** Receipt for an existing sale loaded through `getSale(id)` (reprint). */
export function buildSaleReceiptDoc(sale = {}, { warehouseName = '' } = {}) {
  const items = (sale.items || []).map((item) => ({
    name: item.product_name || item.name || '',
    product_name: item.product_name || item.name || '',
    qty: num(item.qty),
    net_unit_price: num(item.net_unit_price ?? item.price),
    discount: num(item.discount),
    tax: num(item.tax),
    subtotal: num(
      item.subtotal
        ?? num(item.qty) * num(item.net_unit_price ?? item.price) - num(item.discount) + num(item.tax)
    ),
  }));
  const paid = num(sale.paid_amount);
  const grand = num(sale.grand_total);
  return {
    reference: sale.reference || '',
    date: sale.sale_date || sale.created_at,
    warehouse_name: sale.warehouse_name || warehouseName,
    customer: { name: sale.customer_name || 'Walk-in Customer', phone: sale.customer_phone || '' },
    cashier: sale.biller_name || '',
    items,
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    discount: num(sale.discount),
    tax: num(sale.tax),
    shipping: num(sale.shipping),
    grand_total: grand,
    paid_amount: paid,
    change_amount: Math.max(0, paid - grand),
    paying_method: (sale.payments || [])[0]?.paying_method || 'cash',
  };
}

/**
 * Cash-drawer report printed when closing a register.
 * @param {(value:number)=>string} money currency formatter from `makeMoney`
 */
export function buildRegisterReportHtml({
  register = {},
  summary = null,
  company = {},
  money = (v) => amount(v),
  warehouseName = '',
}) {
  const methods = summary?.by_method || [];
  const rows = methods.length
    ? methods
      .map((row) => `<tr>
        <td>${escapeHtml(payingMethodLabel(row.paying_method))}</td>
        <td class="r">${escapeHtml(String(num(row.count, 0)))}</td>
        <td class="r">${escapeHtml(money(row.total))}</td>
      </tr>`)
      .join('')
    : '<tr><td colspan="3" class="empty">No payments recorded</td></tr>';

  const openingFloat = num(register.cash_in_hand);
  const line = (label, value) => `<tr><td>${escapeHtml(label)}</td><td class="r">${escapeHtml(value)}</td></tr>`;

  return `<div class="doc">
  <h1>Cash register report</h1>
  <p class="sub">${escapeHtml(company.name || '')}${warehouseName ? ` — ${escapeHtml(warehouseName)}` : ''}</p>
  <table>
    <tbody>
      ${line('Opened at', formatErpDate(register.opened_at, company.dateFormat, { withTime: true }) || '—')}
      ${line('Printed at', formatErpDate(new Date(), company.dateFormat, { withTime: true }))}
      ${line('Opening float', money(openingFloat))}
      ${line('Sales count', String(num(summary?.sales_count, 0)))}
      ${line('Total sales', money(summary?.total_sales))}
      ${line('Total received', money(summary?.total_paid))}
      ${line('Expected cash in drawer', money(summary?.expected_cash ?? openingFloat))}
    </tbody>
  </table>
  <h1 style="font-size:14px;margin-top:18px;">Payments by method</h1>
  <table>
    <thead><tr><th>Method</th><th class="r">Count</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="foot">Counted by ______________________   Signature ______________________</p>
</div>`;
}
