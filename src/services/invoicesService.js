import { supabase } from '@/lib/customSupabaseClient';
import jsPDF from 'jspdf';
import { sendRegistrationConfirmation } from './emailService'; // Reusing or new email function

export const generateInvoice = async (registrationData) => {
    try {
        // 1. Generate Invoice Number (Simple logic: Count + 1)
        const { count } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true });
        const invoiceNumber = `INV-${String((count || 0) + 1).padStart(3, '0')}`;
        
        // 2. Calculate Totals
        const subtotal = Number(registrationData.total_price);
        const taxRate = 0.05; // 5% example tax
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        // 3. Prepare Data for DB
        const invoiceData = {
            invoice_number: invoiceNumber,
            registration_id: registrationData.id,
            client_name: registrationData.client_name,
            email: registrationData.client_email,
            courses_json: registrationData.course_ids, // Assuming we store IDs or names
            subtotal: subtotal,
            tax: tax,
            total: total,
            payment_method: registrationData.payment_method || 'Credit Card', // Default or from input
            payment_status: registrationData.payment_status || 'pending',
            payment_date: registrationData.payment_date,
            created_at: new Date().toISOString()
        };

        // 4. Save to DB
        const { data, error } = await supabase.from('invoices').insert([invoiceData]).select().single();
        if (error) throw error;

        // 5. Generate PDF (Client-side generation logic)
        // Note: Real PDF storage usually requires uploading generated Blob to Storage Bucket then saving URL.
        // For this demo, we'll simulate the "generation" and return the object.
        // Actual PDF generation happens in the UI download handler often, or here if we upload.
        
        return data;
    } catch (error) {
        console.error("Error generating invoice:", error);
        throw error;
    }
};

export const getInvoices = async () => {
    try {
        const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching invoices:", error);
        throw error;
    }
};

export const getInvoice = async (id) => {
    try {
        const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching invoice:", error);
        throw error;
    }
};

export const createInvoicePDF = (invoice) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 61, 130); // Alpha Bridge Blue
    doc.text("INVOICE", 105, 20, null, null, "center");
    
    // Company Info
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Alpha Bridge", 105, 30, null, null, "center");
    doc.text("123 Tech Avenue, Innovation City", 105, 35, null, null, "center");
    doc.text("contact@alphabridge.com", 105, 40, null, null, "center");

    // Line
    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);

    // Details
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 20, 60);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 20, 68);
    
    doc.text(`Bill To:`, 140, 60);
    doc.text(`${invoice.client_name}`, 140, 68);
    doc.text(`${invoice.email}`, 140, 76);

    // Items Header
    doc.setFillColor(240);
    doc.rect(20, 90, 170, 10, 'F');
    doc.setFontSize(10);
    doc.font = "helvetica";
    doc.setFont(undefined, 'bold');
    doc.text("Description", 25, 96);
    doc.text("Amount", 170, 96, null, null, "right");

    // Items
    let y = 110;
    doc.setFont(undefined, 'normal');
    // Assuming courses_json is just a list or count for now
    doc.text("Course Services Registration", 25, y);
    doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, 170, y, null, null, "right");

    y += 20;
    doc.line(20, y, 190, y);
    y += 10;

    // Totals
    doc.text(`Subtotal:`, 140, y);
    doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, 190, y, null, null, "right");
    y += 8;
    doc.text(`Tax (5%):`, 140, y);
    doc.text(`$${Number(invoice.tax).toFixed(2)}`, 190, y, null, null, "right");
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text(`Total:`, 140, y);
    doc.text(`$${Number(invoice.total).toFixed(2)}`, 190, y, null, null, "right");

    return doc;
};

export const sendInvoiceEmail = async (invoiceId) => {
    try {
        const invoice = await getInvoice(invoiceId);
        // Use existing generic send-email edge function
        const { error } = await supabase.functions.invoke('send-email', {
            body: {
                to: invoice.email,
                subject: `Invoice ${invoice.invoice_number} from Alpha Bridge`,
                htmlBody: `
                    <h1>Invoice Available</h1>
                    <p>Dear ${invoice.client_name},</p>
                    <p>Your invoice <strong>${invoice.invoice_number}</strong> for <strong>$${invoice.total}</strong> is ready.</p>
                    <p>Please login to your portal to download it.</p>
                `,
                templateType: 'invoice_notification',
                data: invoice
            }
        });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error sending invoice email:", error);
        throw error;
    }
};