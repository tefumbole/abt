import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHorizontalNav from '@/components/admin/AdminHorizontalNav';
import { EVENT_NAV } from '@/config/eventNavConfig';
import { createMeal } from '@/services/mealsService';
import { supabase } from '@/lib/customSupabaseClient';
import { getStoragePublicUrl } from '@/utils/storageUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const CreateMealPage = () => {
  const [form, setForm] = useState({ name: '', description: '', category: 'General', image_url: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const uploadMealImage = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image file.', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `meal-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('event-meals').upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;

      const storedPath = data?.path || data?.Key || filePath;
      const publicUrl = getStoragePublicUrl('event-meals', storedPath);
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      setImagePreview(publicUrl);
      toast({ title: 'Image uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await createMeal(form);
      toast({ title: 'Meal created' });
      navigate('/admin/events/meals');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl">
      <AdminHorizontalNav items={EVENT_NAV} title="Create Meal" />
      <Card>
        <CardHeader><CardTitle>Meal Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Meal Photo</Label>
              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <img src={imagePreview} alt="Meal preview" className="h-20 w-20 rounded-lg object-cover border" />
                  <ImageUploadZone
                    disabled={uploadingImage}
                    accept="image/*"
                    onFile={uploadMealImage}
                    title="Replace photo — click, drop, or paste"
                    hint="Ctrl/Cmd+V supported"
                    className="flex-1 py-4"
                  />
                </div>
              ) : (
                <ImageUploadZone
                  disabled={uploadingImage}
                  accept="image/*"
                  onFile={uploadMealImage}
                  title="Click, drop, or paste a meal photo"
                  hint="So guests can identify this meal — Ctrl/Cmd+V supported"
                />
              )}
            </div>
            <Button type="submit" disabled={loading || uploadingImage} className="bg-[#003D82]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save Meal
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateMealPage;
