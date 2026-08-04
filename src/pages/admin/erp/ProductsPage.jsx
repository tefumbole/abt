import React, { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createAdjustment, createBrand, createCategory, createProduct, createUnit,
  listAdjustments, listBrands, listCategories, listProducts, listUnits, listWarehouses,
} from '@/services/erpService';
import ErpShell, { COMMERCE_TABS } from './ErpShell';

const INNER = ['Categories', 'Products', 'Add Product', 'Adjustments', 'Barcode'];

export default function ProductsPage() {
  const [tab, setTab] = useState('Products');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catName, setCatName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [productForm, setProductForm] = useState({
    name: '', code: '', barcode: '', category_id: '', brand_id: '', unit_id: '', cost: 0, price: 0, qty: 0, warehouse_id: '',
  });
  const [adjForm, setAdjForm] = useState({ warehouse_id: '', product_id: '', qty: 0, note: '' });
  const [barcodeId, setBarcodeId] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const wh = await listWarehouses();
      setWarehouses(wh);
      const def = wh.find((w) => w.is_default) || wh[0];
      const wid = warehouseId || def?.id || '';
      if (!warehouseId && wid) setWarehouseId(wid);
      const [p, c, b, u, a] = await Promise.all([
        listProducts(wid || undefined),
        listCategories(),
        listBrands(),
        listUnits(),
        listAdjustments(),
      ]);
      setProducts(p);
      setCategories(c);
      setBrands(b);
      setUnits(u);
      setAdjustments(a);
      if (!productForm.warehouse_id && wid) setProductForm((f) => ({ ...f, warehouse_id: wid }));
      if (!adjForm.warehouse_id && wid) setAdjForm((f) => ({ ...f, warehouse_id: wid }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [warehouseId]);

  return (
    <ErpShell title="ERP Commerce" subtitle="Products & stock" tabs={COMMERCE_TABS}>
      <div className="flex flex-wrap gap-2 mb-4">
        {INNER.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>{t}</Button>
        ))}
        <select className="border rounded-md px-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div> : null}

      {tab === 'Categories' && (
        <div className="space-y-4">
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await createCategory({ name: catName }); setCatName(''); toast.success('Category added'); reload(); }
            catch (err) { toast.error(err.message); }
          }}>
            <Input placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} required />
            <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
          </form>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await createBrand({ name: brandName }); setBrandName(''); toast.success('Brand added'); reload(); }
            catch (err) { toast.error(err.message); }
          }}>
            <Input placeholder="Brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
            <Button type="submit">Add brand</Button>
          </form>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await createUnit({ name: unitName }); setUnitName(''); toast.success('Unit added'); reload(); }
            catch (err) { toast.error(err.message); }
          }}>
            <Input placeholder="Unit name" value={unitName} onChange={(e) => setUnitName(e.target.value)} required />
            <Button type="submit">Add unit</Button>
          </form>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="border rounded-xl p-3 bg-white"><h3 className="font-semibold mb-2">Categories</h3>{categories.map((c) => <div key={c.id}>{c.name}</div>)}</div>
            <div className="border rounded-xl p-3 bg-white"><h3 className="font-semibold mb-2">Brands</h3>{brands.map((c) => <div key={c.id}>{c.name}</div>)}</div>
            <div className="border rounded-xl p-3 bg-white"><h3 className="font-semibold mb-2">Units</h3>{units.map((c) => <div key={c.id}>{c.name}</div>)}</div>
          </div>
        </div>
      )}

      {tab === 'Products' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Name</th><th className="p-3">Code</th><th className="p-3">Price</th><th className="p-3">Cost</th><th className="p-3">Stock</th>
            </tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{p.code}</td>
                  <td className="p-3">{Number(p.price).toFixed(2)}</td>
                  <td className="p-3">{Number(p.cost).toFixed(2)}</td>
                  <td className="p-3">{Number(p.stock_qty || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Add Product' && (
        <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const stocks = productForm.warehouse_id && Number(productForm.qty)
              ? [{ warehouse_id: productForm.warehouse_id, qty: Number(productForm.qty), price: Number(productForm.price), cost: Number(productForm.cost) }]
              : [];
            await createProduct({ ...productForm, cost: Number(productForm.cost), price: Number(productForm.price), stocks });
            toast.success('Product created');
            setTab('Products');
            reload();
          } catch (err) { toast.error(err.message); }
        }}>
          <div><Label>Name</Label><Input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
          <div><Label>Code</Label><Input value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} /></div>
          <div><Label>Barcode</Label><Input value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} /></div>
          <div><Label>Category</Label>
            <select className="w-full border rounded-md h-10 px-2" value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Brand</Label>
            <select className="w-full border rounded-md h-10 px-2" value={productForm.brand_id} onChange={(e) => setProductForm({ ...productForm, brand_id: e.target.value })}>
              <option value="">—</option>
              {brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Unit</Label>
            <select className="w-full border rounded-md h-10 px-2" value={productForm.unit_id} onChange={(e) => setProductForm({ ...productForm, unit_id: e.target.value })}>
              <option value="">—</option>
              {units.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Cost</Label><Input type="number" step="0.01" value={productForm.cost} onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })} /></div>
          <div><Label>Price</Label><Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
          <div><Label>Initial warehouse</Label>
            <select className="w-full border rounded-md h-10 px-2" value={productForm.warehouse_id} onChange={(e) => setProductForm({ ...productForm, warehouse_id: e.target.value })}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><Label>Initial qty</Label><Input type="number" step="0.001" value={productForm.qty} onChange={(e) => setProductForm({ ...productForm, qty: e.target.value })} /></div>
          <div className="md:col-span-2"><Button type="submit">Create product</Button></div>
        </form>
      )}

      {tab === 'Adjustments' && (
        <div className="space-y-4">
          <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createAdjustment({
                warehouse_id: adjForm.warehouse_id,
                note: adjForm.note,
                items: [{ product_id: adjForm.product_id, qty: Number(adjForm.qty) }],
              });
              toast.success('Stock adjusted');
              reload();
            } catch (err) { toast.error(err.message); }
          }}>
            <div><Label>Warehouse</Label>
              <select className="w-full border rounded-md h-10 px-2" value={adjForm.warehouse_id} onChange={(e) => setAdjForm({ ...adjForm, warehouse_id: e.target.value })}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div><Label>Product</Label>
              <select className="w-full border rounded-md h-10 px-2" value={adjForm.product_id} onChange={(e) => setAdjForm({ ...adjForm, product_id: e.target.value })} required>
                <option value="">Select…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Qty (+/-)</Label><Input type="number" step="0.001" value={adjForm.qty} onChange={(e) => setAdjForm({ ...adjForm, qty: e.target.value })} required /></div>
            <div><Label>Note</Label><Input value={adjForm.note} onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })} /></div>
            <div className="md:col-span-2"><Button type="submit">Save adjustment</Button></div>
          </form>
          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left"><tr><th className="p-3">Ref</th><th className="p-3">Warehouse</th><th className="p-3">Note</th><th className="p-3">Date</th></tr></thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-3">{a.reference}</td>
                    <td className="p-3">{a.warehouse_name}</td>
                    <td className="p-3">{a.note || '—'}</td>
                    <td className="p-3">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Barcode' && (
        <div className="rounded-xl border bg-white p-4 space-y-3 max-w-md">
          <Label>Product</Label>
          <select className="w-full border rounded-md h-10 px-2" value={barcodeId} onChange={(e) => setBarcodeId(e.target.value)}>
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {barcodeId && (() => {
            const p = products.find((x) => x.id === barcodeId);
            if (!p) return null;
            const code = p.barcode || p.code || p.id;
            return (
              <div className="border p-6 text-center space-y-2">
                <div className="font-mono text-lg tracking-widest">{code}</div>
                <div className="font-semibold">{p.name}</div>
                <div>{Number(p.price).toFixed(2)}</div>
                <Button type="button" variant="outline" onClick={() => window.print()}>Print</Button>
              </div>
            );
          })()}
        </div>
      )}
    </ErpShell>
  );
}
