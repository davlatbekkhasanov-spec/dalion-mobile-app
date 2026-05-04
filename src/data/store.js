const crypto = require('crypto');
const storageAdapter = require('../storage/file-storage.adapter.js');
const {
  ORDER_STATUS_LIST,
  ORDER_STATUSES,
  PAYMENT_METHOD_LIST,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  STORE_LOCATION
} = require('../constants/domain.constants.js');

const products = [];

const categories = [
  { id: 'cat_kanselyariya', name: 'Kanselyariya', displayName: 'Kanselyariya', icon: '✏️', image_url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80', active: true, productCount: 0 },
  { id: 'cat_ofis_jihozlari', name: 'Ofis jihozlari', displayName: 'Ofis jihozlari', icon: '🪑', image_url: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=80', active: true, productCount: 0 },
  { id: 'cat_kompyuter_aksessuarlari', name: 'Kompyuter aksessuarlari', displayName: 'Kompyuter aksessuarlari', icon: '🖱️', image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80', active: true, productCount: 0 },
  { id: 'cat_usb_kabellar', name: 'USB va kabellar', displayName: 'USB va kabellar', icon: '🔌', image_url: 'https://images.unsplash.com/photo-1587134160474-cd7f6c09d1a5?auto=format&fit=crop&w=900&q=80', active: true, productCount: 0 },
  { id: 'cat_ichimliklar', name: 'Ichimliklar', displayName: 'Ichimliklar', icon: '🥤', image_url: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80', active: true, productCount: 0 },
];

const banners = [
  { id: 'banner_1', title: 'Tez yetkazib berish', subtitle: '30 daqiqa ichida buyurtma bering', image_url: '', active: true }
];

const promotions = [
  { id: 'promo_1', title: 'Hafta aksiyasi', description: 'Eng yaxshi narxlar', discount_text: '-20%', active: true, promo_code: '', discount_percent: 0 }
];

const promoCodes = [];

let homeSettings = {
  brandName: 'GlobusMarket',
  locationText: '📍 Samarqand, Shohrux Mirzo 33',
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
  cashTermsText: "Men buyurtmani yetkazilganda naqd to‘lashni tasdiqlayman",
  defaultMarginPercent: 0
};

const users = new Map();
const carts = new Map();
const orders = [];
let lastUpdated = null;
let orderSequence = 1;
const ORDER_STATUS_SET = new Set([...ORDER_STATUS_LIST, 'created', 'payment_pending', 'payment_confirmed', 'preparing', 'ready_for_courier', 'courier_assigned', 'returned']);
const ORDER_TRANSITIONS = {
  created: new Set(['payment_pending', 'payment_confirmed', 'cancelled']),
  payment_pending: new Set(['payment_confirmed', 'cancelled']),
  payment_confirmed: new Set(['preparing', 'cancelled']),
  preparing: new Set(['ready_for_courier', 'cancelled']),
  ready_for_courier: new Set(['courier_assigned', 'cancelled']),
  courier_assigned: new Set(['out_for_delivery', 'cancelled']),
  out_for_delivery: new Set(['delivered', 'cancelled', 'returned']),
  delivered: new Set([]),
  cancelled: new Set([]),
  returned: new Set([])
};
const orderStatusLogs = [];

function normalizeOrderStatus(status = '') {
  const raw = String(status || '').trim();
  if (ORDER_STATUS_SET.has(raw)) return raw;
  const legacyMap = {
    queued: 'preparing',
    accepted: 'preparing',
    picking: 'preparing',
    picked: 'ready_for_courier',
    waiting_courier: 'ready_for_courier',
    waiting: 'ready_for_courier',
    sent_to_tsd: 'payment_confirmed',
    in_delivery: 'out_for_delivery',
    done: 'delivered'
  };
  return legacyMap[raw] || 'created';
}

function persistState() {
  try {
    const data = {
      products,
      categories,
      banners,
      promotions,
      promoCodes,
      homeSettings,
      users: Array.from(users.values()),
      carts: Array.from(carts.entries()).map(([phone, cart]) => ({
        phone,
        items: Array.from(cart.entries()).map(([productId, quantity]) => ({ productId, quantity }))
      })),
      orders,
      orderSequence,
      savedAt: new Date().toISOString()
    };
    storageAdapter.writeJson(data);
    lastUpdated = data.savedAt;
  } catch (e) {
    // no-op for demo mode
  }
}

function loadStateFromDisk() {
  try {
    const parsed = storageAdapter.readJson();
    if (!parsed) return false;
    if (Array.isArray(parsed.products)) { products.splice(0, products.length, ...parsed.products); }
    if (Array.isArray(parsed.categories)) { categories.splice(0, categories.length, ...parsed.categories); }
    if (Array.isArray(parsed.banners)) { banners.splice(0, banners.length, ...parsed.banners); }
    if (Array.isArray(parsed.promotions)) { promotions.splice(0, promotions.length, ...parsed.promotions); }
    if (Array.isArray(parsed.promoCodes)) { promoCodes.splice(0, promoCodes.length, ...parsed.promoCodes); }
    if (parsed.homeSettings && typeof parsed.homeSettings === 'object') { homeSettings = { ...homeSettings, ...parsed.homeSettings }; }
    if (Array.isArray(parsed.users)) {
      users.clear();
      parsed.users.forEach((user) => {
        const phone = String(user?.phone || '').replace(/\s+/g, '');
        if (!phone) return;
        users.set(phone, {
          phone,
          name: String(user?.name || '').trim(),
          address: String(user?.address || '').trim(),
          phoneVerified: Boolean(user?.phoneVerified),
          otpVerifiedAt: user?.otpVerifiedAt || null,
          createdAt: user?.createdAt || new Date().toISOString(),
          updatedAt: user?.updatedAt || new Date().toISOString()
        });
      });
    }
    if (Array.isArray(parsed.carts)) {
      carts.clear();
      parsed.carts.forEach((entry) => {
        const phone = String(entry?.phone || '').replace(/\s+/g, '');
        if (!phone) return;
        const cart = new Map();
        (entry?.items || []).forEach((item) => {
          const productId = String(item?.productId || '').trim();
          const quantity = Number(item?.quantity || 0);
          if (!productId || quantity <= 0) return;
          cart.set(productId, quantity);
        });
        carts.set(phone, cart);
      });
    }
    if (!users.size && parsed.customerProfile && typeof parsed.customerProfile === 'object') {
      const legacyPhone = String(parsed.customerProfile.phone || '').replace(/\s+/g, '');
      if (legacyPhone) {
        users.set(legacyPhone, {
          phone: legacyPhone,
          name: String(parsed.customerProfile.name || '').trim(),
          address: String(parsed.customerProfile.address || '').trim(),
          phoneVerified: false,
          otpVerifiedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    if (!carts.size && parsed.cart && parsed.customerProfile?.phone) {
      const legacyPhone = String(parsed.customerProfile.phone || '').replace(/\s+/g, '');
      if (legacyPhone) {
        const legacyCart = new Map();
        Object.entries(parsed.cart || {}).forEach(([productId, quantity]) => {
          const qty = Number(quantity || 0);
          if (qty > 0) legacyCart.set(productId, qty);
        });
        carts.set(legacyPhone, legacyCart);
      }
    }
    if (Array.isArray(parsed.orders)) {
      orders.splice(0, orders.length, ...parsed.orders.map((o) => ({ ...o, status: normalizeOrderStatus(o?.status) })));
    }
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
    active: payload.active !== false,
    action_type: payload.action_type || '',
    action_value: payload.action_value || ''
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
    active: payload.active !== false,
    promo_code: String(payload.promo_code || '').trim().toUpperCase(),
    discount_percent: Math.max(0, Math.min(100, Number(payload.discount_percent || 0)))
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

function normalizePhone(phone = '') {
  return String(phone || '').replace(/\s+/g, '');
}

function getUserByPhone(phone = '') {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return users.get(normalized) || null;
}

function upsertUser(payload = {}) {
  const phone = normalizePhone(payload.phone);
  if (!phone) return null;
  const existing = users.get(phone);
  const now = new Date().toISOString();
  const user = {
    phone,
    name: String(payload.name ?? existing?.name ?? '').trim(),
    address: String(payload.address ?? existing?.address ?? '').trim(),
    phoneVerified: payload.phoneVerified !== undefined ? Boolean(payload.phoneVerified) : Boolean(existing?.phoneVerified),
    otpVerifiedAt: payload.otpVerifiedAt !== undefined ? (payload.otpVerifiedAt || null) : (existing?.otpVerifiedAt || null),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  users.set(phone, user);
  persistState();
  return user;
}

function markPhoneVerified(phone = '') {
  const existing = getUserByPhone(phone);
  if (!existing) return null;
  return upsertUser({
    ...existing,
    phone: existing.phone,
    phoneVerified: true,
    otpVerifiedAt: new Date().toISOString()
  });
}

function getOrCreateCart(phone = '') {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  if (!carts.has(normalized)) carts.set(normalized, new Map());
  return carts.get(normalized);
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

  const nextPrice = payload.price !== undefined ? Math.max(0, Number(payload.price) || 0) : Math.max(0, Number(products[i].price || 0));
  const discountPercent = payload.discount_percent !== undefined ? Math.max(0, Math.min(100, Number(payload.discount_percent) || 0)) : Math.max(0, Math.min(100, Number(products[i].discount_percent || 0)));
  const discountedPrice = discountPercent > 0 ? Math.max(0, Math.round(nextPrice * (1 - (discountPercent / 100)))) : nextPrice;
  products[i] = {
    ...products[i],
    ...payload,
    ...categoryPatch,
    discount_percent: discountPercent,
    oldPrice: discountPercent > 0 ? nextPrice : 0,
    old_price: discountPercent > 0 ? nextPrice : 0,
    price: discountedPrice,
    stock: payload.stock !== undefined ? Number(payload.stock) || 0 : products[i].stock
  };
  persistState();
  return products[i];
}

function getCartItems(phone = '') {
  const cart = getOrCreateCart(phone);
  if (!cart) return [];
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

function getCartSummary(phone = '') {
  const items = getCartItems(phone);
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { items, totalQty, subtotal };
}

function setCartItem(phone, productId, quantity) {
  const cart = getOrCreateCart(phone);
  if (!cart) return { error: 'Foydalanuvchi topilmadi' };
  const product = getProductById(productId);
  if (!product) return { error: 'Product not found' };
  const maxStock = Math.max(0, Number(product.stock || 0));
  const qty = Math.max(0, Math.min(Number(quantity) || 0, maxStock));
  if (qty === 0) cart.delete(productId);
  else cart.set(productId, qty);
  persistState();
  return { data: getCartSummary(phone) };
}

function clearCart(phone = '') {
  const cart = getOrCreateCart(phone);
  if (!cart) return;
  cart.clear();
  persistState();
}


function getPromoCodes() {
  return promoCodes.slice();
}

function upsertPromoCode(payload = {}) {
  const code = String(payload.promo_code || payload.code || '').trim().toUpperCase();
  if (!code) return null;
  const discount_percent = Math.max(0, Math.min(100, Number(payload.discount_percent || 0)));
  const i = promoCodes.findIndex((x) => x.promo_code === code);
  const row = { promo_code: code, discount_percent, active: payload.active !== false };
  if (i === -1) promoCodes.push(row);
  else promoCodes[i] = { ...promoCodes[i], ...row };
  persistState();
  return row;
}

function createOrder({
  paymentMethod = 'cash',
  paymentStatus = '',
  cashTermsAccepted = false,
  location = STORE_LOCATION.address,
  locationLat = null,
  locationLng = null,
  locationAccuracy = null,
  addressText = '',
  landmarkText = '',
  deliveryTime = '',
  deliveryPrice = 0,
  userPhone = '',
  customerSelfieUrl = '',
  paymentProofUrl = '',
  cashAgreementConfirmed = false,
  cashAgreementConfirmedAt = null,
  authMethod = '',
  cashAgreementTextVersion = 'draft-v1',
  cashAgreementAccepted = false,
  cashAgreementAcceptedAt = null,
  promoCode = ''
} = {}) {
  const normalizedUserPhone = normalizePhone(userPhone);
  if (!normalizedUserPhone) return { error: "Avval ro‘yxatdan o‘ting" };
  const user = getUserByPhone(normalizedUserPhone);
  if (!user || !String(user.name || '').trim()) return { error: "Avval ro‘yxatdan o‘ting" };
  const summary = getCartSummary(normalizedUserPhone);
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
  const acceptedPaymentMethods = new Set(PAYMENT_METHOD_LIST);
  if (!acceptedPaymentMethods.has(normalizedPaymentMethod)) {
    return { error: 'To‘lov turi noto‘g‘ri' };
  }
  const customerAddress = String(user.address || addressText || location || '').trim();
  const latNum = Number(locationLat);
  const lngNum = Number(locationLng);
  const hasGeoInput = locationLat !== null && locationLat !== undefined && locationLat !== '' && locationLng !== null && locationLng !== undefined && locationLng !== '';
  const hasGeo = hasGeoInput && Number.isFinite(latNum) && Number.isFinite(lngNum) && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180;
  const hasManual = String(addressText || customerAddress || location || '').trim();
  if (!hasGeo && !hasManual) {
    return { error: 'Lokatsiya yoki manzil talab qilinadi' };
  }
  if (normalizedPaymentMethod === PAYMENT_METHODS.CASH && !cashAgreementAccepted) {
    return { error: 'Naqd to‘lov shartlarini tasdiqlang' };
  }
  const orderItems = summary.items.map((item) => {
    const p = getProductById(item.id) || {};
    return {
      id: item.id,
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

  const baseDeliveryPrice = 18500;
  const pricePerKmAfterBase = 4000;
  const baseDistanceKm = 4;
  const freeDeliveryThreshold = Number(process.env.FREE_DELIVERY_THRESHOLD || 0);
  let deliveryDistanceKm = null;
  if (hasGeo) {
    const toRad = (deg) => (Number(deg) * Math.PI) / 180;
    const earthKm = 6371;
    const dLat = toRad(latNum - STORE_LOCATION.lat);
    const dLng = toRad(lngNum - STORE_LOCATION.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(STORE_LOCATION.lat)) * Math.cos(toRad(latNum)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    deliveryDistanceKm = Math.max(0, earthKm * c);
  }
  const subtotal = Number(summary.subtotal || 0);
  const normalizedPromoCode = String(promoCode || '').trim().toUpperCase();
  const promo = promoCodes.find((x) => x.active !== false && x.promo_code === normalizedPromoCode);
  const promoDiscountPercent = Math.max(0, Math.min(100, Number(promo?.discount_percent || 0)));
  const promoDiscountAmount = Math.max(0, Math.round(subtotal * (promoDiscountPercent / 100)));
  const freeDelivery = Number.isFinite(freeDeliveryThreshold) && freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold;
  const rawDeliveryPrice = deliveryDistanceKm === null
    ? null
    : (deliveryDistanceKm <= baseDistanceKm
      ? baseDeliveryPrice
      : baseDeliveryPrice + ((deliveryDistanceKm - baseDistanceKm) * pricePerKmAfterBase));
  const roundedDeliveryPrice = rawDeliveryPrice === null ? null : Math.round(rawDeliveryPrice / 500) * 500;
  const computedDeliveryPrice = freeDelivery ? 0 : roundedDeliveryPrice;
  const deliveryZone = deliveryDistanceKm === null ? 'unknown' : (deliveryDistanceKm <= 3 ? 'near' : (deliveryDistanceKm <= 7 ? 'mid' : 'far'));

  const order = {
    id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderNumber: `ORD-${String(orderSequence).padStart(5, '0')}`,
    order_number: `ORD-${String(orderSequence).padStart(5, '0')}`,
    customerName: String(user.name || 'Mehmon'),
    customerPhone: normalizedUserPhone,
    customerAddress: String(customerAddress || location || ''),
    customerSelfieUrl: String(customerSelfieUrl || ''),
    created_at: now,
    updated_at: now,
    status: normalizedPaymentMethod === PAYMENT_METHODS.CASH ? 'created' : 'payment_pending',
    sentToTsdAt: null,
    tsdStatus: '',
    dalionPicked: false,
    pickedAt: null,
    waitingCourierAt: null,
    courierToken: crypto.randomBytes(24).toString('hex'),
    courierTokenUsed: false,
    courierName: '',
    courierPhone: '',
    courier_id: '',
    delivery_status: 'new',
    assigned_at: null,
    picked_up_at: null,
    delivered_at: null,
    courierAcceptedAt: null,
    courierDeliveredAt: null,
    courierLocationLat: null,
    courierLocationLng: null,
    courierLocationAccuracy: null,
    courierLocationUpdatedAt: null,
    courierTrackingStartedAt: null,
    courierTrackingStoppedAt: null,
    courierTrackingHeartbeatAt: null,
    deliveredAt: null,
    cancelledAt: null,
    paymentMethod: normalizedPaymentMethod,
    payment_method: normalizedPaymentMethod,
    paymentStatus: String(paymentStatus || (normalizedPaymentMethod === PAYMENT_METHODS.CASH ? 'unpaid' : 'pending')),
    payment_status: String(paymentStatus || (normalizedPaymentMethod === PAYMENT_METHODS.CASH ? 'unpaid' : 'pending')),
    cashTermsAccepted: Boolean(cashTermsAccepted),
    paymentProofUrl: String(paymentProofUrl || ''),
    cashAgreementConfirmed: Boolean(cashAgreementConfirmed),
    cashAgreementConfirmedAt: cashAgreementConfirmedAt || (cashAgreementConfirmed ? now : null),
    authMethod: String(authMethod || ''),
    cashAgreementTextVersion: String(cashAgreementTextVersion || 'draft-v1'),
    cashAgreementAccepted: Boolean(cashAgreementAccepted),
    cashAgreementAcceptedAt: cashAgreementAcceptedAt || (cashAgreementAccepted ? now : null),
    location: String(location || addressText || customerAddress || ''),
    locationLat: hasGeo ? latNum : null,
    locationLng: hasGeo ? lngNum : null,
    locationAccuracy: hasGeo && Number.isFinite(Number(locationAccuracy)) ? Number(locationAccuracy) : null,
    addressText: String(addressText || customerAddress || location || ''),
    landmarkText: String(landmarkText || ''),
    deliveryTime: deliveryTime || '',
    deliveryPrice: Number(computedDeliveryPrice || 0),
    delivery_price: Number(computedDeliveryPrice || 0),
    delivery_distance: deliveryDistanceKm === null ? null : Number(deliveryDistanceKm.toFixed(2)),
    delivery_distance_km: deliveryDistanceKm === null ? null : Number(deliveryDistanceKm.toFixed(2)),
    delivery_address: String(addressText || customerAddress || location || ''),
    delivery_lat: hasGeo ? latNum : null,
    delivery_lng: hasGeo ? lngNum : null,
    delivery_zone: deliveryZone,
    items: orderItems,
    subtotal,
    promoCode: promo?.promo_code || '',
    promoDiscountPercent: promoDiscountPercent || 0,
    promoDiscountAmount,
    total: Math.max(0, subtotal - promoDiscountAmount) + computedDeliveryPrice
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
  clearCart(normalizedUserPhone);
  persistState();

  return { data: order };
}

function getCustomerOrders(phone = '') {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  return getOrders().filter((o) => String(o.customerPhone || '').replace(/\s+/g, '') === normalized);
}

function attachPaymentProof(orderNumber, { paymentProofUrl = '' } = {}) {
  const order = getOrderByNumber(orderNumber);
  if (!order) return null;
  order.paymentProofUrl = String(paymentProofUrl || '');
  order.paymentStatus = PAYMENT_STATUSES.PROOF_UPLOADED;
  order.updated_at = new Date().toISOString();
  persistState();
  return order;
}

function markOrderPaid(id) {
  const order = getOrderById(id);
  if (!order) return null;
  if (String(order.status) === 'cancelled' || String(order.status) === ORDER_STATUSES.CANCELLED) return null;
  if (String(order.status) === 'delivered' || String(order.status) === ORDER_STATUSES.DELIVERED) return null;
  const now = new Date().toISOString();
  order.paymentStatus = 'paid';
  order.payment_status = 'paid';
  if (order.status === 'payment_pending' || order.status === 'created' || order.status === ORDER_STATUSES.NEW) {
    order.status = 'payment_confirmed';
  }
  order.paidAt = order.paidAt || now;
  order.updated_at = now;
  persistState();
  return order;
}

function markOrderPaymentCancelled(id) {
  const order = getOrderById(id);
  if (!order) return null;
  if (String(order.status) === 'delivered' || String(order.status) === ORDER_STATUSES.DELIVERED) return null;
  if (String(order.paymentStatus) === 'paid') return null;
  const now = new Date().toISOString();
  order.paymentStatus = 'cancelled';
  order.payment_status = 'cancelled';
  if (order.status === 'payment_pending' || order.status === 'created') order.status = 'cancelled';
  order.updated_at = now;
  persistState();
  return order;
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
  if (status === ORDER_STATUSES.PICKING && !order.pickerStartedAt) order.pickerStartedAt = now;
  if (status === ORDER_STATUSES.PICKED && !order.pickedAt) order.pickedAt = now;
  if (status === ORDER_STATUSES.SENT_TO_TSD && !order.sentToTsdAt) order.sentToTsdAt = now;
  if (status === ORDER_STATUSES.WAITING_COURIER && !order.waitingCourierAt) order.waitingCourierAt = now;
  if (status === ORDER_STATUSES.WAITING_COURIER && !order.courierWaitingAt) order.courierWaitingAt = now;
  if (status === ORDER_STATUSES.DELIVERED && !order.deliveredAt) order.deliveredAt = now;
  if (status === ORDER_STATUSES.CANCELLED && !order.cancelledAt) order.cancelledAt = now;
  if ((status === ORDER_STATUSES.DELIVERED || status === ORDER_STATUSES.CANCELLED) && !order.courierTrackingStoppedAt) order.courierTrackingStoppedAt = now;
}

function restoreStockForCancelledOrder(order) {
  if (!order || order.stockRestoredAt) return;
  for (const item of order.items || []) {
    const p = getProductById(item.id);
    if (!p) continue;
    p.stock = Math.max(0, Number(p.stock || 0) + Math.max(0, Number(item.quantity || 0)));
    p.updated_at = new Date().toISOString();
  }
  order.stockRestoredAt = new Date().toISOString();
}

function updateOrderStatus(id, status) {
  if (!ORDER_STATUS_SET.has(status)) return null;
  const order = getOrderById(id);
  if (!order) return null;
  const fromStatus = normalizeOrderStatus(order.status);
  const toStatus = normalizeOrderStatus(status);
  if (fromStatus === 'delivered' && toStatus !== 'delivered') return null;
  const allowed = ORDER_TRANSITIONS[fromStatus] || new Set();
  if (!allowed.has(toStatus) && !(toStatus === 'cancelled' && fromStatus !== 'delivered')) return null;
  if (toStatus === 'cancelled' && fromStatus !== 'delivered' && fromStatus !== 'cancelled') {
    restoreStockForCancelledOrder(order);
  }
  order.status = toStatus;
  if (toStatus === 'courier_assigned') order.assigned_at = new Date().toISOString();
  if (toStatus === 'out_for_delivery') order.picked_up_at = new Date().toISOString();
  if (toStatus === 'delivered') order.delivered_at = new Date().toISOString();
  order.delivery_status = toStatus;
  order.updated_at = new Date().toISOString();
  applyStatusTimestamps(order, toStatus);
  orderStatusLogs.push({ order_id: order.id, from_status: fromStatus, to_status: toStatus, actor: 'admin', note: '', created_at: order.updated_at });
  persistState();
  return order;
}

function cancelOrder(id) {
  return updateOrderStatus(id, ORDER_STATUSES.CANCELLED);
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
  order.status = 'preparing';
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
  order.status = 'ready_for_courier';
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
  if (order.status !== 'ready_for_courier') return { error: 'Buyurtma hali courier qabul bosqichida emas' };
  order.status = 'out_for_delivery';
  order.courierName = String(courierName || order.courierName || '').trim();
  order.courierPhone = String(courierPhone || order.courierPhone || '').trim();
  order.assigned_at = new Date().toISOString();
  order.picked_up_at = order.assigned_at;
  order.courierAcceptedAt = new Date().toISOString();
  order.courierTrackingStartedAt = order.courierTrackingStartedAt || order.courierAcceptedAt;
  order.courierTrackingStoppedAt = null;
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
  order.courierTrackingStoppedAt = order.deliveredAt;
  order.courierTokenUsed = true;
  order.updated_at = order.deliveredAt;
  persistState();
  return { order };
}

function updateCourierLocation(token, { lat = null, lng = null, accuracy = null } = {}) {
  const order = getOrderByCourierToken(token);
  if (!order) return { error: 'Invalid token' };
  if (order.status !== 'out_for_delivery') return { error: 'Buyurtma courierda emas' };
  if (order.status === 'delivered' || order.status === 'cancelled' || order.courierTokenUsed) {
    return { error: 'Lokatsiya yuborish mumkin emas' };
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { error: 'lat/lng noto‘g‘ri' };
  }
  order.courierLocationLat = latNum;
  order.courierLocationLng = lngNum;
  order.courierLocationAccuracy = Number.isFinite(Number(accuracy)) ? Number(accuracy) : null;
  order.courierLocationUpdatedAt = new Date().toISOString();
  order.courierTrackingStartedAt = order.courierTrackingStartedAt || order.courierLocationUpdatedAt;
  order.courierTrackingHeartbeatAt = order.courierLocationUpdatedAt;
  order.updated_at = order.courierLocationUpdatedAt;
  persistState();
  return { ok: true, order };
}

function adminAssignCourier(id, { courierName = '', courierPhone = '' } = {}) {
  const order = getOrderById(id);
  if (!order) return null;
  if (normalizeOrderStatus(order.status) === 'delivered') return null;
  order.courierName = String(courierName || '').trim();
  order.courierPhone = String(courierPhone || '').trim();
  order.courier_id = order.courier_id || `courier_${Date.now()}`;
  order.assigned_at = new Date().toISOString();
  if (normalizeOrderStatus(order.status) === 'ready_for_courier') order.status = 'courier_assigned';
  order.updated_at = new Date().toISOString();
  orderStatusLogs.push({ order_id: order.id, from_status: normalizeOrderStatus(order.status), to_status: normalizeOrderStatus(order.status), actor: 'admin', note: 'courier assigned', created_at: order.updated_at });
  persistState();
  return order;
}

function markOrderPaymentPaid(orderRef) {
  const order = getOrderByNumber(orderRef) || getOrderById(orderRef);
  if (!order) return null;
  order.paymentStatus = 'paid';
  order.updated_at = new Date().toISOString();
  persistState();
  return order;
}

function upsertProducts(items = []) {
  const touched = [];
  const defaultMarginPercent = Number(homeSettings.defaultMarginPercent || 0);

  for (const raw of items) {
    if (!raw || !raw.id) continue;
    const i = products.findIndex((p) => p.id === raw.id);
    const categoryRef = ensureCategory(raw.category || 'Boshqa');

    const costPrice = Math.max(0, Number(raw.cost_price ?? raw.price ?? 0) || 0);
    const marginPercentRaw = raw.margin_percent;
    const marginFixedRaw = raw.margin_fixed;
    const hasMarginPercent = marginPercentRaw !== undefined && marginPercentRaw !== null && marginPercentRaw !== '';
    const hasMarginFixed = marginFixedRaw !== undefined && marginFixedRaw !== null && marginFixedRaw !== '';
    const marginPercent = hasMarginPercent ? Number(marginPercentRaw || 0) : defaultMarginPercent;
    const marginFixed = hasMarginFixed ? Number(marginFixedRaw || 0) : null;
    let sellingPrice = costPrice;
    if (hasMarginFixed) sellingPrice = costPrice + (Number.isFinite(marginFixed) ? marginFixed : 0);
    else if (Number.isFinite(marginPercent) && marginPercent !== 0) sellingPrice = costPrice * (1 + (marginPercent / 100));
    sellingPrice = Math.max(0, Math.round(sellingPrice));

    const normalized = {
      id: raw.id,
      code: raw.code || raw.sku || raw.id,
      sku: raw.sku || raw.id,
      name: raw.name || 'Nomsiz mahsulot',
      categoryId: raw.categoryId || categoryRef.id,
      category: raw.category || categoryRef.name,
      cost_price: costPrice,
      margin_percent: Number.isFinite(marginPercent) ? marginPercent : 0,
      margin_fixed: Number.isFinite(marginFixed) ? marginFixed : null,
      price: sellingPrice,
      oldPrice: Number(raw.oldPrice) || sellingPrice || 0,
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

function getOrderStatusLogs(orderId = '') {
  if (!orderId) return orderStatusLogs.slice();
  return orderStatusLogs.filter((l) => l.order_id === orderId);
}

loadStateFromDisk();

module.exports = {
  // state sections
  products,
  categories,
  banners,
  promotions,
  promoCodes,
  // public getters
  listProducts,
  getProductById,
  getCategories,
  getBanners,
  getPromotions,
  getHomeSettings,
  getUserByPhone,
  // admin operations
  createBanner,
  updateBanner,
  deleteBanner,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromoCodes,
  upsertPromoCode,
  updateHomeSettings,
  upsertUser,
  markPhoneVerified,
  updateCategory,
  updateProduct,
  // cart/order/import
  getCartSummary,
  setCartItem,
  clearCart,
  createOrder,
  upsertProducts,
  getStoreSummary,
  getOrderStatusLogs,
  reloadStoreFromDisk,
  getOrders,
  markOrderPaid,
  markOrderPaymentCancelled,
  getCustomerOrders,
  getOrderById,
  getOrderByNumber,
  saveOrderFeedback,
  attachPaymentProof,
  updateOrderStatus,
  cancelOrder,
  getOrderPicklist,
  sendOrderToTsd,
  markDalionPicked,
  getOrderByCourierToken,
  courierAccept,
  courierDeliver,
  updateCourierLocation,
  markOrderPaymentPaid,
  adminAssignCourier,
  orders
};
