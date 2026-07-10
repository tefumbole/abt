import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { otpService } from '@/services/otpService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Loader2, User, Lock, ArrowRight, MessageSquare, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateSessionAndProfile } from '@/utils/sessionValidator';
import { APP_VERSION, APP_VERSION_LABEL } from '@/constants/appVersion';

/*
 * TASK 8 SUMMARY OF FIXES:
 * - Fixed: Session validation logic now correctly checks both Supabase session and database profile before showing "already logged in".
 * - Fixed: Added comprehensive logging on mount, login attempts, and redirect decisions.
 * - Fixed: Ensure OTP trigger logic validates and proceeds correctly without being blocked by false positive sessions.
 * 
 * PRESERVED SYSTEMS:
 * - OTP generation logic (otpService.js)
 * - OTP verification logic
 * - WhatsApp messaging (wasenderapiService.js)
 * - Wasender integration
 * - Authentication base logic (Supabase signInWithPassword)
 * - Role-based redirects paths
 */

/*
 * SESSION STATE AUDIT CHECKLIST
 * [x] 1. Login button checks if session is truly valid before showing "already logged in"
 * [x] 2. Profile exists and is active
 * [x] 3. Logout clears Supabase session, localStorage, sessionStorage, and auth context
 * [x] 4. OTP flow is not blocked by session checks
 * [x] 5. Redirect works based on role
 * [x] 6. No console errors
 */

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const { loginWithCredentials, user, session, role, loading: authLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectOverride = searchParams.get('redirect');
  const prefillUser = searchParams.get('u');
  const isGuestPrefill = searchParams.get('guest') === '1';
  const { toast } = useToast();

  // Pre-fill the temporary guest credentials when arriving from a task invite link.
  useEffect(() => {
    if (prefillUser && !identifier) setIdentifier(prefillUser);
    if (isGuestPrefill && !password) setPassword('system');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillUser, isGuestPrefill]);

  // Task 1: Implement validateUserSession (wrapping validateSessionAndProfile)
  const validateUserSession = async () => {
    try {
      const { isValid, profile, session: validSession } = await validateSessionAndProfile();
      console.log(`[LoginPage Validation] Supabase Session Valid: ${!!validSession}, Profile Valid: ${!!profile}`);
      return { isValid, profile };
    } catch (err) {
      console.error("[LoginPage Validation] Error validating user session:", err);
      return { isValid: false, profile: null };
    }
  };

  // Helper to determine destination based on role
  const getRedirectDestination = (userRole, overridePath, profileData) => {
    // First-login guests must set their own username/password/email/address before anything else.
    if (profileData?.must_change_credentials) {
      return overridePath
        ? `/complete-profile?redirect=${encodeURIComponent(overridePath)}`
        : '/complete-profile';
    }
    if (overridePath) return overridePath;
    const adminRoles = ['admin', 'super_admin', 'director', 'manager'];
    if (adminRoles.includes(userRole)) return '/admin/dashboard';
    if (['task_assignee', 'customer'].includes(userRole)) return '/user/tasks/pending-acceptances';
    if (['staff', 'employee', 'teacher'].includes(userRole)) return '/user/tasks';
    if (userRole === 'student') return '/student/dashboard';
    if (userRole === 'shareholder') return '/shareholder/dashboard';
    if (userRole === 'applicant') return '/applicant-dashboard';
    return '/';
  };

  // Task 6: Add comprehensive debugging logs throughout the login flow.
  useEffect(() => {
    let mounted = true;
    
    const verifyExistingSession = async () => {
      console.log("[LoginPage] Component Mount: Verifying if user is already truly logged in...");
      console.log(`[LoginPage] Mount State -> hasSession: ${!!session}, userId: ${user?.id || 'none'}, role: ${role || 'none'}, authLoading: ${authLoading}`);
      
      try {
        const { isValid, profile } = await validateUserSession();
        
        if (!mounted) return;

        if (isValid && profile) {
           console.log(`[LoginPage] Active session confirmed. Redirecting... Profile Role: ${profile.role}`);
           
           const destination = getRedirectDestination(profile.role, redirectOverride, profile);
           console.log(`[LoginPage] Redirect Decision -> Role: ${profile.role}, Destination: ${destination}, UserId: ${profile.id}, Timestamp: ${new Date().toISOString()}`);
           
           toast({
            title: "Session Resumed",
            description: "You are already securely logged in.",
            className: "bg-green-600 text-white"
           });
           
           navigate(destination, { replace: true });
        } else {
           console.log("[LoginPage] No valid session detected. Ready for manual login.");
        }
      } catch (err) {
        console.error("[LoginPage] Mount Verification Error:", err);
      } finally {
        if (mounted) {
           setIsCheckingSession(false);
        }
      }
    };

    if (!authLoading) {
      verifyExistingSession();
    }

    return () => { mounted = false; };
  }, [authLoading, user, session, role, navigate, toast]);

  // Display auth context errors
  useEffect(() => {
    if (authError && !isLoading) {
      setErrorMsg(authError);
    }
  }, [authError, isLoading]);

  const handleRetry = () => {
    setErrorMsg('');
    setIdentifier('');
    setPassword('');
    window.location.reload();
  };

  // Task 4: Audit and fix OTP request trigger logic (named handleLogin since it initiates the auth + OTP flow)
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    console.log(`[LoginPage] Login Attempt Triggered. Identifier: ${identifier}, Timestamp: ${new Date().toISOString()}`);
    console.log(`[LoginPage] Pre-Login State -> hasSession: ${!!session}, userId: ${user?.id || 'none'}, role: ${role || 'none'}, isOtpVerified: false`);

    if (!identifier || !password) {
        setErrorMsg('Please enter both email/username and password.');
        setIsLoading(false);
        return;
    }

    try {
        // Double check against rapid double clicks causing stale states
        console.log("[LoginPage] Validating existing session before allowing new login...");
        const preCheck = await validateUserSession();
        
        if (preCheck.isValid && preCheck.profile) {
           console.log("[LoginPage] Pre-validation caught an active session. Aborting new login and redirecting.");
           const dest = getRedirectDestination(preCheck.profile.role, redirectOverride, preCheck.profile);
           navigate(dest, { replace: true });
           return;
        }

        console.log("[LoginPage] Proceeding with fresh authentication flow...");

        // 1. Authenticate with email or username
        console.log("[LoginPage] Authenticating...");
        const result = await loginWithCredentials(identifier.trim(), password);
        
        if (!result.success) {
            throw new Error(result.error || 'Login failed');
        }

        const authUser = result.user;
        if (!authUser) throw new Error("Authentication succeeded but user data is missing.");
        
        console.log(`[LoginPage] Initial Auth Success. User ID: ${authUser.id}`);

        const profileService = await import('@/services/profileService');
        const profileData = await profileService.getProfile(authUser.id);
        const userRole = profileData?.role || authUser?.app_metadata?.role || authUser?.user_metadata?.role;

        // Skip WhatsApp OTP when VITE_DEV_SKIP_OTP=true (local / initial VPS bootstrap)
        if (import.meta.env.VITE_DEV_SKIP_OTP === 'true') {
            console.log('[LoginPage] OTP skipped (VITE_DEV_SKIP_OTP). Redirecting by role:', userRole);
            toast({
                title: 'Login Successful',
                description: 'Welcome back.',
                className: 'bg-green-600 text-white',
            });
            navigate(getRedirectDestination(userRole, redirectOverride, profileData), { replace: true });
            return;
        }

        // 2. Fetch Profile Safely for Phone Validation
        console.log("[LoginPage] Fetching user profile to verify phone number format...");
        
        const phoneFromProfile = profileData?.phone ?? null;
        const phoneFromAuth = authUser?.phone ?? null;
        const phoneToUse = phoneFromProfile || phoneFromAuth;
        
        console.log(`[LoginPage] Phone Validation -> Fetched Phone: ${phoneToUse}`);

        if (!phoneToUse || phoneToUse.length < 8) {
            console.error("[LoginPage] Login Error: Invalid or missing phone number for user", authUser.id);
            throw new Error('Invalid or no phone number linked to this account. Please contact support to update your profile.');
        }

        console.log(`[LoginPage] Session State before OTP -> User: ${authUser.id}, Phone: ${phoneToUse}`);
        console.log("[LoginPage] Triggering OTP Generation and Sending...");
        
        // 3. Send OTP
        const otpResult = await otpService.sendOTP(authUser.id, phoneToUse);
        
        if (!otpResult?.success) {
            console.error(`[LoginPage] OTP Send Failure: ${otpResult?.message || 'Unknown error'}`);
            throw new Error(otpResult?.message || 'Failed to dispatch OTP');
        }

        console.log("[LoginPage] OTP Send Success. OTP dispatched to WhatsApp. Navigating to Verification Screen.");
        
        toast({
            title: "Verification Code Sent",
            description: "Please check your WhatsApp for the code.",
            className: "bg-blue-600 text-white"
        });

        // 4. Show OTP Input / Redirect to Verification
        navigate('/otp-verification');

    } catch (err) {
        console.error("[LoginPage] Login Process Error Caught:", err);
        let displayMessage = err.message || 'An unexpected error occurred.';
        
        if (displayMessage.includes("destructure")) {
            displayMessage = "System error: Profile data could not be loaded.";
        } else if (displayMessage.includes("network")) {
            displayMessage = "Network error. Please check your connection.";
        } else if (displayMessage.includes("Invalid login credentials")) {
            displayMessage = "Invalid email/username or password. Please try again.";
        } else if (displayMessage.includes("Email not confirmed")) {
            displayMessage = "Please verify your email address before logging in.";
        }
        
        setErrorMsg(displayMessage);
        toast({
            title: "Login Error",
            description: displayMessage,
            variant: "destructive"
        });
    } finally {
        setIsLoading(false);
    }
  };

  // Show loading spinner while auth is initializing or we are running the deep session check
  if (authLoading || isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#003D82] to-[#001f42] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37] mx-auto mb-4" />
          <p className="text-white text-lg">Validating Secure Connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003D82] to-[#001f42] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-[#D4AF37] p-8 text-center relative">
             <div className="absolute top-0 left-0 w-full h-full bg-[#003D82] opacity-10 pattern-grid-lg"></div>
             <h1 className="text-3xl font-bold text-[#003D82] relative z-10">Alpha Bridge</h1>
             <p className="text-[#003D82] font-medium text-sm tracking-wider uppercase relative z-10 opacity-80">Technologies Ltd</p>
             <p className="text-[#003D82] text-xs font-semibold relative z-10 mt-2 opacity-90">
               {APP_VERSION_LABEL} {APP_VERSION}
             </p>
          </div>

          <div className="p-8">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Welcome Back</h2>
                <p className="text-gray-500 text-sm">Sign in with your Email or Username</p>
                {import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_OTP === 'true' && (
                  <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    Local dev login: <strong>admin@alpha-bridge.net</strong> / <strong>ChangeMe@123456</strong>
                  </p>
                )}
            </div>

            <AnimatePresence>
                {errorMsg && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 overflow-hidden"
                    >
                        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="ml-2">
                              {errorMsg}
                            </AlertDescription>
                        </Alert>
                        
                        {/* Retry button for session errors */}
                        {(errorMsg.includes("session") || errorMsg.includes("authentication") || errorMsg.includes("expired")) && (
                          <Button
                            variant="outline"
                            className="w-full mt-3 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={handleRetry}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry Login
                          </Button>
                        )}
                    </motion.div>
                )}
                
                {authError && !errorMsg && (
                  <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden"
                  >
                      <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="ml-2">
                            Authentication system error. Please try again.
                          </AlertDescription>
                      </Alert>
                      <Button
                        variant="outline"
                        className="w-full mt-3 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={handleRetry}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                  </motion.div>
                )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="identifier" 
                    placeholder="Enter email or username" 
                    className="pl-10 h-11 bg-white text-gray-900 border-gray-300 focus:border-[#003D82] focus:ring-[#003D82]/20"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-[#003D82] hover:underline font-medium">
                        Forgot Password?
                    </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-white text-gray-900 border-gray-300 focus:border-[#003D82] focus:ring-[#003D82]/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-[#003D82] hover:bg-[#002855] text-white font-bold text-lg shadow-lg transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <span className="flex items-center gap-2">
                        Login <ArrowRight className="w-4 h-4" />
                    </span>
                )}
              </Button>
              
              <div className="relative flex items-center justify-center mt-6 mb-4">
                  <div className="border-t border-gray-200 w-full absolute"></div>
                  <span className="bg-white px-3 text-xs text-gray-400 relative z-10">OR</span>
              </div>
              
              <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 text-[#003D82] border-[#003D82]/30 hover:bg-blue-50 font-medium"
                  onClick={() => navigate('/signup')}
                  disabled={isLoading}
              >
                  <User className="w-4 h-4 mr-2" />
                  Create Customer Account
              </Button>

              <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 text-[#003D82] border-gray-300 hover:bg-gray-50 mt-3"
                  onClick={() => navigate('/login-otp')}
                  disabled={isLoading}
              >
                  <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                  Login with WhatsApp OTP
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-[#003D82] font-bold hover:underline">
                        Sign Up
                    </Link>
                    {' '}to view tasks assigned to you.
                </p>
                <div className="mt-4 flex justify-center gap-4 text-xs text-gray-400">
                    <Link to="/" className="hover:text-gray-600">Home</Link>
                    <span>•</span>
                    <Link to="/contact" className="hover:text-gray-600">Support</Link>
                    <span>•</span>
                    <Link to="/about" className="hover:text-gray-600">About</Link>
                </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;