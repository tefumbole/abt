import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { isValidDocumentToken } from '../services/erp/documentToken.js';
import { loadQuotation } from '../services/erp/quotationApproval.js';
import { buildInvoicePdfBuffer, buildQuotationPdfBuffer } from '../services/erp/quotationPdf.js';

const router = Router();

async function loadPublicSale(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT s.*, w.name AS warehouse_name,
      c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
      c.address AS customer_address, c.company_name AS customer_company,
      b.name AS biller_name
     FROM sales s
     LEFT JOIN warehouses w ON w.id = s.warehouse_id
     LEFT JOIN erp_customers c ON c.id = s.customer_id
     LEFT JOIN erp_billers b ON b.id = s.biller_id
     WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const [items] = await pool.query(
    `SELECT ps.*, p.name AS product_name FROM product_sales ps
     LEFT JOIN products p ON p.id = ps.product_id WHERE ps.sale_id = ?`,
    [id]
  );
  return { ...rows[0], items };
}

router.get('/:kind/:id/:token', async (req, res) => {
  try {
    const kind = req.params.kind === 'invoice' ? 'invoice' : 'quotation';
    const { id, token } = req.params;
    const doc = kind === 'invoice' ? await loadPublicSale(id) : await loadQuotation(id);
    if (!doc || !isValidDocumentToken(kind, doc.id, doc.reference, token)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const buffer = kind === 'invoice'
      ? await buildInvoicePdfBuffer(doc)
      : await buildQuotationPdfBuffer(doc);
    const fileName = `${doc.reference || kind}.pdf`;
    const asDownload = String(req.query.download || '') === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${asDownload ? 'attachment' : 'inline'}; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=120');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
