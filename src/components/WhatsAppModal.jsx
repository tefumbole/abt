import React, { useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWhatsApp } from '@/context/WhatsAppContext';
import { Button } from '@/components/ui/button';
import { COMPANY_NAME, whatsAppUrl } from '@/constants/branding';

function WhatsAppModal() {
  const { isModalOpen, closeModal } = useWhatsApp();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service: '',
    message: '',
  });

  const services = [
    'IT Consultancy',
    'Networks',
    'CCTV & Security',
    'Sound & Audio Engineering',
    'Screens & Lighting',
    'Repairs & Maintenance',
    'IT Trainings',
    'Fiber Optic Services',
    'Live Audio Engineering',
    'Musical Equipment Rentals',
    'Cloud Computing',
    'Intercom Solutions',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { name, phone, email, service, message } = formData;
    
    // Default values if empty to ensure message structure holds
    const dName = name || '[Name]';
    const dPhone = phone || '[Phone]';
    const dEmail = email || '[Email]';
    const dService = service || '[Service]';
    const dMessage = message || '[Message]';

    const whatsappMessage = `Hello ${COMPANY_NAME}, my name is ${dName}. I'm interested in ${dService}. My phone: ${dPhone}. My email: ${dEmail}. Message: ${dMessage}`;
    const whatsappUrl = whatsAppUrl(whatsappMessage);

    window.open(whatsappUrl, '_blank');
    closeModal();
    setFormData({ name: '', phone: '', email: '', service: '', message: '' }); // Reset
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden border border-gold/20"
            >
              {/* Header */}
              <div className="bg-navy px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-white">
                  <MessageCircle className="w-6 h-6 text-gold" />
                  <h3 className="text-lg font-bold">Chat with Alpha Bridge</h3>
                </div>
                <button 
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-gray-600 mb-6 text-sm">
                  Fill out the details below to start a WhatsApp conversation with our team.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="modal-name" className="block text-sm font-medium text-navy mb-1">Name</label>
                    <input
                      type="text"
                      id="modal-name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tech-blue focus:border-transparent bg-white text-navy"
                      placeholder="Your Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="modal-phone" className="block text-sm font-medium text-navy mb-1">Phone</label>
                      <input
                        type="tel"
                        id="modal-phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tech-blue focus:border-transparent bg-white text-navy"
                        placeholder="+250..."
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-email" className="block text-sm font-medium text-navy mb-1">Email</label>
                      <input
                        type="email"
                        id="modal-email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tech-blue focus:border-transparent bg-white text-navy"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="modal-service" className="block text-sm font-medium text-navy mb-1">Service Interest</label>
                    <select
                      id="modal-service"
                      name="service"
                      value={formData.service}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tech-blue focus:border-transparent bg-white text-navy"
                    >
                      <option value="">Select a Service</option>
                      {services.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="modal-message" className="block text-sm font-medium text-navy mb-1">Message</label>
                    <textarea
                      id="modal-message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tech-blue focus:border-transparent bg-white text-navy resize-none"
                      placeholder="How can we help you?"
                    ></textarea>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-gold py-6 text-lg font-semibold shadow-lg mt-2"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Send to WhatsApp
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WhatsAppModal;