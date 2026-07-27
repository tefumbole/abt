import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, ArrowLeft, AlertTriangle, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 45;

const OTPVerificationScreen = () => {
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [expiresIn, setExpiresIn] = useState(OTP_EXPIRY_SECONDS);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [attempts, setAttempts] = useState(5);

  const { verifyOTP, resendOTP, logout, user, getProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const SECURITY_IMAGE =
    "https://horizons-cdn.hostinger.com/81ef3422-3855-479e-bfe8-28a4ceb0df39/0e6288c4dcb5f1a443d2d1c74e86297f.png";

  useEffect(() => {
    if (expiresIn <= 0) return undefined;
    const timer = setTimeout(() => setExpiresIn((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [expiresIn]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const redirectBasedOnRole = (role) => {
    const r = String(role || "").toLowerCase();
    switch (r) {
      case "admin":
      case "super_admin":
      case "director":
      case "manager":
        return "/admin/dashboard";
      case "student":
        return "/student/dashboard";
      case "shareholder":
        return "/shareholder/dashboard";
      case "applicant":
        return "/applicant-dashboard";
      case "task_assignee":
      case "customer":
        return "/user/tasks/pending-acceptances";
      default:
        return "/";
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.replace(/\D/g, "");

    if (cleanOtp.length !== 6) return;

    setIsLoading(true);
    setStatusMessage("Verifying code...");

    try {
      const result = await verifyOTP(cleanOtp);

      if (!result.success) {
        setAttempts((prev) => Math.max(prev - 1, 0));
        throw new Error(result.error || result.message || "Verification failed");
      }

      const profile = result.profile;
      if (!profile) {
        setStatusMessage("Loading profile...");
        const fetchedProfile = await getProfile(user.id);
        if (!fetchedProfile) throw new Error("Profile not found.");
        handleSuccess(fetchedProfile);
      } else {
        handleSuccess(profile);
      }
    } catch (err) {
      console.error("[OTP Verification] Error caught:", err);
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleSuccess = (profileData) => {
    const destination = profileData.must_change_credentials
      ? "/complete-profile"
      : redirectBasedOnRole(profileData.role);

    toast({
      title: "Access Granted",
      description: `Welcome back, ${profileData.full_name || "User"}`,
      className: "bg-green-600 text-white border-none",
    });

    navigate(destination, { replace: true, state: { verifiedRole: profileData.role } });
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setIsLoading(true);
    setStatusMessage("Resending WhatsApp code...");
    try {
      const result = await resendOTP();
      if (result.success) {
        toast({
          title: "OTP resent on WhatsApp",
          description: "Open WhatsApp on your phone — not SMS — for the new code.",
        });
        setExpiresIn(OTP_EXPIRY_SECONDS);
        setResendIn(RESEND_COOLDOWN_SECONDS);
        setAttempts(5);
        setOtp("");
      } else {
        toast({
          title: "Could not resend",
          description: result.error || result.message || "Try again shortly.",
          variant: "destructive",
        });
        if (result.retryAfter) {
          setResendIn(Number(result.retryAfter) || RESEND_COOLDOWN_SECONDS);
        }
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to resend WhatsApp OTP.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleBackToLogin = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <p className="text-lg font-semibold">Session Expired</p>
        <Button onClick={() => navigate("/login")} className="mt-4">Back to Login</Button>
      </div>
    );
  }

  const maskedPhone = user.phone
    ? user.phone.replace(/(\d{3})\d+(\d{2})/, "$1****$2")
    : "your phone";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#003D82] to-[#001f42] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
      >
        <div className="md:w-1/2 bg-gray-50 flex items-center justify-center p-8 border-r border-gray-100">
          <div className="text-center">
            <img
              src={SECURITY_IMAGE}
              alt="Secure Verification"
              className="w-full max-w-[280px] mx-auto mb-6 object-contain drop-shadow-md"
            />
            <h3 className="text-xl font-bold text-[#003D82]">Secure Authentication</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
              We send a one-time code on WhatsApp to confirm it is really you.
            </p>
          </div>
        </div>

        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Verify It&apos;s You</h2>
            <p className="text-gray-500 mt-2">
              Enter the 6-digit code sent via WhatsApp to{" "}
              <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                {maskedPhone}
              </span>
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <MessageCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Open the <strong>WhatsApp</strong> app on that number (not SMS). Look for a message
                from Alpha Bridge with your code.
              </span>
            </div>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter 6-digit code"
              className="text-center text-3xl tracking-[0.35em] h-20 font-bold border-2 border-gray-200 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 rounded-xl placeholder:text-base placeholder:tracking-normal placeholder:font-medium placeholder:text-gray-400"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
              disabled={isLoading || attempts <= 0}
            />

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Expires in:</span>
                <span className={`font-mono font-bold ${expiresIn < 60 ? "text-red-500" : "text-[#003D82]"}`}>
                  {formatTime(expiresIn)}
                </span>
              </div>
              <span className={attempts < 3 ? "text-red-500 font-bold" : "text-gray-500"}>
                {attempts} attempts left
              </span>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#003D82] hover:bg-[#002855] text-white font-bold text-lg shadow-md"
              disabled={isLoading || otp.length < 6 || attempts <= 0}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {statusMessage || "Processing..."}
                </div>
              ) : (
                "Verify OTP"
              )}
            </Button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#003D82] hover:bg-blue-50 w-full"
              onClick={handleResend}
              disabled={resendIn > 0 || isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {resendIn > 0 ? `Resend available in ${resendIn}s` : "Resend WhatsApp code"}
            </Button>

            <button
              onClick={handleBackToLogin}
              className="flex items-center text-gray-400 hover:text-gray-600 text-sm transition-colors mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OTPVerificationScreen;
