import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock, Loader2, Menu, Minus, Package, Plus, ScanLine, Search, Star, Tags, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { amount, makeMoney, num, payingMethodLabel } from '@/lib/erpFormat';
import { buildReceiptHtml, loadErpCompany, RECEIPT_STYLES } from '@/lib/erpDocuments';
import { productImageSrc } from '@/lib/erpImages';
import { openPrintWindow } from '@/lib/erpExport';
import { getSystemSettings } from '@/services/settingsService';
import { paymentService } from '@/services/commerceService';
import {
  closeRegister, createCustomer, createPosSale, createProduct, getPosSettings, getRegisterSummary, getSale,
  listBillers, listBrands, listCategories, listCustomers, listProducts, listRecentPosSales,
  listRegisters, listUnits, listWarehouses, openRegister,
} from '@/services/erpService';
import PaymentModal, { paymentTotals } from '@/components/erp/pos/PaymentModal';
import SaleCompleteModal from '@/components/erp/pos/SaleCompleteModal';
import RegisterCloseModal from '@/components/erp/pos/RegisterCloseModal';
import PosVisaModal from '@/components/erp/pos/PosVisaModal';
import SearchSelect from '@/components/erp/SearchSelect';
import { COUNTRIES } from '@/lib/countries';
import { acceptPhone } from '@/lib/phones';
import {
  buildCartReceiptDoc, buildRegisterReportHtml, lineSubtotal,
} from '@/components/erp/pos/posDocs';

/** Beyond Tech quick-pay buttons → erp paying_method + legacy paid_by_id. */
const QUICK_METHODS = [
  { key: 'cash', method: 'cash', paidById: 1, label: 'Cash', icon: '💵', className: 'bg-[#00cec9] hover:bg-[#00b8b4] text-white' },
  { key: 'momo', method: 'momo_mtn', paidById: 8, label: 'MoMo', icon: '📱', className: 'bg-[#da7828] hover:bg-[#c06820] text-white' },
  { key: 'visa', method: 'visa', paidById: 2, label: 'Visa', icon: '💳', className: 'bg-[#1a1f71] hover:bg-[#12164f] text-white' },
];
const POS_PAY_METHODS = QUICK_METHODS.map((m) => ({ value: m.method, label: m.label }));

