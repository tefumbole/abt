import React, { useState, useEffect } from 'react';
import { getAllCourses } from '@/services/coursesService';
import { createRegistration } from '@/services/registrationsService';
import { sendRegistrationConfirmation, sendAdminNotification } from '@/services/emailService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, ShoppingCart, CheckCircle, Info, Star } from 'lucide-react';
import FeedbackStatsCard from '@/components/FeedbackStatsCard';
import { motion } from 'framer-motion';

const RegisterNowTab = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    
    // Form State with pre-filled values
    const [formData, setFormData] = useState({
        client_name: 'Sr. Engr. Mbole',
        client_email: 'info@alpha-bridge.net',
        client_phone: '+250 794 006 160',
        company_name: 'Alpha Bridge.'
    });
    const [submitting, setSubmitting] = useState(false);
    const [successId, setSuccessId] = useState(null);

    const { toast } = useToast();

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const data = await getAllCourses();
            setCourses(data);
        } catch (error) {
            toast({ title: "Error", description: "Failed to load courses.", variant: "destructive" });
        } finally {
            setLoading(false);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (selectedCourses.length === 0) {
            toast({ title: "Selection Required", description: "Please select at least one course.", variant: "destructive" });
            return;
        }
        if (!formData.client_name || !formData.client_email || !formData.client_phone) {
            toast({ title: "Missing Information", description: "Name, Email and Phone are required.", variant: "destructive" });
            return;
        }
        
        // Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.client_email)) {
            toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
            return;
        }

        setSubmitting(true);
        try {
            const total = calculateTotal();
            const selectedCourseObjects = courses.filter(c => selectedCourses.includes(c.id));
            const courseNames = selectedCourseObjects.map(c => c.name);

            const regData = {
                ...formData,
                course_ids: selectedCourses,
                total_price: total,
                status: 'Pending Payment',
                payment_status: 'pending'
            };

            const result = await createRegistration(regData);
            
            // Send Emails
            await sendRegistrationConfirmation({ ...regData, course_names: courseNames, id: result.id }, formData.client_email);
            // Optionally notify admin
            await sendAdminNotification({ ...regData, course_names: courseNames });

            setSuccessId(result.id || 'CONFIRMED');
            toast({ title: "Registration Successful", description: "Please check your email for confirmation." });
        } catch (error) {
            toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const categories = ['All', ...new Set(courses.map(c => c.category || 'Other'))];
    
    const filteredCourses = courses.filter(course => {
        const matchesCategory = categoryFilter === 'All' || (course.category || 'Other') === categoryFilter;
        const matchesSearch = course.name.toLowerCase().includes(search.toLowerCase()) || 
                              (course.description || '').toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (successId) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in duration-500">
                <div className="bg-green-100 p-6 rounded-full mb-6">
                    <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-[#003D82] mb-4">Registration Successful!</h2>
                <p className="text-gray-600 max-w-md mb-8">
                    Your registration has been received. A confirmation email with payment instructions has been sent to <strong>{formData.client_email}</strong>.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border mb-8 w-full max-w-sm">
                    <p className="text-sm text-gray-500 uppercase tracking-wide">Registration ID</p>
                    <p className="text-xl font-mono font-bold text-gray-800">{successId.slice(0,8).toUpperCase()}</p>
                </div>
                <Button onClick={() => window.location.reload()} className="bg-[#003D82] hover:bg-[#002d62]">
                    Register Another Student
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column: Courses */}
            <div className="flex-1 space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4 sticky top-4 z-10">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Search courses..." 
                                className="pl-9" 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#003D82]" /></div>
                ) : filteredCourses.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                        No courses found matching your criteria.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredCourses.map((course) => {
                            const isSelected = selectedCourses.includes(course.id);
                            return (
                                <motion.div 
                                    key={course.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`relative bg-white rounded-xl overflow-hidden transition-all duration-300 border-2 cursor-pointer flex flex-col group ${isSelected ? 'border-[#D4AF37] shadow-lg ring-1 ring-[#D4AF37]' : 'border-gray-100 hover:border-blue-200 hover:shadow-md'}`}
                                    onClick={() => handleCourseToggle(course.id)}
                                >
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                                                {course.category || 'General'}
                                            </Badge>
                                            <Checkbox 
                                                checked={isSelected} 
                                                className={`data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37] h-5 w-5 rounded-full transition-transform ${isSelected ? 'scale-110' : ''}`}
                                            />
                                        </div>
                                        
                                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#003D82] transition-colors line-clamp-2">
                                            {course.name}
                                        </h3>
                                        
                                        <p className="text-gray-500 text-sm mb-4 line-clamp-3 flex-1">
                                            {course.description}
                                        </p>

                                        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                            <div>
                                                <FeedbackStatsCard courseId={course.id} />
                                            </div>
                                            <span className="text-lg font-bold text-[#003D82]">
                                                ${Number(course.price).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="bg-[#D4AF37] text-[#003D82] text-xs font-bold text-center py-1">
                                            SELECTED
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Right Column: Registration Form */}
            <div className="lg:w-[400px] shrink-0">
                <div className="sticky top-4">
                    <Card className="shadow-xl border-t-4 border-t-[#003D82] overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b">
                            <h3 className="text-lg font-bold text-[#003D82] flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5" /> Registration Summary
                            </h3>
                        </div>
                        <CardContent className="p-6 space-y-6">
                            {/* Selected Courses List */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Selected Courses</h4>
                                <div className="bg-gray-50 rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar">
                                    {selectedCourses.length > 0 ? (
                                        selectedCourses.map(id => {
                                            const c = courses.find(x => x.id === id);
                                            return c ? (
                                                <div key={id} className="flex justify-between text-sm group">
                                                    <span className="text-gray-700 truncate max-w-[180px]" title={c.name}>{c.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900">${Number(c.price).toLocaleString()}</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleCourseToggle(id); }}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                            type="button"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-400 italic text-center py-2">No courses selected yet.</p>
                                    )}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                    <span className="font-bold text-gray-700">Total Amount</span>
                                    <span className="text-2xl font-bold text-[#003D82]">${calculateTotal().toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Registration Form */}
                            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Student Details</h4>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="client_name" className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="client_name" 
                                            name="client_name" 
                                            value={formData.client_name} 
                                            onChange={handleInputChange} 
                                            placeholder="Student Name"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="client_email" className="text-xs">Email Address <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="client_email" 
                                            name="client_email" 
                                            type="email"
                                            value={formData.client_email} 
                                            onChange={handleInputChange} 
                                            placeholder="student@example.com"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="client_phone" className="text-xs">Phone Number <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="client_phone" 
                                            name="client_phone" 
                                            value={formData.client_phone} 
                                            onChange={handleInputChange} 
                                            placeholder="+1 234 567 890"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="company_name" className="text-xs">Company / Organization (Optional)</Label>
                                        <Input 
                                            id="company_name" 
                                            name="company_name" 
                                            value={formData.company_name} 
                                            onChange={handleInputChange} 
                                            placeholder="Company Ltd."
                                            className="h-9"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    type="submit" 
                                    className="w-full bg-[#003D82] hover:bg-[#002d62] font-bold text-white shadow-lg mt-4"
                                    disabled={submitting || selectedCourses.length === 0}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                                        </>
                                    ) : (
                                        "Complete Registration"
                                    )}
                                </Button>
                                <p className="text-[10px] text-gray-400 text-center">
                                    By registering, you agree to our Terms of Service and Privacy Policy.
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default RegisterNowTab;