import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown, FileSpreadsheet, FileText, Image as ImageIcon,
  Loader2, Plus, Printer, Search, Eye, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSystemSettings } from '@/services/settingsService';
import {
  createAdjustment, createCategory, createProduct,
  deleteCategory, listAdjustments, listBrands, listCategories, listProducts,
  listUnits, listWarehouses, updateCategory,
} from '@/services/erpService';

const TAB_IDS = [
  'category', 'product-list', 'add-product', 'barcode',
  'adjustment-list', 'add-adjustment', 'stock-count',
];

function money(n, currency = 'XAF') {
  return `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const raw = searchParams.get('tab') || 'category';
    return TAB_IDS.includes(raw) ? raw : 'category';
  }, [searchParams]);
  const setTab = (id) => {
    setSearchParams({ tab: id }, { replace: true });
  };
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [currency, setCurrency] = useState('XAF');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showImportCategory, setShowImportCategory] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', parent_id: '', image_url: '' });
  const [importText, setImportText] = useState('name,parent_category\n');
  const [productForm, setProductForm] = useState({
    name: '', code: '', barcode: '', category_id: '', brand_id: '', unit_id: '', cost: 0, price: 0, qty: 0, warehouse_id: '',
  });
  const [adjForm, setAdjForm] = useState({ warehouse_id: '', product_id: '', qty: 0, note: '' });
  const [barcodeId, setBarcodeId] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const [wh, sys] = await Promise.all([
        listWarehouses(),
        getSystemSettings().catch(() => null),
      ]);
      setCurrency(sys?.currency || 'XAF');
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
      setProducts(p || []);
      setCategories(c || []);
      setBrands(b || []);
      setUnits(u || []);
      setAdjustments(a || []);
      if (!productForm.warehouse_id && wid) setProductForm((f) => ({ ...f, warehouse_id: wid }));
      if (!adjForm.warehouse_id && wid) setAdjForm((f) => ({ ...f, warehouse_id: wid }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [warehouseId]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) =>
      c.name?.toLowerCase().includes(q)
      || c.parent_name?.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const pageCats = filteredCategories.slice((page - 1) * pageSize, page * pageSize);

  const openAddCategory = () => {
    setEditCategory(null);
    setCatForm({ name: '', parent_id: '', image_url: '' });
    setShowAddCategory(true);
  };

  const openEditCategory = (c) => {
    setEditCategory(c);
    setCatForm({
      name: c.name || '',
      parent_id: c.parent_id || '',
      image_url: c.image_url || '',
    });
    setShowAddCategory(true);
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return toast.error('Name required');
    try {
      const payload = {
        name: catForm.name.trim(),
        parent_id: catForm.parent_id || null,
        image_url: catForm.image_url || null,
      };
      if (editCategory) await updateCategory(editCategory.id, payload);
      else await createCategory(payload);
      toast.success(editCategory ? 'Category updated' : 'Category created');
      setShowAddCategory(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const importCategories = async () => {
    const lines = importText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return toast.error('Add rows under the header');
    const header = lines[0].toLowerCase();
    if (!header.includes('name')) return toast.error('Header must include name');
    let ok = 0;
    for (const line of lines.slice(1)) {
      const [name, parentName] = line.split(',').map((x) => (x || '').trim());
      if (!name) continue;
      let parent_id = null;
      if (parentName) {
        const parent = categories.find((c) => c.name.toLowerCase() === parentName.toLowerCase())
          || (await listCategories()).find((c) => c.name.toLowerCase() === parentName.toLowerCase());
        parent_id = parent?.id || null;
        if (!parent_id) {
          const created = await createCategory({ name: parentName });
          parent_id = created?.id || created?.data?.id || null;
        }
      }
      try {
        await createCategory({ name, parent_id });
        ok += 1;
      } catch {
        /* skip duplicates */
      }
    }
    toast.success(`Imported ${ok} categor${ok === 1 ? 'y' : 'ies'}`);
    setShowImportCategory(false);
    reload();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (pageCats.every((c) => selected.includes(c.id))) {
      setSelected((prev) => prev.filter((id) => !pageCats.some((c) => c.id === id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageCats.map((c) => c.id)])]);
    }
  };

  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PRODUCT</h1>
          <p className="text-sm text-slate-600 mt-1">Categories, catalog & stock</p>
        </div>
        <select
          className="border rounded-md px-2 text-sm h-9"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div> : null}

      {!loading && tab === 'category' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button className="bg-[#003D82]" onClick={openAddCategory}>
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
            <Button className="bg-[#0b5ed7]" onClick={() => setShowImportCategory(true)}>
              Import Category
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex items-center gap-2 text-sm">
              <span>Records per page</span>
              <select
                className="border rounded-md h-9 px-2"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" className="text-pink-600" title="PDF" onClick={() => window.print()}><FileText className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="text-amber-600" title="Excel" onClick={() => {
                const csv = ['Category,Parent,Products,Stock Qty,Stock Worth Price,Stock Worth Cost',
                  ...filteredCategories.map((c) =>
                    `"${c.name}","${c.parent_name || 'N/A'}",${c.product_count || 0},${c.stock_qty || 0},${c.stock_price || 0},${c.stock_cost || 0}`
                  )].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'categories.csv';
                a.click();
              }}><FileSpreadsheet className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="text-blue-600" title="Print" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="text-orange-600" title="Clear selection" onClick={() => setSelected([])}><X className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="text-purple-600" title="View"><Eye className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={pageCats.length > 0 && pageCats.every((c) => selected.includes(c.id))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3">Image</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Parent Category</th>
                  <th className="p-3">Number of Product</th>
                  <th className="p-3">Stock Quantity</th>
                  <th className="p-3">Stock Worth (Price/Cost)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageCats.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td className="p-3">
                      <div className="w-14 h-14 rounded-lg bg-slate-100 border flex items-center justify-center overflow-hidden">
                        {c.image_url ? (
                          <img src={c.image_url} alt="" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3">{c.parent_name || 'N/A'}</td>
                    <td className="p-3">{c.product_count || 0}</td>
                    <td className="p-3">{Number(c.stock_qty || 0)}</td>
                    <td className="p-3">
                      {money(c.stock_price, currency)} / {money(c.stock_cost, currency)}
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                            Action <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditCategory(c)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={async () => {
                              if (!confirm('If you delete category, products under it may be affected. Continue?')) return;
                              try {
                                await deleteCategory(c.id);
                                toast.success('Deleted');
                                reload();
                              } catch (e) {
                                toast.error(e.message);
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {!pageCats.length && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-500">No categories found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              Showing {(filteredCategories.length ? (page - 1) * pageSize + 1 : 0)} – {Math.min(page * pageSize, filteredCategories.length)} ({filteredCategories.length})
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="self-center">Page {page} / {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === 'product-list' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Category</th>
                <th className="p-3">Price</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.code || '—'}</td>
                  <td className="p-3">{p.category_name || '—'}</td>
                  <td className="p-3">{Number(p.price).toFixed(2)}</td>
                  <td className="p-3">{Number(p.cost).toFixed(2)}</td>
                  <td className="p-3">{Number(p.stock_qty || 0)}</td>
                </tr>
              ))}
              {!products.length && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">No products yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'add-product' && (
        <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const stocks = productForm.warehouse_id && Number(productForm.qty)
              ? [{ warehouse_id: productForm.warehouse_id, qty: Number(productForm.qty), price: Number(productForm.price), cost: Number(productForm.cost) }]
              : [];
            await createProduct({ ...productForm, cost: Number(productForm.cost), price: Number(productForm.price), stocks });
            toast.success('Product created');
            setTab('product-list');
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
          <div className="md:col-span-2"><Button type="submit" className="bg-[#003D82]">Create product</Button></div>
        </form>
      )}

      {!loading && tab === 'adjustment-list' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr><th className="p-3">Ref</th><th className="p-3">Warehouse</th><th className="p-3">Note</th><th className="p-3">Date</th></tr>
            </thead>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3">{a.reference}</td>
                  <td className="p-3">{a.warehouse_name}</td>
                  <td className="p-3">{a.note || '—'}</td>
                  <td className="p-3">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {!adjustments.length && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No adjustments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'add-adjustment' && (
        <form className="rounded-xl border bg-white p-4 grid md:grid-cols-2 gap-3" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await createAdjustment({
              warehouse_id: adjForm.warehouse_id,
              note: adjForm.note,
              items: [{ product_id: adjForm.product_id, qty: Number(adjForm.qty) }],
            });
            toast.success('Stock adjusted');
            setTab('adjustment-list');
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
          <div className="md:col-span-2"><Button type="submit" className="bg-[#003D82]">Save adjustment</Button></div>
        </form>
      )}

      {!loading && tab === 'barcode' && (
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

      {!loading && tab === 'stock-count' && (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Code</th>
                <th className="p-3">Warehouse stock</th>
                <th className="p-3">Price</th>
                <th className="p-3">Worth</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.code || '—'}</td>
                  <td className="p-3">{Number(p.stock_qty || 0)}</td>
                  <td className="p-3">{Number(p.price).toFixed(2)}</td>
                  <td className="p-3">{money(Number(p.stock_qty || 0) * Number(p.price || 0), currency)}</td>
                </tr>
              ))}
              {!products.length && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No stock to count</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveCategory} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="text-lg font-bold text-[#003D82]">{editCategory ? 'Update Category' : 'Add Category'}</h3>
            <div>
              <Label>Name *</Label>
              <Input required value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Type category name..." />
            </div>
            <div>
              <Label>Parent Category</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={catForm.parent_id}
                onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value })}
              >
                <option value="">No Parent Category</option>
                {categories.filter((c) => c.id !== editCategory?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={catForm.image_url} onChange={(e) => setCatForm({ ...catForm, image_url: e.target.value })} placeholder="Optional image URL" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]">Submit</Button>
            </div>
          </form>
        </div>
      )}

      {showImportCategory && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3">
            <h3 className="text-lg font-bold text-[#003D82]">Import Category</h3>
            <p className="text-sm text-slate-600">
              Correct column order is <code>name*, parent_category</code>. One category per line.
            </p>
            <textarea
              className="w-full border rounded-md p-2 font-mono text-xs min-h-[160px]"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowImportCategory(false)}>Cancel</Button>
              <Button type="button" className="bg-[#003D82]" onClick={importCategories}>Import</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
