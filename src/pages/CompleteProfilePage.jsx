import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { completeOwnProfile } from '@/services/accountService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';

const CompleteProfilePage = () => {
  const { user, profile, loading: authLoading, getProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    address: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profile) {
      setForm((prev) => ({
        ...prev,
        full_name: profile.full_name || prev.full_name,
        username: profile.username && !/^\d+$/.test(profile.username) ? profile.username : prev.username,
        email: profile.email && !profile.email.includes('@customers.alpha-bridge.net') ? profile.email : prev.email,
        address: profile.address || prev.address,
      }));
    }
  }, [profile]);

  const finishDestination = () => {
    if (redirect) return redirect;
    return '/user/tasks/pending-acceptances';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (!form.username.trim() || form.username.trim().length < 3) {
      toast({ title: 'Choose a username', description: 'At least 3 characters.', variant: 'destructive' });
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast({ title: 'Set a password', description: 'At least 6 characters.', variant: 'destructive' });
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      await completeOwnProfile({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        password: form.password,
      });
      if (user?.id) await getProfile(user.id).catch(() => {});
      toast({ title: 'Profile updated', description: 'Your account is ready.' });
      navigate(finishDestination(), { replace: true });
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003D82] to-[#001f42] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#003D82]">
            <ShieldCheck className="w-5 h-5" /> Set Up Your Account
          </CardTitle>
          <CardDescription>
            Welcome! Before you continue, please replace your temporary login with your own details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>New Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="choose a username" required />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Your address" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} minLength={6} required />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-[#003D82] hover:bg-[#002a5a]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfilePage;
