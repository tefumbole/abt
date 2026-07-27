import React, { useState, useEffect } from 'react';
import { createEvent, updateEvent, uploadEventImage, addEventImage, deleteEventImage } from '@/services/eventsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Trash2 } from 'lucide-react';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const EventForm = ({ event = null, onClose }) => {
  const { toast } = useToast();
  const isEditing = !!event;

  const [formData, setFormData] = useState({
    title: event?.title || '',
    event_date: event?.event_date || '',
    location: event?.location || '',
    description: event?.description || '',
    status: event?.status || 'draft',
    featured_image: event?.featured_image || ''
  });

  const [images, setImages] = useState(event?.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const uploadImageFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f?.type?.startsWith('image/'));
    if (list.length === 0) return;

    if (!isEditing) {
      toast({
        title: 'Save Event First',
        description: 'Please create the event before uploading images',
        variant: 'destructive'
      });
      return;
    }

    setUploadingImages(true);

    try {
      for (const file of list) {
        const { publicUrl, path } = await uploadEventImage(event.id, file);
        const imageData = await addEventImage(event.id, {
          image_url: publicUrl,
          image_path: path,
          alt_text: file.name,
          order: images.length
        });

        setImages(prev => [...prev, imageData]);
      }

      toast({
        title: 'Images Uploaded',
        description: `${list.length} image(s) uploaded successfully`,
        className: 'bg-green-600 text-white'
      });
    } catch (err) {
      console.error('EventForm: Error uploading images:', err);
      toast({
        title: 'Upload Failed',
        description: err.message || 'Failed to upload images',
        variant: 'destructive'
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (imageId, imagePath) => {
    try {
      await deleteEventImage(imageId, imagePath);
      setImages(prev => prev.filter(img => img.id !== imageId));

      toast({
        title: 'Image Deleted',
        description: 'Image removed successfully',
        className: 'bg-green-600 text-white'
      });
    } catch (err) {
      console.error('EventForm: Error deleting image:', err);
      toast({
        title: 'Delete Failed',
        description: err.message || 'Failed to delete image',
        variant: 'destructive'
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.event_date) {
      newErrors.event_date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      if (isEditing) {
        await updateEvent(event.id, formData);
        toast({
          title: 'Event Updated',
          description: 'Event has been successfully updated',
          className: 'bg-green-600 text-white'
        });
      } else {
        await createEvent(formData);
        toast({
          title: 'Event Created',
          description: 'Event has been successfully created',
          className: 'bg-green-600 text-white'
        });
      }

      onClose(true);
    } catch (err) {
      console.error('EventForm: Error saving event:', err);
      toast({
        title: 'Save Failed',
        description: err.message || 'Failed to save event',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => !submitting && onClose(false)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Event' : 'Create New Event'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update event details and manage images' : 'Fill in the details to create a new event'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Event Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter event title"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className="text-red-600 text-sm">{errors.title}</p>}
          </div>

          {/* Event Date */}
          <div className="space-y-2">
            <Label htmlFor="event_date">
              Event Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="event_date"
              type="date"
              value={formData.event_date}
              onChange={(e) => handleChange('event_date', e.target.value)}
              className={errors.event_date ? 'border-red-500' : ''}
            />
            {errors.event_date && <p className="text-red-600 text-sm">{errors.event_date}</p>}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (Optional)</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Enter event location"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter event description"
              rows={6}
            />
          </div>

          {/* Featured Image URL */}
          <div className="space-y-2">
            <Label htmlFor="featured_image">Featured Image URL</Label>
            <Input
              id="featured_image"
              value={formData.featured_image}
              onChange={(e) => handleChange('featured_image', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Image Gallery Upload (Only for editing) */}
          {isEditing && (
            <div className="space-y-4 border-t pt-6">
              <Label className="text-lg font-semibold">Image Gallery</Label>
              <ImageUploadZone
                disabled={uploadingImages}
                accept="image/*"
                onFile={(file) => uploadImageFiles([file])}
                title={uploadingImages ? 'Uploading…' : 'Click, drop, or paste event images'}
                hint="Ctrl/Cmd+V supported — save the event first before uploading"
              />

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.image_url}
                        alt={img.alt_text || 'Event image'}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteImage(img.id, img.image_path)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#003D82] hover:bg-[#002855] text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEditing ? 'Update Event' : 'Create Event'}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventForm;