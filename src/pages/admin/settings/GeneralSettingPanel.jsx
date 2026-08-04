import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { APP_VERSION } from '@/constants/appVersion';
import { getSystemSettings, updateSystemSettings } from '@/services/settingsService';
import { uploadLogo, uploadPdfLetterheadImage, deleteStoredAsset } from '@/services/logoUploadService';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import {
  listBillers,
  listCategories,
  listUnits,
  listWarehouses,
  updateWarehouse,
  updateBiller,
} from '@/services/erpService';

const TIMEZONES = [
  { zone: 'Africa/Douala', offset: '+01:00', label: '(GMT+01:00) Africa/Douala' },
  { zone: 'Africa/Lagos', offset: '+01:00', label: '(GMT+01:00) Africa/Lagos' },
  { zone: 'Africa/Kinshasa', offset: '+01:00', label: '(GMT+01:00) Africa/Kinshasa' },
  { zone: 'Africa/Kigali', offset: '+02:00', label: '(GMT+02:00) Africa/Kigali' },
  { zone: 'Africa/Nairobi', offset: '+03:00', label: '(GMT+03:00) Africa/Nairobi' },
  { zone: 'Africa/Johannesburg', offset: '+02:00', label: '(GMT+02:00) Africa/Johannesburg' },
  { zone: 'UTC', offset: '+00:00', label: '(GMT+00:00) UTC' },
  { zone: 'Europe/Paris', offset: '+01:00', label: '(GMT+01:00) Europe/Paris' },
];

const EMPTY_FORM = {
  application_name: 'Alpha Bridge',
  developed_by: '',
  copyright_text: '',
  currency: 'XAF',
  currency_position: 'prefix',
  timezone: 'Africa/Douala',
  timezone_offset: '+01:00',
  staff_access: 'all',
  date_format: 'd-m-Y',
  invoice_format: 'standard',
  letter_serial_no: '',
  default_warehouse_id: '',
  default_biller_id: '',
  default_unit_id: '',
  default_category_id: '',
  tax_rate: '0',
  logo_url: '',
  logo_file_path: '',
  pdf_header_url: '',
  pdf_header_file_path: '',
  pdf_footer_url: '',
  pdf_footer_file_path: '',
  pdf_watermark_url: '',
  pdf_watermark_file_path: '',
};

