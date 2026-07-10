import React, { useState, useEffect } from 'react';
import { getAllCourses } from '@/services/coursesService';
import { createRegistration, updateRegistration } from '@/services/registrationsService';
import { sendRegistrationConfirmation, sendAdminNotification } from '@/services/emailService';
import { initializeStripe, createPaymentIntent } from '@/services/stripeService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, ShoppingCart, Info, User, Mail, Phone, Building, Search, CreditCard, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import FeedbackStatsCard from '@/components/FeedbackStatsCard';

// Payment Form Component Wrapper
const StripePaymentForm = ({ amount, onSuccess, onError }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setProcessing(true);
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required'
            });

            if (error) {
                onError(error.message);
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                onSuccess(paymentIntent);
            }
        } catch (err) {
            onError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 border p-4 rounded-lg bg-white">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Card Payment</h4>
            <PaymentElement />
            <Button type="submit" disabled={!stripe || processing} className="w-full bg-[#003D82] hover:bg-[#002d62]">
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : ''} 
                Pay ${amount.toLocaleString()}
            </Button>
        </form>
    );
};

const RegistrationPage = () => {
    const [courses, setCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    
    // Filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    // Payment
    const [paymentMode, setPaymentMode] = useState(null); // 'now' or 'later'
    const [clientSecret, setClientSecret] = useState(null);
    const [stripePromise, setStripePromise] = useState(null);

    const [formData, setFormData] = useState({
        client_name: 'Sr. Engr. Mbole',
        client_email: 'info@alpha-bridge.net',
        client_phone: '+250 794 006 160',
        company_name: 'Alpha Bridge.'
    });

    const { toast } = useToast();

    useEffect(() => {
        fetchCourses();
        setStripePromise(initializeStripe());
    }, []);

    const fetchCourses = async () => {
        try {
            const data = await getAllCourses();
            setCourses(data);
        } catch (error) {
            toast({ title: "Error", description: "Failed to load courses.", variant: "destructive" });
        } finally {
            setLoadingCourses(false);
        }
    };

    const handleCourseToggle = (courseId) => {
        setSelectedCourses(prev => {
            if (prev.includes(courseId)) {
                return prev.filter(id => id !== courseId);
            } else {
                return [...prev, courseId];
            }
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const calculateTotal = () => {
        return selectedCourses.reduce((total, id) => {
            const course = courses.find(c => c.id === id);
            return total + (course ? Number(course.price) : 0);
        }, 0);
    };

    // Filter Logic
    const categories = ['All', 'IT Services', 'Security & Surveillance', 'Audio & Visual', 'Maintenance & Support'];
    
    const filteredCourses = courses.filter(course => {
        const matchesCategory = categoryFilter === 'All' || course.category === categoryFilter;
        const matchesSearch = course.name.toLowerCase().includes(search.toLowerCase()) || 
                              (course.description || '').toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getCategoryColor = (cat) => {
        switch(cat) {
            case 'IT Services': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Security & Surveillance': return 'bg-red-100 text-red-800 border-red-200';
            case 'Audio & Visual': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Maintenance & Support': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Form Submission & Payment Flow
    const initiatePaymentOrSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedCourses.length === 0) {
            toast({ title: "Selection Required", description: "Please select at least one course.", variant: "destructive" });
            return;
        }

        // Validate Form
        if(!formData.client_name || !formData.client_email) {
            toast({ title: "Missing Info", description: "Name and Email are required.", variant: "destructive" });
            return;
        }

        if (paymentMode === 'now') {
            setSubmitting(true);
            try {
                const total = calculateTotal();
                const { clientSecret } = await createPaymentIntent(total, 'usd', { 
                    email: formData.client_email,
                    courses: selectedCourses.join(',') 
                });
                setClientSecret(clientSecret);
                // Reveal Stripe Element in UI (handled by conditional rendering below)
            } catch (err) {
                toast({ title: "Payment Error", description: "Could not initialize payment gateway.", variant: "destructive" });
                setPaymentMode(null); // Reset
            } finally {
                setSubmitting(false);
            }
        } else {
            // Pay Later - Direct Submission
            finalizeRegistration({ payment_status: 'pending', status: 'pending' });
        }
    };

    const handlePaymentSuccess = (paymentIntent) => {
        finalizeRegistration({
            payment_status: 'paid',
            payment_id: paymentIntent.id,
            payment_date: new Date().toISOString(),
            status: 'confirmed'
        });
    };

    const finalizeRegistration = async (extraData) => {
        setSubmitting(true);
        try {
            const total = calculateTotal();
            const regData = {
                ...formData,
                course_ids: selectedCourses,
                total_price: total,
                ...extraData
            };

            const result = await createRegistration(regData);
            
            // Send Emails
            const selectedNames = courses.filter(c => selectedCourses.includes(c.id)).map(c => c.name);
            await sendRegistrationConfirmation({ ...regData, course_names: selectedNames }, formData.client_email);
            await sendAdminNotification({ ...regData, course_names: selectedNames });

            setSuccess(true);
            toast({ title: "Success!", description: "Registration completed successfully." });
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-lg w-full text-center p-8 shadow-xl border-t-4 border-t-green-500">
                    <div className="mb-6 flex justify-center">
                        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Registration Complete!</h1>
                    <p className="text-gray-600 mb-8">
                        Thank you for registering with Alpha Bridge. A confirmation email has been sent to <span className="font-semibold">{formData.client_email}</span>.
                    </p>
                    <div className="flex justify-center gap-4">
                         <Button onClick={() => window.location.href='/'} variant="outline">Back to Home</Button>
                         <Button onClick={() => window.location.reload()} className="bg-[#003D82]">Register Another</Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-[#003D82] sm:text-5xl">Course Registration</h1>
                    <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
                        Select from our premium IT and specialized training services.
                    </p>
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-xl shadow-sm border mb-8 flex flex-col md:flex-row gap-4 justify-between items-center sticky top-20 z-10">
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <Button 
                                key={cat} 
                                variant={categoryFilter === cat ? "default" : "outline"}
                                onClick={() => setCategoryFilter(cat)}
                                className={categoryFilter === cat ? "bg-[#003D82]" : "text-gray-600"}
                                size="sm"
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Search courses..." 
                            className="pl-9 h-9" 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Courses Grid */}
                    <div className="flex-1">
                        {loadingCourses ? (
                             <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#003D82]" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                                {filteredCourses.map((course) => {
                                    const isSelected = selectedCourses.includes(course.id);
                                    return (
                                        <motion.div 
                                            key={course.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div 
                                                className={`relative h-full bg-white rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col ${isSelected ? 'border-[#003D82] shadow-lg ring-1 ring-[#003D82]' : 'border-gray-200 hover:border-blue-300 shadow-sm'}`}
                                                onClick={() => handleCourseToggle(course.id)}
                                            >
                                                <div className="absolute top-3 right-3 z-10">
                                                    <Checkbox 
                                                        checked={isSelected} 
                                                        onCheckedChange={() => handleCourseToggle(course.id)}
                                                        className={`h-6 w-6 rounded-full border-2 ${isSelected ? 'bg-[#003D82] border-[#003D82]' : 'border-gray-300'}`}
                                                    />
                                                </div>
                                                <div className="p-6 flex-1 flex flex-col">
                                                    <Badge className={`mb-3 w-fit ${getCategoryColor(course.category)}`} variant="outline">
                                                        {course.category}
                                                    </Badge>
                                                    <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{course.name}</h3>
                                                    <p className="text-gray-500 text-sm mb-4 flex-1">{course.description}</p>
                                                    
                                                    {/* Rating Display */}
                                                    <div className="mb-4">
                                                        <FeedbackStatsCard courseId={course.id} />
                                                    </div>

                                                    <div className="pt-4 mt-auto border-t border-gray-100 flex justify-between items-center">
                                                        <span className="font-bold text-xl text-[#003D82]">${Number(course.price).toLocaleString()}</span>
                                                        <span className={`text-xs px-2 py-1 rounded-full ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                                                            {isSelected ? 'Selected' : 'Add to Cart'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Sticky Sidebar / Form */}
                    <div className="lg:w-96 shrink-0">
                        <div className="sticky top-24 space-y-6">
                            <Card className="border-t-4 border-t-[#D4AF37] shadow-lg">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <ShoppingCart className="w-5 h-5 text-[#D4AF37]" /> Registration
                                    </h3>
                                    
                                    {/* Selected Items */}
                                    <div className="bg-gray-50 p-3 rounded-lg mb-6 max-h-48 overflow-y-auto">
                                        {selectedCourses.length > 0 ? (
                                            selectedCourses.map(id => {
                                                const c = courses.find(x => x.id === id);
                                                return c ? (
                                                    <div key={id} className="flex justify-between text-sm py-1 border-b border-gray-200 last:border-0">
                                                        <span className="text-gray-700 truncate max-w-[180px]">{c.name}</span>
                                                        <span className="font-medium text-gray-900">${Number(c.price).toLocaleString()}</span>
                                                    </div>
                                                ) : null;
                                            })
                                        ) : (
                                            <div className="text-sm text-gray-500 italic text-center py-2">No courses selected</div>
                                        )}
                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-300 font-bold">
                                            <span>Total</span>
                                            <span className="text-[#003D82]">${calculateTotal().toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Form */}
                                    <form onSubmit={initiatePaymentOrSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="client_name">Full Name <span className="text-red-500">*</span></Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input 
                                                    id="client_name" name="client_name" required 
                                                    className="pl-9" placeholder="Sr. Engr. Mbole"
                                                    value={formData.client_name} onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="client_email">Email <span className="text-red-500">*</span></Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input 
                                                    id="client_email" name="client_email" type="email" required 
                                                    className="pl-9" placeholder="info@alpha-bridge.net"
                                                    value={formData.client_email} onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="client_phone">Phone</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input 
                                                    id="client_phone" name="client_phone"
                                                    className="pl-9" placeholder="+250 794 006 160"
                                                    value={formData.client_phone} onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="company_name">Company</Label>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input 
                                                    id="company_name" name="company_name"
                                                    className="pl-9" placeholder="Alpha Bridge."
                                                    value={formData.company_name} onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        {/* Payment Options */}
                                        {!clientSecret && (
                                            <div className="grid grid-cols-2 gap-3 mt-4">
                                                <Button 
                                                    type="button" 
                                                    variant={paymentMode === 'now' ? 'default' : 'outline'}
                                                    className={paymentMode === 'now' ? 'bg-green-600 hover:bg-green-700' : ''}
                                                    onClick={() => setPaymentMode('now')}
                                                >
                                                    Pay Now
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    variant={paymentMode === 'later' ? 'default' : 'outline'}
                                                    className={paymentMode === 'later' ? 'bg-[#003D82] hover:bg-[#002d62]' : ''}
                                                    onClick={() => setPaymentMode('later')}
                                                >
                                                    Pay Later
                                                </Button>
                                            </div>
                                        )}

                                        {/* Submit Logic */}
                                        {paymentMode === 'later' && (
                                            <Button type="submit" disabled={submitting} className="w-full bg-[#003D82] hover:bg-[#002d62] mt-4">
                                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Confirm Registration"}
                                            </Button>
                                        )}

                                        {paymentMode === 'now' && !clientSecret && (
                                            <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 mt-4">
                                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Proceed to Payment"}
                                            </Button>
                                        )}
                                    </form>

                                    {/* Stripe Element Rendering */}
                                    {clientSecret && stripePromise && (
                                        <Elements stripe={stripePromise} options={{ clientSecret }}>
                                            <StripePaymentForm 
                                                amount={calculateTotal()}
                                                onSuccess={handlePaymentSuccess}
                                                onError={(msg) => toast({ title: "Payment Failed", description: msg, variant: "destructive" })}
                                            />
                                        </Elements>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationPage;