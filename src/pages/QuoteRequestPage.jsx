import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Send, CheckCircle2, ArrowLeft, Building2, User, Phone, Mail, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ALL_SERVICES = [
  "IT Consultancy",
  "Enterprise Networks",
  "CCTV & Security Systems",
  "Sound & Audio Engineering",
  "Screens & Lighting",
  "Repairs & Maintenance",
  "IT Trainings",
  "Fiber Optic Services",
  "Live Audio Engineering",
  "Musical Equipment Rentals",
  "Cloud Computing",
  "Intercom Solutions"
];

const QuoteRequestPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [selectedServices, setSelectedServices] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        email: '',
        phone: '',
        message: ''
    });

    const toggleService = (service) => {
        setSelectedServices(prev => 
            prev.includes(service) 
                ? prev.filter(s => s !== service)
                : [...prev, service]
        );
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log("Quote Request:", { ...formData, services: selectedServices });

        setIsSubmitting(false);
        setSubmitted(true);
        toast({
            title: "Request Received",
            description: "We'll get back to you with a quote shortly.",
            className: "bg-green-600 text-white border-none"
        });
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                 <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center"
                 >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#003D82] mb-2">Quote Request Sent!</h2>
                    <p className="text-gray-600 mb-8">
                        Thank you, {formData.name}. We have received your request for {selectedServices.length} services. Our team will review your requirements and contact you at {formData.email}.
                    </p>
                    <Button onClick={() => navigate('/')} className="bg-[#D4AF37] text-[#003D82] hover:bg-[#b5952f] w-full py-6 font-bold text-lg">
                        Return to Home
                    </Button>
                 </motion.div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Request a Quote | Alpha Bridge</title>
                <meta name="description" content="Get a custom quote for IT consultancy, networking, audio engineering, or security systems." />
            </Helmet>

            <div className="min-h-screen bg-gradient-to-br from-[#0a192f] via-[#003D82] to-[#0a192f] py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <Link to="/" className="inline-flex items-center text-blue-200 hover:text-[#D4AF37] mb-8 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Link>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Info Column */}
                        <div className="lg:col-span-1 space-y-6 text-white">
                            <div>
                                <h1 className="text-3xl font-bold mb-4">Get a Custom Quote</h1>
                                <p className="text-blue-100 leading-relaxed">
                                    Tell us about your project needs. Select the services you require and provide a few details so we can prepare an accurate estimate for you.
                                </p>
                            </div>
                            
                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10">
                                <h3 className="font-semibold text-[#D4AF37] mb-2">Why Alpha Bridge?</h3>
                                <ul className="space-y-2 text-sm text-gray-200">
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#D4AF37]" /> Industry Standard Equipment</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#D4AF37]" /> Expert Engineers</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#D4AF37]" /> Rapid Deployment</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#D4AF37]" /> 24/7 Support Available</li>
                                </ul>
                            </div>
                        </div>

                        {/* Form Column */}
                        <div className="lg:col-span-2">
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="bg-white rounded-2xl shadow-2xl overflow-hidden"
                            >
                                <div className="p-8">
                                    <form onSubmit={handleSubmit} className="space-y-8">
                                        
                                        {/* Service Selection */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base font-bold text-[#003D82]">Select Services Required</Label>
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                                                    {selectedServices.length} Selected
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {ALL_SERVICES.map((service) => (
                                                    <div 
                                                        key={service}
                                                        className={`
                                                            flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200
                                                            ${selectedServices.includes(service) 
                                                                ? 'border-[#D4AF37] bg-yellow-50 shadow-sm' 
                                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                                                        `}
                                                        onClick={() => toggleService(service)}
                                                    >
                                                        <Checkbox 
                                                            checked={selectedServices.includes(service)}
                                                            onCheckedChange={() => toggleService(service)}
                                                            id={`srv-${service}`}
                                                            className="data-[state=checked]:bg-[#003D82] data-[state=checked]:border-[#003D82]"
                                                        />
                                                        <Label 
                                                            htmlFor={`srv-${service}`} 
                                                            className="cursor-pointer flex-1 text-sm font-medium text-gray-700"
                                                        >
                                                            {service}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                            {selectedServices.length === 0 && (
                                                <p className="text-xs text-red-500">* Please select at least one service</p>
                                            )}
                                        </div>

                                        <div className="h-px bg-gray-100" />

                                        {/* Contact Details */}
                                        <div className="space-y-5">
                                            <h3 className="text-base font-bold text-[#003D82]">Contact Information</h3>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <Label htmlFor="name">Full Name</Label>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                        <Input id="name" name="name" placeholder="John Doe" className="pl-10" required value={formData.name} onChange={handleChange} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="company">Company / Organization</Label>
                                                    <div className="relative">
                                                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                        <Input id="company" name="company" placeholder="Acme Inc." className="pl-10" value={formData.company} onChange={handleChange} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <Label htmlFor="email">Email Address</Label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                        <Input id="email" name="email" type="email" placeholder="john@example.com" className="pl-10" required value={formData.email} onChange={handleChange} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="phone">Phone Number</Label>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                        <Input id="phone" name="phone" placeholder="+250 7XX XXX XXX" className="pl-10" required value={formData.phone} onChange={handleChange} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="message">Project Details / Requirements</Label>
                                                <div className="relative">
                                                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                    <Textarea 
                                                        id="message" 
                                                        name="message" 
                                                        placeholder="Please describe your project needs, estimated timeline, and any specific requirements..." 
                                                        className="pl-10 min-h-[120px]" 
                                                        value={formData.message} 
                                                        onChange={handleChange}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Button 
                                            type="submit" 
                                            className="w-full bg-[#D4AF37] text-[#003D82] hover:bg-[#b5952f] py-6 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                                            disabled={isSubmitting || selectedServices.length === 0}
                                        >
                                            {isSubmitting ? "Processing..." : "Submit Quote Request"} <Send className="ml-2 w-5 h-5" />
                                        </Button>

                                    </form>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default QuoteRequestPage;