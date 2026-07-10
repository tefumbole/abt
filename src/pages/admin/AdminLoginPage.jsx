import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { otpService } from '@/services/otpService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Lock, User, Loader2, AlertCircle, ShieldCheck, ArrowRight, UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION, APP_VERSION_LABEL } from '@/constants/appVersion';

// Import Modals
import AdminSignUpModal from '@/components/AdminSignUpModal';
import PasswordResetModal from '@/components/PasswordResetModal';

const AdminLoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Modal States
  const [showSignUp, setShowSignUp] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const { loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMsg('');

    if (!username || !password) {
      setErrorMsg('Please enter both username and password.');
      setIsLoading(false);
      return;
    }

    try {
      // 1) Authenticate username/password
      setStatusMsg('Verifying credentials...');
      const loginResult = await loginWithCredentials(username, password);

      if (!loginResult?.success) {
        throw new Error(loginResult?.error || 'Authentication failed');
      }

      const user = loginResult.user;
      if (!user?.id) throw new Error('Login succeeded but user data is missing.');

      // 2) Send OTP
      setStatusMsg('Sending Verification Code...');
      const otpResult = await otpService.sendOTP(user.id);

      if (!otpResult.success) {
        throw new Error(otpResult.message);
      }

      toast({
        title: 'Code Sent',
        description: `Verification code sent to your registered phone.`,
        className: "bg-blue-600 text-white"
      });

      // 3) Persist ID for the next screen (in case of refresh)
      localStorage.setItem('pending_otp_user_id', user.id);

      // 4) Navigate
      navigate('/admin/otp-verification', { state: { userId: user.id } });

    } catch (error) {
      console.error('Login Error:', error);
      setErrorMsg(error?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden border border-gray-100 relative">

        {/* Branding Header */}
        <div className="bg-[#1E3A8A] p-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-[#D4AF37] tracking-tight">Alpha Bridge</h1>
            <p className="text-blue-100 mt-2 text-sm uppercase tracking-wider">Technologies Ltd</p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-[#D4AF37] text-[#1E3A8A] text-xs font-bold rounded-full">
              <ShieldCheck className="w-3 h-3" /> SECURE ADMIN PORTAL
            </div>
            <p className="text-blue-100 text-xs font-semibold mt-3 tracking-wide">
              {APP_VERSION_LABEL} {APP_VERSION}
            </p>
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-blue-900 opacity-20 transform -skew-y-12 scale-150"></div>
        </div>

        <div className="p-8">
          <AnimatePresence>
            {errorMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Email / Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter admin email"
                  className="pl-10 h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-[#1E3A8A] hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-[#1E3A8A] font-bold py-6 shadow-md transition-all hover:shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {statusMsg || 'Authenticating...'}
                </>
              ) : (
                <span className="flex items-center">
                  Secure Login <ArrowRight className="w-4 h-4 ml-2" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">New Administrator?</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#1E3A8A] font-semibold py-5"
              onClick={() => setShowSignUp(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" /> Create Admin Account
            </Button>
          </div>

          <div className="text-center space-y-2 pt-6 border-t border-gray-100 mt-6">
            <p className="text-xs text-gray-400 flex justify-center items-center gap-1">
              <Lock className="w-3 h-3" /> 2FA Enabled • IP Logged
            </p>
          </div>
        </div>

        {/* Modals */}
        <AdminSignUpModal
          isOpen={showSignUp}
          onClose={() => setShowSignUp(false)}
          onSwitchToLogin={() => setShowSignUp(false)}
        />

        <PasswordResetModal
          isOpen={showReset}
          onClose={() => setShowReset(false)}
          onBackToLogin={() => setShowReset(false)}
        />
      </div>
    </div>
  );
};

export default AdminLoginPage;