const PAID_BY_ID = {
  cash: 1, visa: 2, je: 3, deposit: 6, momo_orange: 8, momo_mtn: 8, pay_later: 9, credit: 10, group_credit: 11,
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
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '', address: '', country: 'Rwanda' });
  const [visaOpen, setVisaOpen] = useState(false);
  const [cashInHand, setCashInHand] = useState('0');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [posSettings, setPosSettings] = useState(() => normalizePosSettings(null));
  const [sysSettings, setSysSettings] = useState({});
  const [company, setCompany] = useState({});
  const [saleComplete, setSaleComplete] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 });
  const [closeReport, setCloseReport] = useState(null); // { loading, summary }
  const [closingRegister, setClosingRegister] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [momoWait, setMomoWait] = useState(null);
  const [searchAll, setSearchAll] = useState(() => {
    try { return localStorage.getItem('pos-search-all') === '1'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('pos-expend') === '1'; } catch { return false; }
  });
  const [starOpen, setStarOpen] = useState(false);
  const [starSaving, setStarSaving] = useState(false);
  const [starForm, setStarForm] = useState({ name: '', price: '', category_id: '' });
  const [units, setUnits] = useState([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const searchRef = useRef(null);

  const money = useMemo(() => makeMoney(sysSettings), [sysSettings]);

  const focusSearch = useCallback(() => {
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!momoWait?.depositId) return undefined;
    let stopped = false;
    const finishPaid = async () => {
      try {
        const fresh = await getSale(momoWait.saleId);
        const sale = fresh?.data || fresh || {};
        const doc = buildCartReceiptDoc({
          sale: { ...sale, reference: momoWait.reference, grand_total: momoWait.grandTotal, paid_amount: momoWait.grandTotal },
          items: momoWait.cart,
          warehouseName,
          customer: momoWait.customer,
          cashier: billers.find((b) => String(b.id) === String(billerId))?.name || '',
          discount: momoWait.discount,
          tax: momoWait.tax,
          shipping: momoWait.shipping,
          grandTotal: momoWait.grandTotal,
          paidAmount: momoWait.grandTotal,
          changeAmount: 0,
          payingMethod: momoWait.method,
        });
        setLastReceipt(doc);
        setSaleComplete({
          reference: doc.reference,
          grand_total: doc.grand_total,
          paid_amount: doc.paid_amount,
          change_amount: 0,
          method_label: payingMethodLabel(momoWait.method),
          payment_status_label: 'Fully paid',
          doc,
        });
        clearCart();
        if (posSettings.auto_print_receipt) printReceipt(doc);
        load(warehouseId);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setMomoWait(null);
      }
    };
    const tick = async () => {
      try {
        const status = await paymentService.pawapayStatus(momoWait.depositId);
        if (stopped) return;
        if (status.status === 'completed') {
          toast.success('PawaPay confirmed the payment');
          await finishPaid();
          return;
        }
        if (status.status === 'failed') {
          toast.error(status.message || 'Customer declined the MoMo prompt. Sale is unpaid.');
          setMomoWait(null);
        }
      } catch {
        // keep waiting — network blips should not cancel the prompt
      }
    };
    tick();
    const timer = setInterval(tick, 3000);
    const timeout = setTimeout(() => {
      if (stopped) return;
      toast.message('Still waiting for PawaPay. You can leave this open or check Payments later.');
    }, 90_000);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [momoWait?.depositId]);

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
      const [w, bl, cats, brs, unitRows, rawSettings, sys, comp] = await Promise.all([
        listWarehouses(),
        listBillers(),
        listCategories().catch(() => []),
        listBrands().catch(() => []),
        listUnits().catch(() => []),
        getPosSettings().catch(() => null),
        getSystemSettings().catch(() => null),
        loadErpCompany(),
      ]);
      const settings = normalizePosSettings(rawSettings);
      setWarehouses(w || []);
      setBillers(bl || []);
      setCategories(Array.isArray(cats) ? cats : unwrap(cats));
      setBrands(Array.isArray(brs) ? brs : unwrap(brs));
      setUnits(Array.isArray(unitRows) ? unitRows : unwrap(unitRows));
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
    focusSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => {
      const textMatch = p.name?.toLowerCase().includes(q)
        || String(p.code || '').toLowerCase().includes(q)
        || String(p.barcode || '').toLowerCase().includes(q);
      if (!textMatch) return false;
      if (searchAll) return true;
      const stock = p.tracks_stock === false ? null : num(p.stock_qty);
      return stock === null || stock > 0;
    }).slice(0, 20);
  }, [products, search, searchAll]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return searchMatches;
    if (filterMode === 'featured') return products.filter((p) => p.is_featured);
    if (filterMode === 'category') {
      if (!filterId) return [];
      return products.filter((p) => String(p.category_id) === String(filterId));
    }
    if (filterMode === 'brand') {
      if (!filterId) return [];
      return products.filter((p) => String(p.brand_id) === String(filterId));
    }
    return products;
  }, [products, search, searchMatches, filterMode, filterId]);

  /**
   * `null` means unlimited — either the warehouse has no stock row for that product,
   * or the product is a stockless type (digital, donation, service).
   */
  const stockById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const unlimited = p.tracks_stock === false
        || p.stock_qty === null || p.stock_qty === undefined;
      map.set(p.id, unlimited ? null : num(p.stock_qty));
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
    if (!searchAll && posSettings.block_out_of_stock && stock !== null && stock !== undefined && nextQty > stock) {
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
    if (!searchAll && posSettings.block_out_of_stock && stock !== null && stock !== undefined && next > stock) {
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
    if (methodEntry.method === 'visa') {
      setVisaOpen(true);
      return;
    }
    setPayRows([{ id: 'row-1', method: methodEntry.method, amount: String(Math.round(grandTotal)) }]);
    setPayModal(methodEntry);
  };

  const openDefaultPay = () => {
    const fallback = QUICK_METHODS.some((m) => m.method === posSettings.default_paying_method)
      ? posSettings.default_paying_method
      : 'cash';
    const entry = QUICK_METHODS.find((m) => m.method === fallback) || QUICK_METHODS[0];
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
    const isMomo = primary.method === 'momo_mtn' || primary.method === 'momo_orange';
    const customer = customers.find((c) => c.id === customerId) || {};
    if (isMomo && !String(customer.phone || '').trim()) {
      toast.error('MoMo needs the customer phone (078… or 079…)');
      return;
    }
    // Over-tender is change owed, not an over-payment: never record more than the total.
    const paid = isMomo ? 0 : Math.min(tendered, grandTotal);
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
        customer_phone: customer.phone || undefined,
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
      if (isMomo) {
        if (!sale.momo?.ok) {
          toast.error(sale.momo?.message || 'Could not start PawaPay. Sale is saved as unpaid.');
          setPayModal(null);
          return;
        }
        setPayModal(null);
        setMomoWait({
          depositId: sale.momo.deposit_id,
          saleId: sale.id,
          reference: sale.reference,
          grandTotal,
          customer,
          change,
          method: primary.method,
          cart: [...cart],
          discount,
          tax,
          shipping,
        });
        clearCart();
        return;
      }
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
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaying(false);
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
    if (starOpen) return setStarOpen(false);
    if (recentOpen) return setRecentOpen(false);
    if (showQuickCustomer) return setShowQuickCustomer(false);
    if (payModal) return setPayModal(null);
    if (saleComplete) return setSaleComplete(null);
    if (closeReport) return setCloseReport(null);
    if (showRegisterModal) return setShowRegisterModal(false);
    return undefined;
  };

  const shortcutRef = useRef({});
  shortcutRef.current = {
    enabled: posSettings.enable_keyboard_shortcuts,
    modalOpen: Boolean(payModal || saleComplete || closeReport
      || showRegisterModal || showQuickCustomer || starOpen || recentOpen),
    focusSearch,
    openDefaultPay,
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
    const phone = acceptPhone(quickCustomer.phone);
    if (quickCustomer.phone.trim() && !phone) {
      toast.error('Enter a valid phone such as +250794… or 250794…');
      return;
    }
    try {
      const created = await createCustomer({
        name: quickCustomer.name.trim(),
        phone: phone || null,
        address: quickCustomer.address || null,
        country: quickCustomer.country || 'Rwanda',
        is_active: true,
      });
      const row = created?.data || created;
      toast.success('Customer added');
      setShowQuickCustomer(false);
      setQuickCustomer({ name: '', phone: '', address: '', country: 'Rwanda' });
      const list = await listCustomers('?active=1');
      setCustomers((list || []).filter((x) => x?.id && x?.name));
      if (row?.id) setCustomerId(row.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleSearchAll = () => {
    const next = !searchAll;
    setSearchAll(next);
    try { localStorage.setItem('pos-search-all', next ? '1' : '0'); } catch { /* ignore */ }
    toast.message(next ? 'Searching all products, including those with no stock' : 'Quick search — in-stock products only');
  };

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem('pos-expend', next ? '1' : '0'); } catch { /* ignore */ }
  };

  const openRecent = async () => {
    setRecentOpen(true);
    setRecentLoading(true);
    try {
      const rows = unwrap(await listRecentPosSales({ warehouse_id: warehouseId || undefined, limit: 10 }));
      setRecentSales(rows.slice(0, 10));
    } catch (err) {
      toast.error(err.message);
      setRecentSales([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const saveStarSale = async (e) => {
    e.preventDefault();
    const name = starForm.name.trim();
    const price = num(starForm.price);
    if (!name) {
      toast.error('Product name is required');
      return;
    }
    if (price <= 0) {
      toast.error('Enter a price');
      return;
    }
    setStarSaving(true);
    try {
      const defaultUnit = units.find((u) => u.is_default) || units[0];
      const rentalCat = categories.find((c) => /rent/i.test(c.name || ''));
      const created = await createProduct({
        name,
        price,
        cost: price,
        category_id: starForm.category_id || rentalCat?.id || null,
        unit_id: defaultUnit?.id || null,
        sale_unit_id: defaultUnit?.id || null,
        purchase_unit_id: defaultUnit?.id || null,
        product_type: 'standard',
        rent_price_hour: 0,
        rent_price_day: price,
        rent_price_month: 0,
        is_featured: true,
        is_active: true,
        stocks: warehouseId ? [{ warehouse_id: warehouseId, qty: 1 }] : [],
      });
      const product = created?.data || created;
      toast.success('Star sale product added');
      setStarOpen(false);
      setStarForm({ name: '', price: '', category_id: '' });
      await load(warehouseId);
      if (product?.id) addToCart(product);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarSaving(false);
    }
  };

  const gridCols = GRID_COLS[posSettings.products_per_row] || GRID_COLS[4];

  return (
    <div className="h-full min-h-full bg-[#eef2f8] flex flex-col">
      <div className={cn('flex-1 grid gap-2 p-2 min-h-0', expanded ? 'grid-cols-1' : 'lg:grid-cols-2')}>
        {/* LEFT: cart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[520px]">
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b">
            <Input
              placeholder="Type reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <SearchSelect
              value={warehouseId}
              onChange={(id) => { setWarehouseId(id); load(id); }}
              placeholder="Warehouse…"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              allowClear={false}
              size="sm"
            />
            <SearchSelect
              value={billerId}
              onChange={setBillerId}
              placeholder="Biller…"
              options={billers.map((b) => ({ value: b.id, label: b.name }))}
              size="sm"
            />
          </div>

          <div className="px-4 pt-4 pb-2 flex gap-2 items-center">
            <SearchSelect
              className="flex-1"
              value={customerId}
              onChange={setCustomerId}
              placeholder="Search customer…"
              options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.phone || '' }))}
            />
            <Button type="button" size="icon" className="bg-[#003D82] h-11 w-11" title="Add customer" onClick={() => setShowQuickCustomer(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {!customers.length && (
            <p className="px-4 pb-2 text-xs text-amber-700">
              No customers yet. Use + to add an ERP customer (system users are not customers).
            </p>
          )}

          <div className="px-3 py-2 flex flex-wrap items-center gap-2 border-b bg-white">
            <Button type="button" variant="outline" className="h-9" onClick={() => {
              const rentalCat = categories.find((c) => /rent/i.test(c.name || ''));
              setStarForm({ name: '', price: '', category_id: rentalCat?.id || '' });
              setStarOpen(true);
            }}>
              <Star className="h-4 w-4 mr-1.5 text-[#D4AF37] fill-[#D4AF37]" /> Star Sale
            </Button>
            <Button type="button" variant="outline" className={cn('h-9', searchAll && 'border-[#003D82] text-[#003D82]')} onClick={toggleSearchAll}>
              <Search className="h-4 w-4 mr-1.5" /> {searchAll ? 'Quick Search' : 'Search All Product'}
            </Button>
            <Button type="button" variant="outline" className="h-9" onClick={toggleExpand}>
              <Menu className="h-4 w-4 mr-1.5" /> {expanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          <div className="px-4 py-3 border-y bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={searchRef}
                className="pl-9 pr-10 h-12 text-base bg-white"
                placeholder="Search product name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <ScanLine className="h-4 w-4" />
              </span>
              {search.trim() && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-white shadow-xl">
                  {!searchMatches.length && (
                    <div className="p-3 text-sm text-slate-500">No product matches “{search}”</div>
                  )}
                  {searchMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { addToCart(p); setSearch(''); }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-[#003D82] font-semibold">{money(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-2 py-3">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="p-3 w-[46%]">Product</th>
                  <th className="p-3 w-[22%]">Price</th>
                  <th className="p-3 w-[14%]">Qty</th>
                  <th className="p-3 w-[14%]">SubTotal</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.map((i) => (
                  <tr key={i.product_id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium leading-snug">{i.name}</div>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-10 text-base font-semibold"
                        type="number"
                        step="1"
                        value={i.price}
                        onChange={(e) => updateLine(i.product_id, { price: num(e.target.value) })}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="outline" className="h-7 w-6" onClick={() => updateCartQty(i.product_id, i.qty - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          className="h-8 w-10 text-center px-1"
                          type="number"
                          value={i.qty}
                          onChange={(e) => updateCartQty(i.product_id, e.target.value)}
                        />
                        <Button size="icon" variant="outline" className="h-7 w-6" onClick={() => updateCartQty(i.product_id, i.qty + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2 font-semibold">{amount(lineSubtotal(i), 0)}</td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((x) => x.product_id !== i.product_id))}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!cart.length && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">Cart is empty — pick products on the right</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t px-3 py-2 text-sm flex flex-wrap gap-x-6 gap-y-1 text-slate-700">
            <span>Items: <strong>{amount(itemsCount, 0)}</strong></span>
            <span>Total: <strong>{money(subtotal)}</strong></span>
            <span className="ml-auto text-xs text-slate-500">Today {todayStats.count} · {money(todayStats.total)}</span>
          </div>
          <div className="bg-[#003D82] text-white px-3 py-2 text-lg font-bold">
            Grand total <span className="float-right">{money(grandTotal)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5">
            {QUICK_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                disabled={paying}
                onClick={() => openPay(m)}
                className={cn('py-3.5 px-2 text-sm font-bold shadow-inner transition disabled:opacity-50', m.className)}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={cancelSale}
              className="py-3.5 px-2 text-sm font-bold bg-[#d63031] hover:bg-[#c02627] text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={openRecent}
              className="py-3.5 px-2 text-sm font-bold bg-[#ffc107] hover:bg-[#e0a800] text-slate-900"
            >
              Recent
            </button>
          </div>
        </div>

        {/* RIGHT: products */}
        {!expanded && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[520px]">
          <div className="bg-[#003D82] text-white px-3 py-2 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Button
                className={cn('h-11 px-5 text-sm font-bold', filterMode === 'category' ? 'bg-white text-[#003D82]' : 'bg-blue-500 hover:bg-blue-600 text-white')}
                onClick={() => { setFilterMode('category'); setFilterId(''); setSearch(''); }}
              >
                Category
              </Button>
              <Button
                className={cn('h-11 px-5 text-sm font-bold', filterMode === 'brand' ? 'bg-white text-[#003D82]' : 'bg-blue-500 hover:bg-blue-600 text-white')}
                onClick={() => { setFilterMode('brand'); setFilterId(''); setSearch(''); }}
              >
                Brand
              </Button>
              <Button
                className={cn('h-11 px-5 text-sm font-bold', filterMode === 'featured' ? 'bg-red-500 text-white' : 'bg-red-400 hover:bg-red-500 text-white')}
                onClick={() => { setFilterMode('featured'); setFilterId(''); setSearch(''); }}
              >
                Featured
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
            ) : search.trim() || filterMode === 'featured' || filterId ? (
              <>
                {filterId && (filterMode === 'category' || filterMode === 'brand') && (
                  <button
                    type="button"
                    className="mb-3 text-sm font-semibold text-[#003D82]"
                    onClick={() => setFilterId('')}
                  >
                    ← {filterMode === 'category' ? 'All categories' : 'All brands'}
                  </button>
                )}
                <div className={cn('grid gap-2', gridCols)}>
                  {filteredProducts.map((p) => {
                    const stock = stockById.get(p.id);
                    const soldOut = !searchAll && posSettings.block_out_of_stock && stock !== null && stock !== undefined && stock <= 0;
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
                            <img src={productImageSrc(p.image_url)} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Package className="h-8 w-8 text-slate-300" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 line-clamp-2 min-h-[2.5em]">{p.name}</div>
                        <div className="text-sm font-bold text-[#003D82] mt-1">{money(p.price)}</div>
                      </button>
                    );
                  })}
                  {!filteredProducts.length && (
                    <div className="col-span-full p-10 text-center text-slate-400">
                      {filterMode === 'featured' ? 'No featured products' : 'No products found'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={cn('grid gap-2', gridCols)}>
                {(filterMode === 'brand' ? brands : categories).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilterId(String(item.id))}
                    className="rounded-xl border border-slate-200 bg-[#f5f7fb] p-4 text-left hover:border-[#D4AF37] hover:shadow transition min-h-[110px]"
                  >
                    <div className="h-12 flex items-center justify-center mb-2">
                      <Tags className="h-8 w-8 text-[#003D82]" />
                    </div>
                    <div className="text-sm font-bold text-slate-800 text-center">{item.name}</div>
                  </button>
                ))}
                {!(filterMode === 'brand' ? brands : categories).length && (
                  <div className="col-span-full p-10 text-center text-slate-400">
                    {filterMode === 'brand' ? 'No brands yet' : 'No categories yet'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {visaOpen && (
        <PosVisaModal
          amount={grandTotal}
          currency={String(sysSettings.currency || 'RWF')}
          amountLabel={money(grandTotal)}
          description={`${company.name || 'Alpha Bridge'} POS`}
          onClose={() => setVisaOpen(false)}
          onPaid={async (intentId) => {
            setVisaOpen(false);
            setPaying(true);
            try {
              const customer = customers.find((c) => c.id === customerId) || {};
              const res = await createPosSale({
                warehouse_id: warehouseId,
                customer_id: customerId || null,
                biller_id: billerId || null,
                reference: reference || undefined,
                discount: num(discount),
                tax: num(tax),
                shipping: num(shipping),
                note: note.trim() || undefined,
                paid_amount: grandTotal,
                paying_method: 'visa',
                paid_by_id: 2,
                stripe_payment_intent_id: intentId,
                currency: String(sysSettings.currency || 'RWF'),
                customer_phone: customer.phone || undefined,
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
                customer,
                cashier: billers.find((b) => String(b.id) === String(billerId))?.name || '',
                discount,
                tax,
                shipping,
                grandTotal: num(sale.grand_total, grandTotal),
                paidAmount: num(sale.paid_amount, grandTotal),
                changeAmount: 0,
                payingMethod: 'visa',
              });
              setLastReceipt(doc);
              setSaleComplete({
                reference: doc.reference,
                grand_total: doc.grand_total,
                paid_amount: doc.paid_amount,
                change_amount: 0,
                method_label: 'Visa',
                payment_status_label: 'Fully paid',
                doc,
              });
              toast.success(`POS sale ${doc.reference} complete`);
              clearCart();
              if (posSettings.auto_print_receipt) printReceipt(doc);
              load(warehouseId);
            } catch (e) {
              toast.error(e.message);
            } finally {
              setPaying(false);
            }
          }}
        />
      )}

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
          methods={POS_PAY_METHODS}
        />
      )}

      {momoWait && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3">
            <h2 className="text-xl font-semibold text-[#003D82]">Waiting for MoMo</h2>
            <p className="text-sm text-gray-600">
              Ask the customer to approve {money(momoWait.grandTotal)} on {momoWait.customer?.phone || 'their phone'}.
              {momoWait.reference ? ` Sale ${momoWait.reference} stays unpaid until PawaPay confirms.` : ''}
            </p>
            <div className="flex items-center gap-2 text-[#003D82]">
              <Loader2 className="w-5 h-5 animate-spin" /> Checking PawaPay…
            </div>
            <Button variant="outline" onClick={() => setMomoWait(null)}>Hide and keep waiting</Button>
          </div>
        </div>
      )}

      {saleComplete && (
        <SaleCompleteModal
          sale={saleComplete}
          money={money}
          onPrint={() => printReceipt(saleComplete.doc)}
          onNewSale={() => { setSaleComplete(null); focusSearch(); }}
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
            <div>
              <Label>Phone number</Label>
              <Input
                value={quickCustomer.phone}
                placeholder="+250794… or 250794…"
                onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
              />
            </div>
            <div><Label>Address</Label><Input value={quickCustomer.address} onChange={(e) => setQuickCustomer({ ...quickCustomer, address: e.target.value })} /></div>
            <div>
              <Label>Country</Label>
              <SearchSelect
                className="mt-1"
                value={quickCustomer.country}
                onChange={(country) => setQuickCustomer({ ...quickCustomer, country })}
                options={COUNTRIES}
                placeholder="Search country…"
                allowClear={false}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]">Save</Button>
            </div>
          </form>
        </div>
      )}

      {starOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveStarSale} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#003D82] flex items-center gap-2">
                <Star className="h-5 w-5 fill-[#D4AF37] text-[#D4AF37]" /> Star Sale
              </h3>
              <button type="button" onClick={() => setStarOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div>
              <Label>Name *</Label>
              <Input required value={starForm.name} onChange={(e) => setStarForm({ ...starForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Price *</Label>
              <Input required type="number" min="1" step="1" value={starForm.price} onChange={(e) => setStarForm({ ...starForm, price: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <SearchSelect
                className="mt-1"
                value={starForm.category_id}
                onChange={(category_id) => setStarForm({ ...starForm, category_id })}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStarOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#003D82]" disabled={starSaving}>
                {starSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add to sale
              </Button>
            </div>
          </form>
        </div>
      )}

      {recentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#003D82] flex items-center gap-2">
                <Clock className="h-5 w-5" /> Recent transaction
              </h3>
              <button type="button" onClick={() => setRecentOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {recentLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#003D82]" /></div>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Reference</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className="border-t">
                        <td className="p-2">{String(sale.sale_date || sale.created_at || '').slice(0, 10)}</td>
                        <td className="p-2 font-medium">{sale.reference}</td>
                        <td className="p-2">{sale.customer_name || '—'}</td>
                        <td className="p-2">{money(sale.grand_total)}</td>
                      </tr>
                    ))}
                    {!recentSales.length && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400">No recent POS sales</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
