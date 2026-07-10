import { supabase } from '@/lib/customSupabaseClient';
import { logEmailSent } from './emailLoggingService';

/**
 * Invokes the generic 'send-email' edge function.
 */
const invokeEmailFunction = async (functionName, payload, applicationId, emailType, recipientEmail) => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Unknown error sending email');
    }

    if (applicationId) {
      await logEmailSent(applicationId, emailType, recipientEmail, 'sent', data.messageId);
    }
    return { success: true, messageId: data.messageId };

  } catch (error) {
    console.error(`Error sending ${emailType}:`, error);
    if (applicationId) {
      await logEmailSent(applicationId, emailType, recipientEmail, 'failed', null, error.message);
    }
    return { success: false, error: error.message };
  }
};

/**
 * Sends a standard email message using the new generic Edge function.
 */
export const sendEmailMessage = async (to, subject, body, reference, pdfUrl) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, body, reference, pdfUrl }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('Error in sendEmailMessage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends bulk emails. 
 * Note: In production, batching inside the edge function or using standard loops.
 */
export const sendBulkEmails = async (messages) => {
  const results = [];
  for (const msg of messages) {
    const result = await sendEmailMessage(msg.to, msg.subject, msg.body, msg.reference, msg.pdfUrl);
    results.push({ to: msg.to, ...result });
  }
  return results;
};

// Legacy Application Functions
export const sendApplicationConfirmation = async (candidateEmail, applicationData) => {
  return invokeEmailFunction(
    'send-application-confirmation',
    {
      candidateEmail,
      candidateName: applicationData.candidate_name,
      jobTitle: applicationData.jobTitle,
      referenceNumber: applicationData.reference_number,
      applicationId: applicationData.id
    },
    applicationData.id,
    'confirmation',
    candidateEmail
  );
};

export const sendApplicationReceivedAdmin = async (adminEmail, applicationData) => {
  return invokeEmailFunction(
    'send-application-received-admin',
    {
      adminEmail,
      candidateName: applicationData.candidate_name,
      candidateEmail: applicationData.email,
      candidatePhone: applicationData.phone,
      jobTitle: applicationData.jobTitle,
      applicationId: applicationData.id
    },
    applicationData.id,
    'admin_notification',
    adminEmail || 'admin'
  );
};

export const sendApplicationRejected = async (candidateEmail, applicationData, rejectionReason) => {
  return invokeEmailFunction(
    'send-application-rejected',
    {
      candidateEmail,
      candidateName: applicationData.candidate_name,
      jobTitle: applicationData.jobTitle || applicationData.jobs?.title,
      rejectionReason
    },
    applicationData.id,
    'rejection',
    candidateEmail
  );
};

export const sendApplicationShortlisted = async (candidateEmail, applicationData, interviewDetails) => {
  return invokeEmailFunction(
    'send-application-shortlisted',
    {
      candidateEmail,
      candidateName: applicationData.candidate_name,
      jobTitle: applicationData.jobTitle || applicationData.jobs?.title,
      interviewDate: interviewDetails.date,
      interviewTime: interviewDetails.time,
      interviewLocation: interviewDetails.location
    },
    applicationData.id,
    'shortlisted',
    candidateEmail
  );
};

export const sendInterviewInvitation = async (candidateEmail, applicationData, invitationDetails) => {
  return invokeEmailFunction(
    'send-interview-invitation',
    {
      candidateEmail,
      candidateName: applicationData.candidate_name,
      jobTitle: applicationData.jobTitle || applicationData.jobs?.title,
      interviewDate: invitationDetails.date,
      interviewTime: invitationDetails.time,
      interviewLocation: invitationDetails.location,
      contactPerson: invitationDetails.contactPerson,
      contactPhone: invitationDetails.contactPhone
    },
    applicationData.id,
    'interview_invitation',
    candidateEmail
  );
};

// Legacy Registration functions
export const sendRegistrationConfirmation = async (registrationData, recipientEmail) => {
  return invokeEmailFunction(
    'send-email',
    {
      to: recipientEmail,
      subject: 'Course Registration Confirmation - Alpha Bridge',
      templateType: 'registration_confirmation',
      data: {
        clientName: registrationData.client_name,
        courseNames: registrationData.course_names || [],
        totalPrice: registrationData.total_price,
        registrationId: registrationData.id,
        paymentStatus: registrationData.payment_status
      }
    },
    null,
    'registration_confirmation',
    recipientEmail
  );
};

export const sendAdminNotification = async (registrationData) => {
  return invokeEmailFunction(
    'send-email',
    {
      to: 'admin@alpha-bridge.net',
      subject: 'New Course Registration Received',
      templateType: 'admin_registration_notification',
      data: {
        clientName: registrationData.client_name,
        clientEmail: registrationData.client_email,
        courseNames: registrationData.course_names || [],
        totalPrice: registrationData.total_price,
        registrationId: registrationData.id
      }
    },
    null,
    'admin_notification',
    'admin@alpha-bridge.net'
  );
};

export const sendOTPEmail = async (email, otpCode) => {
  return invokeEmailFunction(
    'send-email',
    {
      to: email,
      subject: 'Your OTP Code - Alpha Bridge',
      htmlBody: `<h1>OTP Code</h1><p>${otpCode}</p>`,
      templateType: 'otp',
      data: { otpCode }
    },
    null,
    'otp',
    email
  );
};