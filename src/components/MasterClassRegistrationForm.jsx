import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User, Mail, Phone, BookOpen, MessageSquare, CreditCard, Banknote } from 'lucide-react';

const TRAINING_MODULES = [
  "Enterprise Network Design (Cisco / MikroTik / UniFi)",
  "Structured Cabling & Fiber Optics",
  "Wi-Fi Deployment & Optimization",
  "VoIP & Unified Communications",
  "Systems Administration Basics",
  "Digital Mixers & Signal Flow",
  "FOH & Monitor Setup",
  "Sound Tuning & System Optimization",
  "Recording & Streaming",
  "LED Screen Installation",
  "Video Routing & Controllers",
  "Stage Lighting Systems",
  "Live Event Production Workflow"
];

const MasterClassRegistrationForm = ({ onSubmit, isSubmitting, initialModule }) => {
  const [formData, setFormData] = useState({
    fullName: 'Sr. Engr. Mbole',
    email: 'info@alpha-bridge.net',
    phone: '+250 794 006 160',
    modules: [],
    paymentPreference: 'pay_now', // pay_now or pay_later
    notes: '',
    company: 'Alpha Bridge.'
  });

  const nameInputRef = useRef(null);

  useEffect(() => {
    if (initialModule) {
      const decodedModule = decodeURIComponent(initialModule);
      if (TRAINING_MODULES.includes(decodedModule) || TRAINING_MODULES.some(m => m.includes(decodedModule))) {
          // Find closest match
          const match = TRAINING_MODULES.find(m => m === decodedModule || m.includes(decodedModule));
          if(match) {
             setFormData(prev => ({ 
                 ...prev, 
                 modules: prev.modules.includes(match) ? prev.modules : [...prev.modules, match] 
             }));
          }
      }
    }
  }, [initialModule]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleModule = (moduleName) => {
      setFormData(prev => {
          const exists = prev.modules.includes(moduleName);
          return {
              ...prev,
              modules: exists 
                ? prev.modules.filter(m => m !== moduleName)
                : [...prev.modules, moduleName]
          };
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-2 rounded-lg">
      <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-gray-700 font-semibold">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="fullName"
                name="fullName"
                ref={nameInputRef}
                placeholder="Sr. Engr. Mbole"
                className="pl-10 border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                value={formData.fullName}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-semibold">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="info@alpha-bridge.net"
                  className="pl-10 border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700 font-semibold">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+250 794 006 160"
                  className="pl-10 border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
             <Label className="text-gray-700 font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D4AF37]" /> Select Training Modules
             </Label>
             <span className="text-xs font-bold bg-[#003D82] text-white px-2 py-1 rounded-full">
                 {formData.modules.length} Selected
             </span>
        </div>
        
        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50/50">
            {TRAINING_MODULES.map((mod, idx) => (
                <div 
                    key={idx} 
                    className={`flex items-start space-x-3 p-2 rounded hover:bg-white hover:shadow-sm transition-all cursor-pointer ${formData.modules.includes(mod) ? 'bg-blue-50 border border-blue-100' : ''}`}
                    onClick={() => toggleModule(mod)}
                >
                    <Checkbox 
                        id={`mod-${idx}`} 
                        checked={formData.modules.includes(mod)}
                        onCheckedChange={() => toggleModule(mod)}
                        className="mt-1 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37]"
                    />
                    <label 
                        htmlFor={`mod-${idx}`} 
                        className="text-sm text-gray-700 cursor-pointer leading-tight select-none"
                    >
                        {mod}
                    </label>
                </div>
            ))}
        </div>
        {formData.modules.length === 0 && <p className="text-xs text-red-500">* Please select at least one module</p>}
      </div>

      <div className="space-y-3">
         <Label className="text-gray-700 font-semibold">Payment Preference</Label>
         <div className="grid grid-cols-2 gap-4">
             <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2
                    ${formData.paymentPreference === 'pay_now' ? 'border-[#003D82] bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => setFormData(prev => ({ ...prev, paymentPreference: 'pay_now' }))}
             >
                 <CreditCard className={`w-6 h-6 ${formData.paymentPreference === 'pay_now' ? 'text-[#003D82]' : 'text-gray-400'}`} />
                 <span className={`text-sm font-bold ${formData.paymentPreference === 'pay_now' ? 'text-[#003D82]' : 'text-gray-600'}`}>Pay Now</span>
                 <span className="text-xs text-gray-500">Card / Mobile Money</span>
             </div>

             <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2
                    ${formData.paymentPreference === 'pay_later' ? 'border-[#D4AF37] bg-yellow-50 ring-2 ring-yellow-200' : 'border-gray-200 hover:border-yellow-300'}`}
                onClick={() => setFormData(prev => ({ ...prev, paymentPreference: 'pay_later' }))}
             >
                 <Banknote className={`w-6 h-6 ${formData.paymentPreference === 'pay_later' ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                 <span className={`text-sm font-bold ${formData.paymentPreference === 'pay_later' ? 'text-[#D4AF37]' : 'text-gray-600'}`}>Pay Later</span>
                 <span className="text-xs text-gray-500">Bank Transfer / Cash</span>
             </div>
         </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-gray-700 font-semibold">Additional Notes (Optional)</Label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Textarea
            id="notes"
            name="notes"
            placeholder="Any specific dietary requirements or questions?"
            className="pl-10 min-h-[80px] border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
            value={formData.notes}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full bg-[#003D82] hover:bg-[#002855] text-white py-6 text-lg font-bold shadow-lg hover:shadow-xl transition-all rounded-lg"
        disabled={isSubmitting || formData.modules.length === 0}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          formData.paymentPreference === 'pay_now' ? "Proceed to Payment" : "Confirm Registration"
        )}
      </Button>
    </form>
  );
};

export default MasterClassRegistrationForm;