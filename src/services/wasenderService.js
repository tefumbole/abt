/**
 * Service to handle WhatsApp interactions via Wasender API
 *
 * IMPORTANT:
 * - This runs in the browser (Vite). Any VITE_* secrets are exposed to users.
 * - For production, move sending to a Supabase Edge Function to protect API keys.
 */

import { logger } from "@/utils/logger";

const WASENDER_CONFIG = {
  apiKey: import.meta.env.VITE_WASENDER_API_KEY,
  apiUrl: import.meta.env.VITE_WASENDER_API_URL,
  senderPhone: import.meta.env.VITE_WASENDER_PHONE, // e.g. +237671553091
  adminPhone: import.meta.env.VITE_ADMIN_PHONE_NUMBER, // e.g. +250794006160
};

/**
 * Normalize and validate phone number.
 * - Keeps digits and leading +
 * - If no +countrycode provided, assumes Cameroon (+237)
 * @param {string} phone
 * @returns {string} normalized E.164 phone or empty string if invalid
 */
function normalizePhone(phone) {
  let clean = String(phone || "").trim().replace(/[^\d+]/g, "");

  // If user entered without +country code, assume Cameroon
  if (clean && !clean.startsWith("+")) {
    clean = clean.replace(/^0+/, ""); // drop leading zeros
    clean = `+237${clean}`;
  }

  // Basic E.164 sanity check: + then 8-15 digits
  if (!/^\+\d{8,15}$/.test(clean)) return "";
  return clean;
}

/**
 * Build endpoint safely.
 * Accepts either:
 * - base url: https://wasenderapi.com/api
 * - full url: https://wasenderapi.com/api/send-message
 */
function buildEndpoint(apiUrl) {
  const url = String(apiUrl || "").trim();
  if (!url) return "";

  // Already points to send-message
  if (url.endsWith("/send-message")) return url;

  // Append
  return url.replace(/\/+$/, "") + "/send-message";
}

/**
 * Sends a WhatsApp message using Wasender API
 * @param {string} phoneNumber - Recipient phone number (E.164 or local)
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, messageId: string|null, error: string|null, raw?: any}>}
 */
export async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    const apiKey = WASENDER_CONFIG.apiKey;
    const endpoint = buildEndpoint(WASENDER_CONFIG.apiUrl);

    if (!apiKey || !endpoint) {
      logger.warn("[WasenderService] Missing config", {
        hasApiKey: !!apiKey,
        apiUrl: WASENDER_CONFIG.apiUrl,
      });
      return { success: false, messageId: null, error: "Wasender configuration missing" };
    }

    const to = normalizePhone(phoneNumber);
    if (!to) {
      return { success: false, messageId: null, error: "Invalid phone number format" };
    }

    const text = String(message ?? "").trim();
    if (!text) {
      return { success: false, messageId: null, error: "Message is empty" };
    }

    // Payload structure (may vary by provider). This matches your previous implementation.
    const payload = {
      api_key: apiKey,
      sender: WASENDER_CONFIG.senderPhone ? normalizePhone(WASENDER_CONFIG.senderPhone) : undefined,
      number: to,
      message: text,
    };

    // Remove undefined keys to keep payload clean
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    logger.debug(`[WasenderService] Sending WhatsApp`, { to, endpoint });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Some APIs return non-JSON on error; handle safely
    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      const errorMsg =
        (data && (data.message || data.error)) ||
        `HTTP ${response.status} ${response.statusText}` ||
        "Request failed";

      logger.error("[WasenderService] API non-2xx", { to, status: response.status, data });
      return { success: false, messageId: null, error: errorMsg, raw: data };
    }

    // Interpret success flags
    const apiStatus = data?.status;
    const isError = apiStatus === "error" || apiStatus === false;

    if (isError) {
      const errorMsg = data?.message || data?.error || "Unknown API error";
      logger.warn("[WasenderService] API error response", { to, data });
      return { success: false, messageId: null, error: errorMsg, raw: data };
    }

    const messageId = data?.message_id || data?.id || data?.data?.id || "sent";
    logger.info("[WasenderService] WhatsApp sent", { to, messageId });

    return { success: true, messageId, error: null, raw: data };
  } catch (err) {
    const msg = err?.message || String(err);
    logger.error("[WasenderService] Network/System error", { error: msg });
    return { success: false, messageId: null, error: msg };
  }
}

/**
 * Sends OTP via WhatsApp
 * @param {string} phoneNumber - User's phone number
 * @param {string} otpCode - The OTP code
 * @returns {Promise<{success: boolean, messageId: string|null, error: string|null, raw?: any}>}
 */
export async function sendWhatsAppOTP(phoneNumber, otpCode) {
  const code = String(otpCode ?? "").trim();
  const message = `Your Alpha Bridge OTP is: ${code}. Valid for 10 minutes.`;

  // Send to user
  const result = await sendWhatsAppMessage(phoneNumber, message);

  // Optional admin alert (await so it doesn't fail silently)
  const admin = normalizePhone(WASENDER_CONFIG.adminPhone);
  const user = normalizePhone(phoneNumber);

  if (admin && user && admin !== user) {
    await sendWhatsAppMessage(admin, `[ADMIN ALERT] OTP generated for user. OTP: ${code}`);
  }

  return result;
}