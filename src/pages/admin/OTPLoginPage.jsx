import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { otpService } from '@/services/otpService';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Lock, Loader2, ShieldCheck, AlertCircle, RefreshCw, Send, Timer, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OTPLoginPage = () => {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [expiryCountdown, setExpiryCountdown] = useState(300); // 5 mins
  const [localError, setLocalError] = useState(null);
  const [copied, setCopied] = useState(false);

  const { verifyOTP } = useAuth(); // AuthContext uses otpService.verifyOTP internally but manages state
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Get userId from state (preferred) or localStorage (fallback)
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const storedId = location.state?.userId || localStorage.getItem('pending_otp_user_id');
    if (storedId) {
        setUserId(storedId);
    } else {
        // If no user ID, we can't verify. Redirect to login.
        toast({ title: "Session Error", description: "Please log in again.", variant: "destructive" });
        navigate('/admin/login');
    }
  }, [location, navigate, toast]);

  // Timers
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    let timer;
    if (expiryCountdown > 0) {
      timer = setInterval(() => setExpiryCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [expiryCountdown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
        setLocalError("Please enter the complete 6-digit code.");
        return;
    }
    
    setLocalError(null);
    setIsLoading(true);

    try {
        // We use AuthContext verifyOTP which calls otpService and updates app state
        const result = await verifyOTP(otp); // This expects OTP, AuthContext already has user object usually.
        // Wait, if AuthContext.user is present (from login), verifyOTP uses that.
        // Let's ensure consistency. If context user is null (page refresh), we might have issues.
        // The AuthContext applies session on load. If session is valid, user is set.
        
        if (result.success) {
            toast({
                title: "Authentication Successful",
                description: "Secure connection established.",
                className: "bg-green-600 text-white border-none"
            });
            // Clear temp storage
            localStorage.removeItem('pending_otp_user_id');
            navigate('/admin/dashboard', { replace: true });
        } else {
            setLocalError(result.error || result.message || "Verification failed");
        }
    } catch (err) {
        setLocalError(err.message || "An unexpected error occurred");
    } finally {
        setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!userId) return;
    setIsSending(true);
    setLocalError(null);

    try {
        const result = await otpService.resendOTP(userId);
        
        if (result.success) {
            setResendCountdown(30);
            setExpiryCountdown(300);
            toast({ 
                title: "Code Resent", 
                description: "A new code has been sent to your WhatsApp." 
            });
        } else {
            setLocalError(result.message);
        }
    } catch (err) {
        setLocalError("Failed to resend code.");
    } finally {
        setIsSending(false);
    }
  };

  const handleCopyOTP = () => {
    if (otp) {
        navigator.clipboard.writeText(otp);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Copied", description: "Code copied to clipboard" });
    }
  };

  const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a192f] relative overflow-hidden font-sans">
        {/* Background Overlay */}
        <div 
            className="absolute inset-0 z-0 bg-cover bg-center"
            style={{ 
                backgroundImage: 'url("https://horizons-cdn.hostinger.com/81ef3422-3855-479e-bfe8-28a4ceb0df39/b6003153821d624b6632b5e633b7295c.png")',
            }}
        >
            <div className="absolute inset-0 bg-[#001f3f]/90 mix-blend-multiply"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-[#003366]/40 to-transparent"></div>
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md w-full relative z-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
            {/* Header Branding */}
            <div className="p-8 text-center border-b border-white/10 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-50"></div>
                
                <div className="w-20 h-20 bg-gradient-to-br from-[#D4AF37] to-[#8C7328] rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-[#D4AF37]/20 border border-white/20">
                    <ShieldCheck className="w-10 h-10 text-[#002244]" />
                </div>
                
                <h1 className="text-xl font-bold text-white tracking-widest uppercase mb-1">Alpha Bridge</h1>
                <h2 className="text-sm font-semibold text-[#D4AF37] tracking-[0.2em] mb-4">TECHNOLOGIES LTD</h2>
                
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                    <Lock className="w-3 h-3 text-blue-300" />
                    <span className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">Secure Admin Access</span>
                </div>
            </div>

            <div className="p-8">
                <AnimatePresence>
                {localError && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-500/30 flex items-start gap-3 backdrop-blur-sm"
                    >
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-red-200 text-sm font-semibold">Verification Error</h4>
                            <p className="text-red-300 text-xs mt-1 leading-relaxed">{localError}</p>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>

                <div className="mb-8 text-center">
                    {isSending ? (
                         <div className="flex flex-col items-center gap-2 animate-pulse">
                             <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
                             <p className="text-blue-200 text-xs tracking-wide">Resending Code...</p>
                         </div>
                    ) : (
                        <div className="bg-[#003366]/30 p-4 rounded-lg border border-white/5 transition-all duration-300 hover:bg-[#003366]/40">
                             <div className="flex items-center justify-center gap-2 mb-1">
                                <Send className="w-4 h-4 text-green-400" />
                                <span className="text-green-400 text-xs font-semibold uppercase">Code Sent</span>
                             </div>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                Please check your registered<br />
                                <span className="text-white font-semibold">WhatsApp Number</span>.
                            </p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleVerify} className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex gap-2 relative">
                            <Input 
                                id="otp" 
                                placeholder="• • • • • •" 
                                className="pl-0 h-16 bg-black/30 border-white/10 text-center tracking-[0.75em] text-3xl text-[#D4AF37] placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-[#D4AF37]/50 focus-visible:border-[#D4AF37]/50 transition-all rounded-xl"
                                maxLength={6}
                                value={otp}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setOtp(val);
                                }}
                                autoFocus
                                autoComplete="one-time-code"
                                disabled={isLoading}
                            />
                             <Button 
                                type="button" 
                                variant="outline" 
                                className="absolute right-2 top-2 h-12 w-12 p-0 border-none bg-transparent hover:bg-white/10 text-gray-500 hover:text-[#D4AF37]"
                                onClick={handleCopyOTP}
                                title="Copy OTP"
                            >
                                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </Button>
                        </div>
                        <div className="flex justify-between items-center px-1">
                             <p className="text-[10px] text-gray-500 uppercase tracking-wider">Enter 6-digit code</p>
                             {expiryCountdown > 0 ? (
                                 <span className="text-[10px] text-blue-300 flex items-center gap-1">
                                     <Timer className="w-3 h-3" /> Expires in {formatTime(expiryCountdown)}
                                 </span>
                             ) : (
                                <span className="text-[10px] text-red-400 flex items-center gap-1">
                                    Expired
                                </span>
                             )}
                        </div>
                    </div>
                    
                    <Button 
                        type="submit" 
                        className="w-full h-12 bg-gradient-to-r from-[#D4AF37] to-[#B4941F] hover:from-[#F4CF57] hover:to-[#D4B43F] text-[#002244] font-bold text-sm tracking-widest uppercase shadow-lg shadow-[#D4AF37]/10 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-[#D4AF37]/20 disabled:opacity-70 disabled:cursor-not-allowed" 
                        disabled={isLoading || otp.length !== 6}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                            </div>
                        ) : "Verify Identity"}
                    </Button>

                    <div className="text-center pt-2">
                        {resendCountdown > 0 ? (
                            <span className="text-xs text-gray-500 font-mono flex items-center justify-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-gray-600"/> Resend available in {resendCountdown}s
                            </span>
                        ) : (
                            <button 
                                type="button"
                                onClick={handleResend}
                                disabled={isSending}
                                className="text-xs flex items-center justify-center gap-2 text-blue-300 hover:text-[#D4AF37] transition-colors mx-auto group uppercase tracking-wider font-semibold px-4 py-2 rounded-full hover:bg-white/5"
                            >
                                <RefreshCw className={`w-3 h-3 ${isSending ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} /> 
                                Resend OTP Code
                            </button>
                        )}
                    </div>
                </form>
            </div>
            
            <div className="bg-black/40 p-4 text-center border-t border-white/5 backdrop-blur-md">
                 <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-2">
                    <Lock className="w-3 h-3 text-[#D4AF37]" /> Restricted Area. Authorized Personnel Only.
                 </p>
            </div>
        </motion.div>
    </div>
  );
};

export default OTPLoginPage;