import jsPDF from 'jspdf';
import { generateQRCode, generateBarcode } from '@/services/pdfGenerationService';
import { getAppOrigin } from '@/utils/pdfLetterhead';

const FORMATS = {
  a4: { width: 210, height: 297, unit: 'mm', fontSize: 10, headerH: 28, margin: 14 },
  a5: { width: 148, height: 210, unit: 'mm', fontSize: 9, headerH: 22, margin: 10 },
  thermal: { width: 80, height: 200, unit: 'mm', fontSize: 7, headerH: 16, margin: 4 },
};

function line(doc, y, label, value, cfg, bold = false) {
  const m = cfg.margin;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(cfg.fontSize);
  if (cfg.width <= 90) {
    doc.text(String(label), m, y);
    doc.text(String(value ?? '—'), m, y + 3.5);
    return y + 7;
  }
  doc.text(String(label), m, y);
  doc.text(String(value ?? '—'), m + 76, y);
  return y + 5;
}

export async function generateHrPayslipPdf(data, format = 'a4') {
  const cfg = FORMATS[format] || FORMATS.a4;
  const verify = data.payslip?.verification_code || data.id?.slice(0, 8)?.toUpperCase();
  const verifyUrl = `${getAppOrigin()}/verify/payslip/${verify}`;
  const qrDataUrl = await generateQRCode(verifyUrl);
  const barcodeDataUrl = generateBarcode(verify);

  const doc = new jsPDF({
    unit: cfg.unit,
    format: format === 'thermal' ? [cfg.width, cfg.height] : [cfg.width, cfg.height],
  });

  doc.setFillColor(0, 61, 130);
  doc.rect(0, 0, cfg.width, cfg.headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(format === 'thermal' ? 9 : 14);
  doc.text('Alpha Bridge', cfg.margin, cfg.headerH * 0.45);
  doc.setFontSize(format === 'thermal' ? 8 : 11);
  doc.text('PAYSLIP', cfg.margin, cfg.headerH * 0.8);

  doc.setTextColor(0, 0, 0);
  let y = cfg.headerH + 8;
  y = line(doc, y, 'Staff name:', `${data.first_name} ${data.last_name}`, cfg, true);
  y = line(doc, y, 'Employee No:', data.staff_code, cfg);
  y = line(doc, y, 'Position:', data.position, cfg);
  y = line(doc, y, 'Date of employment:', data.hire_date || '—', cfg);
  y = line(doc, y, 'Category:', data.category_name, cfg);
  y = line(doc, y, 'Payment type:', data.payment_type, cfg);
  if (format !== 'thermal') {
    y = line(doc, y, 'Payroll:', data.payroll_title, cfg);
    if (data.job_name) y = line(doc, y, 'Job / Event:', data.job_name, cfg);
    y = line(doc, y, 'Period:', `${data.period_start || ''} — ${data.period_end || ''}`, cfg);
  }
  y = line(doc, y, 'Days worked:', data.days_worked ?? '—', cfg);
  y = line(doc, y, 'Daily rate / Basic:', data.daily_rate
    ? `${Number(data.daily_rate).toLocaleString()} FCFA/day`
    : `${Number(data.basic_amount).toLocaleString()} FCFA`, cfg);

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Allowances', cfg.margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  for (const a of data.allowances || []) {
    y = line(doc, y, a.label, `${Number(a.amount).toLocaleString()} FCFA`, cfg);
  }
  if (!(data.allowances || []).length) y = line(doc, y, '—', '0 FCFA', cfg);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Deductions', cfg.margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  for (const d of data.deductions || []) {
    y = line(doc, y, d.label, `${Number(d.amount).toLocaleString()} FCFA`, cfg);
  }
  if (!(data.deductions || []).length) y = line(doc, y, '—', '0 FCFA', cfg);

  y += 4;
  y = line(doc, y, 'Gross pay:', `${Number(data.gross_amount).toLocaleString()} FCFA`, cfg, true);
  y = line(doc, y, 'Advances:', `${Number(data.total_advances).toLocaleString()} FCFA`, cfg);
  y = line(doc, y, 'NET PAY:', `${Number(data.net_amount).toLocaleString()} FCFA`, cfg, true);
  y = line(doc, y, 'Status:', data.payment_status, cfg);
  y = line(doc, y, 'Verify code:', verify, cfg);

  if (qrDataUrl) {
    const qrSize = format === 'thermal' ? 22 : format === 'a5' ? 28 : 32;
    const qrX = format === 'thermal' ? cfg.margin : cfg.width - qrSize - cfg.margin;
    doc.addImage(qrDataUrl, 'PNG', qrX, y + 2, qrSize, qrSize);
    y += qrSize + 4;
    doc.setFontSize(cfg.fontSize - 1);
    doc.text('Scan QR for verification', cfg.margin, y);
    y += 4;
  }

  if (barcodeDataUrl) {
    const bw = format === 'thermal' ? cfg.width - cfg.margin * 2 : 70;
    const bh = format === 'thermal' ? 12 : 16;
    doc.addImage(barcodeDataUrl, 'PNG', cfg.margin, y, bw, bh);
    y += bh + 4;
  }

  doc.save(`Payslip-${data.staff_code}-${verify}-${format.toUpperCase()}.pdf`);
}

export const PAYSLIP_FORMATS = [
  { id: 'a4', label: 'A4 (Standard)' },
  { id: 'a5', label: 'A5 (Half page)' },
  { id: 'thermal', label: 'Thermal (80mm receipt)' },
];

export default generateHrPayslipPdf;
