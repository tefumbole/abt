import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createPurchaseReturn, createSaleReturn, deletePurchaseReturn, deleteSaleReturn,
  listCustomers, listProducts, listPurchaseReturns, listPurchases, listSaleReturns,
  listSales, listSuppliers, listWarehouses,
} from '@/services/erpService';
import ErpShell from './ErpShell';

const emptySaleLine = () => ({ product_id: '', qty: 1, net_unit_price: 0 });
const emptyPurchaseLine = () => ({ product_id: '', qty: 1, net_unit_cost: 0 });

export default function ReturnsPanel() {
  const [tab, setTab] = useState('sale');
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saleForm, setSaleForm] = useState({
    warehouse_id: '',
    customer_id: '',
    sale_id: '',
    note: '',
    items: [emptySaleLine()],
  });
  const [purchaseForm, setPurchaseForm] = useState({
    warehouse_id: '',
    supplier_id: '',
    purchase_id: '',
    note: '',
    items: [emptyPurchaseLine()],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [r, w, p, c, s, recentSales, recentPurchases] = await Promise.all([
        tab === 'sale' ? listSaleReturns() : listPurchaseReturns(),
        listWarehouses(),
        listProducts(),
        listCustomers(),
        listSuppliers(),
        listSales(),
        listPurchases(),
      ]);
      setRows(r);
      setWarehouses(w);
      setProducts(p);
      setCustomers(c);
      setSuppliers(s);
      setSales((recentSales || []).slice(0, 50));
      setPurchases((recentPurchases || []).slice(0, 50));
      const defWh = w.find((x) => x.is_default) || w[0];
      if (defWh) {
        setSaleForm((f) => (f.warehouse_id ? f : { ...f, warehouse_id: defWh.id }));
        setPurchaseForm((f) => (f.warehouse_id ? f : { ...f, warehouse_id: defWh.id }));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const setSaleItem = (idx, patch) => {
    setSaleForm((f) => ({
      ...f,
      items: f.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }));
  };

  const setPurchaseItem = (idx, patch) => {
    setPurchaseForm((f) => ({
      ...f,
      items: f.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }));
  };

  const submitSale = async (e) => {
    e.preventDefault();
    const items = saleForm.items
      .filter((i) => i.product_id)
      .map((i) => ({
        product_id: i.product_id,
        qty: Number(i.qty),
        net_unit_price: Number(i.net_unit_price),
      }));
    if (!items.length) {
      toast.error('Add at least one product line');
      return;
    }
    setSaving(true);
    try {
      await createSaleReturn({
        warehouse_id: saleForm.warehouse_id,
        customer_id: saleForm.customer_id || null,
        sale_id: saleForm.sale_id || null,
        note: saleForm.note || null,
        items,
      });
      toast.success('Sale return saved — stock restored');
      setSaleForm((f) => ({ ...f, sale_id: '', note: '', items: [emptySaleLine()] }));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    const items = purchaseForm.items
      .filter((i) => i.product_id)
      .map((i) => ({
        product_id: i.product_id,
        qty: Number(i.qty),
        net_unit_cost: Number(i.net_unit_cost),
      }));
    if (!items.length) {
      toast.error('Add at least one product line');
      return;
    }
    setSaving(true);
    try {
      await createPurchaseReturn({
        warehouse_id: purchaseForm.warehouse_id,
        supplier_id: purchaseForm.supplier_id || null,
        purchase_id: purchaseForm.purchase_id || null,
        note: purchaseForm.note || null,
        items,
      });
      toast.success('Purchase return saved — stock deducted');
      setPurchaseForm((f) => ({ ...f, purchase_id: '', note: '', items: [emptyPurchaseLine()] }));
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this return and reverse stock?')) return;
    try {
      if (tab === 'sale') await deleteSaleReturn(id);
      else await deletePurchaseReturn(id);
      toast.success('Return deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onPickSale = (saleId) => {
    const sale = sales.find((s) => s.id === saleId);
    setSaleForm((f) => ({
      ...f,
      sale_id: saleId,
      customer_id: sale?.customer_id || f.customer_id,
      warehouse_id: sale?.warehouse_id || f.warehouse_id,
    }));
  };

  const onPickPurchase = (purchaseId) => {
    const purchase = purchases.find((p) => p.id === purchaseId);
    setPurchaseForm((f) => ({
      ...f,
      purchase_id: purchaseId,
      supplier_id: purchase?.supplier_id || f.supplier_id,
      warehouse_id: purchase?.warehouse_id || f.warehouse_id,
    }));
  };

  return (
    <ErpShell title="ERP Commerce" subtitle="Returns">
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === 'sale' ? 'default' : 'outline'} onClick={() => setTab('sale')}>
          Sale returns
        </Button>
        <Button size="sm" variant={tab === 'purchase' ? 'default' : 'outline'} onClick={() => setTab('purchase')}>
          Purchase returns
        </Button>
      </div>

      {tab === 'sale' ? (
        <form className="rounded-xl border bg-white p-4 space-y-3 mb-4" onSubmit={submitSale}>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Warehouse</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={saleForm.warehouse_id}
                onChange={(e) => setSaleForm({ ...saleForm, warehouse_id: e.target.value })}
                required
              >
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Link sale (optional)</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={saleForm.sale_id}
                onChange={(e) => onPickSale(e.target.value)}
              >
                <option value="">—</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>{s.reference} · {Number(s.grand_total || 0).toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Customer (optional)</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={saleForm.customer_id}
                onChange={(e) => setSaleForm({ ...saleForm, customer_id: e.target.value })}
              >
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lines</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSaleForm({ ...saleForm, items: [...saleForm.items, emptySaleLine()] })}
              >
                <Plus className="h-4 w-4 mr-1" /> Add line
              </Button>
            </div>
            {saleForm.items.map((line, idx) => (
              <div key={idx} className="grid md:grid-cols-[1fr_100px_120px_40px] gap-2 items-end">
                <div>
                  <Label className="text-xs text-slate-500">Product</Label>
                  <select
                    className="w-full border rounded-md h-10 px-2"
                    value={line.product_id}
                    onChange={(e) => {
                      const p = products.find((x) => x.id === e.target.value);
                      setSaleItem(idx, {
                        product_id: e.target.value,
                        net_unit_price: p?.price ?? line.net_unit_price,
                      });
                    }}
                    required={idx === 0}
                  >
                    <option value="">Select…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Qty</Label>
                  <Input type="number" step="0.001" min="0.001" value={line.qty} onChange={(e) => setSaleItem(idx, { qty: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Unit price</Label>
                  <Input type="number" step="0.01" value={line.net_unit_price} onChange={(e) => setSaleItem(idx, { net_unit_price: e.target.value })} required />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={saleForm.items.length <= 1}
                  onClick={() => setSaleForm({ ...saleForm, items: saleForm.items.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label>Note</Label>
            <Input value={saleForm.note} onChange={(e) => setSaleForm({ ...saleForm, note: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save sale return
          </Button>
        </form>
      ) : (
        <form className="rounded-xl border bg-white p-4 space-y-3 mb-4" onSubmit={submitPurchase}>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Warehouse</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={purchaseForm.warehouse_id}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, warehouse_id: e.target.value })}
                required
              >
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Link purchase (optional)</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={purchaseForm.purchase_id}
                onChange={(e) => onPickPurchase(e.target.value)}
              >
                <option value="">—</option>
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>{p.reference} · {Number(p.grand_total || 0).toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Supplier (optional)</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={purchaseForm.supplier_id}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
              >
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lines</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPurchaseForm({ ...purchaseForm, items: [...purchaseForm.items, emptyPurchaseLine()] })}
              >
                <Plus className="h-4 w-4 mr-1" /> Add line
              </Button>
            </div>
            {purchaseForm.items.map((line, idx) => (
              <div key={idx} className="grid md:grid-cols-[1fr_100px_120px_40px] gap-2 items-end">
                <div>
                  <Label className="text-xs text-slate-500">Product</Label>
                  <select
                    className="w-full border rounded-md h-10 px-2"
                    value={line.product_id}
                    onChange={(e) => {
                      const p = products.find((x) => x.id === e.target.value);
                      setPurchaseItem(idx, {
                        product_id: e.target.value,
                        net_unit_cost: p?.cost ?? line.net_unit_cost,
                      });
                    }}
                    required={idx === 0}
                  >
                    <option value="">Select…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Qty</Label>
                  <Input type="number" step="0.001" min="0.001" value={line.qty} onChange={(e) => setPurchaseItem(idx, { qty: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Unit cost</Label>
                  <Input type="number" step="0.01" value={line.net_unit_cost} onChange={(e) => setPurchaseItem(idx, { net_unit_cost: e.target.value })} required />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={purchaseForm.items.length <= 1}
                  onClick={() => setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label>Note</Label>
            <Input value={purchaseForm.note} onChange={(e) => setPurchaseForm({ ...purchaseForm, note: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save purchase return
          </Button>
        </form>
      )}

      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Ref</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">{tab === 'sale' ? 'Customer' : 'Supplier'}</th>
                <th className="p-3">Linked</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.reference}</td>
                  <td className="p-3">{r.warehouse_name || '—'}</td>
                  <td className="p-3">{tab === 'sale' ? (r.customer_name || '—') : (r.supplier_name || '—')}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {tab === 'sale' ? (r.sale_id ? r.sale_id.slice(0, 8) + '…' : '—') : (r.purchase_id ? r.purchase_id.slice(0, 8) + '…' : '—')}
                  </td>
                  <td className="p-3">{r.items_count ?? '—'}</td>
                  <td className="p-3">{Number(r.grand_total || 0).toFixed(2)}</td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">No returns yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </ErpShell>
  );
}
