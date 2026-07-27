import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, Phone, Mail, Clock, Send, MessageSquare, Globe, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { sendContactMessageViaWhatsApp } from '@/services/contactService';
import { useSiteContent } from '@/hooks/useSiteContent';

const ContactUsPage = () => {
  const { field } = useSiteContent();
  const [formData, setFormData] = useState({
    name: 'Sr. Engr. Mbole',
    email: 'info@alpha-bridge.net',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const phone = field('contact', 'phone', '+250 794 006 160');
  const email = field('contact', 'email', 'info@alpha-bridge.net');
  const website = field('contact', 'website', 'www.alpha-bridge.net');
  const phoneDigits = phone.replace(/\D/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
        const res = await sendContactMessageViaWhatsApp(formData);
        
        if (res.success) {
            toast({
                title: "Message Sent Successfully!",
                description: "Thank you for reaching out. We have received your message and will get back to you shortly.",
            });
            setFormData({ name: 'Sr. Engr. Mbole', email: 'info@alpha-bridge.net', subject: '', message: '' });
        } else {
            throw new Error(res.error || "Failed to send message");
        }
    } catch (error) {
        toast({
            title: "Submission Failed",
            description: "There was an error sending your message. Please try again or use WhatsApp directly.",
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleWhatsAppClick = () => {
    window.open(
      `https://wa.me/${phoneDigits}?text=${encodeURIComponent('Hello Alpha Bridge, I would like to inquire about...')}`,
      '_blank'
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#003D82] mb-4">
            {field('contact', 'heading', 'Get in Touch')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {field(
              'contact',
              'intro',
              "Have a question, need assistance, or want to explore partnership opportunities? We're here to help. Reach out to the Alpha Bridge team today."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Contact Information Cards (Left Column) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-t-4 border-t-[#003D82] shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-[#003D82] mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> Office Location
                </h3>
                <div className="space-y-3 text-gray-600">
                    <p className="font-semibold text-gray-800">{field('contact', 'office_name', 'Alpha Bridge.')}</p>
                    <p>{field('contact', 'office_line1', 'Norrsken House Kigali')}</p>
                    <p>{field('contact', 'office_line2', 'Kigali, Rwanda')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-[#D4AF37] shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-[#003D82] mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#D4AF37]" /> Contact Person
                </h3>
                <div className="space-y-4 text-gray-600">
                    <div>
                        <p className="font-bold text-gray-800">{field('contact', 'person_name', 'Sr. Engr. Mbole')}</p>
                        <p className="text-sm text-gray-500">{field('contact', 'person_role', 'Lead Technical Director')}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2">
                        <div className="bg-blue-100 p-2 rounded-full text-[#003D82]">
                            <Phone className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-medium">{phone}</p>
                            <Button variant="link" className="p-0 h-auto text-[#D4AF37] hover:text-[#003D82] text-xs font-semibold" onClick={handleWhatsAppClick}>
                                <MessageSquare className="w-3 h-3 mr-1" /> Chat on WhatsApp
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <div className="bg-yellow-100 p-2 rounded-full text-[#D4AF37]">
                            <Mail className="w-4 h-4" />
                        </div>
                        <a href={`mailto:${email}`} className="font-medium hover:text-[#003D82] transition-colors">
                            {email}
                        </a>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2">
                        <div className="bg-gray-200 p-2 rounded-full text-gray-700">
                            <Globe className="w-4 h-4" />
                        </div>
                        <a href={`https://${website.replace(/^https?:\/\//, '')}`} className="font-medium hover:text-[#003D82] transition-colors">
                            {website}
                        </a>
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#003D82] text-white shadow-md rounded-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
              <CardContent className="p-6 relative z-10 flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-full text-white shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2 text-[#D4AF37]">Business Hours</h3>
                  <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                          <span className="text-blue-100">Mon - Fri:</span>
                          <span className="font-medium">{field('contact', 'hours_weekday', '9:00 AM - 6:00 PM')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-blue-100">Sat & Sun:</span>
                          <span className="font-medium opacity-80">{field('contact', 'hours_weekend', 'Closed')}</span>
                      </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form (Right Column) */}
          <div className="lg:col-span-8">
            <Card className="shadow-xl border-0 h-full rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#002855] to-[#003D82] p-6 text-white">
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Send className="w-6 h-6 text-[#D4AF37]" /> Send us a Direct Message
                 </h2>
                 <p className="text-blue-100 mt-1">Fill out the form below and we'll instantly receive it via WhatsApp.</p>
              </div>
              <CardContent className="p-8 md:p-10 bg-white">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                      <Input 
                        required 
                        placeholder="e.g. John Doe" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-[#003D82]/20 focus:border-[#003D82] text-gray-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></label>
                      <Input 
                        required 
                        type="email" 
                        placeholder="e.g. john@example.com" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-[#003D82]/20 focus:border-[#003D82] text-gray-900 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Subject <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      placeholder="What is this regarding?" 
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-[#003D82]/20 focus:border-[#003D82] text-gray-900 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Your Message <span className="text-red-500">*</span></label>
                    <Textarea 
                      required 
                      rows={6} 
                      placeholder="Please provide details about your inquiry..." 
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-[#003D82]/20 focus:border-[#003D82] text-gray-900 resize-none transition-all"
                    />
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-4">
                      <Button 
                        type="submit" 
                        className="w-full sm:w-auto px-8 bg-[#003D82] hover:bg-[#002a5a] text-white font-bold h-12 text-lg transition-colors shadow-md hover:shadow-lg"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Sending...
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Send className="w-5 h-5 mr-2" /> Send Message
                          </span>
                        )}
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={handleWhatsAppClick}
                        className="w-full sm:w-auto px-8 border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white font-bold h-12 text-lg transition-colors"
                      >
                        <MessageSquare className="w-5 h-5 mr-2" /> Open WhatsApp
                      </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default ContactUsPage;