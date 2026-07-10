import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile } from '@/services/profileService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, User, Phone, Mail, Shield, Smartphone, Cog } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SystemConfigTab from '@/components/admin/SystemConfigTab';

const AdminSettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
  });

  const loadProfile = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Fetch latest profile data
      const data = await getProfile(user.id);
      if (data) {
        setProfile(data);
        setFormData({
            full_name: data.full_name || '',
            phone: data.phone || '',
            email: data.email || user.email || '',
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load profile settings."
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e?.preventDefault();
    if (!user?.id) return;

    setIsSaving(true);
    try {
        await updateProfile(user.id, {
            full_name: formData.full_name,
            phone: formData.phone
        });

        toast({
            title: "Success",
            description: "Profile updated successfully.",
            className: "bg-green-600 text-white"
        });
        
        // Refresh local state
        loadProfile();

    } catch (error) {
        console.error("Update failed:", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Failed to update profile."
        });
    } finally {
        setIsSaving(false);
    }
  };

  // Specific task function: Update to requested phone number
  const handleQuickPhoneUpdate = async () => {
      const targetPhone = '+250794006160';
      setFormData(prev => ({ ...prev, phone: targetPhone }));
      
      // We also trigger the save immediately for better UX
      if (!user?.id) return;
      setIsSaving(true);
      try {
          await updateProfile(user.id, { phone: targetPhone });
          toast({
              title: "Phone Updated",
              description: `Phone number set to ${targetPhone} successfully.`,
              className: "bg-green-600 text-white"
          });
          loadProfile();
      } catch (error) {
          toast({ variant: "destructive", title: "Error", description: error.message });
      } finally {
          setIsSaving(false);
      }
  };

  if (isLoading) {
      return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#003D82]" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-[#003D82]">Settings</h1>
        <p className="text-gray-500">Manage your account and system preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="system">System Config</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>Update your personal details and contact information.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input 
                                            id="full_name" 
                                            name="full_name" 
                                            value={formData.full_name} 
                                            onChange={handleChange} 
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input 
                                            id="email" 
                                            name="email" 
                                            value={formData.email} 
                                            disabled 
                                            className="pl-10 bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400">Email cannot be changed directly.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input 
                                            id="phone" 
                                            name="phone" 
                                            value={formData.phone} 
                                            onChange={handleChange} 
                                            className="pl-10"
                                            placeholder="+123..."
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-4 flex gap-4">
                                    <Button type="submit" disabled={isSaving} className="bg-[#003D82]">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Changes
                                    </Button>

                                    {/* Task Specific Button */}
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={handleQuickPhoneUpdate}
                                        disabled={isSaving}
                                        className="border-[#D4AF37] text-[#D4AF37] hover:bg-yellow-50"
                                    >
                                        <Smartphone className="w-4 h-4 mr-2" />
                                        Set to Alpha Contact (+237...)
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card className="bg-blue-50 border-blue-100">
                        <CardHeader>
                            <CardTitle className="text-[#003D82] flex items-center gap-2">
                                <Shield className="w-5 h-5" /> Account Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Role</span>
                                <span className="font-bold text-[#003D82] uppercase">{profile?.role || 'User'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Status</span>
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Active
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">User ID</span>
                                <span className="text-xs text-gray-500 font-mono truncate max-w-[120px]" title={user.id}>
                                    {user.id}
                                </span>
                            </div>

                            <Alert className="bg-white border-blue-200 mt-4">
                                <AlertTitle className="text-[#003D82] text-xs font-bold">Security Tip</AlertTitle>
                                <AlertDescription className="text-xs text-gray-600 mt-1">
                                    Ensure your phone number is up to date to receive OTP verification codes for login.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="system">
            <SystemConfigTab />
        </TabsContent>
        
        <TabsContent value="security">
            <Card>
                 <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>Manage password and authentication.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Button variant="outline">Change Password</Button>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettingsPage;