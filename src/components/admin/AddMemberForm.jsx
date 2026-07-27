import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createMember, updateMember } from '@/services/membersService';
import { uploadMemberImage, deleteMemberImage, validateFile } from '@/services/imageUploadService';
import { formatBytes } from '@/utils/imageCompression';
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRY_FLAGS, getFlagByCountry } from '@/utils/countryFlags';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const AddMemberForm = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    photo_url: '',
    email: '',
    phone: '',
    country: ''
  });
  
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [errors, setErrors] = useState({ upload: null, submit: null });
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (initialData) {
      setFormData({ country: '', ...initialData });
      setPreview(initialData.photo_url);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors.submit) setErrors(prev => ({ ...prev, submit: null }));
  };

  const selectPhotoFile = (file) => {
    if (!file) return;

    setUploadProgress(0);
    setFileStats(null);
    setErrors(prev => ({ ...prev, upload: null }));

    const validation = validateFile(file);
    if (!validation.valid) {
      toast({ 
        title: "Invalid File", 
        description: validation.error, 
        variant: "destructive",
        duration: 4000
      });
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setSelectedFile(file);
      
      setFileStats({
        original: formatBytes(file.size),
        compressed: "Pending upload..."
      });
      
      toast({ title: "Photo Selected", description: "Image will be uploaded when you click Save. Tip: you can also paste images (Ctrl/Cmd+V)." });
    } catch (error) {
      toast({ title: "File Error", description: "Could not process selected file.", variant: "destructive" });
    }
  };

  const removeImage = () => {
    setPreview(null);
    setSelectedFile(null);
    setFormData(prev => ({ ...prev, photo_url: null }));
    setFileStats(null);
    setUploadProgress(0);
    setErrors(prev => ({ ...prev, upload: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({ upload: null, submit: null });
    
    if (!user || !user.id) {
      toast({ title: "Authentication Required", description: "Please log in to manage members.", variant: "destructive" });
      return;
    }

    if (!formData.name.trim() || !formData.title.trim()) {
      toast({ title: "Missing Fields", description: "Name and Job Title are required.", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    let finalPhotoUrl = formData.photo_url;

    try {
      if (selectedFile) {
        setUploadProgress(10);
        try {
          if (initialData?.photo_url && initialData.photo_url !== formData.photo_url) {
            await deleteMemberImage(initialData.photo_url);
          }
          setUploadProgress(30);
          const memberId = initialData?.id || 'new';
          finalPhotoUrl = await uploadMemberImage(selectedFile, memberId);
          setUploadProgress(100);
          setFormData(prev => ({ ...prev, photo_url: finalPhotoUrl }));
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
          setErrors(prev => ({ ...prev, upload: uploadErr.message }));
          setLoading(false);
          toast({ title: "Upload Failed", description: "Could not upload photo. Please try again.", variant: "destructive" });
          return;
        }
      }

      const payload = {
        ...formData,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        photo_url: finalPhotoUrl,
      };

      if (initialData?.id) {
        await updateMember(initialData.id, payload);
        toast({ title: "Updated", description: "Member profile updated successfully." });
      } else {
        await createMember(payload);
        toast({ title: "Created", description: "New member added to team." });
      }
      
      onSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      // Enhanced RLS error messaging
      const errMsg = error.message?.includes('row-level security') 
          ? 'Permission Denied: You do not have the required admin role to perform this action.'
          : (error.message || "Failed to save member details.");
          
      setErrors(prev => ({ ...prev, submit: errMsg }));
      toast({ 
        title: "Save Failed", 
        description: errMsg, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-300">
      
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{errors.submit}</span>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">Member Name <span className="text-red-500">*</span></Label>
        <Input 
          id="name" 
          name="name" 
          value={formData.name} 
          onChange={handleChange} 
          required 
          placeholder="e.g. Dr. Jane Smith"
          className={errors.submit ? "border-red-300 focus-visible:ring-red-300" : ""}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="title">Job Title <span className="text-red-500">*</span></Label>
        <Input 
          id="title" 
          name="title" 
          value={formData.title} 
          onChange={handleChange} 
          required 
          placeholder="e.g. Chief Technology Officer"
        />
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center justify-between">
          <span>Profile Photo <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span></span>
        </Label>
        
        {errors.upload && (
           <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded text-sm flex items-start justify-between gap-2 mb-2">
             <div className="flex gap-2">
               <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
               <div className="flex flex-col">
                 <span className="font-semibold">Photo upload failed</span>
                 <span>{errors.upload}</span>
               </div>
             </div>
             <Button type="button" variant="ghost" size="xs" onClick={() => setErrors(prev => ({...prev, upload: null}))} className="h-6 w-6 p-0 hover:bg-orange-100">
               <X className="w-3 h-3" />
             </Button>
           </div>
        )}

        {!preview ? (
          <ImageUploadZone
            disabled={loading}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onFile={selectPhotoFile}
            title="Click, drop, or paste a profile photo"
            hint="JPG, PNG, WebP (Max 5MB) — Ctrl/Cmd+V supported"
          />
        ) : (
          <div className="space-y-3">
             <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Selected Photo</span>
                        {fileStats && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {fileStats.original}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            variant="destructive" 
                            size="sm" 
                            onClick={removeImage}
                            disabled={loading}
                            className="h-7 text-xs"
                        >
                            <X className="w-3 h-3 mr-2" /> Remove
                        </Button>
                        {errors.upload && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSubmit}
                            disabled={loading}
                            className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                          >
                            <RefreshCw className="w-3 h-3 mr-2" /> Retry Upload
                          </Button>
                        )}
                    </div>
                </div>
            </div>
            
            {loading && uploadProgress > 0 && uploadProgress < 100 && (
               <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>Uploading photo...</span>
                      <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
               </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Bio / Description <span className="text-red-500">*</span></Label>
        <Textarea 
          id="description" 
          name="description" 
          value={formData.description} 
          onChange={handleChange} 
          required 
          className="h-24"
          placeholder="Short professional biography..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email <span className="text-gray-400 font-normal text-xs">(Optional)</span></Label>
          <Input 
            id="email" 
            name="email" 
            type="email"
            value={formData.email} 
            onChange={handleChange} 
            placeholder="email@company.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone <span className="text-gray-400 font-normal text-xs">(Optional)</span></Label>
          <Input 
            id="phone" 
            name="phone" 
            value={formData.phone} 
            onChange={handleChange} 
            placeholder="+123..."
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="country">Country Flag <span className="text-gray-400 font-normal text-xs">(Optional)</span></Label>
        <Select
          value={formData.country || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, country: value }))}
        >
          <SelectTrigger id="country">
            <SelectValue placeholder="Select a country">
              {formData.country ? (
                <span className="flex items-center gap-2">
                  <span className="text-lg">{getFlagByCountry(formData.country)}</span>
                  <span>{formData.country}</span>
                </span>
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRY_FLAGS.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                <span className="flex items-center gap-2">
                  <span className="text-lg">{c.flag}</span>
                  <span>{c.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-400">The flag appears next to the member's name on the public team page.</p>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button 
            type="submit" 
            disabled={loading} 
            className="bg-[#003D82] text-white hover:bg-[#002d62] min-w-[120px]"
        >
          {loading ? (
             <>
               <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 
               {uploadProgress > 0 && uploadProgress < 100 ? 'Uploading...' : 'Saving...'}
             </>
          ) : (
             initialData ? 'Update Member' : 'Add Member'
          )}
        </Button>
      </div>
    </form>
  );
};

export default AddMemberForm;