export default function GeneralSettingPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [warehouses, setWarehouses] = useState([]);
  const [billers, setBillers] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState({ logo: false, header: false, footer: false, watermark: false });

  const logoRef = useRef(null);
  const headerRef = useRef(null);
  const footerRef = useRef(null);
  const watermarkRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sys, wh, bl, un, cats] = await Promise.all([
        getSystemSettings(),
        listWarehouses().catch(() => []),
        listBillers().catch(() => []),
        listUnits().catch(() => []),
        listCategories().catch(() => []),
      ]);
      setWarehouses(wh || []);
      setBillers(bl || []);
      setUnits(un || []);
      setCategories(cats || []);

      const defaultWh = sys?.default_warehouse_id || (wh || []).find((w) => w.is_default)?.id || '';
      const defaultBl = sys?.default_biller_id || (bl || []).find((b) => b.is_default)?.id || '';

      setForm({
        ...EMPTY_FORM,
        application_name: sys?.application_name || 'Alpha Bridge',
        developed_by: sys?.developed_by || '',
        copyright_text: sys?.copyright_text || '',
        currency: sys?.currency || 'XAF',
        currency_position: sys?.currency_position || 'prefix',
        timezone: sys?.timezone || 'Africa/Douala',
        timezone_offset: sys?.timezone_offset || '+01:00',
        staff_access: sys?.staff_access || 'all',
        date_format: sys?.date_format || 'd-m-Y',
        invoice_format: sys?.invoice_format || 'standard',
        letter_serial_no: sys?.letter_serial_no || '',
        default_warehouse_id: defaultWh,
        default_biller_id: defaultBl,
        default_unit_id: sys?.default_unit_id || (un || [])[0]?.id || '',
        default_category_id: sys?.default_category_id || (cats || [])[0]?.id || '',
        tax_rate: sys?.tax_rate != null ? String(sys.tax_rate) : '0',
        logo_url: sys?.logo_url || '',
        logo_file_path: sys?.logo_file_path || '',
        pdf_header_url: sys?.pdf_header_url || '',
        pdf_header_file_path: sys?.pdf_header_file_path || '',
        pdf_footer_url: sys?.pdf_footer_url || '',
        pdf_footer_file_path: sys?.pdf_footer_file_path || '',
        pdf_watermark_url: sys?.pdf_watermark_url || '',
        pdf_watermark_file_path: sys?.pdf_watermark_file_path || '',
      });
    } catch (e) {
      toast.error(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const tz = TIMEZONES.find((t) => t.zone === form.timezone);
      await updateSystemSettings({
        application_name: form.application_name,
        developed_by: form.developed_by,
        copyright_text: form.copyright_text,
        currency: (form.currency || 'XAF').trim().toUpperCase(),
        currency_position: form.currency_position,
        timezone: form.timezone,
        timezone_offset: tz?.offset || form.timezone_offset || '+01:00',
        staff_access: form.staff_access,
        date_format: form.date_format,
        invoice_format: form.invoice_format,
        letter_serial_no: form.letter_serial_no || null,
        default_warehouse_id: form.default_warehouse_id || null,
        default_biller_id: form.default_biller_id || null,
        default_unit_id: form.default_unit_id || null,
        default_category_id: form.default_category_id || null,
        tax_rate: Number(form.tax_rate) || 0,
      });

      // Keep ERP default flags in sync when a default warehouse/biller is chosen
      if (form.default_warehouse_id) {
        const wh = warehouses.find((w) => w.id === form.default_warehouse_id);
        if (wh && !wh.is_default) {
          await updateWarehouse(form.default_warehouse_id, {
            name: wh.name,
            phone: wh.phone || '',
            email: wh.email || '',
            address: wh.address || '',
            is_active: wh.is_active !== false,
            is_default: true,
          }).catch(() => {});
        }
      }
      if (form.default_biller_id) {
        const bl = billers.find((b) => b.id === form.default_biller_id);
        if (bl && !bl.is_default) {
          await updateBiller(form.default_biller_id, {
            name: bl.name,
            email: bl.email || '',
            phone: bl.phone || '',
            company_name: bl.company_name || '',
            address: bl.address || '',
            warehouse_id: bl.warehouse_id || '',
            is_default: true,
          }).catch(() => {});
        }
      }

      toast.success('General settings saved');
      await load();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (file, kind) => {
    if (!file) return;
    const map = {
      logo: {
        upload: () => uploadLogo(file),
        pathKey: 'logo_file_path',
        urlKey: 'logo_url',
        label: 'Logo',
      },
      header: {
        upload: () => uploadPdfLetterheadImage(file, 'header'),
        pathKey: 'pdf_header_file_path',
        urlKey: 'pdf_header_url',
        label: 'Header',
      },
      footer: {
        upload: () => uploadPdfLetterheadImage(file, 'footer'),
        pathKey: 'pdf_footer_file_path',
        urlKey: 'pdf_footer_url',
        label: 'Footer',
      },
      watermark: {
        upload: () => uploadPdfLetterheadImage(file, 'watermark'),
        pathKey: 'pdf_watermark_file_path',
        urlKey: 'pdf_watermark_url',
        label: 'Watermark',
      },
    };
    const cfg = map[kind];
    if (!cfg) return;

    setUploading((u) => ({ ...u, [kind]: true }));
    try {
      if (form[cfg.pathKey]) {
        await deleteStoredAsset(form[cfg.pathKey]).catch(() => {});
      }
      const { publicUrl, filePath } = await cfg.upload();
      await updateSystemSettings({
        [cfg.urlKey]: publicUrl,
        [cfg.pathKey]: filePath,
      });
      setForm((f) => ({ ...f, [cfg.urlKey]: publicUrl, [cfg.pathKey]: filePath }));
      toast.success(`${cfg.label} updated`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [kind]: false }));
    }
  };

  const removeAsset = async (kind) => {
    const map = {
      logo: { pathKey: 'logo_file_path', urlKey: 'logo_url', label: 'logo' },
      header: { pathKey: 'pdf_header_file_path', urlKey: 'pdf_header_url', label: 'header' },
      footer: { pathKey: 'pdf_footer_file_path', urlKey: 'pdf_footer_url', label: 'footer' },
      watermark: { pathKey: 'pdf_watermark_file_path', urlKey: 'pdf_watermark_url', label: 'watermark' },
    };
    const cfg = map[kind];
    if (!cfg || !window.confirm(`Remove the ${cfg.label}?`)) return;
    setUploading((u) => ({ ...u, [kind]: true }));
    try {
      if (form[cfg.pathKey]) await deleteStoredAsset(form[cfg.pathKey]).catch(() => {});
      await updateSystemSettings({ [cfg.urlKey]: null, [cfg.pathKey]: null });
      setForm((f) => ({ ...f, [cfg.urlKey]: '', [cfg.pathKey]: '' }));
      toast.success(`${cfg.label} removed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading((u) => ({ ...u, [kind]: false }));
    }
  };

  const renderUpload = (kind, label, hint, inputRef, imageUrl, isUploading, tall = false) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => uploadAsset(e.target.files?.[0], kind)}
      />
      {isUploading ? (
        <div className={`border-2 border-dashed rounded-xl flex items-center justify-center bg-slate-50 ${tall ? 'min-h-[160px]' : 'min-h-[120px]'}`}>
          <Loader2 className="w-7 h-7 animate-spin text-[#003D82]" />
        </div>
      ) : imageUrl ? (
        <div className={`border-2 border-dashed rounded-xl p-3 bg-slate-50 ${tall ? 'min-h-[160px]' : 'min-h-[120px]'}`}>
          <div className="bg-white border rounded-lg p-2 flex items-center justify-center mb-2">
            <img src={imageUrl} alt={label} className={`object-contain ${tall ? 'max-h-28' : 'max-h-20'} max-w-full`} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>Replace</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => removeAsset(kind)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <ImageUploadZone
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onFile={(file) => uploadAsset(file, kind)}
          title={`Click, drop, or paste ${label.toLowerCase()}`}
          hint={hint}
          className={tall ? 'min-h-[160px]' : 'min-h-[120px]'}
        />
      )}
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-[#003D82]">General Setting</h2>
        <p className="text-sm text-slate-600 italic">The field labels marked with * are required input fields.</p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="application_name">System Title *</Label>
              <Input
                id="application_name"
                required
                value={form.application_name}
                onChange={(e) => setField('application_name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Application Version</Label>
              <Input value={APP_VERSION} disabled className="bg-slate-100 font-mono" />
              <p className="text-xs text-slate-500">
                Auto-updates as <code>ABT_ERP_V…</code> on each release deploy. Not editable.
              </p>
            </div>

            {renderUpload(
              'footer',
              'Email / Invoice Footer',
              'Wide footer band. Auto-resized to max 1400×200.',
              footerRef,
              form.pdf_footer_url,
              uploading.footer,
              true
            )}

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Input
                id="currency"
                required
                value={form.currency}
                onChange={(e) => setField('currency', e.target.value)}
                placeholder="XAF"
              />
            </div>

            <div className="space-y-2">
              <Label>Default Category *</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.default_category_id}
                onChange={(e) => setField('default_category_id', e.target.value)}
              >
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Default Biller</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.default_biller_id}
                onChange={(e) => setField('default_biller_id', e.target.value)}
              >
                <option value="">No default (auto: first active biller)</option>
                {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <p className="text-xs text-slate-500">Used by POS and sales when no POS biller is configured.</p>
            </div>

            <div className="space-y-2">
              <Label>Time Zone</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.timezone}
                onChange={(e) => setField('timezone', e.target.value)}
              >
                <option value="">Select TimeZone...</option>
                {TIMEZONES.map((t) => <option key={t.zone} value={t.zone}>{t.label}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Format *</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.invoice_format}
                onChange={(e) => setField('invoice_format', e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="gst">GST</option>
                <option value="beyond_a4">Beyond A4</option>
                <option value="mini">Beyond Mini Receipt</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="developed_by">Developed By</Label>
              <Input
                id="developed_by"
                value={form.developed_by}
                onChange={(e) => setField('developed_by', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="letter_serial_no">Letter Serial No.</Label>
              <Input
                id="letter_serial_no"
                value={form.letter_serial_no}
                onChange={(e) => setField('letter_serial_no', e.target.value)}
                placeholder="e.g. ABT/LTR"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {renderUpload(
              'logo',
              'System Logo',
              'PNG/JPG recommended. Auto-resized to fit (max 400×400). Transparent PNG works best.',
              logoRef,
              form.logo_url,
              uploading.logo
            )}

            {renderUpload(
              'header',
              'Email / Invoice Header',
              'Wide letterhead band. Auto-resized to max 1400×240 so it fits on A4 invoices.',
              headerRef,
              form.pdf_header_url,
              uploading.header,
              true
            )}

            {renderUpload(
              'watermark',
              'Email / Invoice Watermark',
              'Square logo works best. Auto-resized to max 800×800 (keeps PDFs small on WhatsApp).',
              watermarkRef,
              form.pdf_watermark_url,
              uploading.watermark
            )}

            <div className="space-y-2">
              <Label>Default Unit *</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.default_unit_id}
                onChange={(e) => setField('default_unit_id', e.target.value)}
              >
                <option value="">—</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Default Warehouse</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.default_warehouse_id}
                onChange={(e) => setField('default_warehouse_id', e.target.value)}
              >
                <option value="">No default (auto: warehouse with most items)</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <p className="text-xs text-slate-500">Used by POS and sales when no POS warehouse is configured.</p>
            </div>

            <div className="space-y-2">
              <Label>Currency Position *</Label>
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="currency_position"
                    checked={form.currency_position === 'prefix'}
                    onChange={() => setField('currency_position', 'prefix')}
                  />
                  Prefix
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="currency_position"
                    checked={form.currency_position === 'suffix'}
                    onChange={() => setField('currency_position', 'suffix')}
                  />
                  Suffix
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Staff Access *</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.staff_access}
                onChange={(e) => setField('staff_access', e.target.value)}
              >
                <option value="all">All Records</option>
                <option value="own">Own Records</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Date Format *</Label>
              <select
                className="w-full border rounded-md h-10 px-2 bg-white"
                value={form.date_format}
                onChange={(e) => setField('date_format', e.target.value)}
              >
                <option value="d-m-Y">dd-mm-yyyy</option>
                <option value="d/m/Y">dd/mm/yyyy</option>
                <option value="d.m.Y">dd.mm.yyyy</option>
                <option value="m-d-Y">mm-dd-yyyy</option>
                <option value="m/d/Y">mm/dd/yyyy</option>
                <option value="Y-m-d">yyyy-mm-dd</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="copyright_text">Copyright Text</Label>
              <Input
                id="copyright_text"
                value={form.copyright_text}
                onChange={(e) => setField('copyright_text', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="bg-[#003D82]">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Submit
      </Button>
    </form>
  );
}
