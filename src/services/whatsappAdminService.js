import { supabase } from '@/lib/customSupabaseClient';

/**
 * WhatsApp-based Admin Service
 * Replaces TEXT role-based admin system with phone/email verification
 * NO circular dependencies - does not import WhatsAppService
 */

// Admin credentials (hardcoded for security)
const ADMIN_PHONE = '+250794006160';
const ADMIN_EMAIL = 'admin@alpha-bridge.net';

/**
 * Get admin account from profiles table
 * @returns {Promise<{success: boolean, data: object|null, error: string|null}>}
 */
export const getAdminAccount = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, phone, full_name')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (error) throw error;

    return { success: true, data, error: null };
  } catch (error) {
    console.error('Error fetching admin account:', error);
    return { success: false, data: null, error: error.message };
  }
};

/**
 * Check if a phone number belongs to an admin
 * @param {string} phone - Phone number to check
 * @returns {Promise<boolean>}
 */
export const isAdminByPhone = async (phone) => {
  if (!phone) return false;
  
  try {
    const normalizedInput = phone.replace(/\s+/g, '');
    const normalizedAdmin = ADMIN_PHONE.replace(/\s+/g, '');
    
    // Direct comparison
    if (normalizedInput === normalizedAdmin) return true;

    // Check database
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .eq('email', ADMIN_EMAIL)
      .single();

    if (error) return false;
    return data !== null;
  } catch (error) {
    console.error('Error checking admin by phone:', error);
    return false;
  }
};

/**
 * Check if an email belongs to an admin
 * @param {string} email - Email to check
 * @returns {Promise<boolean>}
 */
export const isAdminByEmail = async (email) => {
  if (!email) return false;
  
  try {
    const normalizedInput = email.toLowerCase().trim();
    const normalizedAdmin = ADMIN_EMAIL.toLowerCase().trim();
    
    return normalizedInput === normalizedAdmin;
  } catch (error) {
    console.error('Error checking admin by email:', error);
    return false;
  }
};

/**
 * Get admin phone number
 * @returns {string}
 */
export const getAdminPhone = () => {
  return ADMIN_PHONE;
};

/**
 * Get admin email
 * @returns {string}
 */
export const getAdminEmail = () => {
  return ADMIN_EMAIL;
};

/**
 * Send WhatsApp message to admin (placeholder - actual sending handled by WhatsAppService)
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendWhatsAppToAdmin = async (message) => {
  try {
    // Log the intent to send WhatsApp message
    console.log(`[WhatsAppAdmin] Message to admin (${ADMIN_PHONE}):`, message);
    
    // Note: Actual WhatsApp sending is handled by WhatsAppService to avoid circular dependency
    // This function serves as a reference point for admin phone number
    
    return { 
      success: true, 
      message: 'Message logged. Use WhatsAppService.sendWhatsAppMessage() for actual sending.' 
    };
  } catch (error) {
    console.error('Error logging WhatsApp message to admin:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if current authenticated user is admin
 * @returns {Promise<boolean>}
 */
export const isCurrentUserAdmin = async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return false;

    // Check by email first (fastest)
    if (user.email && await isAdminByEmail(user.email)) {
      return true;
    }

    // Check profile phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile for admin check:', profileError);
      return false;
    }

    // Verify both email and phone match admin credentials
    const emailMatch = profile?.email && await isAdminByEmail(profile.email);
    const phoneMatch = profile?.phone && await isAdminByPhone(profile.phone);

    return emailMatch || phoneMatch;
  } catch (error) {
    console.error('Error checking current user admin status:', error);
    return false;
  }
};

/**
 * Get current user's admin status with detailed info
 * @returns {Promise<{isAdmin: boolean, email?: string, phone?: string, userId?: string}>}
 */
export const getCurrentUserAdminStatus = async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isAdmin: false };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, email, full_name')
      .eq('id', user.id)
      .single();

    const isAdmin = await isCurrentUserAdmin();

    return {
      isAdmin,
      email: profile?.email || user.email,
      phone: profile?.phone,
      userId: user.id,
      fullName: profile?.full_name
    };
  } catch (error) {
    console.error('Error getting admin status:', error);
    return { isAdmin: false };
  }
};