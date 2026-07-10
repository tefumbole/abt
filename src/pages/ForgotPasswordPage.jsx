import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Phone, Lock, ArrowLeft, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { requestPasswordResetOtp, confirmPasswordReset } from '@/services/passwordResetService';
import { APP_VERSION, APP_VERSION_LABEL } from '@/constants/appVersion';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await requestPasswordResetOtp(phone.trim());
      setMaskedPhone(result.maskedPhone || phone);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset({ phone: phone.trim(), otp: otp.trim(), newPassword });
      setStep(3);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003D82] to-[#001f42] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#D4AF37] p-6 text-center">
          <h1 className="text-2xl font-bold text-[#003D82]">Reset Password</h1>
          <p className="text-[#003D82] text-xs font-semibold mt-1">{APP_VERSION_LABEL} {APP_VERSION}</p>
        </div>

        <div className="p-8">
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <p className="text-sm text-gray-600">
                Enter the phone number linked to your account. We will send a verification code via WhatsApp.
              </p>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+250794006160"
                    className="pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-[#003D82]" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <><MessageSquare className="w-4 h-4 mr-2" /> Send Verification Code</>
                )}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="text-sm text-gray-600">
                Enter the 6-digit code sent to {maskedPhone || 'your WhatsApp'} and choose a new password.
              </p>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="newPassword"
                    type="password"
                    className="pl-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-[#003D82]" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </Button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
              <h2 className="text-xl font-bold text-gray-800">Password Updated</h2>
              <p className="text-gray-600 text-sm">You can now sign in with your email or username and new password.</p>
              <Button className="w-full bg-[#003D82]" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          )}

          {step !== 3 && (
            <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-[#003D82] mt-6 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
