import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus, Loader2, RefreshCw, Save, UploadCloud, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { num } from '@/lib/erpFormat';
import { PRODUCT_IMAGE_BUCKET, productImageSrc } from '@/lib/erpImages';
import { nextProductCode } from '@/services/erpService';
import RichTextField from '@/components/erp/RichTextField';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const IMAGE_BUCKET = PRODUCT_IMAGE_BUCKET;
const SELECT_CLASS = 'w-full border rounded-md h-10 px-2 mt-1 text-sm bg-white';
const ROW_CLASS = 'grid gap-4 md:grid-cols-3';

export const PRODUCT_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'digital', label: 'Digital' },
  { value: 'donation', label: 'Donation' },
  { value: 'service', label: 'Service' },
];

/** Only standard products keep stock; digital / donation / service are stockless. */
export function productTypeTracksStock(productType) {
  return String(productType || 'standard') === 'standard';
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
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '');
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
    image_url: '',
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
  const fileRef = useRef(null);
  const codeSeeded = useRef(mode !== 'create');

  // Stockless types are intangible: no brand, units, cost or inventory either.
  const trackStock = productTypeTracksStock(form.product_type);
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
      // Per-warehouse qty, never the multi-warehouse total: saving writes it back to one warehouse.
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
      image_url: initialProduct.image_url || '',
      description: initialProduct.description || '',
      has_warehouse_price: !!initialProduct.has_warehouse_price,
      warehouse_rows: mergeWarehouseRows(warehouses, prices),
      is_active: initialProduct.is_active !== false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct]);

  const preview = useMemo(() => productImageSrc(form.image_url), [form.image_url]);

  const changeType = (productType) => {
    setForm((prev) => ({
      ...prev,
      product_type: productType,
      ...(productTypeTracksStock(productType)
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

  const handleFile = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const path = await uploadProductImage(file);
      patch({ image_url: path });
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer?.files?.[0]);
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
    if (form.price === '' || num(form.price) < 0) return toast.error('Product price is required');
    if (trackStock && (form.qty === '' || num(form.qty) < 0)) {
      return toast.error('Quantity is required for a standard product');
    }
    if (uploading) return toast.error('Wait for the image upload to finish');

    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      barcode: (form.barcode || form.code).trim() || null,
      product_type: form.product_type,
      category_id: form.category_id || null,
      brand_id: trackStock ? form.brand_id || null : null,
      unit_id: trackStock ? form.unit_id || null : null,
      sale_unit_id: trackStock ? form.sale_unit_id || null : null,
      purchase_unit_id: trackStock ? form.purchase_unit_id || null : null,
      cost: trackStock ? num(form.cost) : 0,
      price: num(form.price),
      rent_price_hour: numOr(form.rent_price_hour, 0),
      rent_price_day: numOr(form.rent_price_day, 0),
      rent_price_month: numOr(form.rent_price_month, 0),
      alert_quantity: trackStock ? numOr(form.alert_quantity, 0) : 0,
      tax_id: form.tax_id || null,
      tax_method: form.tax_method,
      product_location: form.product_location.trim() || null,
      is_featured: !!form.is_featured,
      has_warehouse_price: showWarehousePrices,
      image_url: form.image_url || null,
      description: form.description || null,
      is_active: form.is_active !== false,
    };
    if (trackStock) body.stocks = buildStocks();

    return onSubmit?.(body);
  };

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white shadow-sm p-4 sm:p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === 'edit' ? 'Edit Product' : 'Add Product'}
        </h2>
        <p className="mt-1 text-sm italic text-slate-500">
          The field labels marked with * are required input fields.
        </p>
      </div>

      <div className={ROW_CLASS}>
        <div>
          <Label>Product Type *</Label>
          <select
            className={SELECT_CLASS}
            value={form.product_type}
            onChange={(e) => changeType(e.target.value)}
          >
            {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Product Name *</Label>
          <Input
            className="mt-1"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
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
      </div>

      <div className={ROW_CLASS}>
        {trackStock && (
          <div>
            <Label>Product Unit *</Label>
            <select
              className={SELECT_CLASS}
              value={form.unit_id}
              onChange={(e) => patch({ unit_id: e.target.value })}
            >
              <option value="">Select Product Unit…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        {trackStock && (
          <div>
            <Label>Brand</Label>
            <select
              className={SELECT_CLASS}
              value={form.brand_id}
              onChange={(e) => patch({ brand_id: e.target.value })}
            >
              <option value="">Select Brand…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>Category *</Label>
          <select
            className={SELECT_CLASS}
            value={form.category_id}
            onChange={(e) => patch({ category_id: e.target.value })}
          >
            <option value="">Select Category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {!trackStock && (
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
        )}
      </div>

      {trackStock && (
        <div className={ROW_CLASS}>
          <div className="hidden md:block" />
          <div>
            <Label>Sale Unit</Label>
            <select
              className={SELECT_CLASS}
              value={form.sale_unit_id}
              onChange={(e) => patch({ sale_unit_id: e.target.value })}
            >
              <option value="">Nothing selected</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Purchase Unit</Label>
            <select
              className={SELECT_CLASS}
              value={form.purchase_unit_id}
              onChange={(e) => patch({ purchase_unit_id: e.target.value })}
            >
              <option value="">Nothing selected</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {trackStock && (
        <div className={ROW_CLASS}>
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
        </div>
      )}

      {trackStock && !showWarehousePrices && (
        <div className={ROW_CLASS}>
          <div>
            <Label>Stock Warehouse</Label>
            <select
              className={SELECT_CLASS}
              value={form.stock_warehouse_id}
              onChange={(e) => patch({ stock_warehouse_id: e.target.value })}
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              The quantity above is recorded against this warehouse.
            </p>
          </div>
        </div>
      )}

      <div className={ROW_CLASS}>
        <div>
          <Label>Product Rent Price / Hour</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="mt-1"
            placeholder="Product Rent Price per Hour"
            value={form.rent_price_hour}
            onChange={(e) => patch({ rent_price_hour: e.target.value })}
          />
        </div>
        <div>
          <Label>Product Rent Price / Day</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="mt-1"
            placeholder="Product Rent Price per Day"
            value={form.rent_price_day}
            onChange={(e) => patch({ rent_price_day: e.target.value })}
          />
        </div>
        <div>
          <Label>Product Rent Price / Month</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="mt-1"
            placeholder="Product Rent Price per Month"
            value={form.rent_price_month}
            onChange={(e) => patch({ rent_price_month: e.target.value })}
          />
        </div>
      </div>

      <div className={ROW_CLASS}>
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
          <select
            className={SELECT_CLASS}
            value={form.tax_id}
            onChange={(e) => patch({ tax_id: e.target.value })}
          >
            <option value="">No Tax</option>
            {taxes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.rate === undefined || t.rate === null ? t.name : `${t.name} (${num(t.rate)}%)`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Tax Method</Label>
          <select
            className={SELECT_CLASS}
            value={form.tax_method}
            onChange={(e) => patch({ tax_method: e.target.value })}
          >
            <option value="exclusive">Exclusive</option>
            <option value="inclusive">Inclusive</option>
          </select>
        </div>
      </div>

      <div className={ROW_CLASS}>
        <div>
          <Label>Product Location</Label>
          <Input
            className="mt-1"
            placeholder="Product location"
            value={form.product_location}
            onChange={(e) => patch({ product_location: e.target.value })}
          />
        </div>
        <div className="md:pt-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => patch({ is_featured: e.target.checked })}
            />
            Featured
          </label>
          <p className="mt-1 text-xs italic text-slate-500">
            Featured product will be displayed in POS
          </p>
        </div>
      </div>

      <div>
        <Label>Product Image</Label>
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!uploading) fileRef.current?.click();
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'mt-1 flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2',
            'rounded-lg border-2 border-dashed p-6 text-sm transition-colors',
            dragging ? 'border-[#003D82] bg-blue-50' : 'border-slate-300 hover:bg-slate-50',
            uploading && 'cursor-wait opacity-70'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[#003D82]" />
              <span className="text-slate-600">Uploading…</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-slate-400" />
              <span className="text-slate-500">Drop files here to upload</span>
              <span className="text-xs text-slate-400">or click to browse (max 50MB)</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
        {preview && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border p-2">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-slate-50">
              <img src={preview} alt="Product" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-sm font-medium text-slate-700">
                <ImagePlus className="h-4 w-4 text-slate-400" /> Product image
              </p>
              <p className="truncate text-xs text-slate-400">{form.image_url}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Remove image"
              onClick={() => patch({ image_url: '' })}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        )}
      </div>

      <div>
        <Label>Product Details</Label>
        <div className="mt-1">
          <RichTextField
            value={form.description}
            resetKey={initialProduct?.id || 'new'}
            placeholder="Describe the product…"
            onChange={(html) => patch({ description: html })}
          />
        </div>
      </div>

      {trackStock && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.has_warehouse_price}
              onChange={(e) => patch({ has_warehouse_price: e.target.checked })}
            />
            This product has different price for different warehouse
          </label>

          {showWarehousePrices && (
            <div className="overflow-x-auto rounded-lg border">
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
                  {!form.warehouse_rows.length && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-500">
                        No warehouses configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 rounded-b-xl border-t bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5">
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
