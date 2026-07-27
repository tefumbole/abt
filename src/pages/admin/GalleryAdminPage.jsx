import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, ChevronsDown, ChevronsUp,
  ExternalLink, Image as ImageIcon, Loader2, Plus, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  GALLERY_FILE_TYPES,
  GALLERY_TYPES,
  GALLERY_URL_TYPES,
  detectGalleryTypeFromUrl,
} from '@/utils/galleryEmbed';
import {
  createGalleryItem,
  deleteGalleryItem,
  listAdminGalleryItems,
  reorderGalleryItems,
  updateGalleryItem,
  uploadGalleryFile,
} from '@/services/galleryService';
import ImageUploadZone from '@/components/ui/ImageUploadZone';

const EMPTY_FORM = {
  type: 'image',
  title: '',
  description: '',
  media_url: '',
  file: null,
};

export default function GalleryAdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listAdminGalleryItems());
    } catch (err) {
      toast.error(err.message || 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isFileType = GALLERY_FILE_TYPES.includes(form.type);
  const isUrlType = GALLERY_URL_TYPES.includes(form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let file_path = null;
      let media_url = form.media_url.trim() || null;
      let type = form.type;

      if (isUrlType) {
        if (!media_url) throw new Error('Paste a social media / video URL');
        const detected = detectGalleryTypeFromUrl(media_url);
        if (detected) type = detected;
      }

      if (isFileType) {
        if (!form.file) throw new Error('Choose a file to upload');
        file_path = await uploadGalleryFile(form.file, type);
      }

      await createGalleryItem({
        type,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        file_path,
        media_url: isUrlType ? media_url : null,
        is_published: true,
      });

      toast.success('Gallery item added');
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this gallery item?')) return;
    try {
      await deleteGalleryItem(id);
      toast.success('Deleted');
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const togglePublished = async (item) => {
    try {
      const updated = await updateGalleryItem(item.id, { is_published: !item.is_published });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      toast.success(updated.is_published ? 'Published' : 'Unpublished');
    } catch (err) {
      toast.error(err.message || 'Update failed');
    }
  };

  const persistOrder = async (nextItems, successMessage) => {
    const previous = items;
    setItems(nextItems);
    setReordering(true);
    try {
      await reorderGalleryItems(nextItems.map((i) => i.id));
      toast.success(successMessage || 'Order updated');
    } catch (err) {
      setItems(previous);
      toast.error(err.message || 'Could not save order');
    } finally {
      setReordering(false);
    }
  };

  const moveItem = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    await persistOrder(next, 'Order updated');
  };

  const moveItemToEdge = async (index, edge) => {
    if (index < 0 || index >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (edge === 'first') next.unshift(item);
    else next.push(item);
    await persistOrder(next, edge === 'first' ? 'Moved to first' : 'Moved to last');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#003D82] flex items-center gap-2">
            <ImageIcon className="w-7 h-7 text-[#D4AF37]" />
            Gallery
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Add photos, uploaded videos, and TikTok / YouTube / Instagram / Facebook links (inline playback).
          </p>
        </div>
        <Button asChild variant="outline" className="border-[#003D82] text-[#003D82]">
          <Link to="/gallery" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" /> Preview live page
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-dashed border-[#c5d3ea] bg-[#f8fbff] p-6 space-y-4">
        <h2 className="font-semibold text-[#003D82] flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add gallery item
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(type) => setForm((f) => ({ ...f, type }))}>
              <SelectTrigger>
                <SelectValue placeholder="Choose type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video file</SelectItem>
                <SelectItem value="audio">Audio file</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="youtube_short">YouTube Short</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Team at Kigali Convention Centre"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
          />
        </div>

        {isFileType ? (
          <div className="space-y-2">
            <Label>Upload file</Label>
            {form.type === 'image' ? (
              form.file ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
                  <p className="text-sm text-gray-700 truncate">{form.file.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, file: null }))}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <ImageUploadZone
                  accept="image/*"
                  onFile={(file) => setForm((f) => ({ ...f, file }))}
                  title="Click, drop, or paste a gallery image"
                  hint="Max 50MB — Ctrl/Cmd+V supported"
                />
              )
            ) : (
              <Input
                type="file"
                accept={form.type === 'video' ? 'video/*' : 'audio/*'}
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
              />
            )}
            <p className="text-xs text-gray-500">Max 50MB. Images support paste from clipboard.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Media URL</Label>
            <Input
              value={form.media_url}
              onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=… or TikTok / Instagram / Facebook link"
            />
          </div>
        )}

        <Button type="submit" disabled={saving} className="bg-[#003D82] hover:bg-[#002a5c]">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          Add to gallery
        </Button>
      </form>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="font-semibold text-[#003D82]">Items ({items.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Use the arrows to decide which item appears first on the public gallery.
            </p>
          </div>
          {reordering && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#003D82]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving order…
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-12 text-[#003D82]">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm">No gallery items yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item, index) => (
              <div key={item.id} className="relative border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="absolute top-2 left-2 z-10 rounded-full bg-[#003D82] text-white text-[10px] font-bold px-2 py-0.5 shadow">
                  #{index + 1}
                </div>
                <div className="absolute top-2 right-2 z-10 flex flex-col gap-0.5 rounded-lg border bg-white/95 p-0.5 shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={reordering || index === 0}
                    onClick={() => moveItemToEdge(index, 'first')}
                    title="Move to first"
                  >
                    <ChevronsUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={reordering || index === 0}
                    onClick={() => moveItem(index, -1)}
                    title="Move earlier"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={reordering || index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    title="Move later"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={reordering || index === items.length - 1}
                    onClick={() => moveItemToEdge(index, 'last')}
                    title="Move to last"
                  >
                    <ChevronsDown className="w-4 h-4" />
                  </Button>
                </div>
                <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {item.type === 'image' && item.file_url ? (
                    <img src={item.file_url} alt="" className="w-full h-full object-cover" />
                  ) : item.type === 'video' && item.file_url ? (
                    <video src={item.file_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wide text-[#003D82] bg-[#e8f0fb] px-2 py-1 rounded-full">
                      {GALLERY_TYPES[item.type] || item.type}
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="font-semibold text-[#003D82] text-sm truncate">
                    {item.title || GALLERY_TYPES[item.type] || item.type}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => togglePublished(item)}
                    >
                      {item.is_published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
