import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock, Fullscreen, HelpCircle, Loader2, Lock, Minus, Package, PauseCircle,
  Plus, Printer, Receipt, ScanLine, Search, Settings2, Trash2, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { amount, formatErpDate, makeMoney, num, payingMethodLabel } from '@/lib/erpFormat';
import { buildReceiptHtml, loadErpCompany, RECEIPT_STYLES } from '@/lib/erpDocuments';
import { openPrintWindow } from '@/lib/erpExport';
import { getSystemSettings } from '@/services/settingsService';
import {
  closeRegister, createCustomer, createPosSale, getPosSettings, getRegisterSummary, getSale,
  listBillers, listBrands, listCategories, listCustomers, listProducts, listRecentPosSales,
  listRegisters, listWarehouses, openRegister,
} from '@/services/erpService';
import PaymentModal, { paymentTotals } from '@/components/erp/pos/PaymentModal';
import SaleCompleteModal from '@/components/erp/pos/SaleCompleteModal';
import HeldSalesModal from '@/components/erp/pos/HeldSalesModal';
import RecentSalesModal from '@/components/erp/pos/RecentSalesModal';
import RegisterCloseModal from '@/components/erp/pos/RegisterCloseModal';
import { addHold, readHolds, removeHold } from '@/components/erp/pos/posHolds';
import {
  buildCartReceiptDoc, buildRegisterReportHtml, buildSaleReceiptDoc, lineSubtotal,
} from '@/components/erp/pos/posDocs';

/** Beyond Tech quick-pay buttons → erp paying_method + legacy paid_by_id. */
const QUICK_METHODS = [
  { key: 'je', method: 'je', paidById: 3, label: 'JE', className: 'bg-[#0b3f90] hover:bg-[#072f6b] text-white' },
  { key: 'cash', method: 'cash', paidById: 1, label: 'Cash', className: 'bg-teal-600 hover:bg-teal-700 text-white' },
  { key: 'credit', method: 'credit', paidById: 10, label: 'Credit', className: 'bg-purple-600 hover:bg-purple-700 text-white' },
  { key: 'group_credit', method: 'group_credit', paidById: 11, label: 'Group Credit', className: 'bg-green-600 hover:bg-green-700 text-white' },
  { key: 'orange_money', method: 'momo_orange', paidById: 8, label: 'Orange Money', className: 'bg-[#da7828] hover:bg-[#c06820] text-white' },
  { key: 'mtn_momo', method: 'momo_mtn', paidById: 8, label: 'MTN momo', className: 'bg-[#fd7272] hover:bg-[#e85a5a] text-white' },
  { key: 'deposit', method: 'deposit', paidById: 6, label: 'Deposit', className: 'bg-[#7b2d3b] hover:bg-[#642430] text-white' },
];

const PAID_BY_ID = {
  cash: 1, je: 3, deposit: 6, momo_orange: 8, momo_mtn: 8, pay_later: 9, credit: 10, group_credit: 11,
};

const SETTINGS_DEFAULTS = {
  receipt_show_logo: true,
  receipt_header: '',
  receipt_footer: '',
  auto_print_receipt: false,
  default_paying_method: 'cash',
  products_per_row: 4,
  show_stock: true,
  block_out_of_stock: true,
  enable_keyboard_shortcuts: true,
  default_tax_rate: 0,
};

/** Static class strings so Tailwind keeps the column variants in the build. */
const GRID_COLS = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-6',
};

const SHORTCUTS = [
  ['F2', 'Focus product search'],
  ['F4', 'Open payment'],
  ['F8', 'Hold current sale'],
  ['Esc', 'Close the open dialog'],
  ['Ctrl + Delete', 'Cancel sale'],
];

const round2 = (value) => Math.round(num(value) * 100) / 100;

function isToday(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear();
}

/** POS settings tolerate missing keys and both `settings` and legacy `settings_json`. */
function normalizePosSettings(raw) {
  let extra = raw?.settings;
  if (!extra && raw?.settings_json) {
    try {
      extra = typeof raw.settings_json === 'string' ? JSON.parse(raw.settings_json) : raw.settings_json;
    } catch {
      extra = null;
    }
  }
  const merged = { ...SETTINGS_DEFAULTS, ...(extra && typeof extra === 'object' ? extra : {}) };
  return {
    ...merged,
    receipt_show_logo: merged.receipt_show_logo !== false,
    auto_print_receipt: merged.auto_print_receipt === true,
    show_stock: merged.show_stock !== false,
    block_out_of_stock: merged.block_out_of_stock !== false,
    enable_keyboard_shortcuts: merged.enable_keyboard_shortcuts !== false,
    products_per_row: Math.min(6, Math.max(2, num(merged.products_per_row, 4))),
    default_paying_method: merged.default_paying_method || 'cash',
    default_tax_rate: num(merged.default_tax_rate, 0),
  };
}

