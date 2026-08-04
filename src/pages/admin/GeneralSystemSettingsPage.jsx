import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getProfile, updateProfile } from '@/services/profileService';
import { getSystemSettings, updateSystemSettings } from '@/services/settingsService';
import { fetchEnvFiles, saveEnvFiles } from '@/services/systemEnvService';
import LicenseAgreementTab from '@/components/admin/LicenseAgreementTab';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { COLORED_TAB_BASE, getTabTheme } from '@/components/admin/tabTheme';
import { cn } from '@/lib/utils';
import { DEFAULT_SETTINGS_TAB, SETTINGS_NAV_TABS } from '@/config/settingsNavConfig';
import GeneralSettingPanel from '@/pages/admin/settings/GeneralSettingPanel';
import {
  BillersSettingsPanel,
  BrandsSettingsPanel,
  CurrencySettingsPanel,
  PosSettingsPanel,
  UnitsSettingsPanel,
  WarehousesSettingsPanel,
} from '@/pages/admin/settings/SettingsMasterPanels';
import RolesPermissionsPage from '@/pages/admin/RolesPermissionsPage';
import AdminActivityLogsPage from '@/pages/admin/AdminActivityLogsPage';
import AdminBackupRestorePage from '@/pages/admin/AdminBackupRestorePage';
import {
  Settings, Save, Loader2, FileCode, User, Phone, Mail, Shield,
} from 'lucide-react';

