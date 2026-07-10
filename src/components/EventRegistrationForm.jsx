import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLES = [
  "Industry Professional",
  "Business Owner",
  "Student",
  "Media / Press",
  "Government Official",
  "Partner",
  "Other"
];

function EventRegistrationForm({ onSubmit, isSubmitting }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    role: '',
    otherRole: ''
  });
  
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.role) newErrors.role = "Please select a role";
    if (formData.role === "Other" && !formData.otherRole.trim()) {
      newErrors.otherRole = "Please specify your role";
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    
    if (Object.keys(newErrors).length === 0) {
        // Pass data up - the service logic will handle the "pending" status and WhatsApp
        // We ensure phone and companyName are passed correctly as they might not have been in the previous minimal form
        onSubmit(formData);
    } else {
      setErrors(newErrors);
      toast({
          title: "Validation Error",
          description: "Please check the form for errors.",
          variant: "destructive"
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left">
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-navy">Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          placeholder="e.g. Engr. Tefu Roland Mbole"
          value={formData.fullName}
          onChange={handleChange}
          className={errors.fullName ? "border-red-500" : ""}
        />
        {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label htmlFor="email" className="text-navy">Email Address</Label>
            <Input
            id="email"
            name="email"
            type="email"
            placeholder="info@alpha-bridge.net"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="phone" className="text-navy">Phone Number</Label>
            <Input
            id="phone"
            name="phone"
            placeholder="+250 7XX XXX XXX"
            value={formData.phone}
            onChange={handleChange}
            className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName" className="text-navy">Company / Organization (Optional)</Label>
        <Input
          id="companyName"
          name="companyName"
          placeholder="Alpha Bridge"
          value={formData.companyName}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address" className="text-navy">Address / Location</Label>
        <Input
          id="address"
          name="address"
          placeholder="e.g. Kigali, Rwanda"
          value={formData.address}
          onChange={handleChange}
          className={errors.address ? "border-red-500" : ""}
        />
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role" className="text-navy">Role</Label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleChange}
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.role ? "border-red-500" : "border-input"}`}
        >
          <option value="" disabled>Select your role</option>
          {ROLES.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
      </div>

      {formData.role === "Other" && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          <Label htmlFor="otherRole" className="text-navy">Specify Role</Label>
          <Input
            id="otherRole"
            name="otherRole"
            placeholder="Please specify"
            value={formData.otherRole}
            onChange={handleChange}
            className={errors.otherRole ? "border-red-500" : ""}
          />
          {errors.otherRole && <p className="text-red-500 text-xs mt-1">{errors.otherRole}</p>}
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full btn-blue py-6 text-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          "Register for Event"
        )}
      </Button>
      
      <p className="text-xs text-gray-500 text-center mt-4">
        Registration is subject to approval. You will receive a QR code upon confirmation.
      </p>
    </form>
  );
}

export default EventRegistrationForm;