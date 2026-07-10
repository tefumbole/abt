import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/customSupabaseClient';
import { sendDocumentBuffer, formatPhoneNumber } from '@/services/wasenderapiService';
import { formatPrice } from '@/services/sharePriceService';

function sanitizeFilename(name) {
  return String(name || 'shareholder').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolvePublicUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

export const generatePDFFromHTML = async (elementId) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`Element with ID "${elementId}" not found`);

    const canvas = await html2canvas(element, {
      scale: 1.25,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const imgWidthMm = pageWidthMm;
    const pageHeightPx = Math.floor((canvas.width * pageHeightMm) / imgWidthMm);

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(
        canvas,
        0,
        renderedHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.72);
      const sliceHeightMm = (sliceHeight * imgWidthMm) / canvas.width;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, sliceHeightMm);

      renderedHeight += sliceHeight;
      pageIndex += 1;
    }

    return { success: true, pdf };
  } catch (error) {
    console.error('[AGREEMENT] Error generating PDF:', error);
    return { success: false, error: error.message };
  }
};

export const downloadPDF = (pdf, filename) => {
  try {
    if (!pdf) throw new Error('PDF object is required');
    pdf.save(filename);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const uploadAgreementPDF = async (shareholderId, pdfBlob, filename) => {
  try {
    if (!shareholderId || !pdfBlob || !filename) {
      throw new Error('Shareholder ID, PDF blob, and filename are required');
    }

    const storedName = `agreement-${shareholderId}-${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from('shareholder-agreements')
      .upload(storedName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw error;

    const storedPath = data?.path || data?.Key || storedName;
    const { data: urlData } = supabase.storage
      .from('shareholder-agreements')
      .getPublicUrl(storedPath);

    const publicUrl = resolvePublicUrl(urlData?.publicUrl);
    return { success: true, publicUrl, path: storedPath, blob: pdfBlob };
  } catch (error) {
    console.error('[AGREEMENT] Error uploading PDF:', error);
    return { success: false, error: error.message };
  }
};

export const savePDFToShareholder = async (shareholderId, pdfUrl, pdfPath) => {
  try {
    const { error } = await supabase
      .from('shareholders')
      .update({
        agreement_pdf_url: pdfUrl,
        agreement_pdf_path: pdfPath,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', shareholderId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const generateAgreementPDFBlob = async (shareholderId, elementId, shareholderName) => {
  const filename = `Shareholder-Agreement-${sanitizeFilename(shareholderName || shareholderId)}.pdf`;
  const { success, pdf, error } = await generatePDFFromHTML(elementId);
  if (!success || !pdf) throw new Error(error || 'Failed to generate PDF');
  const pdfBlob = pdf.output('blob');
  return { pdf, pdfBlob, filename };
};

export const generateAndSaveAgreementPDF = async (shareholderId, elementId, shareholderName) => {
  try {
    const { pdfBlob, filename } = await generateAgreementPDFBlob(shareholderId, elementId, shareholderName);

    const { success: uploadSuccess, publicUrl, path, error: uploadError } = await uploadAgreementPDF(
      shareholderId,
      pdfBlob,
      filename
    );

    if (!uploadSuccess) throw new Error(uploadError || 'Failed to upload PDF');

    const { success: saveSuccess, error: saveError } = await savePDFToShareholder(
      shareholderId,
      publicUrl,
      path
    );

    if (!saveSuccess) throw new Error(saveError || 'Failed to save PDF info to database');

    return { success: true, pdfUrl: publicUrl, pdfBlob, filename };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sendPendingAgreementViaWhatsApp = async (
  shareholderPhone,
  shareholderName,
  pdfBlob,
  fileName,
  details
) => {
  try {
    if (!shareholderPhone || !shareholderName || !pdfBlob) {
      throw new Error('Phone number, name, and PDF are required');
    }

    const formattedPhone = formatPhoneNumber(shareholderPhone);
    if (!formattedPhone) {
      throw new Error(`Invalid phone number: ${shareholderPhone}`);
    }

    const { sharesCount, totalInvestment, referenceNumber } = details || {};
    const message = `Dear ${shareholderName},

Thank you for submitting your shareholder agreement with Alpha Bridge.

Your signed agreement copy is attached in the next message.

Reference Number: ${referenceNumber || 'N/A'}
Shares Requested: ${sharesCount || 0}
Total Investment: ${formatPrice(totalInvestment || 0)}
Status: Pending Approval

We will review your request and contact you shortly.

Alpha Bridge
The Technological Bridge to Kigali`;

    const result = await sendDocumentBuffer(
      formattedPhone,
      message,
      pdfBlob,
      fileName || 'Shareholder-Agreement-Pending.pdf'
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp message');
    }

    return { success: true };
  } catch (error) {
    console.error('[AGREEMENT] Error sending pending agreement:', error);
    return { success: false, error: error.message };
  }
};

export const sendPaymentConfirmationViaWhatsApp = async (shareholderPhone, shareholderName, details) => {
  try {
    const formattedPhone = formatPhoneNumber(shareholderPhone);
    if (!formattedPhone) {
      throw new Error(`Invalid phone number: ${shareholderPhone}`);
    }

    const { sharesCount, totalInvestment } = details || {};
    const message = `Dear ${shareholderName},

Your payment for your Alpha Bridge share investment has been confirmed.

Payment Status: Paid
Shares: ${sharesCount || 0}
Total Investment: ${formatPrice(totalInvestment || 0)}

Thank you for your investment. Welcome to Alpha Bridge!

Alpha Bridge
The Technological Bridge to Kigali`;

    const { sendWhatsAppMessage } = await import('@/services/wasenderapiService');
    const result = await sendWhatsAppMessage(formattedPhone, message);
    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp message');
    }
    return { success: true };
  } catch (error) {
    console.error('[AGREEMENT] Error sending payment confirmation:', error);
    return { success: false, error: error.message };
  }
};

export const sendAgreementViaWhatsApp = async (
  shareholderPhone,
  shareholderName,
  pdfBlob,
  fileName,
  investmentDetails
) => {
  try {
    if (!shareholderPhone || !shareholderName || !pdfBlob) {
      throw new Error('Phone number, name, and PDF are required');
    }

    const phone = shareholderPhone;
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      throw new Error(`Invalid phone number: ${phone}. Use international format e.g. +250794006160`);
    }

    const { approvedShares, sharePrice, totalInvestment } = investmentDetails || {};
    const message = `Dear ${shareholderName},

Congratulations! Your shareholder agreement has been approved.

Investment Summary:
• Approved Shares: ${approvedShares || 0}
• Share Price: ${formatPrice(sharePrice || 0)}
• Total Investment: ${formatPrice(totalInvestment || 0)}

Your signed shareholder agreement PDF is attached in the next message.

Thank you for investing with Alpha Bridge.

Best regards,
Alpha Bridge Team`;

    const result = await sendDocumentBuffer(
      formattedPhone,
      message,
      pdfBlob,
      fileName || 'Shareholder-Agreement.pdf'
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp message');
    }

    return { success: true };
  } catch (error) {
    console.error('[AGREEMENT] Error sending WhatsApp message:', error);
    return { success: false, error: error.message };
  }
};

export const getShareholderAgreement = async (shareholderId) => {
  try {
    const { data, error } = await supabase
      .from('shareholders')
      .select('*')
      .eq('id', shareholderId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Shareholder not found');
    return { success: true, shareholder: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  generatePDFFromHTML,
  downloadPDF,
  uploadAgreementPDF,
  savePDFToShareholder,
  generateAgreementPDFBlob,
  generateAndSaveAgreementPDF,
  sendPendingAgreementViaWhatsApp,
  sendPaymentConfirmationViaWhatsApp,
  sendAgreementViaWhatsApp,
  getShareholderAgreement,
};
