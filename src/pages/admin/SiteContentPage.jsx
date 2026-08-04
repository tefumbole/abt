import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Home,
  List,
  Settings,
  SlidersHorizontal,
  Pencil,
  Image as ImageIcon,
  Eye,
  GripVertical,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Loader2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import ImageUploadZone from '@/components/ui/ImageUploadZone';
import { getStoragePublicUrl } from '@/utils/storageUrl';
import {
  getAdminSiteContent,
  saveLandingMenuOrder,
  saveSideMenuOrder,
  saveSettingsMenuOrder,
  saveContentTabsOrder,
  savePageContent,
  uploadSiteContentImage,
} from '@/services/siteContentService';

const TAB_META = {
  landing: { label: 'Landing Menu', color: '#003D82', icon: Home },
  side: { label: 'Side Menu', color: '#7c3aed', icon: List },
  settingsMenu: { label: 'Settings Menu', color: '#ea580c', icon: Settings },
  contentTabs: { label: 'Settings', color: '#0d9488', icon: SlidersHorizontal },
  home: { label: 'Home', color: '#16a34a', icon: Pencil },
  trainings: { label: 'Training', color: '#2563eb', icon: Pencil },
  events: { label: 'Events', color: '#ca8a04', icon: Pencil },
  gallery: { label: 'Gallery', color: '#dc2626', icon: ImageIcon },
  about: { label: 'About', color: '#0284c7', icon: Pencil },
  shareholders: { label: 'Shareholders', color: '#4338ca', icon: Pencil },
  contact: { label: 'Contact', color: '#db2777', icon: Pencil },
};

const PAGE_TAB_COLORS = {
  home: '#16a34a',
  trainings: '#2563eb',
  events: '#ca8a04',
  gallery: '#dc2626',
  about: '#0284c7',
  shareholders: '#4338ca',
  contact: '#db2777',
};

