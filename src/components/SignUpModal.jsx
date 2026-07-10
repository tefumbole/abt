import React, { useState, useEffect } from 'react';
import { createAccountFromModal } from '@/services/accountService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle, X, UserPlus, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SignUpModal = ({ isOpen, onClose, onSwitchToLogin, redirectOnSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'student'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        email: '',
        fullName: '',
        phone: '',
        password: '',
        confirmPassword: '',
        role: 'student'
      });
      setError('');
      setSuccess(false);
      setPasswordStrength(0);
    }
  }, [isOpen]);

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
      const { error } = await createAccountFromModal(
          formData.email, 
          formData.password, 
          formData.fullName, 
          formData.phone,
          formData.role
      );

      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
          onClose();
          if (redirectOnSuccess) {
              navigate(redirectOnSuccess);
          }
      }, 1500);
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create account');
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
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 max-h-[90vh] overflow-y-auto"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-[#003D82] tracking-tight">Create Account</h2>
            <p className="text-gray-500 mt-2">Join Alpha Bridge</p>
          </div>

          {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-6 animate-in fade-in zoom-in duration-300">
                  <div className="bg-green-100 p-4 rounded-full shadow-inner">
                      <CheckCircle className="w-16 h-16 text-green-600" />
                  </div>
                  <div>
                      <h3 className="text-2xl font-bold text-gray-800">Welcome Aboard!</h3>
                      <p className="text-gray-600 mt-2">Account created successfully.</p>
                      {redirectOnSuccess && <p className="text-[#003D82] font-medium mt-4 text-sm">Redirecting...</p>}
                  </div>
              </div>
          ) : (
            <>
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3 mb-6 border border-red-100 shadow-sm">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> 
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input 
                            id="fullName" name="fullName" placeholder="e.g. Engr. Mbole" 
                            value={formData.fullName} onChange={handleChange} 
                            required className="h-10 focus:border-[#003D82] bg-gray-50/50" 
                        />
                    </div>
                    
                    <div className="space-y-2">
                         <Label>Account Type</Label>
                         <RadioGroup 
                             defaultValue="student" 
                             value={formData.role} 
                             onValueChange={handleRoleChange}
                             className="flex flex-col space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-200"
                         >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="student" id="r-student" />
                                <Label htmlFor="r-student" className="font-normal cursor-pointer">Student (Default)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="applicant" id="r-applicant" />
                                <Label htmlFor="r-applicant" className="font-normal cursor-pointer">Job Applicant</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="shareholder" id="r-shareholder" />
                                <Label htmlFor="r-shareholder" className="font-normal cursor-pointer">Shareholder</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="signup-email">Email Address</Label>
                            <Input 
                                id="signup-email" name="email" type="email" placeholder="john@example.com" 
                                value={formData.email} onChange={handleChange} 
                                required className="h-10 focus:border-[#003D82] bg-gray-50/50" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input 
                                id="phone" name="phone" placeholder="+250..." 
                                value={formData.phone} onChange={handleChange} 
                                required className="h-10 focus:border-[#003D82] bg-gray-50/50" 
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="signup-password">Password</Label>
                            <Input 
                                id="signup-password" name="password" type="password" placeholder="Min. 6 characters"
                                value={formData.password} onChange={handleChange} 
                                required className="h-10 focus:border-[#003D82] bg-gray-50/50" 
                            />
                            {formData.password && (
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-300 ${strengthInfo.color}`} style={{ width: `${(passwordStrength / 4) * 100}%` }}></div>
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">{strengthInfo.label}</span>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input 
                                id="confirmPassword" name="confirmPassword" type="password" placeholder="Repeat password"
                                value={formData.confirmPassword} onChange={handleChange} 
                                required className="h-10 focus:border-[#003D82] bg-gray-50/50" 
                            />
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-white font-bold h-11 text-lg shadow-md hover:shadow-lg transition-all mt-4" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <span className="flex items-center gap-2">
                                <UserPlus className="w-5 h-5" /> 
                                Create Account
                            </span>
                        )}
                    </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                    <p className="text-gray-500 text-sm">
                        Already have an account?{' '}
                        <button 
                            onClick={onSwitchToLogin}
                            className="text-[#003D82] font-bold hover:underline transition-colors"
                        >
                            Log in here
                        </button>
                    </p>
                </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SignUpModal;