import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  REVIEW_COUNTRIES,
  REVIEW_CRITERIA,
  listPublishedReviews,
  sendReviewOtp,
  submitPublicReview,
} from '@/services/reviewsService';

function Stars({ value = 0, onChange, size = 'h-6 w-6', readOnly = false }) {
  const rating = Number(value) || 0;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            className={`${size} ${star <= Math.round(rating) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

const emptyForm = {
  reviewer_name: '',
  country: 'Rwanda',
  phone: '',
  code: '',
  comment: '',
  professionalism: 0,
  time_score: 0,
  quality: 0,
  after_sales: 0,
};

function ReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ count: 0, average: 0 });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listPublishedReviews();
      setReviews(data.reviews);
      setSummary(data.summary);
    } catch (err) {
      toast({ title: 'Could not load reviews', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const overallDraft = useMemo(() => {
    const scores = REVIEW_CRITERIA.map((item) => Number(form[item.key]) || 0);
    if (scores.some((n) => n < 1)) return 0;
    return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  }, [form]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const result = await sendReviewOtp(form.phone);
      setOtpSent(true);
      toast({ title: 'Code sent', description: `WhatsApp code sent to ${result.maskedPhone || 'your phone'}.` });
    } catch (err) {
      toast({ title: 'OTP failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (REVIEW_CRITERIA.some((item) => !form[item.key])) {
      toast({ title: 'Rate all areas', description: 'Give 1 to 5 stars for each criterion.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitPublicReview(form);
      toast({ title: result.published ? 'Review published' : 'Review received', description: result.message });
      setForm(emptyForm);
      setOtpSent(false);
      await load();
    } catch (err) {
      toast({ title: 'Could not submit review', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reviews | Alpha Bridge</title>
        <meta name="description" content="Read and write reviews about Alpha Bridge Technologies." />
      </Helmet>

      <section className="bg-gradient-to-br from-[#003D82] via-[#0052A3] to-[#003D82] pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Reviews</h1>
          <p className="text-blue-100 text-lg mb-6">What clients say about Alpha Bridge.</p>
          <div className="inline-flex flex-col items-center gap-2 bg-white/10 rounded-2xl px-8 py-5">
            <Stars value={summary.average} readOnly size="h-8 w-8" />
            <p className="text-2xl font-bold">{summary.average ? summary.average.toFixed(1) : '0.0'} / 5</p>
            <p className="text-blue-100 text-sm">{summary.count} published review{summary.count === 1 ? '' : 's'}</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#003D82]" /></div>
          ) : reviews.length === 0 ? (
            <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
              No published reviews yet. Be the first to write one.
            </div>
          ) : reviews.map((review) => (
            <article key={review.id} className="bg-white border rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold text-[#003D82]">{review.reviewer_name}</h3>
                  <p className="text-sm text-gray-500">{review.country}</p>
                </div>
                <div className="text-right">
                  <Stars value={review.overall} readOnly size="h-4 w-4" />
                  <p className="text-sm font-semibold text-[#003D82]">{Number(review.overall).toFixed(1)} / 5</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">{review.comment}</p>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {REVIEW_CRITERIA.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">{item.label}</span>
                    <Stars value={review[item.key]} readOnly size="h-3.5 w-3.5" />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-6 shadow-lg sticky top-24 space-y-4">
            <h2 className="text-xl font-bold text-[#003D82]">Write a review</h2>
            <p className="text-sm text-gray-500">Rate Alpha Bridge, verify your phone, and share a short comment.</p>

            {REVIEW_CRITERIA.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <Label>{item.label}</Label>
                <Stars value={form[item.key]} onChange={(value) => setField(item.key, value)} />
              </div>
            ))}
            <p className="text-sm text-gray-600">
              Your average: <span className="font-semibold text-[#003D82]">{overallDraft || '—'}</span>
              {overallDraft > 0 && overallDraft < 4 ? ' · Under 4 stars stays unpublished.' : ''}
            </p>

            <div className="space-y-2">
              <Label htmlFor="reviewer_name">Name</Label>
              <Input id="reviewer_name" value={form.reviewer_name} onChange={(e) => setField('reviewer_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
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
              <Label htmlFor="phone">Phone</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+250 7XX XXX XXX"
                  required
                />
                <Button type="button" variant="outline" onClick={handleSendOtp} disabled={sendingOtp}>
                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : otpSent ? 'Resend' : 'Send code'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">WhatsApp code</Label>
              <Input id="code" value={form.code} onChange={(e) => setField('code', e.target.value)} placeholder="6-digit code" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Short review</Label>
              <textarea
                id="comment"
                className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={500}
                value={form.comment}
                onChange={(e) => setField('comment', e.target.value)}
                required
              />
              <p className="text-xs text-gray-400">{form.comment.length}/500</p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-[#003D82] hover:bg-[#002d62]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit review
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}

export default ReviewsPage;