const unwrap = (res) => (Array.isArray(res) ? res : res?.data || []);

export default function PosPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [billers, setBillers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [billerId, setBillerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [register, setRegister] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('featured'); // featured | category | brand
  const [filterId, setFilterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payModal, setPayModal] = useState(null); // { label, method }
  const [payRows, setPayRows] = useState([{ id: 'row-1', method: 'cash', amount: '' }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '', email: '' });
  const [cashInHand, setCashInHand] = useState('0');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [posSettings, setPosSettings] = useState(() => normalizePosSettings(null));
  const [sysSettings, setSysSettings] = useState({});
  const [company, setCompany] = useState({});
  const [saleComplete, setSaleComplete] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [holds, setHolds] = useState([]);
  const [showHolds, setShowHolds] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [reprintingId, setReprintingId] = useState(null);
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 });
  const [closeReport, setCloseReport] = useState(null); // { loading, summary }
  const [closingRegister, setClosingRegister] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const searchRef = useRef(null);

  const money = useMemo(() => makeMoney(sysSettings), [sysSettings]);
  const dateFormat = sysSettings.date_format || 'd-m-Y';

  const focusSearch = useCallback(() => {
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const refreshTodayStats = useCallback(async (wid) => {
    try {
      const rows = unwrap(await listRecentPosSales({ warehouse_id: wid || undefined, limit: 100 }));
      const todays = rows.filter((row) => isToday(row.sale_date));
      setTodayStats({
        count: todays.length,
        total: todays.reduce((sum, row) => sum + num(row.grand_total), 0),
      });
    } catch {
      // Header strip is informational only — never block the till on it.
    }
  }, []);

  const load = async (wid) => {
    setLoading(true);
    try {
      const [w, bl, cats, brs, rawSettings, sys, comp] = await Promise.all([
        listWarehouses(),
        listBillers(),
        listCategories().catch(() => []),
        listBrands().catch(() => []),
        getPosSettings().catch(() => null),
        getSystemSettings().catch(() => null),
        loadErpCompany(),
      ]);
      const settings = normalizePosSettings(rawSettings);
      setWarehouses(w || []);
      setBillers(bl || []);
      setCategories(cats || []);
      setBrands(brs || []);
      setPosSettings(settings);
      setSysSettings(sys || {});
      setCompany(comp || {});

      const defWh = wid
        || warehouseId
        || rawSettings?.warehouse_id
        || w.find((x) => x.is_default)?.id
        || w[0]?.id
        || '';
      setWarehouseId(defWh);
      if (!billerId) {
        setBillerId(rawSettings?.biller_id || bl.find((b) => b.is_default)?.id || bl[0]?.id || '');
      }

      if (!defWh) return;
      const [p, c, regs] = await Promise.all([
        listProducts(defWh),
        // ERP customers only (erp_customers) — never system users
        listCustomers('?active=1'),
        listRegisters(`?warehouse_id=${defWh}&status=open`),
      ]);
      const customerRows = (c || []).filter((row) => row?.id && row?.name);
      setProducts(p || []);
      setCustomers(customerRows);
      setRegister((regs || [])[0] || null);
      if (!(regs || []).length) setShowRegisterModal(true);
      // Prefer POS default customer, else Walk-in, else first customer
      if (!customerId) {
        const walkIn = customerRows.find((x) => /walk[- ]?in/i.test(x.name || ''));
        const preferred = customerRows.find((x) => x.id === rawSettings?.customer_id)
          || walkIn
          || customerRows[0];
        if (preferred?.id) setCustomerId(preferred.id);
      } else if (!customerRows.some((x) => x.id === customerId)) {
        const walkIn = customerRows.find((x) => /walk[- ]?in/i.test(x.name || ''));
        if (walkIn?.id) setCustomerId(walkIn.id);
      }
      refreshTodayStats(defWh);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setHolds(readHolds());
    focusSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (filterMode === 'category' && filterId) {
      list = list.filter((p) => String(p.category_id) === String(filterId));
    } else if (filterMode === 'brand' && filterId) {
      list = list.filter((p) => String(p.brand_id) === String(filterId));
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name?.toLowerCase().includes(q)
        || String(p.code || '').toLowerCase().includes(q)
        || String(p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, search, filterMode, filterId]);

  /** `null` means the warehouse has no stock row for that product — never block on it. */
  const stockById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      map.set(p.id, p.stock_qty === null || p.stock_qty === undefined ? null : num(p.stock_qty));
    });
    return map;
  }, [products]);

  const itemsCount = cart.reduce((sum, line) => sum + num(line.qty), 0);
  const subtotal = cart.reduce((sum, line) => sum + lineSubtotal(line), 0);
  const grandTotal = Math.max(0, subtotal - num(discount) + num(tax) + num(shipping));

  const withLineTax = (line) => {
    if (line.taxEdited || !posSettings.default_tax_rate) return line;
    const base = num(line.qty) * num(line.price) - num(line.discount);
    return { ...line, tax: round2((base * posSettings.default_tax_rate) / 100) };
  };

  const updateLine = (productId, patch) => {
    setCart((c) => c.map((x) => (x.product_id === productId ? withLineTax({ ...x, ...patch }) : x)));
  };

  const addToCart = (product, qty = 1) => {
    if (!product) return;
    const stock = stockById.get(product.id);
    const nextQty = num(cart.find((x) => x.product_id === product.id)?.qty) + qty;
    if (posSettings.block_out_of_stock && stock !== null && stock !== undefined && nextQty > stock) {
      toast.warning(`Only ${amount(stock, 0)} in stock for ${product.name}`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === product.id);
      if (existing) {
        return prev.map((x) => (x.product_id === product.id ? withLineTax({ ...x, qty: nextQty }) : x));
      }
      return [...prev, withLineTax({
        product_id: product.id,
        name: product.name,
        code: product.code || '',
        qty,
        price: num(product.price),
        discount: 0,
        tax: 0,
        taxEdited: false,
      })];
    });
    focusSearch();
  };

  const updateCartQty = (productId, qty) => {
    let next = Math.max(1, num(qty, 1) || 1);
    const stock = stockById.get(productId);
    if (posSettings.block_out_of_stock && stock !== null && stock !== undefined && next > stock) {
      toast.warning(`Only ${amount(stock, 0)} in stock`);
      next = Math.max(1, stock);
    }
    updateLine(productId, { qty: next });
  };

  const clearCart = () => {
    setCart([]);
    setReference('');
    setDiscount(0);
    setTax(0);
    setShipping(0);
    setNote('');
  };

  const cancelSale = () => {
    if (!cart.length && !reference) return;
    if (!window.confirm('Cancel this sale and clear the cart?')) return;
    clearCart();
    toast.message('Sale cancelled');
    focusSearch();
  };

  /* ---------------------------------------------------------------- scanning */

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const q = search.trim();
    if (!q) return;
    const needle = q.toLowerCase();
    const exact = products.filter(
      (p) => String(p.barcode || '').toLowerCase() === needle || String(p.code || '').toLowerCase() === needle
    );
    let match = null;
    if (exact.length === 1) match = exact[0];
    else if (!exact.length && filteredProducts.length === 1) [match] = filteredProducts;

    if (!match) {
      const many = exact.length > 1 || filteredProducts.length > 1;
      toast.error(many ? 'Several products match — pick one from the grid' : `No product matches "${q}"`);
      return;
    }
    addToCart(match);
    setSearch('');
  };

  /* ------------------------------------------------------------------- holds */

  const holdSale = () => {
    if (!cart.length) {
      toast.error('Cart is empty');
      return;
    }
    const customerName = customers.find((c) => c.id === customerId)?.name || 'Walk-in';
    const fallback = `${customerName} · ${formatErpDate(new Date(), dateFormat, { withTime: true })}`;
    const label = window.prompt('Label for this held sale', fallback);
    if (label === null) return;
    setHolds(addHold({
      label: label.trim() || fallback,
      payload: {
        items: cart,
        customer_id: customerId,
        biller_id: billerId,
        warehouse_id: warehouseId,
        discount: num(discount),
        tax: num(tax),
        shipping: num(shipping),
        reference,
        note,
      },
    }));
    clearCart();
    toast.success('Sale held');
    focusSearch();
  };

  const resumeHold = (hold) => {
    if (cart.length && !window.confirm('Replace the current cart with this held sale?')) return;
    const payload = hold.payload || {};
    setCart((payload.items || []).map((line) => ({
      product_id: line.product_id,
      name: line.name,
      code: line.code || '',
      qty: num(line.qty, 1),
      price: num(line.price),
      discount: num(line.discount),
      tax: num(line.tax),
      taxEdited: line.taxEdited === true,
    })));
    setCustomerId(payload.customer_id || customerId);
    setBillerId(payload.biller_id || billerId);
    setReference(payload.reference || '');
    setNote(payload.note || '');
    setDiscount(num(payload.discount));
    setTax(num(payload.tax));
    setShipping(num(payload.shipping));
    setHolds(removeHold(hold.id));
    setShowHolds(false);
    if (payload.warehouse_id && payload.warehouse_id !== warehouseId) {
      setWarehouseId(payload.warehouse_id);
      load(payload.warehouse_id);
    }
    toast.success('Held sale resumed');
    focusSearch();
  };

  const deleteHold = (id) => {
    setHolds(removeHold(id));
    toast.message('Held sale deleted');
  };

  /* ---------------------------------------------------------------- receipts */

  const warehouseName = warehouses.find((w) => String(w.id) === String(warehouseId))?.name || '';

  const printReceipt = (doc) => {
    if (!doc) {
      toast.error('No receipt to print yet');
      return;
    }
    try {
      openPrintWindow(buildReceiptHtml({ doc, company, settings: posSettings }), {
        title: 'Receipt',
        styles: RECEIPT_STYLES,
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  /* ---------------------------------------------------------------- payments */

  const openPay = (methodEntry) => {
    if (!register) {
      toast.error('Open a cash register first');
      setShowRegisterModal(true);
      return;
    }
    if (!cart.length) {
      toast.error('Cart is empty');
      return;
    }
    if (!warehouseId) {
      toast.error('Select a warehouse');
      return;
    }
    if (!customerId) {
      toast.error('Select a customer (add one with + if the list is empty)');
      return;
    }
    setPayRows([{ id: 'row-1', method: methodEntry.method, amount: grandTotal.toFixed(2) }]);
    setPayModal(methodEntry);
  };

  const openDefaultPay = () => {
    const fallback = posSettings.default_paying_method;
    const entry = QUICK_METHODS.find((m) => m.method === fallback)
      || { key: fallback, method: fallback, label: payingMethodLabel(fallback) };
    openPay(entry);
  };

  const confirmPay = async () => {
    if (!payModal) return;
    const rows = payRows.filter((row) => row.method);
    const funded = rows.filter((row) => num(row.amount) > 0);
    const { tendered, change } = paymentTotals(rows, grandTotal);
    if (tendered < 0) {
      toast.error('Invalid paid amount');
      return;
    }
    const primary = funded.length
      ? funded.reduce((best, row) => (num(row.amount) > num(best.amount) ? row : best))
      : { method: payModal.method };
    // Over-tender is change owed, not an over-payment: never record more than the total.
    const paid = Math.min(tendered, grandTotal);
    const breakdown = funded.length > 1
      ? `Split: ${funded.map((row) => `${payingMethodLabel(row.method)} ${amount(row.amount)}`).join(' | ')}`
      : '';
    const finalNote = [note.trim(), breakdown].filter(Boolean).join(' — ');

    setPaying(true);
    try {
      const res = await createPosSale({
        warehouse_id: warehouseId,
        customer_id: customerId || null,
        biller_id: billerId || null,
        reference: reference || undefined,
        discount: num(discount),
        tax: num(tax),
        shipping: num(shipping),
        note: finalNote || undefined,
        paid_amount: paid,
        paying_amount: tendered,
        paid_by_id: PAID_BY_ID[primary.method] ?? payModal.paidById ?? null,
        paying_method: primary.method,
        cash_register_id: register?.id || null,
        items: cart.map((line) => ({
          product_id: line.product_id,
          qty: num(line.qty),
          net_unit_price: num(line.price),
          discount: num(line.discount),
          tax: num(line.tax),
        })),
      });
      const sale = res?.data || res || {};
      const doc = buildCartReceiptDoc({
        sale,
        items: cart,
        warehouseName,
        customer: customers.find((c) => c.id === customerId) || {},
        cashier: billers.find((b) => String(b.id) === String(billerId))?.name || '',
        discount,
        tax,
        shipping,
        grandTotal: num(sale.grand_total, grandTotal),
        paidAmount: num(sale.paid_amount, paid),
        changeAmount: change,
        payingMethod: primary.method,
      });

      setLastReceipt(doc);
      setSaleComplete({
        reference: doc.reference,
        grand_total: doc.grand_total,
        paid_amount: doc.paid_amount,
        change_amount: change,
        method_label: payingMethodLabel(primary.method),
        payment_status_label: sale.payment_status === 'partial'
          ? 'Partially paid'
          : sale.payment_status === 'pending' ? 'Payment pending' : 'Fully paid',
        doc,
      });
      toast.success(`POS sale ${doc.reference} complete`);
      clearCart();
      setPayModal(null);
      if (posSettings.auto_print_receipt) printReceipt(doc);
      load(warehouseId);
      if (showRecent) loadRecentSales();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaying(false);
    }
  };

  /* ----------------------------------------------------------- recent sales */

  const loadRecentSales = async () => {
    setRecentLoading(true);
    try {
      setRecentSales(unwrap(await listRecentPosSales({ warehouse_id: warehouseId || undefined, limit: 15 })));
    } catch (e) {
      toast.error(e.message);
      setRecentSales([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const openRecent = () => {
    setShowRecent(true);
    loadRecentSales();
  };

  const reprintSale = async (row) => {
    setReprintingId(row.id);
    try {
      const res = await getSale(row.id);
      const doc = buildSaleReceiptDoc(res?.data || res || {}, { warehouseName });
      setLastReceipt(doc);
      printReceipt(doc);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReprintingId(null);
    }
  };

  /* -------------------------------------------------------------- registers */

  const startCloseRegister = async () => {
    if (!register) return;
    setCloseReport({ loading: true, summary: null });
    try {
      const res = await getRegisterSummary(register.id);
      setCloseReport({ loading: false, summary: res?.data || res || null });
    } catch (e) {
      toast.error(e.message);
      setCloseReport({ loading: false, summary: null });
    }
  };

  const printRegisterReport = () => {
    try {
      openPrintWindow(
        buildRegisterReportHtml({
          register: register || {},
          summary: closeReport?.summary,
          company,
          money,
          warehouseName,
        }),
        { title: 'Register report' }
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmCloseRegister = async () => {
    if (!register) return;
    setClosingRegister(true);
    try {
      await closeRegister(register.id);
      toast.success('Register closed');
      setCloseReport(null);
      load(warehouseId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setClosingRegister(false);
    }
  };

  /* ------------------------------------------------------------- shortcuts */

  const closeTopModal = () => {
    if (showShortcuts) return setShowShortcuts(false);
    if (showQuickCustomer) return setShowQuickCustomer(false);
    if (payModal) return setPayModal(null);
    if (saleComplete) return setSaleComplete(null);
    if (showHolds) return setShowHolds(false);
    if (showRecent) return setShowRecent(false);
    if (closeReport) return setCloseReport(null);
    if (showRegisterModal) return setShowRegisterModal(false);
    return undefined;
  };

  const shortcutRef = useRef({});
  shortcutRef.current = {
    enabled: posSettings.enable_keyboard_shortcuts,
    modalOpen: Boolean(payModal || saleComplete || showHolds || showRecent || closeReport
      || showRegisterModal || showQuickCustomer),
    focusSearch,
    openDefaultPay,
    holdSale,
    cancelSale,
    closeTopModal,
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const handlers = shortcutRef.current;
      if (!handlers.enabled) return;
      if (event.key === 'Escape') {
        handlers.closeTopModal?.();
        return;
      }
      const el = event.target;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (event.key === 'F2') {
        event.preventDefault();
        handlers.focusSearch?.();
      } else if (event.key === 'F4') {
        if (handlers.modalOpen) return;
        event.preventDefault();
        handlers.openDefaultPay?.();
      } else if (event.key === 'F8') {
        if (handlers.modalOpen) return;
        event.preventDefault();
        handlers.holdSale?.();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'Delete') {
        if (handlers.modalOpen) return;
        event.preventDefault();
        handlers.cancelSale?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ---------------------------------------------------------------- helpers */

  const saveQuickCustomer = async (e) => {
    e.preventDefault();
    if (!quickCustomer.name.trim()) {
      toast.error('Name required');
      return;
    }
    try {
      const created = await createCustomer({
        name: quickCustomer.name.trim(),
        phone: quickCustomer.phone || null,
        email: quickCustomer.email || null,
        is_active: true,
      });
      const row = created?.data || created;
      toast.success('Customer added');
      setShowQuickCustomer(false);
      setQuickCustomer({ name: '', phone: '', email: '' });
      const list = await listCustomers('?active=1');
      setCustomers((list || []).filter((x) => x?.id && x?.name));
      if (row?.id) setCustomerId(row.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const gridCols = GRID_COLS[posSettings.products_per_row] || GRID_COLS[4];

  return (
    <div className="-m-4 md:-m-6 min-h-[calc(100vh-4rem)] bg-[#eef2f8] flex flex-col">
      {/* POS chrome */}
      <div className="bg-[#003D82] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-wide">Point of Sale</span>
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] bg-white/10 rounded-full px-2.5 py-1">
            <Clock className="h-3.5 w-3.5" />
            Today: <strong>{todayStats.count}</strong> sale{todayStats.count === 1 ? '' : 's'}
            <span className="opacity-60">·</span>
            <strong>{money(todayStats.total)}</strong>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 px-2" onClick={openRecent}>
            <Receipt className="h-4 w-4 mr-1" /> Recent sales
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 px-2" onClick={() => setShowHolds(true)}>
            <PauseCircle className="h-4 w-4 mr-1" /> Held ({holds.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 h-8 px-2"
            disabled={!lastReceipt}
            onClick={() => printReceipt(lastReceipt)}
          >
            <Printer className="h-4 w-4 mr-1" /> Print last receipt
          </Button>
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10 h-8 w-8 p-0"
              title="Keyboard shortcuts"
              onClick={() => setShowShortcuts((v) => !v)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            {showShortcuts ? (
              <div className="absolute right-0 top-9 z-40 w-64 rounded-xl bg-white text-slate-700 shadow-xl border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shortcuts</span>
                  <button type="button" onClick={() => setShowShortcuts(false)}><X className="h-4 w-4" /></button>
                </div>
                <ul className="space-y-1 text-xs">
                  {SHORTCUTS.map(([keys, label]) => (
                    <li key={keys} className="flex justify-between gap-3">
                      <kbd className="bg-slate-100 border rounded px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
                      <span className="text-right">{label}</span>
                    </li>
                  ))}
                </ul>
                {!posSettings.enable_keyboard_shortcuts ? (
                  <p className="mt-2 text-[11px] text-amber-700">Shortcuts are disabled in POS settings.</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8 p-0" onClick={toggleFullscreen}>
            <Fullscreen className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8 p-0" asChild>
            <Link to="/admin/general-settings?tab=pos"><Settings2 className="h-4 w-4" /></Link>
          </Button>
          {register ? (
            <Button size="sm" variant="ghost" className="text-amber-300 hover:bg-white/10 h-8 px-2" onClick={startCloseRegister}>
              <Lock className="h-4 w-4 mr-1" /> Close register
            </Button>
          ) : (
            <Button size="sm" className="bg-[#D4AF37] text-[#003D82] hover:bg-[#c4a030] h-8" onClick={() => setShowRegisterModal(true)}>
              Open register
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-2 p-2 min-h-0">
        {/* LEFT: cart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[520px]">
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b">
            <Input
              placeholder="Type reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <select
              className="border rounded-md h-10 px-2 bg-white text-sm"
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); load(e.target.value); }}
            >
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select
              className="border rounded-md h-10 px-2 bg-white text-sm"
              value={billerId}
              onChange={(e) => setBillerId(e.target.value)}
            >
              <option value="">Select biller</option>
              {billers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="px-4 pt-4 pb-2 flex gap-2 items-center">
            <select
              className="border rounded-md h-11 px-2 bg-white text-sm flex-1"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.phone ? ` (${c.phone})` : ''}
                </option>
              ))}
            </select>
            <Button type="button" size="icon" className="bg-[#003D82] h-11 w-11" title="Add customer" onClick={() => setShowQuickCustomer(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {!customers.length && (
            <p className="px-4 pb-2 text-xs text-amber-700">
              No customers yet. Use + to add an ERP customer (system users are not customers).
            </p>
          )}

          <div className="px-4 py-4 border-y bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={searchRef}
                className="pl-9 pr-10 h-12 text-base bg-white"
                placeholder="Scan barcode or type product code and press Enter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                title="Scan mode: a barcode or exact code followed by Enter adds the product straight to the cart"
              >
                <ScanLine className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-2 py-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="p-3">Product</th>
                  <th className="p-3 w-24">Price</th>
                  <th className="p-3 w-28">Quantity</th>
                  <th className="p-3 w-20">Discount</th>
                  <th className="p-3 w-20">Tax</th>
                  <th className="p-3 w-24">SubTotal</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.map((i) => (
                  <tr key={i.product_id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-slate-500">{i.code || '—'}</div>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8"
                        type="number"
                        step="0.01"
                        value={i.price}
                        onChange={(e) => updateLine(i.product_id, { price: num(e.target.value) })}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(i.product_id, i.qty - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          className="h-8 w-14 text-center"
                          type="number"
                          value={i.qty}
                          onChange={(e) => updateCartQty(i.product_id, e.target.value)}
                        />
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(i.product_id, i.qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8"
                        type="number"
                        step="0.01"
                        min="0"
                        value={i.discount}
                        onChange={(e) => updateLine(i.product_id, { discount: num(e.target.value) })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8"
                        type="number"
                        step="0.01"
                        min="0"
                        value={i.tax}
                        onChange={(e) => updateLine(i.product_id, { tax: num(e.target.value), taxEdited: true })}
                      />
                    </td>
                    <td className="p-2 font-medium">{amount(lineSubtotal(i))}</td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((x) => x.product_id !== i.product_id))}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!cart.length && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">Cart is empty — pick products on the right</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t bg-[#003D82] text-white p-3 text-sm space-y-1">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Items: <strong>{amount(itemsCount, 0)}</strong></span>
              <span>Total: <strong>{money(subtotal)}</strong></span>
              <span>Discount: <strong>{money(discount)}</strong></span>
              <span>Tax: <strong>{money(tax)}</strong></span>
              <span>Shipping: <strong>{money(shipping)}</strong></span>
            </div>
            <div className="text-lg font-bold">Grand Total: {money(grandTotal)}</div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Input className="bg-white/10 border-white/30 text-white h-8" type="number" placeholder="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              <Input className="bg-white/10 border-white/30 text-white h-8" type="number" placeholder="Tax" value={tax} onChange={(e) => setTax(e.target.value)} />
              <Input className="bg-white/10 border-white/30 text-white h-8" type="number" placeholder="Shipping" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </div>
          </div>

          <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t bg-slate-50">
            {QUICK_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                disabled={paying}
                onClick={() => openPay(m)}
                className={cn('rounded-xl py-3 px-2 text-sm font-bold shadow-sm transition disabled:opacity-50', m.className)}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={holdSale}
              className="rounded-xl py-3 px-2 text-sm font-bold shadow-sm bg-slate-600 hover:bg-slate-700 text-white"
            >
              Hold
            </button>
            <button
              type="button"
              onClick={cancelSale}
              className="rounded-xl py-3 px-2 text-sm font-bold shadow-sm bg-red-600 hover:bg-red-700 text-white col-span-2 sm:col-span-4"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* RIGHT: products */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[520px]">
          <div className="bg-[#003D82] text-white px-2 py-1 flex flex-wrap gap-1.5 items-center justify-between min-h-0">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className={cn('h-7 px-2.5 text-xs', filterMode === 'category' ? 'bg-white text-[#003D82]' : 'bg-blue-500 hover:bg-blue-600 text-white')}
                onClick={() => { setFilterMode('category'); setFilterId(categories[0]?.id || ''); }}
              >
                Category
              </Button>
              <Button
                size="sm"
                className={cn('h-7 px-2.5 text-xs', filterMode === 'brand' ? 'bg-white text-[#003D82]' : 'bg-blue-500 hover:bg-blue-600 text-white')}
                onClick={() => { setFilterMode('brand'); setFilterId(brands[0]?.id || ''); }}
              >
                Brand
              </Button>
              <Button
                size="sm"
                className={cn('h-7 px-2.5 text-xs', filterMode === 'featured' ? 'bg-red-500 text-white' : 'bg-red-400 hover:bg-red-500 text-white')}
                onClick={() => { setFilterMode('featured'); setFilterId(''); }}
              >
                Featured
              </Button>
            </div>
            <span className="text-[10px] text-blue-100 leading-none">{register ? 'Register open' : 'No open register'}</span>
          </div>

          {(filterMode === 'category' || filterMode === 'brand') && (
            <div className="px-2 py-1.5 border-b">
              <select
                className="w-full border rounded-md h-8 px-2 text-sm"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              >
                <option value="">All {filterMode === 'category' ? 'categories' : 'brands'}</option>
                {(filterMode === 'category' ? categories : brands).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-auto p-3">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
            ) : (
              <div className={cn('grid gap-2', gridCols)}>
                {filteredProducts.map((p) => {
                  const stock = stockById.get(p.id);
                  const soldOut = posSettings.block_out_of_stock && stock !== null && stock !== undefined && stock <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => addToCart(p)}
                      className={cn(
                        'rounded-xl border border-slate-200 bg-[#f5f7fb] p-2 text-left transition',
                        soldOut ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-[#D4AF37] hover:shadow'
                      )}
                    >
                      <div className="h-20 flex items-center justify-center bg-white rounded-lg border mb-2 overflow-hidden">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <Package className="h-8 w-8 text-slate-300" />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 line-clamp-2 min-h-[2.5em]">{p.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{p.code || String(p.id).slice(0, 8)}</div>
                      <div className="text-sm font-bold text-[#003D82] mt-1">{money(p.price)}</div>
                      {posSettings.show_stock ? (
                        <div className={cn('text-[11px]', soldOut ? 'text-red-600 font-semibold' : 'text-slate-500')}>
                          {soldOut ? 'Out of stock' : `Stock ${stock === null || stock === undefined ? '—' : amount(stock, 0)}`}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
                {!filteredProducts.length && (
                  <div className="col-span-full p-10 text-center text-slate-400">No products found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {payModal && (
        <PaymentModal
          title={payModal.label}
          grandTotal={grandTotal}
          money={money}
          rows={payRows}
          onRowsChange={setPayRows}
          note={note}
          onNoteChange={setNote}
          paying={paying}
          onClose={() => setPayModal(null)}
          onSubmit={confirmPay}
        />
      )}

      {saleComplete && (
        <SaleCompleteModal
          sale={saleComplete}
          money={money}
          onPrint={() => printReceipt(saleComplete.doc)}
          onNewSale={() => { setSaleComplete(null); focusSearch(); }}
        />
      )}

      {showHolds && (
        <HeldSalesModal
          holds={holds}
          money={money}
          dateFormat={dateFormat}
          onResume={resumeHold}
          onDelete={deleteHold}
          onClose={() => setShowHolds(false)}
        />
      )}

      {showRecent && (
        <RecentSalesModal
          sales={recentSales}
          loading={recentLoading}
          money={money}
          dateFormat={dateFormat}
          reprintingId={reprintingId}
          onReprint={reprintSale}
          onRefresh={loadRecentSales}
          onClose={() => setShowRecent(false)}
        />
      )}

      {closeReport && (
        <RegisterCloseModal
          register={register}
          summary={closeReport.summary}
          loading={closeReport.loading}
          closing={closingRegister}
          money={money}
          onPrint={printRegisterReport}
          onConfirm={confirmCloseRegister}
          onClose={() => setCloseReport(null)}
        />
      )}

      {/* Open register modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-bold text-[#003D82]">Open Cash Register</h3>
            <p className="text-sm text-slate-600">A register must be open for this warehouse before POS sales.</p>
            <div className="space-y-2">
              <Label>Cash in hand</Label>
              <Input type="number" value={cashInHand} onChange={(e) => setCashInHand(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRegisterModal(false)}>Later</Button>
              <Button
                className="bg-[#003D82]"
                onClick={async () => {
                  try {
                    await openRegister({ warehouse_id: warehouseId, cash_in_hand: num(cashInHand) });
                    toast.success('Register opened');
                    setShowRegisterModal(false);
                    load(warehouseId);
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Open register
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick customer */}
      {showQuickCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveQuickCustomer} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#003D82]">Add Customer</h3>
              <button type="button" onClick={() => setShowQuickCustomer(false)}><X className="h-5 w-5" /></button>
            </div>
            <div><Label>Name *</Label><Input required value={quickCustomer.name} onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={quickCustomer.phone} onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={quickCustomer.email} onChange={(e) => setQuickCustomer({ ...quickCustomer, email: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]">Save</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