function StubPanel({ title, description, children }) {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-[#003D82]">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

const GeneralSystemSettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const raw = searchParams.get('tab') || DEFAULT_SETTINGS_TAB;
    if (raw === 'branding') return 'general';
    return SETTINGS_NAV_TABS.some((t) => t.id === raw) ? raw : DEFAULT_SETTINGS_TAB;
  }, [searchParams]);

  const setTab = (id) => {
    setSearchParams(id === DEFAULT_SETTINGS_TAB ? {} : { tab: id }, { replace: true });
  };

  const [loading, setLoading] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ full_name: '', phone: '', email: '' });
  const [taxRate, setTaxRate] = useState('0');
  const [envFiles, setEnvFiles] = useState({ frontend: '', api: '' });

  useEffect(() => {
    if (!['profile', 'env', 'tax'].includes(tab)) return;
    (async () => {
      try {
        setLoading(true);
        if (tab === 'env') {
          setEnvFiles(await fetchEnvFiles());
        }
        if (tab === 'tax') {
          const sys = await getSystemSettings();
          setTaxRate(sys?.tax_rate != null ? String(sys.tax_rate) : '0');
        }
        if (tab === 'profile' && user?.id) {
          const prof = await getProfile(user.id);
          if (prof) {
            setProfile(prof);
            setFormData({
              full_name: prof.full_name || '',
              phone: prof.phone || '',
              email: prof.email || user?.email || '',
            });
          }
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Load failed', description: err.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, user, toast]);

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

  const saveTax = async () => {
    setSavingTax(true);
    try {
      await updateSystemSettings({ tax_rate: Number(taxRate) || 0 });
      toast({ title: 'Tax saved', description: 'Default tax rate updated.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    } finally {
      setSavingTax(false);
    }
  };

  const activeLabel = SETTINGS_NAV_TABS.find((t) => t.id === tab)?.label || 'Settings';

  return (
    <>
      <Helmet><title>{activeLabel} | Settings | Admin</title></Helmet>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-[#003D82] flex items-center gap-2">
            <Settings className="w-8 h-8" /> Settings
          </h1>
          <p className="text-gray-500 mt-1">
            General configuration, warehouses, billers, brands, units, POS, and system tools.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SETTINGS_NAV_TABS.map((item) => {
            const theme = getTabTheme(item.color);
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(COLORED_TAB_BASE, active ? theme.active : theme.idle)}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'general' && <GeneralSettingPanel />}
        {tab === 'roles' && <RolesPermissionsPage />}
        {tab === 'warehouses' && <WarehousesSettingsPanel />}
        {tab === 'customer-group' && (
          <StubPanel
            title="Customer Group"
            description="Customer groups are managed with ERP customers for now."
          >
            <Button asChild className="bg-[#003D82]">
              <Link to="/admin/erp/people">Open ERP People</Link>
            </Button>
          </StubPanel>
        )}
        {tab === 'brands' && <BrandsSettingsPanel />}
        {tab === 'units' && <UnitsSettingsPanel />}
        {tab === 'currency' && <CurrencySettingsPanel />}
        {tab === 'tax' && (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-[#003D82]">Tax</CardTitle>
              <CardDescription>Default tax rate (%) applied to sales when no line tax is set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#003D82]" />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax rate (%)</Label>
                    <Input id="tax_rate" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                  </div>
                  <Button onClick={saveTax} disabled={savingTax} className="bg-[#003D82]">
                    {savingTax ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save tax
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
        {tab === 'mail' && (
          <StubPanel
            title="Mail Setting"
            description="Outbound mail is configured via API environment variables (SMTP / provider keys)."
          >
            <Button type="button" variant="outline" onClick={() => setTab('env')}>
              Open .env Settings
            </Button>
          </StubPanel>
        )}
        {tab === 'reward' && (
          <StubPanel
            title="Reward Point Setting"
            description="Reward points are not enabled in Alpha Bridge. This tab is reserved for future use."
          />
        )}
        {tab === 'pos' && <PosSettingsPanel />}
        {tab === 'transactions' && (
          <StubPanel
            title="My Transactions"
            description="View ERP payments and ledger activity."
          >
            <Button asChild className="bg-[#003D82]">
              <Link to="/admin/erp/payments">Open Payments</Link>
            </Button>
          </StubPanel>
        )}
        {tab === 'empty-db' && (
          <StubPanel
            title="Empty Database"
            description="Destructive wipe is disabled for safety. Use Backup Database to export, or contact a system administrator for controlled resets."
          >
            <Alert variant="destructive">
              <AlertTitle>Disabled</AlertTitle>
              <AlertDescription>This action will not run from the admin UI.</AlertDescription>
            </Alert>
          </StubPanel>
        )}
        {tab === 'logs' && <AdminActivityLogsPage />}
        {tab === 'backup' && <AdminBackupRestorePage />}
        {tab === 'billers' && <BillersSettingsPanel />}
        {tab === 'license' && <LicenseAgreementTab />}

        {tab === 'profile' && (
          loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#003D82]" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
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
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                          className="pl-10"
                        />
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
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                          className="pl-10"
                          placeholder="+237..."
                        />
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
                  <div className="flex justify-between">
                    <span>Role</span>
                    <span className="font-bold uppercase">{profile?.role || 'User'}</span>
                  </div>
                  <Alert className="bg-white border-blue-200">
                    <AlertTitle className="text-xs font-bold">WhatsApp OTP</AlertTitle>
                    <AlertDescription className="text-xs">Keep your phone number current for login verification.</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          )
        )}

        {tab === 'env' && (
          loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#003D82]" /></div>
          ) : (
            <Card className="max-w-5xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileCode className="w-5 h-5" /> Environment Files</CardTitle>
                <CardDescription>Edit `.env` files. Restart the API after changing server variables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Frontend `.env` / `.env.local`</Label>
                  <Textarea
                    value={envFiles.frontend}
                    onChange={(e) => setEnvFiles((f) => ({ ...f, frontend: e.target.value }))}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API `apps/api/.env`</Label>
                  <Textarea
                    value={envFiles.api}
                    onChange={(e) => setEnvFiles((f) => ({ ...f, api: e.target.value }))}
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
                <Button onClick={saveEnv} disabled={savingEnv} variant="outline" className="border-[#003D82] text-[#003D82]">
                  {savingEnv ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Environment Files
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </>
  );
};

export default GeneralSystemSettingsPage;
