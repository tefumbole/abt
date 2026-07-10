import jsPDF from 'jspdf';

/**
 * Generates a PDF confirmation for a job application
 * @param {Object} application - Application data
 * @param {Object} job - Job data
 * @param {string} qrCodeUrl - Data URL of the QR code
 * @returns {jsPDF} The PDF document object
 */
export const generateApplicationPDF = (application, job, qrCodeUrl) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // -- Header --
  // Blue Background Header
  doc.setFillColor(0, 61, 130); // #003D82
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title text in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("Application Confirmation", margin, 25);

  yPos = 55;

  // -- Reference Number Section --
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text("Reference Number:", margin, yPos);
  
  doc.setTextColor(0, 61, 130);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(application.reference_number || "N/A", margin, yPos + 8);

  // -- QR Code (Right aligned) --
  if (qrCodeUrl) {
    try {
        const qrSize = 40;
        doc.addImage(qrCodeUrl, 'PNG', pageWidth - margin - qrSize, 50, qrSize, qrSize);
    } catch (e) {
        console.warn("Could not add QR code to PDF", e);
    }
  }

  yPos += 30;

  // -- Candidate Details --
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Candidate Details", margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  
  const addDetailRow = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value || "N/A", margin + 40, yPos);
    yPos += 8;
  };

  addDetailRow("Name", application.candidate_name);
  addDetailRow("Email", application.email);
  addDetailRow("Phone", application.phone);
  addDetailRow("Date", new Date(application.created_at).toLocaleDateString());

  yPos += 5;

  // -- Job Details --
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text("Position Applied For", margin, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.setTextColor(0, 61, 130); // Primary color
  doc.text(job?.title || "Unknown Position", margin, yPos);
  yPos += 8;

  if (job?.salary) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`Salary Range: ${job.salary}`, margin, yPos);
      yPos += 15;
  } else {
      yPos += 7;
  }

  // -- Description / Cover Note --
  if (application.description) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text("Cover Note / Summary", margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      const splitText = doc.splitTextToSize(application.description, pageWidth - (margin * 2));
      doc.text(splitText, margin, yPos);
  }

  // -- Footer --
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Alpha Bridge.", margin, footerY);
  doc.text("This document confirms that your application has been received.", margin, footerY + 5);

  return doc;
};