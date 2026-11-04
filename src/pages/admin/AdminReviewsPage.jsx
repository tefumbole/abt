import React, { useEffect, useState } from 'react';
import { Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  REVIEW_COUNTRIES,
  REVIEW_CRITERIA,
  createAdminReview,
  deleteReview,
  listAdminReviews,
  setReviewPublished,
} from '@/services/reviewsService';

const emptyForm = {
  reviewer_name: '',
  country: 'Rwanda',
  phone: '',
  comment: '',
  professionalism: 5,
  time_score: 5,
  quality: 5,
  after_sales: 5,
};

function AdminReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setReviews(await listAdminReviews());
    } catch (err) {
      toast({ title: 'Could not load reviews', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createAdminReview({ ...form, is_published: true });
      toast({ title: 'Review added' });
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast({ title: 'Could not add review', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (review) => {
    try {
      const updated = await setReviewPublished(review.id, !review.is_published);
      setReviews((prev) => prev.map((item) => (item.id === review.id ? updated : item)));
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this review?')) return;
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Review removed' });
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#003D82] flex items-center gap-2">
          <Star className="w-8 h-8 fill-[#D4AF37] text-[#D4AF37]" /> Reviews
        </h1>
        <p className="text-gray-500">Add or remove public Alpha Bridge reviews. Scores under 4 stars stay hidden unless you publish them here.</p>
      </div>

      <form onSubmit={handleAdd} className="bg-white border rounded-xl p-6 grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={form.reviewer_name} onChange={(e) => setField('reviewer_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
          >
            {REVIEW_COUNTRIES.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Phone (optional)</Label>
          <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+250..." />
        </div>
        {REVIEW_CRITERIA.map((item) => (
          <div key={item.key} className="space-y-2">
            <Label>{item.label}</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form[item.key]}
              onChange={(e) => setField(item.key, Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} stars</option>
              ))}
            </select>
          </div>
        ))}
        <div className="md:col-span-2 space-y-2">
          <Label>Review</Label>
          <textarea
            className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.comment}
            onChange={(e) => setField('comment', e.target.value)}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={saving} className="bg-[#003D82]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add review
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#003D82]" /></div>
      ) : (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Reviewer</th>
                <th className="p-3">Scores</th>
                <th className="p-3">Comment</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">No reviews yet.</td></tr>
              ) : reviews.map((review) => (
                <tr key={review.id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-semibold">{review.reviewer_name}</div>
                    <div className="text-gray-500">{review.country}</div>
                    <div className="text-xs text-gray-400">{review.phone}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div>Overall {Number(review.overall).toFixed(1)}</div>
                    <div className="text-gray-500">P {review.professionalism} · T {review.time_score} · Q {review.quality} · S {review.after_sales}</div>
                  </td>
                  <td className="p-3 max-w-sm">{review.comment}</td>
                  <td className="p-3">
                    <Button size="sm" variant={review.is_published ? 'default' : 'outline'} onClick={() => togglePublish(review)}>
                      {review.is_published ? 'Published' : 'Hidden'}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(review.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminReviewsPage;
