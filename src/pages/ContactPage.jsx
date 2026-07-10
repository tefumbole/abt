import React from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Phone, Mail, Globe, MessageCircle, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  COMPANY_NAME,
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  WEBSITE_HOST,
  whatsAppUrl,
} from '@/constants/branding';

function ContactPage() {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({
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
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleWhatsAppSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.phone || !formData.email || !formData.service || !formData.message) {
      toast({
        title: 'Incomplete Form',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Create WhatsApp message
    const message = `Hello ${COMPANY_NAME}, my name is ${formData.name}. I'm interested in ${formData.service}. My phone: ${formData.phone}. My email: ${formData.email}. Message: ${formData.message}`;
    const whatsappUrl = whatsAppUrl(message);

    // Show success toast
    toast({
      title: 'Redirecting to WhatsApp',
      description: 'Opening WhatsApp with your message...',
    });

    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    // Reset form
    setFormData({
      name: '',
      phone: '',
      email: '',
      service: '',
      message: '',
    });
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.phone || !formData.email || !formData.service || !formData.message) {
      toast({
        title: 'Incomplete Form',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Create email body
    const subject = 'New Website Inquiry — Alpha Bridge';
    const body = `Name: ${formData.name}%0D%0APhone: ${formData.phone}%0D%0AEmail: ${formData.email}%0D%0AService: ${formData.service}%0D%0A%0D%0AMessage:%0D%0A${formData.message}`;
    const mailtoUrl = `mailto:info@alpha-bridge.net?subject=${encodeURIComponent(subject)}&body=${body}`;

    // Show success toast
    toast({
      title: 'Opening Email Client',
      description: 'Preparing your email...',
    });

    // Open email client
    window.location.href = mailtoUrl;
  };

  return (
    <>
      <Helmet>
        <title>Contact Us | Alpha Bridge</title>
        <meta
          name="description"
          content="Get in touch with Alpha Bridge. Contact us via WhatsApp, email, or our contact form for IT consultancy and technology solutions in Kigali."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-[#003D82] via-[#0066CC] to-[#003D82] py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold text-white mb-6"
          >
            Get in <span className="text-[#D4AF37]">Touch</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-200"
          >
            We're here to help with your technology needs
          </motion.p>
        </div>
      </section>

      {/* Contact Form & Info Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-xl shadow-lg p-8 border border-gray-200"
            >
              <h2 className="text-3xl font-bold text-[#003D82] mb-6">Send Us a Message</h2>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all bg-white text-gray-900"
                    placeholder="Engr. Tefu R. Mbole"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all bg-white text-gray-900"
                    placeholder="+250 XXX XXX XXX"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all bg-white text-gray-900"
                    placeholder="info@alpha-bridge.net"
                  />
                </div>

                <div>
                  <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Interested In *
                  </label>
                  <select
                    id="service"
                    name="service"
                    value={formData.service}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all bg-white text-gray-900"
                  >
                    <option value="">Select a service</option>
                    {services.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent transition-all resize-none bg-white text-gray-900"
                    placeholder="Tell us about your project..."
                  ></textarea>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    onClick={handleWhatsAppSubmit}
                    className="w-full bg-[#D4AF37] hover:bg-[#C19B2A] text-white py-6 text-lg rounded-lg shadow-md hover:shadow-lg"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Send via WhatsApp
                  </Button>
                  <Button
                    type="button"
                    onClick={handleEmailSubmit}
                    className="w-full bg-[#003D82] hover:bg-[#002855] text-white py-6 text-lg rounded-lg shadow-md hover:shadow-lg"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Send via Email
                  </Button>
                </div>
              </form>
            </motion.div>

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200"
              >
                <h2 className="text-3xl font-bold text-[#003D82] mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-[#0066CC]/10 p-3 rounded-lg">
                      <MessageCircle className="w-6 h-6 text-[#0066CC]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#003D82] mb-1">WhatsApp</h3>
                      <a
                        href="https://wa.me/250794006160"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-[#0066CC] transition-colors"
                      >
                        +250 794 006 160
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-[#0066CC]/10 p-3 rounded-lg">
                      <Phone className="w-6 h-6 text-[#0066CC]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#003D82] mb-1">Phone</h3>
                      <a
                        href="tel:+250794006160"
                        className="text-gray-700 hover:text-[#0066CC] transition-colors"
                      >
                        +250 794 006 160
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-[#0066CC]/10 p-3 rounded-lg">
                      <Mail className="w-6 h-6 text-[#0066CC]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#003D82] mb-1">Email</h3>
                      <a
                        href="mailto:info@alpha-bridge.net"
                        className="text-gray-700 hover:text-[#0066CC] transition-colors"
                      >
                        info@alpha-bridge.net
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-[#0066CC]/10 p-3 rounded-lg">
                      <Globe className="w-6 h-6 text-[#0066CC]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#003D82] mb-1">Website</h3>
                      <a
                        href="https://www.alpha-bridge.net"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-[#0066CC] transition-colors"
                      >
                        www.alpha-bridge.net
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#003D82] to-[#0066CC] rounded-xl shadow-lg p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Business Hours</h3>
                <div className="space-y-2">
                  <p className="flex justify-between">
                    <span>Monday - Friday:</span>
                    <span className="font-semibold">8:00 AM - 6:00 PM</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Saturday:</span>
                    <span className="font-semibold">9:00 AM - 2:00 PM</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Sunday:</span>
                    <span className="font-semibold">Closed</span>
                  </p>
                </div>
                <p className="mt-4 text-sm text-gray-300">
                  Emergency support available 24/7 via WhatsApp
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}

export default ContactPage;