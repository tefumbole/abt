import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, X, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/context/AuthContext';
import CountryCodeSelect from '@/components/CountryCodeSelect';

const countries = [
  { name: 'Rwanda', code: '+250' },
  { name: 'Uganda', code: '+256' },
  { name: 'Cameroon', code: '+237' },
  { name: 'Kenya', code: '+254' },
  { name: 'Nigeria', code: '+234' },
  { name: 'United Kingdom', code: '+44' },
  { name: 'United States', code: '+1' },
];

const JobApplicationForm = ({ isOpen, onClose, job, onSuccess }) => {
  const { register, handleSubmit, control, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      full_name: "Engr. Mbole",
      email: "info@alpha-bridge.net",
      countryCode: '+250',
      phone: "794006160",
      availability: 'Immediately'
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const selectedCode = watch('countryCode');
  const selectedAvailability = watch('availability');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File too large", description: "Max file size is 5MB", variant: "destructive" });
        return;
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({ title: "Invalid file type", description: "Please upload PDF, DOC, or DOCX", variant: "destructive" });
        return;
      }
      setResumeFile(file);
      setValue('resume', file); // Register with hook form
    }
  };

  const onSubmit = async (data) => {
    if (!resumeFile) {
      toast({ title: "Resume required", description: "Please upload your resume", variant: "destructive" });
      return;
    }

    if (!data.phone) {
        toast({ title: "Phone required", description: "Please enter your phone number", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      // Find country name
      const countryObj = countries.find(c => c.code === data.countryCode);
      const countryName = countryObj ? countryObj.name : 'Unknown';
      
      // Combine country code and phone for full format
      const fullPhone = `${data.countryCode}${data.phone.replace(/^0+/, '')}`;

      // 1. Upload Resume
      const fileExt = resumeFile.name.split('.').pop();
      const fileName = `${job.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-applications')
        .upload(fileName, resumeFile);

      if (uploadError) throw new Error("Resume upload failed: " + uploadError.message);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-applications')
        .getPublicUrl(fileName);

      // 2. Create Application Record
      const referenceNumber = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const { error: dbError } = await supabase
        .from('applications')
        .insert([{
          job_id: job.id,
          user_id: user?.id || null, // Optional if user is logged in
          full_name: data.full_name,
          email: data.email,
          phone: fullPhone,
          country: countryName, // Save Country Name
          cover_letter: data.cover_letter,
          expected_salary: data.expected_salary,
          availability: data.availability,
          availability_days: data.availability === 'Custom' ? parseInt(data.availability_days) : null,
          cv_url: publicUrl || fileName, 
          status: 'new',
          reference_number: referenceNumber,
          submitted_at: new Date().toISOString()
        }]);

      if (dbError) throw new Error(dbError.message);

      // 3. Success
      onSuccess({
        candidateName: data.full_name,
        email: data.email,
        jobTitle: job.title,
        referenceNumber: referenceNumber
      });
      
      reset({ 
        countryCode: '+250', 
        availability: 'Immediately',
        full_name: "Engr. Mbole",
        email: "info@alpha-bridge.net",
        phone: "794006160"
      });
      setResumeFile(null);
      onClose();

    } catch (error) {
      console.error(error);
      toast({
        title: "Application Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#003D82] text-xl">Apply for {job.title}</DialogTitle>
          <p className="text-sm text-gray-500">Please fill out the form below to submit your application.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                {...register('full_name', { required: "Full Name is required" })}
              />
              {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message}</span>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    className="bg-gray-100 text-gray-500 focus:bg-white focus:text-gray-900 transition-colors"
                    {...register('email', { 
                        required: "Email is required",
                        pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: "Invalid email address"
                        }
                    })}
                />
                {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Controller
                        name="countryCode"
                        control={control}
                        render={({ field }) => (
                            <CountryCodeSelect 
                                value={field.value} 
                                onChange={field.onChange}
                                className="w-full sm:w-[200px]"
                            />
                        )}
                    />
                    <Input
                        id="phone"
                        placeholder="788 123 456"
                        className="flex-1 bg-gray-100 text-gray-500 focus:bg-white focus:text-gray-900 transition-colors"
                        {...register('phone', { required: "Phone number is required" })}
                    />
                </div>
                {errors.phone && <span className="text-xs text-red-500">{errors.phone.message}</span>}
                <p className="text-xs text-gray-500 mt-1">
                    {countries.find(c => c.code === selectedCode)?.name || 'Unknown'} {selectedCode}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="expected_salary">Expected Salary (Optional)</Label>
                    <Input
                        id="expected_salary"
                        placeholder="e.g., 50,000 RWF"
                        {...register('expected_salary')}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="availability">Availability</Label>
                    <Controller
                        name="availability"
                        control={control}
                        render={({ field }) => (
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Availability" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Immediately">Immediately</SelectItem>
                                    <SelectItem value="1 week">1 week</SelectItem>
                                    <SelectItem value="2 weeks">2 weeks</SelectItem>
                                    <SelectItem value="1 month">1 month</SelectItem>
                                    <SelectItem value="Custom">Custom (specify days)</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>

            {selectedAvailability === 'Custom' && (
                <div className="space-y-2">
                    <Label htmlFor="availability_days">Days Available In</Label>
                    <Input
                        id="availability_days"
                        type="number"
                        placeholder="e.g. 45"
                        {...register('availability_days', { required: "Please specify number of days" })}
                    />
                </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="resume">Resume / CV (PDF, DOC) <span className="text-red-500">*</span></Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                <Input 
                    type="file" 
                    id="resume" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                />
                {resumeFile ? (
                    <div className="flex items-center gap-2 text-[#003D82] font-medium">
                        <FileText className="w-6 h-6" />
                        <span className="truncate max-w-[200px]">{resumeFile.name}</span>
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 hover:bg-red-100 text-red-500 rounded-full z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setResumeFile(null);
                            }}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                ) : (
                    <>
                        <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-400">PDF, DOC, DOCX up to 5MB</p>
                    </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover_letter">Cover Letter</Label>
              <Textarea
                id="cover_letter"
                placeholder="Tell us why you're a great fit for this role..."
                className="h-32"
                {...register('cover_letter')}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
                type="submit" 
                className="bg-[#003D82] hover:bg-[#002855] min-w-[120px]" 
                disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JobApplicationForm;