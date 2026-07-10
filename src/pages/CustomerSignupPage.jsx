import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { requestRegistration, verifyRegistration } from '@/services/registerService';
import { APP_VERSION, APP_VERSION_LABEL } from '@/constants/appVersion';
import {
  Loader2,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  LogIn,
} from 'lucide-react';

/** Public share link for customer self-registration */
export const CUSTOMER_SIGNUP_PATH = '/signup';

const CustomerSignupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState('form');
  const [pendingId, setPendingId] = useState(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const result = await requestRegistration({
        ...form,
        signupType: 'customer',
      });
      setPendingId(result.pendingId);
      setStep('otp');
      toast({ title: 'OTP sent', description: `Code sent to ${result.maskedPhone}` });
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await verifyRegistration({ pendingId, otp });
      toast({
        title: 'Account created',
        description: 'Sign in to view tasks assigned to you.',
        className: 'bg-green-600 text-white',
      });
      navigate('/login?redirect=/user/tasks/pending-acceptances');
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

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
            <div className="absolute top-0 left-0 w-full h-full bg-[#003D82] opacity-10 pattern-grid-lg" />
            <h1 className="text-3xl font-bold text-[#003D82] relative z-10">Alpha Bridge</h1>
            <p className="text-[#003D82] font-medium text-sm tracking-wider uppercase relative z-10 opacity-80">
              Technologies Ltd
            </p>
            <p className="text-[#003D82] text-xs font-semibold relative z-10 mt-2 opacity-90">
              {APP_VERSION_LABEL} {APP_VERSION}
            </p>
          </div>

          <div className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Create Account</h2>
              <p className="text-gray-500 text-sm">Customer signup — view tasks assigned to you</p>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900 mb-5">
              After signup you can sign in to see <strong>Pending Tasks</strong> and <strong>My Tasks</strong> only.
            </div>

            {errorMsg && (
              <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">{errorMsg}</AlertDescription>
              </Alert>
            )}

            {step === 'form' ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="full_name"
                      required
                      className="pl-10 h-11"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      required
                      className="pl-10 h-11"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      required
                      placeholder="+250..."
                      className="pl-10 h-11"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      className="pl-10 h-11"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Minimum 8 characters</p>
                </div>
                <Button type="submit" disabled={busy} className="w-full h-12 bg-[#003D82] hover:bg-[#002855] text-white font-bold">
                  {busy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Send OTP & Continue <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <p className="text-sm text-gray-600">Enter the 6-digit code sent to your WhatsApp.</p>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="text-center text-2xl tracking-widest h-12"
                />
                <Button
                  type="submit"
                  disabled={busy || otp.length !== 6}
                  className="w-full h-12 bg-[#003D82] hover:bg-[#002855] text-white font-bold"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Create Account'}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => setStep('form')}>
                  Back to form
                </Button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-3">
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex gap-2 text-left">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Already added by admin? Use the <strong>same phone number</strong> — your account will be updated.
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-[#003D82] font-bold hover:underline inline-flex items-center gap-1">
                  <LogIn className="w-3.5 h-3.5" /> Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerSignupPage;
