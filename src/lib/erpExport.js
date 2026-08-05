/**
 * Table export utilities shared by the ERP list screens (sales, quotations, products…).
 *
 * A column is `{ key, label, value?(row), align? }`. `value` wins over `key` and must
 * return a primitive — export output is plain text, never JSX.
 */

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function cellText(row, column) {
  const raw = typeof column.value === 'function' ? column.value(row) : row?.[column.key];
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv({ filename = 'export.csv', columns = [], rows = [] }) {
  const escapeCsv = (text) => `"${String(text).replace(/"/g, '""')}"`;
  const lines = [
    columns.map((c) => escapeCsv(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsv(cellText(row, c))).join(',')),
  ];
  // BOM keeps Excel from mangling non-ASCII currency symbols.
  download(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Excel-readable single-sheet HTML workbook (no extra dependency). */
export function exportExcel({ filename = 'export.xls', title = '', columns = [], rows = [] }) {
  const head = columns.map((c) => `<th style="background:#003D82;color:#fff;padding:6px;">${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td style="padding:5px;">${escapeHtml(cellText(row, c))}</td>`).join('')}</tr>`)
    .join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>
<body>${title ? `<h3>${escapeHtml(title)}</h3>` : ''}<table border="1">
<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), filename);
}

export function buildTableHtml({ title = '', subtitle = '', columns = [], rows = [], footer = '' }) {
  const head = columns.map((c) => `<th class="${c.align === 'right' ? 'r' : ''}">${escapeHtml(c.label)}</th>`).join('');
  const body = rows.length
    ? rows
      .map((row) => `<tr>${columns
        .map((c) => `<td class="${c.align === 'right' ? 'r' : ''}">${escapeHtml(cellText(row, c))}</td>`)
        .join('')}</tr>`)
      .join('')
    : `<tr><td colspan="${columns.length}" class="empty">No records found</td></tr>`;
  return `<div class="doc">
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${footer ? `<p class="foot">${escapeHtml(footer)}</p>` : ''}
</div>`;
}

export const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
  .doc h1 { font-size: 18px; margin: 0 0 4px; color: #003D82; }
  .doc .sub { font-size: 12px; color: #64748b; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 600; }
  td.r, th.r { text-align: right; }
  td.empty { text-align: center; color: #94a3b8; padding: 20px; }
  .foot { margin-top: 12px; font-size: 11px; color: #64748b; }
  @page { margin: 14mm; }
`;

/** Opens an isolated window so printing never inherits the admin layout CSS. */
export function openPrintWindow(html, { title = 'Print', styles = PRINT_STYLES, autoClose = true } = {}) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) {
    throw new Error('Popup blocked — allow popups for this site to print.');
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  // Give the browser a tick to lay out images/fonts before the print dialog.
  setTimeout(() => {
    win.print();
    if (autoClose) setTimeout(() => win.close(), 400);
  }, 350);
  return win;
}

export function printTable(options) {
  openPrintWindow(buildTableHtml(options), { title: options.title || 'Print' });
}

/** Renders HTML off-screen and saves it as a PDF via html2pdf. */
export async function downloadHtmlPdf(html, {
  filename = 'document.pdf',
  styles = PRINT_STYLES,
  orientation = 'portrait',
  format = 'a4',
} = {}) {
  const { default: html2pdf } = await import('html2pdf.js');
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-10000px';
  holder.style.top = '0';
  holder.style.width = orientation === 'landscape' ? '1120px' : '794px';
  holder.style.background = '#ffffff';
  holder.innerHTML = `<style>${styles}</style>${html}`;
  document.body.appendChild(holder);
  try {
    await html2pdf()
      .set({
        margin: [10, 10, 12, 10],
        filename,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format, orientation },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(holder)
      .save();
  } finally {
    document.body.removeChild(holder);
  }
}

export function exportTablePdf(options) {
  const { filename = 'export.pdf', ...rest } = options;
  return downloadHtmlPdf(buildTableHtml(rest), { filename, orientation: 'landscape' });
}
