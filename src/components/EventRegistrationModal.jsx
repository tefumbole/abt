import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle } from 'lucide-react';
import EventRegistrationForm from './EventRegistrationForm';
import { useToast } from '@/components/ui/use-toast';

function EventRegistrationModal({ isOpen, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFormSubmit = async (data) => {
    setIsSubmitting(true);
    
    const finalRole = data.role === "Other" ? data.otherRole : data.role;
    
    // 1. Prepare data for "Backend" (Mock/Simulated)
    // In a real app, this would be: await fetch('/api/send-email', { method: 'POST', body: JSON.stringify(data) })
    const emailPayload = {
      to: 'info@alpha-bridge.net',
      subject: 'New Event Registration: Grand Launching',
      body: `Name: ${data.fullName}\nAddress: ${data.address}\nRole: ${finalRole}`
    };

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Log for developer reference (Frontend-only environment limitation)
      console.log('--- MOCK EMAIL SEND ---');
      console.log('Endpoint: /api/send-email');
      console.log('Payload:', emailPayload);
      console.log('Status: Success');
      console.log('-----------------------');

      // 2. Send via WhatsApp (Client-side execution)
      const whatsappMessage = `Hello Alpha Bridge, I'm registering for the Grand Launching event on April 5th 2026. Name: ${data.fullName}, Address: ${data.address}, Role: ${finalRole}. Please confirm my registration.`;
      const encodedMessage = encodeURIComponent(whatsappMessage);
      const whatsappUrl = `https://wa.me/250794006160?text=${encodedMessage}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      // 3. Success UI Feedback
      toast({
        title: "Registration Successful!",
        description: "Thank you for registering! We'll contact you soon.",
        variant: "default",
        className: "bg-green-50 border-green-200"
      });
      
      onClose();
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: "Something went wrong. Please try again or contact us directly.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden z-10"
          >
            {/* Header */}
            <div className="bg-navy p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Event Registration</h2>
                <p className="text-blue-200 text-sm">Grand Launching - April 5th, 2026</p>
              </div>
              <button 
                onClick={onClose}
                className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 bg-white">
              <EventRegistrationForm 
                onSubmit={handleFormSubmit} 
                isSubmitting={isSubmitting}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default EventRegistrationModal;