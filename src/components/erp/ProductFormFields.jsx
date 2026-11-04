import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, RefreshCw, Save, UploadCloud, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { num } from '@/lib/erpFormat';
import { PRODUCT_IMAGE_BUCKET, imageFileFromClipboard, productImageSrc } from '@/lib/erpImages';
import { nextProductCode } from '@/services/erpService';
import RichTextField from '@/components/erp/RichTextField';
import SearchSelect from '@/components/erp/SearchSelect';
import { WarehouseSelect } from '@/components/erp/WarehouseBillerSelect';
import PasteableImage from '@/components/erp/PasteableImage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IMAGE_BUCKET = PRODUCT_IMAGE_BUCKET;

export const PRODUCT_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'digital', label: 'Digital' },
  { value: 'combo', label: 'Combo' },
  { value: 'donation', label: 'Donation' },
  { value: 'service', label: 'Service' },
  { value: 'rental', label: 'Rentals' },
];

const TAX_METHODS = [
  { value: 'exclusive', label: 'Exclusive' },
  { value: 'inclusive', label: 'Inclusive' },
];

/** Only standard products keep stock; digital / donation / service / rental are stockless. */
export function productTypeTracksStock(productType) {
  return String(productType || 'standard') === 'standard';
}

export function productTypeIsRental(productType) {
  return String(productType || '') === 'rental';
}

