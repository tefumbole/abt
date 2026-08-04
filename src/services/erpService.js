const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text || res.statusText };
  }
  if (!res.ok) throw new Error(json.error || json.message || `Request failed (${res.status})`);
  return json;
}

export const erpApi = {
  get: (path) => apiJson(`/erp${path}`).then((r) => r.data),
  post: (path, body) => apiJson(`/erp${path}`, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiJson(`/erp${path}`, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => apiJson(`/erp${path}`, { method: 'DELETE' }),
};

export const listCurrencies = () => erpApi.get('/currencies');
export const createCurrency = (body) => erpApi.post('/currencies', body).then((r) => r.data);
export const updateCurrency = (id, body) => erpApi.put(`/currencies/${id}`, body).then((r) => r.data);
export const setDefaultCurrency = (id) => erpApi.post(`/currencies/${id}/set-default`, {}).then((r) => r.data);
export const deleteCurrency = (id) => erpApi.del(`/currencies/${id}`);

export const listWarehouses = () => erpApi.get('/warehouses');
export const createWarehouse = (body) => erpApi.post('/warehouses', body).then((r) => r.data);
export const updateWarehouse = (id, body) => erpApi.put(`/warehouses/${id}`, body).then((r) => r.data);
export const deleteWarehouse = (id) => erpApi.del(`/warehouses/${id}`);

export const listProducts = (warehouseId) =>
  erpApi.get(`/products${warehouseId ? `?warehouse_id=${warehouseId}` : ''}`);
export const createProduct = (body) => erpApi.post('/products', body).then((r) => r.data);
export const updateProduct = (id, body) => erpApi.put(`/products/${id}`, body).then((r) => r.data);
export const deleteProduct = (id) => erpApi.del(`/products/${id}`);
export const listCategories = () => erpApi.get('/products/categories');
export const createCategory = (body) => erpApi.post('/products/categories', body).then((r) => r.data);
export const listBrands = () => erpApi.get('/products/brands');
export const createBrand = (body) => erpApi.post('/products/brands', body).then((r) => r.data);
export const listUnits = () => erpApi.get('/products/units');
export const createUnit = (body) => erpApi.post('/products/units', body).then((r) => r.data);
export const updateUnit = (id, body) => erpApi.put(`/products/units/${id}`, body).then((r) => r.data);
export const setDefaultUnit = (id) => erpApi.post(`/products/units/${id}/set-default`, {}).then((r) => r.data);
export const deleteUnit = (id) => erpApi.del(`/products/units/${id}`);
export const listAdjustments = () => erpApi.get('/products/adjustments/list');
export const createAdjustment = (body) => erpApi.post('/products/adjustments', body).then((r) => r.data);

export const listCustomerGroups = () => erpApi.get('/people/customer-groups');
export const createCustomerGroup = (body) => erpApi.post('/people/customer-groups', body).then((r) => r.data);
export const updateCustomerGroup = (id, body) => erpApi.put(`/people/customer-groups/${id}`, body).then((r) => r.data);
export const deleteCustomerGroup = (id) => erpApi.del(`/people/customer-groups/${id}`);

export const listCustomers = () => erpApi.get('/people/customers');
export const createCustomer = (body) => erpApi.post('/people/customers', body).then((r) => r.data);
export const updateCustomer = (id, body) => erpApi.put(`/people/customers/${id}`, body).then((r) => r.data);
export const deleteCustomer = (id) => erpApi.del(`/people/customers/${id}`);
export const listSuppliers = () => erpApi.get('/people/suppliers');
export const createSupplier = (body) => erpApi.post('/people/suppliers', body).then((r) => r.data);
export const updateSupplier = (id, body) => erpApi.put(`/people/suppliers/${id}`, body).then((r) => r.data);
export const deleteSupplier = (id) => erpApi.del(`/people/suppliers/${id}`);
export const listBillers = () => erpApi.get('/people/billers');
export const createBiller = (body) => erpApi.post('/people/billers', body).then((r) => r.data);
export const updateBiller = (id, body) => erpApi.put(`/people/billers/${id}`, body).then((r) => r.data);
export const deleteBiller = (id) => erpApi.del(`/people/billers/${id}`);

export const listPurchases = (q = '') => erpApi.get(`/purchases${q}`);
export const createPurchase = (body) => erpApi.post('/purchases', body).then((r) => r.data);
export const listSales = (q = '') => erpApi.get(`/sales${q}`);
export const createSale = (body) => erpApi.post('/sales', body).then((r) => r.data);
export const listQuotations = async (q = '') => {
  const API_BASE = import.meta.env.VITE_API_URL || '/api';
  const res = await fetch(`${API_BASE}/erp/quotations${q}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `Request failed (${res.status})`);
  return { data: json.data || [], statusCounts: json.statusCounts || {} };
};
export const getQuotation = (id) => erpApi.get(`/quotations/${id}`);
export const createQuotation = (body) => erpApi.post('/quotations', body).then((r) => r.data);
export const deleteQuotation = (id) => erpApi.del(`/quotations/${id}`);
export const setQuotationStatus = (id, status) =>
  fetch(`${import.meta.env.VITE_API_URL || '/api'}/erp/quotations/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.message || `Request failed (${res.status})`);
    return json;
  });
export const sendQuotationWhatsApp = (id, body = {}) => erpApi.post(`/quotations/${id}/send-whatsapp`, body);
export const convertQuotation = (id) => erpApi.post(`/quotations/${id}/convert-sale`, {});
export const listDeliveries = (q = '') => erpApi.get(`/deliveries${q}`);
export const createDelivery = (body) => erpApi.post('/deliveries', body).then((r) => r.data);
export const sendDeliverySignLink = (id, body = {}) => erpApi.post(`/deliveries/${id}/send-sign-link`, body);

export const getPosSettings = () => erpApi.get('/pos/settings');
export const savePosSettings = (body) => erpApi.put('/pos/settings', body).then((r) => r.data);
export const listRegisters = (q = '') => erpApi.get(`/pos/registers${q}`);
export const openRegister = (body) => erpApi.post('/pos/registers/open', body).then((r) => r.data);
export const closeRegister = (id) => erpApi.post(`/pos/registers/${id}/close`, {}).then((r) => r.data);
export const createPosSale = (body) => erpApi.post('/pos/sale', body).then((r) => r.data);

export const listTransfers = () => erpApi.get('/support/transfers');
export const createTransfer = (body) => erpApi.post('/support/transfers', body).then((r) => r.data);
export const listSaleReturns = () => erpApi.get('/support/sale-returns');
export const createSaleReturn = (body) => erpApi.post('/support/sale-returns', body).then((r) => r.data);
export const listPurchaseReturns = () => erpApi.get('/support/purchase-returns');
export const createPurchaseReturn = (body) => erpApi.post('/support/purchase-returns', body).then((r) => r.data);
export const listExpenseCategories = () => erpApi.get('/support/expense-categories');
export const createExpenseCategory = (body) => erpApi.post('/support/expense-categories', body).then((r) => r.data);
export const listExpenses = (q = '') => erpApi.get(`/support/expenses${q}`);
export const createExpense = (body) => erpApi.post('/support/expenses', body).then((r) => r.data);
export const listErpPayments = (q = '') => erpApi.get(`/support/payments${q}`);
export const createErpPayment = (body) => erpApi.post('/support/payments', body).then((r) => r.data);
export const listAccounts = () => erpApi.get('/support/accounts');
export const createAccount = (body) => erpApi.post('/support/accounts', body).then((r) => r.data);
export const listMoneyTransfers = () => erpApi.get('/support/money-transfers');
export const createMoneyTransfer = (body) => erpApi.post('/support/money-transfers', body).then((r) => r.data);
export const getBalanceSheet = () => erpApi.get('/support/balance-sheet');

export const listBookings = (q = '') => erpApi.get(`/heavy/bookings${q}`);
export const createBooking = (body) => erpApi.post('/heavy/bookings', body).then((r) => r.data);
export const sendBookingSignLink = (id, body = {}) => erpApi.post(`/heavy/bookings/${id}/send-sign-link`, body);
export const listContracts = (q = '') => erpApi.get(`/heavy/contracts${q}`);
export const createContract = (body) => erpApi.post('/heavy/contracts', body).then((r) => r.data);
export const updateContract = (id, body) => erpApi.put(`/heavy/contracts/${id}`, body).then((r) => r.data);
export const listErpLetters = () => erpApi.get('/heavy/letters');
export const createErpLetter = (body) => erpApi.post('/heavy/letters', body).then((r) => r.data);
export const listFixedAssets = () => erpApi.get('/heavy/fixed-assets');
export const createFixedAsset = (body) => erpApi.post('/heavy/fixed-assets', body).then((r) => r.data);
export const disposeFixedAsset = (id) => erpApi.post(`/heavy/fixed-assets/${id}/dispose`, {});
export const listLeaders = () => erpApi.get('/heavy/leaders');
export const createLeader = (body) => erpApi.post('/heavy/leaders', body).then((r) => r.data);
export const updateLeader = (id, body) => erpApi.put(`/heavy/leaders/${id}`, body).then((r) => r.data);
export const deleteLeader = (id) => erpApi.del(`/heavy/leaders/${id}`);

export const publicGetQuotation = (token) =>
  fetch(`${API_BASE}/erp/public/quotation/${token}`).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    return j.data;
  });
export const publicRespondQuotation = (token, body) =>
  fetch(`${API_BASE}/erp/public/quotation/${token}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    return j;
  });
export const publicGetDelivery = (token) =>
  fetch(`${API_BASE}/erp/public/delivery/${token}`).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    return j.data;
  });
export const publicSignDelivery = (token, body) =>
  fetch(`${API_BASE}/erp/public/delivery/${token}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    return j;
  });
export const publicGetBooking = (token) =>
  fetch(`${API_BASE}/erp/public/booking/${token}`).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    return j.data;
  });
export const publicSignBooking = (token) =>
  fetch(`${API_BASE}/erp/public/booking/${token}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    return j;
  });
