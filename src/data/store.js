const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const products = [
  { id: 'coca', code: 'DAL-COCA-1L', sku: 'DAL-COCA-1L', name: 'Coca Cola 1L', categoryId: 'cat_ichimliklar', category: 'Ichimliklar', price: 12000, oldPrice: 13400, stock: 100, image: '', image_url: '', source: 'seed', updated_at: new Date().toISOString(), active: true, orderCount: 0 },
  { id: 'pepsi', code: 'DAL-PEPSI-1L', sku: 'DAL-PEPSI-1L', name: 'Pepsi 1L', categoryId: 'cat_ichimliklar', category: 'Ichimliklar', price: 12000, oldPrice: 13400, stock: 100, image: '', image_url: '', source: 'seed', updated_at: new Date().toISOString(), active: true, orderCount: 0 },
  { id: 'rich', code: 'DAL-RICH-ORANGE-1L', sku: 'DAL-RICH-ORANGE-1L', name: 'Rich Apelsin 1L', categoryId: 'cat_ichimliklar', category: 'Ichimliklar', price: 18000, oldPrice: 20000, stock: 100, image: '', image_url: '', source: 'seed', updated_at: new Date().toISOString(), active: true, orderCount: 0 }
];

const categories = [
  { id: 'cat_ichimliklar', name: 'Ichimliklar', displayName: 'Ichimliklar', icon: '🥤', image_url: '', active: true, productCount: 0 },
  { id: 'cat_shirinliklar', name: 'Shirinliklar', displayName: 'Shirinliklar', icon: '🍬', image_url: '', active: true, productCount: 0 },
  { id: 'cat_sut', name: 'Sut mahsulotlari', displayName: 'Sut mahsulotlari', icon: '🥛', image_url: '', active: true, productCount: 0 },
  { id: 'cat_boshqa', name: 'Boshqa', displayName: 'Boshqa', icon: '📦', image_url: '', active: true, productCount: 0 }
];

const banners = [
  { id: 'banner_1', title: 'Tez yetkazib berish', subtitle: '30 daqiqa ichida buyurtma bering', image_url: '', active: true }
];

const promotions = [
  { id: 'promo_1', title: 'Hafta aksiyasi', description: 'Eng yaxshi narxlar', discount_text: '-20%', active: true }
];

let homeSettings = {
  brandName: 'GlobusMarket',
  locationText: '📍 Тошкент, Чилонзор тумани',
  searchPlaceholder: '🔎 Маҳсулот, бренд ёки тоифани қидиринг',
  heroTitle: 'GlobusMarket',
  heroSubtitle: 'Qulay va tez xarid tajribasi',
  heroBadgeText: '⚡ Бугун бепул доставка',
  bonusTitle: 'Бонус балллар ×2',
  bonusSubtitle: 'Янги ҳафта акцияси: ҳар бир харид учун икки баравар Globus бонус.',
  deliveryTimeText: '30 daqiqa',
  deliveryText: '30 daqiqada yetkazib berish',
  backgroundImageUrl: '',
  accentColor: '#25f48f',
  clickPaymentUrl: '',
  paymePaymentUrl: '',
  cashTermsText: "Men buyurtmani yetkazilganda naqd to‘lashni tasdiqlayman"
};

let customerProfile = {
  name: '',
  phone: '',
  address: ''
};

const cart = new Map();
const orders = [];
let lastUpdated = null;
let orderSequence = 1;

function persistState() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = {
      products,
      categories,
      banners,
      promotions,
      homeSettings,
      customerProfile,
      orders,
      orderSequence,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    lastUpdated = data.savedAt;
  } catch (e) {
    // no-op for demo mode
  }
}

function loadStateFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return false;
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(parsed.products)) { products.splice(0, products.length, ...parsed.products); }
    if (Array.isArray(parsed.categories)) { categories.splice(0, categories.length, ...parsed.categories); }
    if (Array.isArray(parsed.banners)) { banners.splice(0, banners.length, ...parsed.banners); }
    if (Array.isArray(parsed.promotions)) { promotions.splice(0, promotions.length, ...parsed.promotions); }
    if (parsed.homeSettings && typeof parsed.homeSettings === 'object') { homeSettings = { ...homeSettings, ...parsed.homeSettings }; }
    if (parsed.customerProfile && typeof parsed.customerProfile === 'object') { customerProfile = { ...customerProfile, ...parsed.customerProfile }; }
    if (Array.isArray(parsed.orders)) { orders.splice(0, orders.length, ...parsed.orders); }
    if (Number.isFinite(Number(parsed.orderSequence))) orderSequence = Math.max(1, Number(parsed.orderSequence));
    lastUpdated = parsed.savedAt || new Date().toISOString();
    return true;
  } catch (e) {
    return false;
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function ensureCategory(categoryName = 'Boshqa') {
  const normalized = String(categoryName || 'Boshqa').trim() || 'Boshqa';
  let found = categories.find((c) => c.name.toLowerCase() === normalized.toLowerCase());
  if (!found) {
    found = { id: makeId('cat'), name: normalized, displayName: normalized, icon: '', image_url: '', active: true, productCount: 0 };
    categories.push(found);
  }
  return found;
}

function defaultCategoryIcon(name = '') {
  const n = String(name || '').toLowerCase();
  if (n.includes('ichim')) return '🥤';
  if (n.includes('shirin')) return '🍬';
  if (n.includes('sut')) return '🥛';
  if (n.includes("go'sht") || n.includes('gosht')) return '🥩';
  if (n.includes('meva')) return '🍏';
  if (n.includes('блокнот') || n.includes('daftar') || n.includes('тетрад')) return '📒';
  if (n.includes('альбом') || n.includes('rasm') || n.includes('рисов')) return '🎨';
  if (n.includes('азбук') || n.includes('kitob') || n.includes('книга')) return '📚';
  if (n.includes('kantsely') || n.includes('канц') || n.includes('karandash') || n.includes('ручка')) return '✏️';
  if (n.includes('доск')) return '🧱';
  if (n.includes('игр')) return '🎲';
  if (n.includes('калькулятор')) return '🧮';
  if (n.includes('gigien')) return '🧴';
  return '📦';
}

function categoryMetaByName(name = '') {
  const normalized = String(name || '').trim().toLowerCase();
  return categories.find((c) => String(c.name || '').toLowerCase() === normalized) || null;
}

function listProducts(search = '', { activeOnly = false, category = '' } = {}) {
  const q = String(search || '').trim().toLowerCase();
  const categoryQuery = String(category || '').trim().toLowerCase();
  return products
    .filter((p) => (activeOnly ? p.active !== false : true))
    .filter((p) => (categoryQuery ? String(p.category || '').toLowerCase() === categoryQuery : true))
    .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
    .map((p) => {
      const cat = categoryMetaByName(p.category);
      return {
        ...p,
        categoryDisplayName: cat?.displayName || p.category || 'Boshqa',
        categoryIcon: cat?.icon || defaultCategoryIcon(cat?.displayName || p.category),
        categoryImageUrl: cat?.image_url || ''
      };
    });
}

function getProductById(id) {
  return products.find((p) => p.id === id) || null;
}

function getCategories({ activeOnly = false } = {}) {
  const counts = new Map();
  products.forEach((p) => {
    const k = String(p.category || '').toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  return categories
    .filter((c) => (activeOnly ? c.active !== false : true))
    .map((c) => ({
      ...c,
      displayName: c.displayName || c.name,
      icon: c.icon || defaultCategoryIcon(c.displayName || c.name),
      image_url: c.image_url || '',
      productCount: counts.get(String(c.name || '').toLowerCase()) || 0
    }));
}

function getBanners({ activeOnly = false } = {}) {
  return banners.filter((b) => (activeOnly ? b.active !== false : true));
}

function createBanner(payload = {}) {
  const banner = {
    id: makeId('banner'),
    title: payload.title || 'Yangi banner',
    subtitle: payload.subtitle || '',
    image_url: payload.image_url || '',
    active: payload.active !== false
  };
  banners.push(banner);
  persistState();
  return banner;
}

function updateBanner(id, payload = {}) {
  const i = banners.findIndex((x) => x.id === id);
  if (i === -1) return null;
  banners[i] = { ...banners[i], ...payload };
  persistState();
  return banners[i];
}

function deleteBanner(id) {
  const i = banners.findIndex((x) => x.id === id);
  if (i === -1) return false;
  banners.splice(i, 1);
  persistState();
  return true;
}

function getPromotions({ activeOnly = false } = {}) {
  return promotions.filter((p) => (activeOnly ? p.active !== false : true));
}

function createPromotion(payload = {}) {
  const promo = {
    id: makeId('promo'),
    title: payload.title || 'Yangi promo',
    description: payload.description || '',
    discount_text: payload.discount_text || '',
    image_url: payload.image_url || '',
    active: payload.active !== false
  };
  promotions.push(promo);
  persistState();
  return promo;
}

function updatePromotion(id, payload = {}) {
  const i = promotions.findIndex((x) => x.id === id);
  if (i === -1) return null;
  promotions[i] = { ...promotions[i], ...payload };
  persistState();
  return promotions[i];
}

function deletePromotion(id) {
  const i = promotions.findIndex((x) => x.id === id);
  if (i === -1) return false;
  promotions.splice(i, 1);
  persistState();
  return true;
}

function getHomeSettings() {
  return homeSettings;
}

function updateHomeSettings(payload = {}) {
  homeSettings = { ...homeSettings, ...payload };
  persistState();
  return homeSettings;
}

function getCustomerProfile() {
  return customerProfile;
}

function saveCustomerProfile(payload = {}) {
  customerProfile = {
    name: String(payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    address: String(payload.address || '').trim()
  };
  persistState();
  return customerProfile;
}

function updateCategory(id, payload = {}) {
  const i = categories.findIndex((x) => x.id === id);
  if (i === -1) return null;
  categories[i] = {
    ...categories[i],
    ...payload,
    displayName: payload.displayName || payload.name || categories[i].displayName || categories[i].name,
    icon: payload.icon !== undefined ? payload.icon : categories[i].icon,
    image_url: payload.image_url !== undefined ? payload.image_url : categories[i].image_url
  };
  persistState();
  return categories[i];
}

function updateProduct(id, payload = {}) {
  const i = products.findIndex((x) => x.id === id);
  if (i === -1) return null;

  let categoryPatch = {};
  if (payload.categoryId) {
    const cat = categories.find((c) => c.id === payload.categoryId);
    if (cat) categoryPatch = { categoryId: cat.id, category: cat.name };
  } else if (payload.category) {
    const cat = ensureCategory(payload.category);
    categoryPatch = { categoryId: cat.id, category: cat.name };
  }

  products[i] = {
    ...products[i],
    ...payload,
    ...categoryPatch,
    price: payload.price !== undefined ? Number(payload.price) || 0 : products[i].price,
    stock: payload.stock !== undefined ? Number(payload.stock) || 0 : products[i].stock,
    oldPrice: payload.oldPrice !== undefined ? Number(payload.oldPrice) || 0 : products[i].oldPrice
  };
  persistState();
  return products[i];
}

function getCartItems() {
  return products
    .map((p) => ({ product: p, quantity: cart.get(p.id) || 0 }))
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      id: item.product.id,
      name: item.product.name,
      category: item.product.category,
      image_url: item.product.image_url || item.product.image || '',
      price: item.product.price,
      oldPrice: item.product.oldPrice,
      quantity: item.quantity,
      subtotal: item.quantity * item.product.price
    }));
}

function getCartSummary() {
  const items = getCartItems();
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { items, totalQty, subtotal };
}

function setCartItem(productId, quantity) {
  const product = getProductById(productId);
  if (!product) return { error: 'Product not found' };
  const maxStock = Math.max(0, Number(product.stock || 0));
  const qty = Math.max(0, Math.min(Number(quantity) || 0, maxStock));
  if (qty === 0) cart.delete(productId);
  else cart.set(productId, qty);
  return { data: getCartSummary() };
}

function clearCart() {
  cart.clear();
}

function createOrder({
  paymentMethod = 'cash',
  paymentStatus = 'pending',
  cashTermsAccepted = false,
  location = 'Yunusobod, Toshkent',
  locationLat = null,
  locationLng = null,
  locationAccuracy = null,
  addressText = '',
  landmarkText = '',
  deliveryTime = '30 daqiqa',
  deliveryPrice = 12000,
  customerName = 'Mehmon',
  customerPhone = '',
  customerAddress = '',
  customerSelfieUrl = ''
} = {}) {
  const summary = getCartSummary();
  if (summary.totalQty === 0) return { error: 'Cart is empty' };

  // validate stock before order creation
  for (const item of summary.items) {
    const p = getProductById(item.id);
    if (!p) return { error: `Product not found: ${item.id}` };
    const available = Number(p.stock || 0);
    const needed = Number(item.quantity || 0);
    if (needed > available) {
      return { error: `${p.name} uchun qoldiq yetarli emas (${available} ta)` };
    }
  }

  const now = new Date().toISOString();
  const normalizedPaymentMethod = String(paymentMethod || '').toLowerCase();
  const acceptedPaymentMethods = new Set(['cash', 'click', 'payme']);
  if (!acceptedPaymentMethods.has(normalizedPaymentMethod)) {
    return { error: 'To‘lov turi noto‘g‘ri' };
  }
  if (!String(customerName || '').trim() || !String(customerPhone || '').trim()) {
    return { error: "Avval ro‘yxatdan o‘ting" };
  }
  if (!String(customerSelfieUrl || '').trim()) {
    return { error: 'Selfie tasdiq talab qilinadi' };
  }
  const hasGeo = Number.isFinite(Number(locationLat)) && Number.isFinite(Number(locationLng));
  const hasManual = String(addressText || customerAddress || location || '').trim() && String(landmarkText || '').trim();
  if (!hasGeo && !hasManual) {
    return { error: 'Lokatsiya yoki manzil/orientir talab qilinadi' };
  }
  if (normalizedPaymentMethod === 'cash' && !cashTermsAccepted) {
    return { error: 'Naqd to‘lov shartlarini tasdiqlang' };
  }
  const orderItems = summary.items.map((item) => {
    const p = getProductById(item.id) || {};
    return {
      code: p.code || p.sku || p.id || item.id,
      sku: p.sku || p.code || p.id || item.id,
      barcode: p.barcode || p.sku || p.code || p.id || item.id,
      name: item.name,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      subtotal: Number(item.subtotal || 0),
      stock: Number(p.stock || 0),
      image_url: item.image_url || p.image_url || p.image || ''
    };
  });

  const order = {
    id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderNumber: `ORD-${String(orderSequence).padStart(5, '0')}`,
    customerName: String(customerName || 'Mehmon'),
    customerPhone: String(customerPhone || ''),
    customerAddress: String(customerAddress || location || ''),
    customerSelfieUrl: String(customerSelfieUrl || ''),
    created_at: now,
    updated_at: now,
    status: 'new',
    sentToTsdAt: null,
    tsdStatus: '',
    dalionPicked: false,
    pickedAt: null,
    waitingCourierAt: null,
    courierToken: crypto.randomBytes(24).toString('hex'),
    courierTokenUsed: false,
    courierName: '',
    courierPhone: '',
    courierAcceptedAt: null,
    courierDeliveredAt: null,
    deliveredAt: null,
    cancelledAt: null,
    paymentMethod: normalizedPaymentMethod,
    paymentStatus: String(paymentStatus || (normalizedPaymentMethod === 'cash' ? 'cash_pending' : 'pending')),
    cashTermsAccepted: Boolean(cashTermsAccepted),
    location: location || '',
    locationLat: hasGeo ? Number(locationLat) : null,
    locationLng: hasGeo ? Number(locationLng) : null,
    locationAccuracy: hasGeo && Number.isFinite(Number(locationAccuracy)) ? Number(locationAccuracy) : null,
    addressText: String(addressText || customerAddress || location || ''),
    landmarkText: String(landmarkText || ''),
    deliveryTime: deliveryTime || '',
    deliveryPrice: Number(deliveryPrice || 0),
    items: orderItems,
    subtotal: summary.subtotal,
    total: summary.subtotal + deliveryPrice
  };
  orderSequence += 1;

  for (const item of summary.items) {
    const p = getProductById(item.id);
    if (!p) continue;
    p.orderCount = Number(p.orderCount || 0) + Number(item.quantity || 0);
    p.stock = Math.max(0, Number(p.stock || 0) - Number(item.quantity || 0));
    p.updated_at = new Date().toISOString();
  }

  orders.push(order);
  clearCart();
  persistState();

  return { data: order };
}

function getOrders() {
  return orders
    .slice()
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

function getOrderById(id) {
  return orders.find((o) => o.id === id) || null;
}

function getOrderByNumber(orderNumber) {
  return orders.find((o) => String(o.orderNumber || '') === String(orderNumber || '')) || null;
}

function saveOrderFeedback(orderNumber, { rating = 0, comment = '' } = {}) {
  const order = getOrderByNumber(orderNumber);
  if (!order) return null;
  order.feedbackRating = Math.max(1, Math.min(5, Number(rating) || 0));
  order.feedbackComment = String(comment || '').trim();
  order.feedbackAt = new Date().toISOString();
  order.updated_at = order.feedbackAt;
  persistState();
  return order;
}

function applyStatusTimestamps(order, status) {
  const now = new Date().toISOString();
  if (status === 'picking' && !order.pickerStartedAt) order.pickerStartedAt = now;
  if (status === 'picked' && !order.pickedAt) order.pickedAt = now;
  if (status === 'sent_to_tsd' && !order.sentToTsdAt) order.sentToTsdAt = now;
  if (status === 'waiting_courier' && !order.waitingCourierAt) order.waitingCourierAt = now;
  if (status === 'waiting_courier' && !order.courierWaitingAt) order.courierWaitingAt = now;
  if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = now;
  if (status === 'cancelled' && !order.cancelledAt) order.cancelledAt = now;
}

function updateOrderStatus(id, status) {
  const allowed = new Set(['new', 'picking', 'picked', 'sent_to_tsd', 'waiting_courier', 'out_for_delivery', 'delivered', 'cancelled']);
  if (!allowed.has(status)) return null;
  const order = getOrderById(id);
  if (!order) return null;
  order.status = status;
  order.updated_at = new Date().toISOString();
  applyStatusTimestamps(order, status);
  persistState();
  return order;
}

function cancelOrder(id) {
  return updateOrderStatus(id, 'cancelled');
}

function getOrderPicklist(id) {
  const order = getOrderById(id);
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    items: (order.items || []).map((item) => ({
      code: item.code || '',
      sku: item.sku || item.code || '',
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      barcode: item.barcode || item.sku || item.code || '',
      image_url: item.image_url || ''
    }))
  };
}

function sendOrderToTsd(id) {
  const order = getOrderById(id);
  if (!order) return null;
  order.status = 'sent_to_tsd';
  order.tsdStatus = 'queued';
  order.tsdQueuedAt = new Date().toISOString();
  order.sentToTsdAt = order.sentToTsdAt || order.tsdQueuedAt;
  order.updated_at = new Date().toISOString();
  // TODO: Data Mobile API integration should be connected here.
  persistState();
  return { ok: true, message: "Order TSD queue ga qo‘shildi", order };
}

function markDalionPicked(id) {
  const order = getOrderById(id);
  if (!order) return null;
  order.status = 'waiting_courier';
  order.dalionPicked = true;
  order.pickedAt = new Date().toISOString();
  order.waitingCourierAt = order.pickedAt;
  order.updated_at = new Date().toISOString();
  persistState();
  return order;
}

function getOrderByCourierToken(token) {
  return orders.find((o) => o.courierToken === token) || null;
}

function courierAccept(token, { courierName = '', courierPhone = '' } = {}) {
  const order = getOrderByCourierToken(token);
  if (!order) return { error: 'Invalid token' };
  if (order.courierTokenUsed) return { error: 'Bu QR kod allaqachon ishlatilgan' };
  if (order.status !== 'waiting_courier') return { error: 'Buyurtma hali courier qabul bosqichida emas' };
  order.status = 'out_for_delivery';
  order.courierName = String(courierName || order.courierName || '').trim();
  order.courierPhone = String(courierPhone || order.courierPhone || '').trim();
  order.courierAcceptedAt = new Date().toISOString();
  order.updated_at = order.courierAcceptedAt;
  persistState();
  return { order };
}

function courierDeliver(token) {
  const order = getOrderByCourierToken(token);
  if (!order) return { error: 'Invalid token' };
  if (order.courierTokenUsed) return { error: 'Bu QR kod allaqachon ishlatilgan' };
  if (order.status !== 'out_for_delivery') return { error: 'Buyurtma courierda emas' };
  order.status = 'delivered';
  order.deliveredAt = new Date().toISOString();
  order.courierDeliveredAt = order.deliveredAt;
  order.courierTokenUsed = true;
  order.updated_at = order.deliveredAt;
  persistState();
  return { order };
}

function upsertProducts(items = []) {
  const touched = [];

  for (const raw of items) {
    if (!raw || !raw.id) continue;
    const i = products.findIndex((p) => p.id === raw.id);
    const categoryRef = ensureCategory(raw.category || 'Boshqa');

    const normalized = {
      id: raw.id,
      code: raw.code || raw.sku || raw.id,
      sku: raw.sku || raw.id,
      name: raw.name || 'Nomsiz mahsulot',
      categoryId: raw.categoryId || categoryRef.id,
      category: raw.category || categoryRef.name,
      price: Number(raw.price) || 0,
      oldPrice: Number(raw.oldPrice) || Number(raw.price) || 0,
      stock: Number(raw.stock ?? 0),
      image: raw.image || raw.image_url || '',
      image_url: raw.image_url || raw.image || '',
      source: raw.source || 'excel',
      updated_at: raw.updated_at || new Date().toISOString(),
      active: raw.active !== false,
      orderCount: Number(raw.orderCount ?? 0)
    };

    if (i === -1) {
      products.push(normalized);
      touched.push(normalized.id);
    } else {
      products[i] = { ...products[i], ...normalized };
      touched.push(products[i].id);
    }
  }

  persistState();

  return touched;
}

function getStoreSummary() {
  return {
    products: products.length,
    categories: categories.length,
    banners: banners.length,
    promotions: promotions.length,
    orders: orders.length,
    lastUpdated,
    storageMode: 'file+memory'
  };
}

function reloadStoreFromDisk() {
  const ok = loadStateFromDisk();
  return { ok, ...getStoreSummary() };
}

loadStateFromDisk();

module.exports = {
  // state sections
  products,
  categories,
  banners,
  promotions,
  // public getters
  listProducts,
  getProductById,
  getCategories,
  getBanners,
  getPromotions,
  getHomeSettings,
  getCustomerProfile,
  // admin operations
  createBanner,
  updateBanner,
  deleteBanner,
  createPromotion,
  updatePromotion,
  deletePromotion,
  updateHomeSettings,
  saveCustomerProfile,
  updateCategory,
  updateProduct,
  // cart/order/import
  getCartSummary,
  setCartItem,
  clearCart,
  createOrder,
  upsertProducts,
  getStoreSummary,
  reloadStoreFromDisk,
  getOrders,
  getOrderById,
  getOrderByNumber,
  saveOrderFeedback,
  updateOrderStatus,
  cancelOrder,
  getOrderPicklist,
  sendOrderToTsd,
  markDalionPicked,
  getOrderByCourierToken,
  courierAccept,
  courierDeliver,
  orders
};