function authHeaders() {
  try {
    const raw = localStorage.getItem('alpha_supabase_auth');
    const parsed = raw ? JSON.parse(raw) : null;
    const token = parsed?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function uploadProductImage(file) {
  const ext = (file.name?.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const filePath = `product_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const form = new FormData();
  form.append('file', file);
  form.append('path', filePath);
  const res = await fetch(`${API_BASE}/upload/${IMAGE_BUCKET}?path=${encodeURIComponent(filePath)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Upload failed');
  return json.path || filePath;
}

function emptyForm(defaultWarehouseId = '') {
  return {
    product_type: 'standard',
    name: '',
    code: '',
    barcode: '',
    unit_id: '',
    brand_id: '',
    category_id: '',
    sale_unit_id: '',
    purchase_unit_id: '',
    cost: '',
    price: '',
    qty: '0',
    stock_warehouse_id: defaultWarehouseId,
    rent_price_hour: '',
    rent_price_day: '',
    rent_price_month: '',
    alert_quantity: '',
    tax_id: '',
    tax_method: 'exclusive',
    product_location: '',
    is_featured: false,
    images: [],
    description: '',
    has_warehouse_price: false,
    warehouse_rows: [],
    is_active: true,
  };
}

function mergeWarehouseRows(warehouses, source = []) {
  const byId = new Map(source.map((row) => [String(row.warehouse_id), row]));
  return warehouses.map((warehouse) => {
    const row = byId.get(String(warehouse.id));
    return {
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      qty: row?.qty ?? '',
      price: row?.price ?? '',
      cost: row?.cost ?? '',
    };
  });
}

function numOr(value, fallback) {
  return value === '' || value === null || value === undefined ? fallback : num(value);
}

function initialImages(product) {
  if (!product) return [];
  if (Array.isArray(product.images) && product.images.length) return product.images.filter(Boolean);
  return product.image_url ? [product.image_url] : [];
}

function FieldCard({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#003D82]">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Beyond/Stocky-style product form used for both create and edit.
 * Emits the API payload through `onSubmit`; the page owns the request itself.
 */
export default function ProductFormFields({
  mode = 'create',
  initialProduct = null,
  categories = [],
  brands = [],
  units = [],
  warehouses = [],
  taxes = [],
  defaultWarehouseId = '',
  saving = false,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(() => emptyForm(defaultWarehouseId));
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const codeSeeded = useRef(mode !== 'create');

  const trackStock = productTypeTracksStock(form.product_type);
  const isRental = productTypeIsRental(form.product_type);
  const showWarehousePrices = trackStock && form.has_warehouse_price;

  const patch = (changes) => setForm((prev) => ({ ...prev, ...changes }));

  const fillCode = async () => {
    setCodeLoading(true);
    try {
      const code = await nextProductCode();
      if (code) patch({ code: String(code) });
    } catch (err) {
      toast.error(err.message || 'Could not generate a product code');
    } finally {
      setCodeLoading(false);
    }
  };

  useEffect(() => {
    if (codeSeeded.current) return;
    codeSeeded.current = true;
    fillCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      stock_warehouse_id: prev.stock_warehouse_id || defaultWarehouseId,
      warehouse_rows: mergeWarehouseRows(warehouses, prev.warehouse_rows),
    }));
  }, [warehouses, defaultWarehouseId]);

  useEffect(() => {
    if (!initialProduct) return;
    const prices = initialProduct.warehouse_prices || [];
    const primary = prices.find((row) => num(row.qty) > 0) || prices[0] || null;
    setForm({
      product_type: initialProduct.product_type || 'standard',
      name: initialProduct.name || '',
      code: initialProduct.code || '',
      barcode: initialProduct.barcode || '',
      unit_id: initialProduct.unit_id || '',
      brand_id: initialProduct.brand_id || '',
      category_id: initialProduct.category_id || '',
      sale_unit_id: initialProduct.sale_unit_id || '',
      purchase_unit_id: initialProduct.purchase_unit_id || '',
      cost: initialProduct.cost ?? '',
      price: initialProduct.price ?? '',
      qty: String(primary?.qty ?? initialProduct.stock_qty ?? 0),
      stock_warehouse_id: primary?.warehouse_id || defaultWarehouseId,
      rent_price_hour: initialProduct.rent_price_hour ?? '',
      rent_price_day: initialProduct.rent_price_day ?? '',
      rent_price_month: initialProduct.rent_price_month ?? '',
      alert_quantity: initialProduct.alert_quantity ?? '',
      tax_id: initialProduct.tax_id || '',
      tax_method: initialProduct.tax_method === 'inclusive' ? 'inclusive' : 'exclusive',
      product_location: initialProduct.product_location || '',
      is_featured: !!initialProduct.is_featured,
      images: initialImages(initialProduct),
      description: initialProduct.description || '',
      has_warehouse_price: !!initialProduct.has_warehouse_price,
      warehouse_rows: mergeWarehouseRows(warehouses, prices),
      is_active: initialProduct.is_active !== false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct]);

  const changeType = (productType) => {
    const rentalCat = categories.find((c) => /rent/i.test(c.name || ''));
    setForm((prev) => ({
      ...prev,
      product_type: productType,
      ...(productType === 'rental'
        ? {
          qty: '0',
          alert_quantity: '',
          has_warehouse_price: false,
          unit_id: '',
          sale_unit_id: '',
          purchase_unit_id: '',
          cost: '',
          rent_price_hour: '',
          category_id: prev.category_id || rentalCat?.id || '',
        }
        : productTypeTracksStock(productType)
          ? {}
          : {
            qty: '0',
            alert_quantity: '',
            has_warehouse_price: false,
            brand_id: '',
            unit_id: '',
            sale_unit_id: '',
            purchase_unit_id: '',
            cost: '',
          }),
    }));
  };

  const updateWarehouseRow = (warehouseId, changes) => {
    setForm((prev) => ({
      ...prev,
      warehouse_rows: prev.warehouse_rows.map((row) => (
        String(row.warehouse_id) === String(warehouseId) ? { ...row, ...changes } : row
      )),
    }));
  };

  const addImages = useCallback(async (files) => {
    const list = [...files].filter((file) => file && String(file.type || '').startsWith('image/'));
    if (!list.length) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const paths = [];
      for (const file of list) paths.push(await uploadProductImage(file));
      setForm((prev) => ({ ...prev, images: [...prev.images, ...paths] }));
      toast.success(paths.length > 1 ? `${paths.length} images added` : 'Image added');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (event) => {
      const target = event.target;
      const tag = String(target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      const files = [...(event.clipboardData?.items || [])]
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (!files.length) {
        const single = imageFileFromClipboard(event);
        if (single) files.push(single);
      }
      if (!files.length) return;
      event.preventDefault();
      addImages(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addImages]);

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addImages(event.dataTransfer?.files || []);
  };

  const removeImage = (index) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const replaceImage = async (index, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadProductImage(file);
      setForm((prev) => ({
        ...prev,
        images: prev.images.map((img, i) => (i === index ? path : img)),
      }));
      toast.success('Image updated');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const buildStocks = () => {
    if (form.has_warehouse_price) {
      return form.warehouse_rows
        .filter((row) => row.qty !== '' || row.price !== '' || row.cost !== '')
        .map((row) => ({
          warehouse_id: row.warehouse_id,
          qty: numOr(row.qty, 0),
          price: numOr(row.price, num(form.price)),
          cost: numOr(row.cost, num(form.cost)),
        }));
    }
    const warehouseId = form.stock_warehouse_id || defaultWarehouseId;
    if (!warehouseId) return [];
    return [{
      warehouse_id: warehouseId,
      qty: numOr(form.qty, 0),
      price: num(form.price),
      cost: num(form.cost),
    }];
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Product name is required');
    if (!form.code.trim()) return toast.error('Product code is required');
    if (trackStock && !form.unit_id) return toast.error('Product unit is required');
    if (!form.category_id) return toast.error('Category is required');
    if (trackStock && (form.cost === '' || num(form.cost) < 0)) {
      return toast.error('Product cost is required');
    }
    if (isRental) {
      if (num(form.rent_price_day) <= 0 && num(form.rent_price_month) <= 0) {
        return toast.error('Enter a daily or monthly rental price');
      }
    } else if (form.price === '' || num(form.price) < 0) {
      return toast.error('Product price is required');
    }
    if (trackStock && (form.qty === '' || num(form.qty) < 0)) {
      return toast.error('Quantity is required for a standard product');
    }
    if (uploading) return toast.error('Wait for the image upload to finish');

    const rentalPrice = num(form.rent_price_day) || num(form.rent_price_month);
    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      barcode: (form.barcode || form.code).trim() || null,
      product_type: form.product_type,
      category_id: form.category_id || null,
      brand_id: trackStock || isRental ? form.brand_id || null : null,
      unit_id: trackStock ? form.unit_id || null : null,
      sale_unit_id: trackStock ? form.sale_unit_id || null : null,
      purchase_unit_id: trackStock ? form.purchase_unit_id || null : null,
      cost: trackStock ? num(form.cost) : 0,
      price: isRental ? (num(form.price) || rentalPrice) : num(form.price),
      rent_price_hour: isRental ? 0 : numOr(form.rent_price_hour, 0),
      rent_price_day: numOr(form.rent_price_day, 0),
      rent_price_month: numOr(form.rent_price_month, 0),
      alert_quantity: trackStock ? numOr(form.alert_quantity, 0) : 0,
      tax_id: form.tax_id || null,
      tax_method: form.tax_method,
      product_location: form.product_location.trim() || null,
      is_featured: !!form.is_featured,
      has_warehouse_price: showWarehousePrices,
      image_url: form.images[0] || null,
      images: form.images,
      description: form.description || null,
      is_active: form.is_active !== false,
    };
    if (trackStock) body.stocks = buildStocks();
    return onSubmit?.(body);
  };

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const brandOptions = brands.map((b) => ({ value: b.id, label: b.name }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const taxOptions = [
    { value: '', label: 'No Tax' },
    ...taxes.map((t) => ({
      value: t.id,
      label: t.rate === undefined || t.rate === null ? t.name : `${t.name} (${num(t.rate)}%)`,
    })),
  ];

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-[#003D82] to-[#0b5ed7] px-5 py-4 text-white shadow-sm">
        <h2 className="text-xl font-semibold">
          {mode === 'edit' ? 'Edit product' : 'Add product'}
        </h2>
        <p className="mt-1 text-sm text-white/80">
          Searchable fields, rental products without stock, and multiple images via click, drop, or Ctrl+V.
        </p>
      </div>

      <FieldCard title="Basics" hint="Fields marked * are required.">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Product Type *</Label>
            <SearchSelect
              className="mt-1"
              value={form.product_type}
              onChange={changeType}
              options={PRODUCT_TYPES}
              placeholder="Search type…"
              allowClear={false}
            />
          </div>
          <div>
            <Label>Product Name *</Label>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Product name"
            />
          </div>
          <div>
            <Label>Product Code *</Label>
            <div className="mt-1 flex gap-2">
              <Input value={form.code} onChange={(e) => patch({ code: e.target.value })} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 text-[#003D82]"
                title="Generate code"
                disabled={codeLoading}
                onClick={fillCode}
              >
                {codeLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {(trackStock || isRental) && (
            <div>
              <Label>Brand</Label>
              <SearchSelect
                className="mt-1"
                value={form.brand_id}
                onChange={(brand_id) => patch({ brand_id })}
                options={brandOptions}
                placeholder="Search brand…"
              />
            </div>
          )}
          <div>
            <Label>Category *</Label>
            <SearchSelect
              className="mt-1"
              value={form.category_id}
              onChange={(category_id) => patch({ category_id })}
              options={categoryOptions}
              placeholder="Search category…"
              allowClear={false}
            />
          </div>
          {trackStock && (
            <div>
              <Label>Product Unit *</Label>
              <SearchSelect
                className="mt-1"
                value={form.unit_id}
                onChange={(unit_id) => patch({ unit_id })}
                options={unitOptions}
                placeholder="Search unit…"
                allowClear={false}
              />
            </div>
          )}
        </div>
        {trackStock && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label>Sale Unit</Label>
              <SearchSelect
                className="mt-1"
                value={form.sale_unit_id}
                onChange={(sale_unit_id) => patch({ sale_unit_id })}
                options={unitOptions}
                placeholder="Search sale unit…"
              />
            </div>
            <div>
              <Label>Purchase Unit</Label>
              <SearchSelect
                className="mt-1"
                value={form.purchase_unit_id}
                onChange={(purchase_unit_id) => patch({ purchase_unit_id })}
                options={unitOptions}
                placeholder="Search purchase unit…"
              />
            </div>
          </div>
        )}
      </FieldCard>

      {isRental ? (
        <FieldCard title="Rental pricing" hint="No stock. Set a daily and/or monthly rental price.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Daily rental price *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="mt-1"
                placeholder="Price per day"
                value={form.rent_price_day}
                onChange={(e) => patch({ rent_price_day: e.target.value })}
              />
            </div>
            <div>
              <Label>Monthly rental price *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="mt-1"
                placeholder="Price per month"
                value={form.rent_price_month}
                onChange={(e) => patch({ rent_price_month: e.target.value })}
              />
            </div>
          </div>
        </FieldCard>
      ) : (
        <FieldCard title="Pricing" hint={trackStock ? 'Cost, sell price, and opening quantity.' : 'Stockless product — sell price only.'}>
          <div className="grid gap-4 md:grid-cols-3">
            {trackStock && (
              <div>
                <Label>Product Cost *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1"
                  value={form.cost}
                  onChange={(e) => patch({ cost: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Product Price *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="mt-1"
                value={form.price}
                onChange={(e) => patch({ price: e.target.value })}
              />
            </div>
            {trackStock && (
              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="mt-1"
                  value={form.qty}
                  onChange={(e) => patch({ qty: e.target.value })}
                />
              </div>
            )}
          </div>
          {trackStock && !showWarehousePrices && (
            <div className="mt-4 max-w-md">
              <Label>Stock Warehouse</Label>
              <WarehouseSelect
                className="mt-1"
                value={form.stock_warehouse_id}
                onChange={(stock_warehouse_id) => patch({ stock_warehouse_id })}
                warehouses={warehouses}
                placeholder="Search warehouse…"
                allowClear={false}
              />
            </div>
          )}
          {!isRental && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <Label>Rent price / hour</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1"
                  value={form.rent_price_hour}
                  onChange={(e) => patch({ rent_price_hour: e.target.value })}
                />
              </div>
              <div>
                <Label>Rent price / day</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1"
                  value={form.rent_price_day}
                  onChange={(e) => patch({ rent_price_day: e.target.value })}
                />
              </div>
              <div>
                <Label>Rent price / month</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1"
                  value={form.rent_price_month}
                  onChange={(e) => patch({ rent_price_month: e.target.value })}
                />
              </div>
            </div>
          )}
        </FieldCard>
      )}

      <FieldCard title="Tax & display">
        <div className="grid gap-4 md:grid-cols-3">
          {trackStock && (
            <div>
              <Label>Alert Quantity</Label>
              <Input
                type="number"
                step="1"
                min="0"
                className="mt-1"
                value={form.alert_quantity}
                onChange={(e) => patch({ alert_quantity: e.target.value })}
              />
            </div>
          )}
          <div>
            <Label>Product Tax</Label>
            <SearchSelect
              className="mt-1"
              value={form.tax_id}
              onChange={(tax_id) => patch({ tax_id })}
              options={taxOptions}
              placeholder="Search tax…"
            />
          </div>
          <div>
            <Label>Tax Method</Label>
            <SearchSelect
              className="mt-1"
              value={form.tax_method}
              onChange={(tax_method) => patch({ tax_method })}
              options={TAX_METHODS}
              allowClear={false}
            />
          </div>
          <div>
            <Label>Product Location</Label>
            <Input
              className="mt-1"
              placeholder="Shelf, room, or site"
              value={form.product_location}
              onChange={(e) => patch({ product_location: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:pt-7">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => patch({ is_featured: e.target.checked })}
            />
            Featured in POS
          </label>
        </div>
      </FieldCard>

      <FieldCard
        title="Product images"
        hint="Click an image to paste, double-click to attach a file, or press Ctrl+V / ⌘V anywhere on this page."
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 rounded-xl border-2 border-dashed p-3',
            dragging ? 'border-[#003D82] bg-blue-50' : 'border-slate-200'
          )}
        >
          {form.images.map((path, index) => (
            <div key={`${path}-${index}`} className="relative">
              <PasteableImage
                src={productImageSrc(path)}
                uploading={uploading}
                size="lg"
                onFile={(file) => replaceImage(index, file)}
              />
              <button
                type="button"
                className="absolute -right-1 -top-1 rounded-full bg-white p-1 shadow border"
                title="Remove image"
                onClick={() => removeImage(index)}
              >
                <X className="h-3.5 w-3.5 text-red-600" />
              </button>
              {index === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-[#003D82] px-1.5 py-0.5 text-[10px] text-white">
                  Main
                </span>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => document.getElementById('product-multi-images')?.click()}
            className="flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-[#003D82] hover:bg-blue-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-[#003D82]" /> : <UploadCloud className="h-5 w-5" />}
            <span>Add images</span>
            <span className="text-[11px] text-slate-400">or Ctrl+V to paste</span>
          </button>
          <input
            id="product-multi-images"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addImages(e.target.files || []);
              e.target.value = '';
            }}
          />
        </div>
      </FieldCard>

      <FieldCard title="Details">
        <RichTextField
          value={form.description}
          resetKey={initialProduct?.id || 'new'}
          placeholder="Describe the product…"
          onChange={(html) => patch({ description: html })}
        />
      </FieldCard>

      {trackStock && (
        <FieldCard title="Warehouse prices">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.has_warehouse_price}
              onChange={(e) => patch({ has_warehouse_price: e.target.checked })}
            />
            This product has a different price per warehouse
          </label>
          {showWarehousePrices && (
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="p-2">Warehouse</th>
                    <th className="p-2 w-32">Quantity</th>
                    <th className="p-2 w-36">Price</th>
                    <th className="p-2 w-36">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {form.warehouse_rows.map((row) => (
                    <tr key={row.warehouse_id} className="border-t">
                      <td className="p-2 font-medium text-slate-700">{row.warehouse_name}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={row.qty}
                          onChange={(e) => updateWarehouseRow(row.warehouse_id, { qty: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={String(form.price || 0)}
                          value={row.price}
                          onChange={(e) => updateWarehouseRow(row.warehouse_id, { price: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={String(form.cost || 0)}
                          value={row.cost}
                          onChange={(e) => updateWarehouseRow(row.warehouse_id, { cost: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FieldCard>
      )}

      <div className="sticky bottom-4 z-20 flex flex-wrap justify-end gap-2 rounded-2xl border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-[#003D82] hover:bg-[#002855]" disabled={saving || uploading}>
          {saving
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Save className="mr-2 h-4 w-4" />}
          {mode === 'edit' ? 'Update Product' : 'Save Product'}
        </Button>
      </div>
    </form>
  );
}
