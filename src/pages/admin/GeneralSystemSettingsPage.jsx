import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile } from '@/services/profileService';
import { getSystemSettings, updateSystemSettings } from '@/services/settingsService';
import { fetchEnvFiles, saveEnvFiles } from '@/services/systemEnvService';
import SystemConfigTab from '@/components/admin/SystemConfigTab';
import LicenseAgreementTab from '@/components/admin/LicenseAgreementTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  Settings, Save, Loader2, FileCode, Building2, User, Phone, Mail, Shield,
} from 'lucide-react';

const GeneralSystemSettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ full_name: '', phone: '', email: '' });
  const [settings, setSettings] = useState({
    application_name: '',
    developed_by: '',
    copyright_text: '',
  });
  const [envFiles, setEnvFiles] = useState({ frontend: '', api: '' });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const tasks = [getSystemSettings(), fetchEnvFiles()];
        if (user?.id) tasks.push(getProfile(user.id));
        const [sys, env, prof] = await Promise.all(tasks);

        if (sys) {
          setSettings({
            application_name: sys.application_name || 'Alpha Bridge',
            developed_by: sys.developed_by || '',
            copyright_text: sys.copyright_text || '',
          });
        }
        setEnvFiles(env);
        if (prof) {
          setProfile(prof);
          setFormData({
            full_name: prof.full_name || '',
            phone: prof.phone || '',
            email: prof.email || user?.email || '',
          });
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Load failed', description: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, toast]);

  const saveAppSettings = async () => {
    setSaving(true);
    try {
      await updateSystemSettings(settings);
      toast({ title: 'Settings saved', description: 'Application settings updated.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (e) => {
    e?.preventDefault();
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        full_name: formData.full_name,
        phone: formData.phone,
      });
      toast({ title: 'Profile updated', description: 'Your profile was saved.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Update failed', description: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEnv = async () => {
    setSavingEnv(true);
    try {
      await saveEnvFiles(envFiles);
      toast({ title: 'Environment files saved', description: 'Restart the API if you changed server variables.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Env save failed', description: err.message });
    } finally {
      setSavingEnv(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <>
      <Helmet><title>General Settings | Admin</title></Helmet>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold text-[#003D82] flex items-center gap-2">
            <Settings className="w-8 h-8" /> General Settings
          </h1>
          <p className="text-gray-500 mt-1">Profile, branding, and environment configuration.</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-4 flex flex-wrap h-auto">
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="license">License Agreement</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details and contact information.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={saveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="full_name" name="full_name" value={formData.full_name}
                          onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))} className="pl-10" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="email" value={formData.email} disabled className="pl-10 bg-gray-50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="phone" name="phone" value={formData.phone}
                          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="pl-10" placeholder="+237..." />
                      </div>
                    </div>
                    <Button type="submit" disabled={savingProfile} className="bg-[#003D82]">
                      {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Profile
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-100">
                <CardHeader>
                  <CardTitle className="text-[#003D82] flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Role</span><span className="font-bold uppercase">{profile?.role || 'User'}</span></div>
                  <Alert className="bg-white border-blue-200">
                    <AlertTitle className="text-xs font-bold">WhatsApp OTP</AlertTitle>
                    <AlertDescription className="text-xs">Keep your phone number current for login verification.</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Application Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="application_name">Application Name</Label>
                  <Input id="application_name" value={settings.application_name}
                    onChange={(e) => setSettings((s) => ({ ...s, application_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="developed_by">Developed By</Label>
                  <Input id="developed_by" value={settings.developed_by}
                    onChange={(e) => setSettings((s) => ({ ...s, developed_by: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copyright_text">Copyright Text</Label>
                  <Input id="copyright_text" value={settings.copyright_text}
                    onChange={(e) => setSettings((s) => ({ ...s, copyright_text: e.target.value }))} />
                </div>
                <Button onClick={saveAppSettings} disabled={saving} className="bg-[#003D82]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Application Settings
                </Button>
              </CardContent>
            </Card>
            <SystemConfigTab />
          </TabsContent>

          <TabsContent value="license">
            <LicenseAgreementTab />
          </TabsContent>

          <TabsContent value="environment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileCode className="w-5 h-5" /> Environment Files</CardTitle>
                <CardDescription>Edit `.env` files. Restart the API after changing server variables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Frontend `.env` / `.env.local`</Label>
                  <Textarea value={envFiles.frontend} onChange={(e) => setEnvFiles((f) => ({ ...f, frontend: e.target.value }))}
                    rows={10} className="font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label>API `apps/api/.env`</Label>
                  <Textarea value={envFiles.api} onChange={(e) => setEnvFiles((f) => ({ ...f, api: e.target.value }))}
                    rows={12} className="font-mono text-xs" />
                </div>
                <Button onClick={saveEnv} disabled={savingEnv} variant="outline" className="border-[#003D82] text-[#003D82]">
                  {savingEnv ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Environment Files
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default GeneralSystemSettingsPage;
