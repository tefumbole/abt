import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { uploadTemplateImage, createTemplate } from '@/services/templateService';
import { validateImageFile, generateThumbnail } from '@/services/imageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const TemplateUploadForm = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    description: ''
  });

  const processFile = (selectedFile) => {
    const validation = validateImageFile(selectedFile);
    if (!validation.valid) {
      toast({ title: 'Invalid File', description: validation.error, variant: 'destructive' });
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedName = formData.name?.trim();
    if (!trimmedName) {
      toast({ title: 'Validation Error', description: 'Template name is required.', variant: 'destructive' });
      return;
    }
    
    if (!file) {
      toast({ title: 'Missing Image', description: 'Please select an image file to upload.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 1. Generate thumbnail
      const thumbnailDataUrl = await generateThumbnail(file);

      // 2. Upload image to storage
      const uploadRes = await uploadTemplateImage(user.id, file);
      if (!uploadRes.success) throw new Error(uploadRes.error);

      // 3. Save to database
      const templateData = {
        ...formData,
        name: trimmedName,
        background_image_url: uploadRes.url,
        background_image_path: uploadRes.path,
        preview_thumbnail_url: thumbnailDataUrl,
        status: 'active',
        is_default: false
      };

      const createRes = await createTemplate(user.id, templateData);
      if (!createRes.success) throw new Error(createRes.error);

      toast({ title: 'Success', description: 'Template uploaded successfully!' });
      
      // Reset form
      setFormData({ name: '', category: 'General', description: '' });
      removeFile();
      onSuccess();
      onClose();

    } catch (error) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Design Template</DialogTitle>
          <DialogDescription>Add a new background template for invitations.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input 
              id="name" 
              required 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. VIP Gold Theme" 
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Corporate">Corporate</SelectItem>
                <SelectItem value="Wedding">Wedding</SelectItem>
                <SelectItem value="Gala">Gala / VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input 
              id="description" 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              placeholder="Optional brief description" 
              className="bg-white"
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label>Background Image *</Label>
            
            {!previewUrl ? (
              <ImageUploadZone
                accept="image/jpeg,image/png,image/webp"
                onFile={processFile}
                title="Click, drop, or paste a background image"
                hint="JPG, PNG or WebP (max 5MB) — Ctrl/Cmd+V supported"
              />
            ) : (
              <div className="relative rounded-lg overflow-hidden border">
                <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover" />
                <button 
                  type="button" 
                  onClick={removeFile}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#003D82] hover:bg-blue-800 text-white" disabled={loading || !file}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload Template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateUploadForm;