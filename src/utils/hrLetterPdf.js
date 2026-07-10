import jsPDF from 'jspdf';

export function generateHrLetterPdf({ subject, body, staff, referenceCode }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(0, 61, 130);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('Alpha Bridge', 14, 12);
  doc.setFontSize(10);
  doc.text('Official HR Letter', 14, 20);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(subject || 'HR Letter', 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(body || '', 182);
  doc.text(lines, 14, 50);

  const y = Math.min(270, 50 + lines.length * 5 + 10);
  doc.setFontSize(9);
  doc.text(`Employee: ${staff?.first_name || ''} ${staff?.last_name || ''} (${staff?.staff_code || ''})`, 14, y);
  doc.text(`Reference: ${referenceCode || '—'}`, 14, y + 5);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y + 10);

  doc.save(`HR-Letter-${staff?.staff_code || 'staff'}-${referenceCode || Date.now()}.pdf`);
}

export default generateHrLetterPdf;
