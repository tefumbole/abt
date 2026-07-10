import React, { useState } from 'react';
import { createAdminAccount } from '@/services/adminAccountService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle, X, ShieldCheck, CheckCircle, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminSignUpModal = ({ isOpen, onClose, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'admin'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const checkStrength = (pass) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length > 7) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'password') {
      setPasswordStrength(checkStrength(value));
    }
  };

  const handleRoleChange = (value) => {
      setFormData(prev => ({ ...prev, role: value }));
  };

  const validate = () => {
    if (!formData.fullName.trim()) return "Full Name is required";
    if (!formData.email.includes('@')) return "Invalid email address";
    if (!formData.phone.trim()) return "Phone number is required";
    if (formData.password.length < 6) return "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const valError = validate();
    if (valError) {
        setError(valError);
        return;
    }

    setLoading(true);
    setError('');

    try {
      await createAdminAccount(
          formData.email, 
          formData.password, 
          formData.fullName, 
          formData.phone,
          formData.role
      );
      
      setSuccess(true);
      setTimeout(() => {
          onClose();
      }, 2000);
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create admin account');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 0: return { label: 'Very Weak', color: 'bg-gray-200' };
      case 1: return { label: 'Weak', color: 'bg-red-400' };
      case 2: return { label: 'Fair', color: 'bg-yellow-400' };
      case 3: return { label: 'Good', color: 'bg-blue-400' };
      case 4: return { label: 'Strong', color: 'bg-green-500' };
      default: return { label: '', color: 'bg-gray-200' };
    }
  };

  const strengthInfo = getStrengthLabel();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-blue-950/80 backdrop-blur-md"
        />

        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#1E3A8A] p-6 text-center relative">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-[#D4AF37] tracking-tight flex items-center justify-center gap-2">
               <ShieldCheck className="w-6 h-6" /> Admin Registration
            </h2>
            <p className="text-blue-200 text-sm mt-1">Create your administrative account</p>
          </div>

          <div className="p-8 max-h-[80vh] overflow-y-auto">
            {success ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-green-100 p-4 rounded-full shadow-inner">
                        <CheckCircle className="w-16 h-16 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Account Created!</h3>
                        <p className="text-gray-600 mt-2">You can now log in with your credentials.</p>
                    </div>
                    <Button onClick={onSwitchToLogin} className="mt-4 bg-[#1E3A8A] text-white">
                        Go to Login
                    </Button>
                </div>
            ) : (
                <>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 mb-6 border border-red-100">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> 
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="fullName" className="text-gray-700">Full Name</Label>
                            <Input 
                                id="fullName" name="fullName" placeholder="e.g. Admin User" 
                                value={formData.fullName} onChange={handleChange} 
                                required className="focus:border-[#D4AF37] focus:ring-[#D4AF37]/20" 
                            />
                        </div>

                        <div className="space-y-2">
                             <Label>Role Assignment</Label>
                             <RadioGroup 
                                 defaultValue="admin" 
                                 value={formData.role} 
                                 onValueChange={handleRoleChange}
                                 className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200"
                             >
                                <div className="flex items-center space-x-2 border rounded p-2 bg-white">
                                    <RadioGroupItem value="admin" id="r-admin" />
                                    <Label htmlFor="r-admin" className="font-medium cursor-pointer text-sm">Admin</Label>
                                </div>
                                <div className="flex items-center space-x-2 border rounded p-2 bg-white">
                                    <RadioGroupItem value="student" id="r-student" />
                                    <Label htmlFor="r-student" className="font-medium cursor-pointer text-sm">Student</Label>
                                </div>
                                <div className="flex items-center space-x-2 border rounded p-2 bg-white">
                                    <RadioGroupItem value="applicant" id="r-applicant" />
                                    <Label htmlFor="r-applicant" className="font-medium cursor-pointer text-sm">Applicant</Label>
                                </div>
                                <div className="flex items-center space-x-2 border rounded p-2 bg-white">
                                    <RadioGroupItem value="shareholder" id="r-shareholder" />
                                    <Label htmlFor="r-shareholder" className="font-medium cursor-pointer text-sm">Shareholder</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label htmlFor="signup-email" className="text-gray-700">Email Address</Label>
                            <Input 
                                id="signup-email" name="email" type="email" placeholder="admin@alpha-bridge.net" 
                                value={formData.email} onChange={handleChange} 
                                required className="focus:border-[#D4AF37] focus:ring-[#D4AF37]/20" 
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
                            <Input 
                                id="phone" name="phone" placeholder="+250..." 
                                value={formData.phone} onChange={handleChange} 
                                required className="focus:border-[#D4AF37] focus:ring-[#D4AF37]/20" 
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="signup-password">Password</Label>
                                <Input 
                                    id="signup-password" name="password" type="password"
                                    value={formData.password} onChange={handleChange} 
                                    required className="focus:border-[#D4AF37] focus:ring-[#D4AF37]/20" 
                                />
                                {formData.password && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-300 ${strengthInfo.color}`} style={{ width: `${(passwordStrength / 4) * 100}%` }}></div>
                                        </div>
                                        <span className="text-xs text-gray-500 font-medium">{strengthInfo.label}</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input 
                                    id="confirmPassword" name="confirmPassword" type="password"
                                    value={formData.confirmPassword} onChange={handleChange} 
                                    required className="focus:border-[#D4AF37] focus:ring-[#D4AF37]/20" 
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-[#1E3A8A] font-bold h-11 text-base shadow-md mt-4" disabled={loading}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <span className="flex items-center gap-2">
                                    <UserPlus className="w-4 h-4" /> Create Account
                                </span>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <p className="text-gray-500 text-sm">
                            Already have an account?{' '}
                            <button 
                                onClick={onSwitchToLogin}
                                className="text-[#1E3A8A] font-bold hover:underline transition-colors"
                            >
                                Login here
                            </button>
                        </p>
                    </div>
                </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminSignUpModal;