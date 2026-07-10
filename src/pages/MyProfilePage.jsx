import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { completeOwnProfile } from '@/services/accountService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, UserCog } from 'lucide-react';

const looksGenerated = (email) => !email || email.includes('@customers.alpha-bridge.net');

const MyProfilePage = () => {
  const { user, profile, loading: authLoading, getProfile } = useAuth();
  const { toast } = useToast();

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
        email: looksGenerated(profile.email) ? prev.email : profile.email,
        address: profile.address || prev.address,
      }));
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.full_name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (form.username.trim() && form.username.trim().length < 3) {
      toast({ title: 'Username too short', description: 'At least 3 characters.', variant: 'destructive' });
      return;
    }
    if (form.password) {
      if (form.password.length < 6) {
        toast({ title: 'Password too short', description: 'At least 6 characters.', variant: 'destructive' });
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast({ title: 'Passwords do not match', variant: 'destructive' });
        return;
      }
    }

    const payload = {
      full_name: form.full_name.trim(),
    };
    if (form.username.trim()) payload.username = form.username.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    payload.address = form.address.trim();
    if (form.password) payload.password = form.password;

    setBusy(true);
    try {
      await completeOwnProfile(payload);
      if (user?.id) await getProfile(user.id).catch(() => {});
      toast({ title: 'Profile updated', description: 'Your account details were saved.' });
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-md border-t-4 border-t-[#003D82]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#003D82]">
            <UserCog className="w-6 h-6" /> My Profile
          </CardTitle>
          <CardDescription>Update your account details, login username, and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="username for login"
              />
              <p className="text-xs text-gray-500">Used to sign in instead of your email.</p>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Your address" />
            </div>

            <div className="rounded-lg border p-4 bg-gray-50/60 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Change password <span className="font-normal text-gray-400">(leave blank to keep current)</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={busy} className="bg-[#003D82] hover:bg-[#002a5a] min-w-[140px]">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyProfilePage;
