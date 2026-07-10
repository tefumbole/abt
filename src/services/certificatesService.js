import { supabase } from '@/lib/customSupabaseClient';
import jsPDF from 'jspdf';

export const generateCertificate = async (studentData, courseData) => {
    try {
        const { count } = await supabase
          .from('certificates')
          .select('id', { count: 'exact', head: true });
        const certNumber = `CERT-${String((count || 0) + 1).padStart(3, '0')}`;
        
        const certData = {
            certificate_number: certNumber,
            registration_id: studentData.registration_id,
            student_name: studentData.student_name,
            course_name: courseData.name,
            completion_date: new Date().toISOString(),
            status: 'active'
        };

        const { data, error } = await supabase.from('certificates').insert([certData]).select().single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error generating certificate:", error);
        throw error;
    }
};

export const getCertificates = async () => {
    try {
        const { data, error } = await supabase.from('certificates').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching certificates:", error);
        throw error;
    }
};

export const getCertificate = async (id) => {
    try {
        const { data, error } = await supabase.from('certificates').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching certificate:", error);
        throw error;
    }
};

export const revokeCertificate = async (id) => {
    try {
        const { data, error } = await supabase
            .from('certificates')
            .update({ status: 'revoked', revoked_at: new Date().toISOString() })
            .eq('id', id)
            .select().single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error revoking certificate:", error);
        throw error;
    }
};

export const createCertificatePDF = (cert) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    
    // Border
    doc.setDrawColor(212, 175, 55); // Gold
    doc.setLineWidth(3);
    doc.rect(10, 10, 277, 190);
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.setTextColor(0, 61, 130);
    doc.text("CERTIFICATE OF COMPLETION", 148.5, 40, null, null, "center");
    
    // Presented To
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(100);
    doc.text("This certificate is proudly presented to", 148.5, 60, null, null, "center");
    
    // Name
    doc.setFont("times", "italic");
    doc.setFontSize(40);
    doc.setTextColor(0);
    doc.text(cert.student_name, 148.5, 85, null, null, "center");
    
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(70, 90, 227, 90);

    // For Course
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(100);
    doc.text("For successfully completing the course", 148.5, 110, null, null, "center");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(0, 61, 130);
    doc.text(cert.course_name, 148.5, 130, null, null, "center");

    // Date & Signature
    const dateStr = new Date(cert.completion_date).toLocaleDateString();
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0);
    
    doc.text(`Date: ${dateStr}`, 60, 160);
    doc.line(50, 165, 100, 165);
    
    doc.text("Director, Alpha Bridge", 200, 170);
    doc.line(180, 165, 250, 165); // Signature Line
    
    // ID
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Certificate ID: ${cert.certificate_number}`, 148.5, 195, null, null, "center");

    return doc;
};

export const sendCertificateEmail = async (certId) => {
    try {
        const cert = await getCertificate(certId);
        // Note: In real app, attach PDF. Here just notification.
         const { error } = await supabase.functions.invoke('send-email', {
            body: {
                to: 'student@example.com', // Would normally fetch student email
                subject: `Certificate Earned: ${cert.course_name}`,
                htmlBody: `
                    <h1>Congratulations!</h1>
                    <p>You have successfully completed <strong>${cert.course_name}</strong>.</p>
                    <p>Your certificate (ID: ${cert.certificate_number}) is now available for download.</p>
                `,
                templateType: 'certificate_notification',
                data: cert
            }
        });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Error sending cert email:", error);
        throw error;
    }
};