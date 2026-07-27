import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createMember, updateMember } from '@/services/membersService';
import { uploadMemberImage, deleteMemberImage, validateFile } from '@/services/imageUploadService';
import { compressImageToMaxBytes, formatBytes, MEMBER_PHOTO_MAX_BYTES } from '@/utils/imageCompression';
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRY_FLAGS, getFlagByCountry } from '@/utils/countryFlags';
import ImageUploadZone, { firstImageFile } from '@/components/ui/ImageUploadZone';

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
  const [optimizing, setOptimizing] = useState(false);
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

  const selectPhotoFile = useCallback(async (file) => {
    if (!file || loading || optimizing) return;

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

    setOptimizing(true);
    try {
      const optimized = await compressImageToMaxBytes(file, MEMBER_PHOTO_MAX_BYTES);
      const objectUrl = URL.createObjectURL(optimized);
      setPreview(objectUrl);
      setSelectedFile(optimized);

      setFileStats({
        original: formatBytes(file.size),
        compressed: formatBytes(optimized.size),
      });

      toast({
        title: file.size > MEMBER_PHOTO_MAX_BYTES ? 'Photo optimized' : 'Photo selected',
        description:
          file.size > MEMBER_PHOTO_MAX_BYTES
            ? `Reduced from ${formatBytes(file.size)} to ${formatBytes(optimized.size)} (max ~1MB) for faster loading.`
            : 'Image will be uploaded when you click Save.',
      });
    } catch (error) {
      toast({
        title: 'File Error',
        description: error?.message || 'Could not process selected file.',
        variant: 'destructive',
      });
    } finally {
      setOptimizing(false);
    }
  }, [loading, optimizing, toast]);

  // While this modal form is open, Ctrl/Cmd+V with an image sets the profile photo
  // (works for both New Team Member and Edit Profile, even with a photo already selected).
  useEffect(() => {
    const onPaste = (e) => {
      const file = firstImageFile(e.clipboardData?.items);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      selectPhotoFile(file);
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [selectPhotoFile]);

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

        {preview ? (
          <div className="space-y-3">
             <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-white">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-700">Selected Photo</span>
                        {fileStats && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {fileStats.original === fileStats.compressed
                                  ? fileStats.compressed
                                  : `${fileStats.original} → ${fileStats.compressed}`}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">Heavy images are auto-compressed to ~1MB. Paste (Ctrl/Cmd+V) or Replace below.</p>
                    
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            variant="destructive" 
                            size="sm" 
                            onClick={removeImage}
                            disabled={loading || optimizing}
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
                            disabled={loading || optimizing}
                            className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                          >
                            <RefreshCw className="w-3 h-3 mr-2" /> Retry Upload
                          </Button>
                        )}
                    </div>
                </div>
            </div>

            <ImageUploadZone
              disabled={loading || optimizing}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onFile={selectPhotoFile}
              title={optimizing ? 'Optimizing photo…' : 'Replace photo — click, drop, or paste'}
              hint="Large images are compressed to ~1MB for faster member page loads"
              className="py-4"
            />
            
            {optimizing && (
              <div className="flex items-center gap-2 text-xs text-[#003D82]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compressing to ~1MB…
              </div>
            )}

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
        ) : (
          <div className="space-y-2">
            <ImageUploadZone
              disabled={loading || optimizing}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onFile={selectPhotoFile}
              title={optimizing ? 'Optimizing photo…' : 'Click, drop, or paste a profile photo'}
              hint="Large images are compressed to ~1MB for faster member page loads"
            />
            {optimizing && (
              <div className="flex items-center gap-2 text-xs text-[#003D82]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compressing to ~1MB…
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