function moveItem(list, index, toIndex) {
  if (toIndex < 0 || toIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function ReorderList({ order, labels, colors = {}, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);

  return (
    <div className="space-y-2">
      {order.map((key, index) => (
        <div
          key={key}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex == null || dragIndex === index) return;
            onChange(moveItem(order, dragIndex, index));
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
          style={{ borderLeftWidth: 4, borderLeftColor: colors[key] || '#003D82' }}
        >
          <GripVertical className="h-4 w-4 text-slate-400 shrink-0 cursor-grab" />
          <span className="flex-1 text-sm font-medium text-slate-800">{labels[key] || key}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-emerald-600"
              disabled={index === 0}
              onClick={() => onChange(moveItem(order, index, 0))}
              title="Move to top"
            >
              <ChevronsUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index === 0}
              onClick={() => onChange(moveItem(order, index, index - 1))}
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index === order.length - 1}
              onClick={() => onChange(moveItem(order, index, index + 1))}
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-rose-600"
              disabled={index === order.length - 1}
              onClick={() => onChange(moveItem(order, index, order.length - 1))}
              title="Move to bottom"
            >
              <ChevronsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function imagePreviewUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  return getStoragePublicUrl('site-content', value, null);
}

export default function SiteContentPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('landing');
  const [menus, setMenus] = useState(null);
  const [pages, setPages] = useState({});
  const [draftOrders, setDraftOrders] = useState({});
  const [draftValues, setDraftValues] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminSiteContent();
      setMenus(data.menus);
      setPages(data.pages || {});
      setDraftOrders({
        landing: [...(data.menus?.landing?.order || [])],
        side: [...(data.menus?.side?.order || [])],
        settingsMenu: [...(data.menus?.settings?.order || [])],
        contentTabs: [...(data.menus?.contentTabs?.order || [])],
      });
      const values = {};
      Object.entries(data.pages || {}).forEach(([key, page]) => {
        values[key] = { ...(page.values || {}) };
      });
      setDraftValues(values);
    } catch (err) {
      toast({
        title: 'Failed to load Site Content',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const contentTabOrder = draftOrders.contentTabs || Object.keys(pages);
  const pageTabs = useMemo(
    () => contentTabOrder.filter((k) => pages[k]),
    [contentTabOrder, pages]
  );

  const tabs = useMemo(() => {
    const base = [
      { id: 'landing', ...TAB_META.landing },
      { id: 'side', ...TAB_META.side },
      { id: 'settingsMenu', ...TAB_META.settingsMenu },
      { id: 'contentTabs', ...TAB_META.contentTabs },
    ];
    pageTabs.forEach((id) => {
      base.push({
        id,
        label: pages[id]?.label || TAB_META[id]?.label || id,
        color: PAGE_TAB_COLORS[id] || TAB_META[id]?.color || '#003D82',
        icon: TAB_META[id]?.icon || Pencil,
      });
    });
    return base;
  }, [pageTabs, pages]);

  const saveMenu = async (kind) => {
    setSaving(true);
    try {
      const order = draftOrders[kind];
      if (kind === 'landing') await saveLandingMenuOrder(order);
      else if (kind === 'side') await saveSideMenuOrder(order);
      else if (kind === 'settingsMenu') await saveSettingsMenuOrder(order);
      else if (kind === 'contentTabs') await saveContentTabsOrder(order);
      toast({ title: 'Saved', description: 'Menu order updated.' });
      await load();
      window.dispatchEvent(new CustomEvent('alphabridge:site-content-updated'));
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const savePage = async (pageKey) => {
    setSaving(true);
    try {
      await savePageContent(pageKey, draftValues[pageKey] || {});
      toast({ title: 'Saved', description: `${pages[pageKey]?.label || pageKey} content updated.` });
      await load();
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onImage = async (pageKey, fieldKey, file) => {
    try {
      const { path } = await uploadSiteContentImage(file);
      const url = getStoragePublicUrl('site-content', path, null);
      setDraftValues((prev) => ({
        ...prev,
        [pageKey]: { ...(prev[pageKey] || {}), [fieldKey]: url },
      }));
      toast({ title: 'Image ready', description: 'Remember to click Save to publish.' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading Site Content…
      </div>
    );
  }

  const isMenuTab = ['landing', 'side', 'settingsMenu', 'contentTabs'].includes(activeTab);
  const activePage = pages[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#003D82] flex items-center gap-2">
          <Globe className="h-8 w-8" />
          Site Content
        </h1>
        <p className="text-slate-600 mt-1">
          Manage what appears on the site and in what order. Edits go live when you press Save.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold border-2 transition-all"
              style={
                active
                  ? { backgroundColor: tab.color, borderColor: tab.color, color: '#fff' }
                  : { backgroundColor: '#fff', borderColor: tab.color, color: tab.color }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isMenuTab ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {TAB_META[activeTab]?.label}
              {activeTab === 'contentTabs' ? ' — Content Tab Order' : ' — Order'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Drag items to reorder{activeTab === 'landing'
                ? ' the public site header menu'
                : activeTab === 'side'
                  ? ' the admin sidebar'
                  : activeTab === 'settingsMenu'
                    ? ' System settings submenu'
                    : ' Site Content page tabs'}{' '}
              (or use arrows). Click Save when done.
            </p>
            {activeTab === 'landing' ? (
              <p className="text-xs text-slate-500 mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                Contact Us appears under <strong>About Us</strong> (submenu). QR Scanner is not shown in the public menu.
              </p>
            ) : null}
          </div>
          <ReorderList
            order={draftOrders[activeTab] || []}
            labels={
              activeTab === 'landing'
                ? Object.fromEntries(
                    Object.entries(menus?.landing?.items || {}).map(([k, v]) => [k, v.label || k])
                  )
                : activeTab === 'side'
                  ? menus?.side?.items || {}
                  : activeTab === 'settingsMenu'
                    ? menus?.settings?.items || {}
                    : menus?.contentTabs?.items || {}
            }
            colors={
              activeTab === 'contentTabs'
                ? PAGE_TAB_COLORS
                : Object.fromEntries((draftOrders[activeTab] || []).map((k, i) => [k, `hsl(${(i * 40) % 360} 55% 42%)`]))
            }
            onChange={(next) => setDraftOrders((prev) => ({ ...prev, [activeTab]: next }))}
          />
          <Button
            onClick={() => saveMenu(activeTab)}
            disabled={saving}
            className="bg-[#003D82] hover:bg-[#002a5c]"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      ) : activePage ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{activePage.label} — Content</h2>
              <p className="text-sm text-slate-500 mt-1">
                Edit the content shown on this page. Leave a field as-is to keep the current text.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={activePage.url || '/'} target="_blank" rel="noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                Preview / View live page
              </Link>
            </Button>
          </div>

          {activeTab === 'gallery' ? (
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 p-4 text-sm text-rose-900">
              Gallery photos and video embeds are managed in{' '}
              <Link to="/admin/gallery" className="font-semibold underline">
                Admin → Gallery
              </Link>
              . Use the fields below for the gallery page heading only.
            </div>
          ) : null}

          <div className="space-y-4 max-w-3xl">
            {Object.entries(activePage.fields || {}).map(([fieldKey, meta]) => {
              const type = meta.type || 'text';
              const value = draftValues[activeTab]?.[fieldKey] ?? meta.default ?? '';
              const setVal = (v) =>
                setDraftValues((prev) => ({
                  ...prev,
                  [activeTab]: { ...(prev[activeTab] || {}), [fieldKey]: v },
                }));

              return (
                <div key={fieldKey} className="space-y-1.5">
                  <Label className="text-slate-700">{meta.label || fieldKey}</Label>
                  {type === 'textarea' || type === 'html' ? (
                    <>
                      <Textarea
                        rows={type === 'html' ? 3 : 4}
                        value={value}
                        onChange={(e) => setVal(e.target.value)}
                        className="font-mono text-sm"
                      />
                      {type === 'html' ? (
                        <p className="text-xs text-slate-500">HTML is allowed here.</p>
                      ) : null}
                    </>
                  ) : type === 'image' ? (
                    <div className="space-y-2">
                      <ImageUploadZone
                        onFile={(file) => onImage(activeTab, fieldKey, file)}
                        title="Click here, then paste an image (Ctrl+V / ⌘V) — or drop a file"
                      />
                      {imagePreviewUrl(value) ? (
                        <img
                          src={imagePreviewUrl(value)}
                          alt=""
                          className="h-24 w-auto rounded-lg border border-slate-200 object-cover"
                        />
                      ) : null}
                      {value ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setVal('')}>
                          Clear image
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <Input value={value} onChange={(e) => setVal(e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => savePage(activeTab)}
            disabled={saving}
            className="bg-[#003D82] hover:bg-[#002a5c]"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
