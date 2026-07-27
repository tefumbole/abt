import { supabase } from '@/lib/customSupabaseClient';
import { sendOtp, formatPhoneNumber } from './wasenderapiService';

const useMysql = import.meta.env.VITE_DATA_BACKEND === 'mysql';
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'alpha_supabase_auth';

function getAuthToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

async function mysqlOtpApi(path, body = {}) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated. Please log in again.');

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || json.message || res.statusText || 'OTP request failed');
    err.retryAfter = json.retryAfter;
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Fetches the phone number for a user from the profiles table
 * @param {string} userId 
 * @returns {Promise<string>} Normalized phone number
 */
export const getPhoneFromProfiles = async (userId) => {
    console.log('[OTP_SERVICE] Fetching phone number for user:', userId);
    
    if (!userId) {
      throw new Error("User ID is required to fetch phone number.");
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("[OTP_SERVICE] Error fetching user phone:", error);
        throw new Error("Could not retrieve your profile information.");
    }

    if (!data?.phone) {
        throw new Error("No phone number found on your profile. Please contact support.");
    }

    const normalized = formatPhoneNumber(data.phone);
    if (!normalized) {
        throw new Error("Invalid phone number format in profile.");
    }

    console.log('[OTP_SERVICE] Phone number retrieved:', normalized);
    return normalized;
};

export const otpService = {
  /**
   * Generates and sends an OTP via WhatsApp using the frontend wasenderapiService.
   * @param {string} userId - The UUID of the user
   * @returns {Promise<{success: boolean, message: string, maskedPhone?: string}>}
   */
  async sendOTP(userId) {
    console.log('[OTP_SERVICE] Initializing OTP generation for user:', userId);

    if (useMysql) {
      try {
        const result = await mysqlOtpApi('/auth/otp/send');
        if (!result.success) {
          return { success: false, message: result.error || 'Failed to send OTP' };
        }
        return {
          success: true,
          message: result.message || 'OTP sent successfully.',
          maskedPhone: result.maskedPhone,
        };
      } catch (err) {
        console.error('[OTP_SERVICE] sendOTP (API) Error:', err);
        return {
          success: false,
          message: err.message || 'Failed to send OTP',
          retryAfter: err.retryAfter,
        };
      }
    }
    
    try {
      if (!userId) throw new Error("User ID is missing.");

      // 1. Get and format phone
      const phone = await getPhoneFromProfiles(userId);
      const formattedPhone = formatPhoneNumber(phone);

      // 2. Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 minutes

      console.log(`[OTP_SERVICE] Generating OTP... Target phone: ${formattedPhone}`);

      // 3. Store OTP in database
      const { error: dbError } = await supabase.from('otp_sessions').insert({
        phone: formattedPhone,
        otp: otpCode,
        expires_at: expiresAt,
        attempts: 0,
        resend_count: 0
      });

      if (dbError) {
        console.error('[OTP_SERVICE] Database insert error:', dbError);
        throw new Error("Failed to store verification code.");
      }

      console.log(`[OTP_SERVICE] Dispatching WhatsApp OTP to ${formattedPhone}`);

      const sendResult = await sendOtp(formattedPhone, otpCode);

      if (!sendResult.success) {
        console.error('[OTP_SERVICE] Message dispatch failed:', sendResult.error);
        throw new Error(sendResult.error || 'Failed to send WhatsApp message.');
      }

      const maskedPhone = `${formattedPhone.substring(0, 6)}****${formattedPhone.slice(-2)}`;
      console.log('[OTP_SERVICE] OTP dispatch completely successful');

      return {
        success: true,
        message: "OTP sent successfully.",
        maskedPhone
      };

    } catch (err) {
      console.error("[OTP_SERVICE] sendOTP Error:", err);
      return { 
        success: false, 
        message: err.message || "An unexpected error occurred sending OTP." 
      };
    }
  },

  /**
   * Verifies the OTP entered by the user.
   * @param {string} userId 
   * @param {string} otp - 6 digit code
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async verifyOTP(userId, otp) {
    console.log('[OTP_SERVICE] Verifying OTP code for user:', userId);

    if (useMysql) {
      try {
        const result = await mysqlOtpApi('/auth/otp/verify', { otp });
        if (!result.success) {
          return { success: false, message: result.error || 'Verification failed' };
        }
        return {
          success: true,
          message: result.message || 'OTP verified.',
          profile: result.profile || null,
        };
      } catch (err) {
        console.error('[OTP_SERVICE] verifyOTP (API) Error:', err);
        return { success: false, message: err.message || 'Verification failed' };
      }
    }

    try {
      if (!userId || !otp) {
        throw new Error("User ID and OTP are required.");
      }

      const phone = await getPhoneFromProfiles(userId);
      const formattedPhone = formatPhoneNumber(phone);

      const { data, error } = await supabase
        .from('otp_sessions')
        .select('*')
        .eq('phone', formattedPhone)
        .is('verified_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('[OTP_SERVICE] OTP lookup failed or expired.');
        return { success: false, message: "Invalid or expired OTP." };
      }

      if (data.otp !== otp) {
        console.warn('[OTP_SERVICE] OTP mismatch. Incrementing attempts.');
        await supabase.from('otp_sessions')
          .update({ attempts: (data.attempts || 0) + 1 })
          .eq('id', data.id);
          
        return { success: false, message: "Incorrect verification code." };
      }

      console.log('[OTP_SERVICE] OTP matched successfully. Marking as verified.');
      await supabase.from('otp_sessions')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', data.id);

      return { success: true, message: "OTP verified." };

    } catch (err) {
      console.error("[OTP_SERVICE] verifyOTP Error:", err);
      return { success: false, message: err.message || "Verification failed." };
    }
  },

  /**
   * Resends OTP
   * @param {string} userId 
   */
  async resendOTP(userId) {
    console.log('[OTP_SERVICE] Resending OTP for user:', userId);
    return this.sendOTP(userId);
  }
};