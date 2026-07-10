import { supabase } from '@/lib/customSupabaseClient';
import { createProfile } from '@/services/profileService';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'alpha_supabase_auth';

function getToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Generates a secure random temporary password
 * @returns {string} 12-character string
 */
export const generateTemporaryPassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Creates a new Supabase Auth account for an applicant
 * @param {string} email 
 * @param {string} name 
 * @param {string} phone 
 * @param {string} role - Default 'student'
 * @returns {Promise<{user: object, password: string, error: object}>}
 */
export const createAccountForApplicant = async (email, name, phone, role = 'student') => {
  try {
    const password = generateTemporaryPassword();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
          role: role
        }
      }
    });

    if (error) throw error;

    if (data?.user) {
      // 1. Create Profile
      await createProfile(data.user.id, email, name, phone, role);

      // 2. Assign Role via RPC
      const { error: roleError } = await supabase.rpc('assign_role', {
        target_user_id: data.user.id,
        role_name: role
      });

      if (roleError) console.warn("Failed to assign role via RPC:", roleError);
    }

    return { 
      user: data.user, 
      password, 
      error: null 
    };

  } catch (error) {
    console.error("Account creation failed:", error);
    return { user: null, password: null, error };
  }
};

/**
 * Creates a new user account from the Modal (user provided password)
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @param {string} phone
 * @param {string} role
 * @returns {Promise<{user: object, error: object}>}
 */
export const createAccountFromModal = async (email, password, fullName, phone, role = 'student') => {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone,
                    role: role
                }
            }
        });

        if (error) throw error;

        if (data?.user) {
          // 1. Create Profile
          await createProfile(data.user.id, email, fullName, phone, role);

          // 2. Assign Role via RPC
          const { error: roleError } = await supabase.rpc('assign_role', {
            target_user_id: data.user.id,
            role_name: role
          });

          if (roleError) console.warn("Failed to assign role via RPC:", roleError);
        }

        return { user: data.user, error: null };
    } catch (error) {
        console.error("Modal account creation failed:", error);
        return { user: null, error };
    }
};

/**
 * Sends account credentials via email
 * @param {string} email 
 * @param {string} name 
 * @param {string} password 
 */
export const sendAccountCredentialsEmail = async (email, name, password) => {
    try {
        const { error } = await supabase.functions.invoke('send-email', {
            body: {
                to: email,
                subject: 'Your Alpha Bridge Applicant Account',
                templateType: 'account_credentials',
                data: {
                    name,
                    email,
                    password,
                    loginUrl: `${window.location.origin}/applicant-login`
                }
            }
        });
        
        if (error) console.error("Failed to send credentials email:", error);
    } catch (e) {
        console.error("Failed to invoke email function:", e);
    }
};

/**
 * Complete first-login profile for a task guest:
 * set their own username, password, email and address.
 */
export async function completeOwnProfile(payload) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/auth/complete-profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'Could not update your profile.');
  }
  // Persist refreshed session so future requests use the latest credentials.
  if (json.session) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          access_token: json.session.access_token,
          refresh_token: json.session.refresh_token,
          expires_at: json.session.expires_at,
          currentSession: json.session,
          user: json.session.user,
        })
      );
    } catch {
      /* ignore storage errors */
    }
  }
  return json;
}
