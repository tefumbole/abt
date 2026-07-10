import jsPDF from 'jspdf';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Uploads a base64 signature image to Supabase storage.
 * @param {string} dataUrl - The base64 data URL of the signature.
 * @param {string} userId - The ID of the user to associate with the file.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadSignature = async (dataUrl, userId) => {
  const blob = await (await fetch(dataUrl)).blob();
  const fileName = `signatures/${userId}_${Date.now()}.png`;

  const { data, error } = await supabase.storage
    .from('shareholder-agreements')
    .upload(fileName, blob, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Signature upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('shareholder-agreements')
    .getPublicUrl(fileName);

  return publicUrl;
};


/**
 * Generates a simple PDF of the Shareholder Agreement.
 * @param {object} shareholderData - Data of the shareholder signing.
 * @param {string} signatureDataUrl - Base64 data URL of the signature.
 * @returns {Promise<Blob>} A blob of the generated PDF.
 */
export const generateShareholderAgreementPDF = async (shareholderData, signatureDataUrl) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text('Shareholder Agreement', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Alpha Bridge', 105, 30, { align: 'center' });

  // Body Text
  doc.setFontSize(10);
  let y = 50;
  const addText = (text, isBold = false) => {
    if(isBold) doc.setFont('helvetica', 'bold');
    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 15, y);
    y += (splitText.length * 5) + 5;
    if(isBold) doc.setFont('helvetica', 'normal');
  };

  addText(`This agreement is made on ${new Date().toLocaleDateString()} between Alpha Bridge ("the Company") and ${shareholderData.name} ("the Shareholder").`, true);
  addText('1. Share Price: The value of one (1) share is set at USD $500.');
  addText('2. Vesting Period: Shares will be officially issued after a vesting period of 24 months.');
  addText('3. Dividends: Dividends are not guaranteed and are declared by the Board of Directors from company profits.');
  addText('By signing below, the Shareholder acknowledges and agrees to the terms outlined.');
  
  // Signature
  y += 20;
  doc.text('Shareholder Signature:', 15, y);
  doc.addImage(signatureDataUrl, 'PNG', 15, y + 5, 60, 30);
  
  doc.text(`Name: ${shareholderData.name}`, 15, y + 45);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, y + 50);

  return doc.output('blob');
};