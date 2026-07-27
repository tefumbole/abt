import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/customSupabaseClient";
import { logInfo } from "@/utils/debug";
import { otpService } from "@/services/otpService";
import { 
  refreshSessionIfNeeded 
} from "@/utils/sessionUtils";
import { validateSessionAndProfile } from "@/utils/sessionValidator";
import { withTimeout } from "@/utils/withTimeout";

const AUTH_INIT_TIMEOUT_MS = 8000;

const AuthContext = createContext({});
const OTP_VERIFIED_KEY = "alpha_otp_verified_flag";
const SUPABASE_STORAGE_KEY = "alpha_supabase_auth";

// Session refresh interval: 5 minutes
const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000;

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [error, setError] = useState(null);

  const refreshIntervalRef = useRef(null);
  const authListenerRef = useRef(null);

  const normalizeRole = (r) => String(r || "").trim().toLowerCase() || null;

  const clearSession = useCallback(() => {
    console.log('[AuthContext] clearSession: Starting state wipe...');
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setOtpVerified(false);
    setError(null);
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        console.log('[AuthContext] clearSession: Removing items from localStorage');
        localStorage.removeItem(OTP_VERIFIED_KEY);
        localStorage.removeItem(SUPABASE_STORAGE_KEY);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('session');
      }
      if (typeof window !== 'undefined' && window.sessionStorage) {
        console.log('[AuthContext] clearSession: Removing items from sessionStorage');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_id');
        sessionStorage.removeItem('user_role');
        sessionStorage.removeItem('session');
      }
    } catch (err) {
      console.warn("[AuthContext] Could not clear storage", err);
    }
    
    logInfo("AuthContext", "clearSession", "User session state completely cleared.");
  }, []);

  const getUserSafely = useCallback(async () => {
    try {
      console.log('[AuthContext] Getting user safely');
      const { data, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        console.warn('[AuthContext] Session error:', sessErr);
        return { user: null, error: sessErr };
      }

      const session = data?.session;
      if (!session?.access_token) {
        console.log('[AuthContext] No valid session token');
        return { user: null, error: null };
      }

      const { data: userData, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('[AuthContext] User fetch error:', error);
      }
      return { user: userData?.user ?? null, error };
    } catch (err) {
      console.error("[AuthContext] Error getting user safely:", err);
      return { user: null, error: err };
    }
  }, []);

  const getProfile = useCallback(
    async (userId) => {
      if (!userId) {
        console.log('[AuthContext] No user ID provided for profile fetch');
        setProfile(null);
        setRole(null);
        return null;
      }

      console.log('[AuthContext] Fetching profile for user:', userId);
      setIsProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("[AuthContext] Profile fetch error:", error);
          setProfile(null);
          setRole(null);
          return null;
        }

        if (data) {
          const normalized = normalizeRole(data.role);
          const normalizedProfile = { ...data, role: normalized };
          console.log('[AuthContext] Profile loaded:', { id: userId, role: normalized });
          setProfile(normalizedProfile);
          setRole(normalized);
          return normalizedProfile;
        }

        console.warn('[AuthContext] No profile data found for user:', userId);
        setProfile(null);
        setRole(null);
        return null;
      } catch (e) {
        console.error("[AuthContext] Unexpected error fetching profile:", e);
        setProfile(null);
        setRole(null);
        return null;
      } finally {
        setIsProfileLoading(false);
      }
    },
    []
  );

  const applySession = useCallback(
    async (sessionData) => {
      try {
        if (!sessionData?.user) {
          console.log('[AuthContext] No user in session data, clearing session');
          clearSession();
          return;
        }

        console.log('[AuthContext] Applying session for user:', sessionData.user.id);
        setSession(sessionData);
        setUser(sessionData.user);
        setError(null);

        let isVerified = false;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            isVerified = localStorage.getItem(OTP_VERIFIED_KEY) === "true";
          }
        } catch (err) {
          console.warn("[AuthContext] Could not access localStorage for OTP check", err);
        }
        if (import.meta.env.VITE_DEV_SKIP_OTP === 'true') {
          isVerified = true;
        }
        setOtpVerified(isVerified);
        console.log('[AuthContext] OTP verified status updated to:', isVerified);

        const freshProfile = await getProfile(sessionData.user.id);
        const userRole = freshProfile?.role ?? "none";

        console.log('[AuthContext] Session applied successfully. Role is:', userRole);
        logInfo(
          "AuthContext",
          "applySession",
          `Session active for ${sessionData.user.email}. Role: ${userRole}`
        );
      } catch (err) {
        console.error("[AuthContext] Error applying session", err);
        setError(err.message || "Failed to apply session");
        clearSession();
      }
    },
    [clearSession, getProfile]
  );

  const startSessionRefresh = useCallback(() => {
    console.log('[AuthContext] Starting session refresh interval');
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = setInterval(async () => {
      console.log("[AuthContext] Running periodic session refresh...");
      const result = await refreshSessionIfNeeded();
      
      if (!result.success && result.cleared) {
        console.log("[AuthContext] Session cleared during periodic refresh");
        clearSession();
        setError("Your session has expired. Please log in again.");
        if (toast) {
          toast({
            title: "Session Expired",
            description: "Please log in again to continue.",
            variant: "destructive"
          });
        }
      } else if (result.refreshed && result.session) {
        console.log("[AuthContext] Session refreshed successfully");
        await applySession(result.session);
      }
    }, SESSION_REFRESH_INTERVAL);
  }, [clearSession, applySession, toast]);

  const stopSessionRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
      console.log("[AuthContext] Session refresh interval stopped");
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        if (!mounted) return;
        console.log('[AuthContext] Step 1: Initializing authentication context...');
        setLoading(true);
        setError(null);

        // Task 2: Validate session and profile completeness
        console.log('[AuthContext] Step 2: Validating existing session and profile...');
        const validation = await withTimeout(
          validateSessionAndProfile(),
          AUTH_INIT_TIMEOUT_MS,
          'Auth initialization'
        );
        
        if (!validation.isValid) {
          console.log("[AuthContext] Step 3: No valid active session/profile found during init. Clearing context.");
          if (mounted) clearSession();
          return;
        }

        // Apply validated session
        if (mounted && validation.session) {
          console.log("[AuthContext] Step 3: Valid session and profile confirmed. Applying session...");
          await applySession(validation.session);
          startSessionRefresh();
        }

      } catch (e) {
        console.error("[AuthContext] Auth initialization critical error:", e);
        if (mounted) {
          clearSession();
          setError(
            e.message?.includes('timed out')
              ? "Connection slow — you can browse the site; sign in when ready."
              : "Failed to initialize authentication"
          );
        }
      } finally {
        if (mounted) {
          console.log('[AuthContext] Step 4: Initialization sequence complete.');
          setLoading(false);
        }
      }
    };

    init();

    // Set up auth state change listener
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, sessionData) => {
          if (!mounted) return;

          console.log(`[AuthContext] Auth state change event triggered: ${event}`);

          try {
            if (event === "SIGNED_OUT" || event === "USER_DELETED") {
              console.log('[AuthContext] Handling SIGNED_OUT/USER_DELETED: Clearing session data.');
              clearSession();
              stopSessionRefresh();
            } else if (event === "SIGNED_IN") {
              console.log('[AuthContext] Handling SIGNED_IN: Applying new session.');
              if (sessionData?.user) {
                await applySession(sessionData);
                startSessionRefresh();
              }
            } else if (event === "TOKEN_REFRESHED") {
              console.log('[AuthContext] Handling TOKEN_REFRESHED: Updating session state.');
              if (sessionData?.user) {
                await applySession(sessionData);
              }
            } else if (event === "USER_UPDATED") {
              console.log('[AuthContext] Handling USER_UPDATED: Updating session state.');
              if (sessionData?.user) {
                await applySession(sessionData);
              }
            }
          } catch (err) {
            console.error("[AuthContext] Auth state change handler error:", err);
            setError(err.message || "Authentication error occurred");
          }
        }
      );
      
      authListenerRef.current = data;
    } catch (err) {
      console.error("[AuthContext] Failed to initialize auth listener:", err);
    }

    return () => {
      mounted = false;
      stopSessionRefresh();
      if (authListenerRef.current?.subscription?.unsubscribe) {
        authListenerRef.current.subscription.unsubscribe();
      }
    };
  }, [applySession, clearSession, startSessionRefresh, stopSessionRefresh]);

  const loginWithCredentials = useCallback(
    async (identifier, password) => {
      console.log('[AuthContext] User attempting login with credentials:', identifier);
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier,
          identifier,
          password,
        });

        if (error) {
          console.error('[AuthContext] Login failed at Supabase level:', error);
          const message =
            typeof error === 'string'
              ? error
              : error?.message || 'Invalid email or password';
          throw new Error(message);
        }

        console.log('[AuthContext] Login successful. User ID:', data.session?.user?.id);
        
        // Wipe old OTP flag for security — every password login requires a fresh OTP
        // (unless local VITE_DEV_SKIP_OTP is enabled).
        setOtpVerified(false);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem(OTP_VERIFIED_KEY);
          }
        } catch (err) {
          console.warn("[AuthContext] Could not clear old OTP status", err);
        }

        if (data?.session?.user) {
          await applySession(data.session);
          if (import.meta.env.VITE_DEV_SKIP_OTP !== 'true') {
            setOtpVerified(false);
            try {
              if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem(OTP_VERIFIED_KEY);
              }
            } catch {
              /* ignore */
            }
          }
          startSessionRefresh();
          return { success: true, user: data.session.user };
        }

        throw new Error("Login succeeded but no session object returned by Supabase.");
      } catch (e) {
        console.error("[AuthContext] Login error caught in context:", e);
        const errorMessage = e.message || "Login failed";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [applySession, startSessionRefresh]
  );

  const verifyOTP = useCallback(
    async (code) => {
      console.log('[AuthContext] Attempting to verify OTP code...');
      try {
        const { user: currentUser, error } = await getUserSafely();

        if (error || !currentUser?.id) {
          console.error('[AuthContext] No valid session exists for OTP verification.');
          return { success: false, error: "Session expired. Please login again." };
        }

        console.log('[AuthContext] Calling OTP service validation for user ID:', currentUser.id);
        const result = await otpService.verifyOTP(currentUser.id, code);

        if (result?.success) {
          console.log('[AuthContext] OTP verified successfully. Setting flag in storage.');
          setOtpVerified(true);
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(OTP_VERIFIED_KEY, "true");
            }
          } catch (err) {
            console.warn("[AuthContext] Could not persist OTP verification state to storage", err);
          }

          const p = await getProfile(currentUser.id);

          // Refresh JWT/session so role metadata is current before admin redirect
          try {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session?.user) {
              setSession(refreshed.session);
              setUser(refreshed.session.user);
            }
          } catch (refreshErr) {
            console.warn('[AuthContext] Session refresh after OTP failed (non-fatal):', refreshErr);
          }

          return { success: true, profile: p };
        }

        console.warn('[AuthContext] OTP verification service returned failure:', result?.error);
        return {
          success: false,
          error: result?.error || result?.message || "Invalid OTP",
        };
      } catch (e) {
        console.error("[AuthContext] Critical VerifyOTP Error:", e);
        return { success: false, error: e.message || "OTP verification failed" };
      }
    },
    [getProfile, getUserSafely]
  );

  const resendOTP = useCallback(async () => {
    console.log('[AuthContext] Requesting OTP resend...');
    try {
      const { user: currentUser, error } = await getUserSafely();

      if (error || !currentUser?.id) {
        console.error('[AuthContext] No valid session for OTP resend operation.');
        return { success: false, error: "No user session found" };
      }

      console.log('[AuthContext] Dispatching resend via OTP service for user:', currentUser.id);
      return await otpService.resendOTP(currentUser.id);
    } catch (e) {
      console.error("[AuthContext] ResendOTP Error:", e);
      return { success: false, error: e.message || "Could not resend OTP" };
    }
  }, [getUserSafely]);

  // Task 2: Comprehensive Logout Handler
  const logout = useCallback(async () => {
    console.log('[AuthContext] >>> LOGOUT SEQUENCE INITIATED <<<');
    
    // 1. Stop background processes
    stopSessionRefresh();
    
    try {
      // 2. Clear Supabase server-side session
      console.log('[AuthContext] Step 1: Calling supabase.auth.signOut()');
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('[AuthContext] Non-critical error during Supabase signOut:', error);
      console.log('[AuthContext] Supabase server session terminated.');
    } catch (e) {
      console.error("[AuthContext] Critical error signing out from Supabase:", e);
    } finally {
      // 3 & 4. Clear ALL local state and storage
      console.log('[AuthContext] Step 2 & 3: Wiping browser storage artifacts (localStorage & sessionStorage)...');
      try {
        if (typeof window !== 'undefined') {
          // Clear localStorage specific keys
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_id');
          localStorage.removeItem('user_role');
          localStorage.removeItem('session');
          localStorage.removeItem('alpha_supabase_auth');
          localStorage.removeItem('alpha_otp_verified_flag');
          localStorage.removeItem('supabase.auth.token');
          
          // Clear sessionStorage specific keys
          sessionStorage.removeItem('auth_token');
          sessionStorage.removeItem('user_id');
          sessionStorage.removeItem('user_role');
          sessionStorage.removeItem('session');
          sessionStorage.clear();
          console.log('[AuthContext] Browser storage wiped successfully.');
        }
      } catch(e) {
        console.warn("[AuthContext] Warning: Browser storage wipe encountered an issue:", e);
      }
      
      // 5. Clear context variables (via clearSession)
      console.log('[AuthContext] Step 4: Clearing React context state (session, user, role, loading)...');
      clearSession();
      
      console.log('[AuthContext] >>> LOGOUT SEQUENCE COMPLETED <<<');
      if (toast) {
        toast({ 
          title: "Logged Out", 
          description: "You have been successfully and securely logged out." 
        });
      }
      // Redirect happens in the component that calls logout typically, or we let the protected route catch the missing session
      if (typeof window !== 'undefined') {
        console.log('[AuthContext] Step 5: Redirecting to /login');
        window.location.href = '/login';
      }
    }
  }, [clearSession, stopSessionRefresh, toast]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      role,
      otpVerified,
      loading,
      isProfileLoading,
      error,
      loginWithCredentials,
      verifyOTP,
      resendOTP,
      logout,
      getProfile,
      setProfile,
    }),
    [
      user,
      session,
      profile,
      role,
      otpVerified,
      loading,
      isProfileLoading,
      error,
      loginWithCredentials,
      verifyOTP,
      resendOTP,
      logout,
      getProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/*
 * SESSION STATE AUDIT CHECKLIST
 * [x] 1. Login button checks if session is truly valid before showing "already logged in" (Implemented via validateUserSession in LoginPage)
 * [x] 2. Profile exists and is active (Checked in AuthContext initialization and validateSessionAndProfile)
 * [x] 3. Logout clears Supabase session, localStorage, sessionStorage, and auth context (Implemented in comprehensive logout handler above)
 * [x] 4. OTP flow is not blocked by session checks (Ensured in handleLogin before OTP triggers)
 * [x] 5. Redirect works based on role (Implemented in OTPVerificationScreen and LoginPage)
 * [x] 6. No console errors (Handled gracefully with try-catch and safe UI fallbacks)
 */