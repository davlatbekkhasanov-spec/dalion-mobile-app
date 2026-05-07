const express = require('express');
const path = require('path');
const fs = require('fs');

process.on('uncaughtException', (error) => {
  console.error('[PROCESS] uncaughtException', { message: error?.message });
});

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] unhandledRejection', {
    message: reason instanceof Error ? reason.message : String(reason)
  });
});

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.store.json');
const ADMIN_TOKEN = process.env.ADMIN_IMPORT_TOKEN || '12345';
const BIOMETRIC_UPLOADS_DIR = path.join(__dirname, 'uploads', 'biometric');
const MAX_BIOMETRIC_BYTES = 1.5 * 1024 * 1024;
const MAX_REASONABLE_DISTANCE_KM = 120;
const MAX_DELIVERY_FEE = 300000;

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  immutable: true
}));

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function parseImageDataUrl(input) {
  const raw = String(input || '').trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mimeType = String(match[1] || '').toLowerCase().replace('jpg', 'jpeg');
  const cleanBase64 = String(match[2] || '').replace(/\s/g, '');
  if (!cleanBase64) return null;
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (!buffer.length) return null;
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return { mimeType, buffer, ext };
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidLatitude(value) {
  const n = toFiniteNumber(value);
  return n !== null && n >= -90 && n <= 90;
}

function isValidLongitude(value) {
  const n = toFiniteNumber(value);
  return n !== null && n >= -180 && n <= 180;
}

function isValidLatLng(lat, lng) {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

function normalizeDistanceKm(distanceKm) {
  const km = toFiniteNumber(distanceKm);
  if (km === null || km <= 0 || km > MAX_REASONABLE_DISTANCE_KM) return null;
  return km;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const a1 = toFiniteNumber(lat1);
  const b1 = toFiniteNumber(lon1);
  const a2 = toFiniteNumber(lat2);
  const b2 = toFiniteNumber(lon2);
  if (
    a1 === null || b1 === null || a2 === null || b2 === null ||
    !isValidLatLng(a1, b1) || !isValidLatLng(a2, b2)
  ) return null;
  const R = 6371;
  const dLat = ((a2 - a1) * Math.PI) / 180;
  const dLon = ((b2 - b1) * Math.PI) / 180;
  const p1 = (a1 * Math.PI) / 180;
  const p2 = (a2 * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(p1) * Math.cos(p2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

function computeDeliveryPriceByDistance(distanceKm) {
  const normalizedKm = normalizeDistanceKm(distanceKm);
  if (normalizedKm === null) return 18000;
  if (normalizedKm <= 3) return 18000;
  return Math.min(MAX_DELIVERY_FEE, toMoney(18000 + (normalizedKm - 3) * 4000));
}

function defaultDb() {
  const categories = [
    { id: 'c1', name: 'Sut mahsulotlari', displayName: 'Sut mahsulotlari', icon: '🥛', image_url: '', active: true },
    { id: 'c2', name: 'Ichimliklar', displayName: 'Ichimliklar', icon: '🥤', image_url: '', active: true },
    { id: 'c3', name: 'Shirinliklar', displayName: 'Shirinliklar', icon: '🍫', image_url: '', active: true },
    { id: 'c4', name: 'Mevalar', displayName: 'Mevalar', icon: '🍎', image_url: '', active: true }
  ];
  const products = [
    { id: 'p1', code: 'MILK-1L', name: 'Sut 1L', price: 14000, oldPrice: 16000, stock: 90, image_url: '', active: true, categoryId: 'c1', category: 'Sut mahsulotlari', categoryDisplayName: 'Sut mahsulotlari', discount_percent: 12 },
    { id: 'p2', code: 'KEFIR', name: 'Kefir 1L', price: 18000, oldPrice: 0, stock: 70, image_url: '', active: true, categoryId: 'c1', category: 'Sut mahsulotlari', categoryDisplayName: 'Sut mahsulotlari', discount_percent: 0 },
    { id: 'p3', code: 'WATER', name: 'Suv 1.5L', price: 7000, oldPrice: 0, stock: 180, image_url: '', active: true, categoryId: 'c2', category: 'Ichimliklar', categoryDisplayName: 'Ichimliklar', discount_percent: 0 },
    { id: 'p4', code: 'JUICE', name: 'Sharbat 1L', price: 21000, oldPrice: 24000, stock: 65, image_url: '', active: true, categoryId: 'c2', category: 'Ichimliklar', categoryDisplayName: 'Ichimliklar', discount_percent: 10 },
    { id: 'p5', code: 'APPLE', name: 'Olma 1kg', price: 24000, oldPrice: 0, stock: 110, image_url: '', active: true, categoryId: 'c4', category: 'Mevalar', categoryDisplayName: 'Mevalar', discount_percent: 0 }
  ];
  return {
    homeSettings: {
      brandName: 'GlobusMarket',
      locationText: 'Toshkent shahri',
      searchPlaceholder: 'Mahsulot qidirish...',
      heroTitle: 'Tez va ishonchli yetkazib berish',
      heroSubtitle: 'Sifatli mahsulotlar eng yaxshi narxlarda',
      heroBadgeText: '20-30 daqiqa',
      bonusTitle: 'Har kuni aksiya',
      bonusSubtitle: 'Yangi chegirmalar siz uchun',
      deliveryTimeText: '30 daqiqa',
      deliveryText: 'Buyurtma uyingizgacha',
      backgroundImageUrl: '',
      accentColor: '#6a4dff',
      defaultMarginPercent: 15,
      clickPaymentUrl: '',
      paymePaymentUrl: '',
      cashTermsText: 'Naqd to‘lovni qabul qilaman.'
    },
    banners: [
      { id: 'b1', title: 'Tez yetkazib berish', subtitle: '20-30 daqiqada', image_url: '', active: true }
    ],
    promotions: [
      { id: 'pr1', title: 'Hafta aksiyasi', discount_text: '-15%', description: 'Eng mashhur mahsulotlarda chegirma', image_url: '', active: true }
    ],
    categories,
    products,
    profiles: {},
    carts: {},
    otp: {},
    orders: [],
    notifications: [],
    shorts: [
      { id: 's1', title: 'Yangi aksiya', subtitle: 'Top mahsulotlar bo‘yicha chegirmalar', media_url: '', active: true, sortOrder: 1 },
      { id: 's2', title: 'Tezkor yetkazish', subtitle: 'Buyurtma odatda 1-4 soatda yetib boradi', media_url: '', active: true, sortOrder: 2 }
    ]
  };
}

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = defaultDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return defaultDb();
  }
}

let db = readDb();

function ensureDbShape() {
  if (!Array.isArray(db.orders)) db.orders = [];
  if (!db.profiles || typeof db.profiles !== 'object') db.profiles = {};
  if (!db.carts || typeof db.carts !== 'object') db.carts = {};
  if (!db.otp || typeof db.otp !== 'object') db.otp = {};
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.shorts)) db.shorts = [];
}
ensureDbShape();

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function getUserPhone(req) {
  return normalizePhone(req.headers['x-user-phone']);
}

function requireAdmin(req, res, next) {
  const token = String(req.headers['x-admin-token'] || '');
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, message: 'Admin token noto‘g‘ri' });
  }
  return next();
}

function findProductById(id) {
  return db.products.find((p) => String(p.id) === String(id));
}

function getCartItems(phone) {
  const cart = db.carts[phone] || {};
  return Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = findProductById(productId);
      if (!product) return null;
      const qty = Math.max(0, Number(quantity || 0));
      if (qty <= 0) return null;
      return {
        id: product.id,
        name: product.name,
        price: toMoney(product.price),
        quantity: qty,
        subtotal: toMoney(product.price) * qty,
        image_url: product.image_url || ''
      };
    })
    .filter(Boolean);
}

function buildCartSummary(phone) {
  const items = getCartItems(phone);
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  return { items, totalQty, subtotal };
}

function publicProduct(product) {
  const category = db.categories.find((c) => c.id === product.categoryId);
  return {
    ...product,
    category: category?.name || product.category || '',
    categoryDisplayName: category?.displayName || category?.name || product.categoryDisplayName || product.category || ''
  };
}

function orderPublic(order) {
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items : []
  };
}

// Frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/orders-display', (req, res) => {
  const filePath = path.join(__dirname, 'orders.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.redirect('/admin');
});

app.get('/orders', (req, res) => {
  res.redirect('/admin');
});

app.get('/courier/:token', (req, res) => {
  const filePath = path.join(__dirname, 'courier.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.redirect('/track/' + encodeURIComponent(req.params.token));
});

app.get('/track/:orderNumber', (req, res) => {
  res.sendFile(path.join(__dirname, 'track.html'));
});

app.get('/api/payme', (req, res) => {
  res.status(200).json({ ok: true, message: 'Payme endpoint expects POST JSON-RPC' });
});

app.post('/api/payme', (req, res) => {
  res.status(200).json({ ok: true, message: 'Payme mock endpoint' });
});

// Public API
app.get('/api/v1/home', (req, res) => {
  const activeShorts = (db.shorts || [])
    .filter((item) => item && item.active !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  return res.json({
    ok: true,
    home_settings: db.homeSettings,
    banners: db.banners.filter((b) => b.active !== false),
    promotions: db.promotions.filter((p) => p.active !== false),
    shorts: activeShorts,
    delivery_info: {
      location: db.homeSettings.locationText || 'Toshkent shahri',
      time: db.homeSettings.deliveryTimeText || '30 daqiqa',
      price: 18000
    }
  });
});

app.get('/api/v1/products', (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 40)));
  const all = db.products.map(publicProduct).filter((p) => p.active !== false);
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);
  return res.json({
    ok: true,
    page,
    limit,
    total: all.length,
    hasMore: start + limit < all.length,
    items
  });
});

app.put('/api/v1/profile', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const name = String(req.body.name || '').trim();
  if (!phone || !name) {
    return res.status(400).json({ ok: false, message: 'Name va phone majburiy' });
  }
  const now = nowIso();
  const existingProfile = db.profiles[phone] || {};
  const consentChecked = req.body.biometricConsent === true;
  const consentAtRaw = req.body.biometricConsentAt;
  const selfieRaw = req.body.biometricSelfieDataUrl;
  const capturedAtRaw = req.body.biometricCapturedAt;
  const wantsBiometricUpdate = selfieRaw !== undefined || req.body.biometricConsent !== undefined;

  let biometric = existingProfile.biometric || null;
  if (selfieRaw !== undefined || (consentChecked && capturedAtRaw)) {
    if (!consentChecked) {
      return res.status(400).json({ ok: false, message: 'Biometrik selfie uchun rozilik majburiy' });
    }
    const parsedImage = parseImageDataUrl(selfieRaw);
    if (!parsedImage) {
      return res.status(400).json({ ok: false, message: 'Selfie formati noto‘g‘ri (faqat PNG/JPG data URL)' });
    }
    if (parsedImage.buffer.length > MAX_BIOMETRIC_BYTES) {
      return res.status(400).json({ ok: false, message: 'Selfie hajmi juda katta (maksimum 1.5MB)' });
    }
    ensureDir(BIOMETRIC_UPLOADS_DIR);
    const safePhone = phone.replace(/[^\d+]/g, '').replace(/\+/g, '');
    const fileName = `${safePhone || 'user'}_${Date.now()}.${parsedImage.ext}`;
    const absolutePath = path.join(BIOMETRIC_UPLOADS_DIR, fileName);
    fs.writeFileSync(absolutePath, parsedImage.buffer);
    biometric = {
      consentGiven: true,
      consentAt: String(consentAtRaw || now),
      capturedAt: String(capturedAtRaw || now),
      imageUrl: `/uploads/biometric/${fileName}`,
      mimeType: parsedImage.mimeType,
      fileSize: parsedImage.buffer.length
    };
  } else if (wantsBiometricUpdate && !consentChecked) {
    return res.status(400).json({ ok: false, message: 'Biometrik rozilik belgilanmagan' });
  } else if (consentChecked && biometric) {
    biometric = {
      ...biometric,
      consentGiven: true,
      consentAt: String(consentAtRaw || biometric.consentAt || now)
    };
  }

  db.profiles[phone] = {
    phone,
    name,
    address: String(req.body.address || '').trim(),
    updatedAt: now,
    biometric
  };
  saveDb();
  return res.json({ ok: true, profile: db.profiles[phone] });
});

app.post('/api/v1/auth/request-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) return res.status(400).json({ ok: false, message: 'Phone kiriting' });
  db.otp[phone] = { code: '1111', createdAt: nowIso() };
  saveDb();
  return res.json({ ok: true, devOtp: '1111' });
});

app.post('/api/v1/auth/verify-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || '').trim();
  const otp = db.otp[phone];
  if (!otp || otp.code !== code) return res.status(400).json({ ok: false, message: 'OTP noto‘g‘ri' });
  const profile = db.profiles[phone] || { phone, name: phone };
  profile.phoneVerified = true;
  profile.otpVerifiedAt = nowIso();
  db.profiles[phone] = profile;
  saveDb();
  return res.json({ ok: true, user: profile });
});

app.get('/api/v1/cart', (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.json({ ok: true, items: [], totalQty: 0, subtotal: 0 });
  return res.json({ ok: true, ...buildCartSummary(phone) });
});

app.put('/api/v1/cart/items', (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.status(401).json({ ok: false, message: 'x-user-phone yuboring' });
  const productId = String(req.body.productId || '');
  const quantity = Math.max(0, Math.round(Number(req.body.quantity || 0)));
  const product = findProductById(productId);
  if (!product) return res.status(404).json({ ok: false, message: 'Mahsulot topilmadi' });
  if (!db.carts[phone]) db.carts[phone] = {};
  if (quantity === 0) {
    delete db.carts[phone][productId];
  } else {
    db.carts[phone][productId] = Math.min(quantity, Math.max(0, Number(product.stock || 0)));
  }
  saveDb();
  return res.json({ ok: true, ...buildCartSummary(phone) });
});

app.post('/api/v1/orders', (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.status(401).json({ ok: false, message: 'Foydalanuvchi tasdiqlanmagan' });
  const cartSummary = buildCartSummary(phone);
  if (!cartSummary.items.length) return res.status(400).json({ ok: false, message: 'Savat bo‘sh' });
  const profile = db.profiles[phone] || {};
  const storeLat = 39.654722;
  const storeLng = 66.958972;
  const rawLocationLat = toFiniteNumber(req.body.locationLat);
  const rawLocationLng = toFiniteNumber(req.body.locationLng);
  const hasValidCustomerCoords = isValidLatLng(rawLocationLat, rawLocationLng);
  const distanceKmRaw = hasValidCustomerCoords
    ? haversineKm(storeLat, storeLng, rawLocationLat, rawLocationLng)
    : null;
  const safeDistanceKm = normalizeDistanceKm(distanceKmRaw);
  const distanceKm = safeDistanceKm === null ? null : Number(safeDistanceKm.toFixed(2));
  const clientDeliveryPrice = toFiniteNumber(req.body.deliveryPrice);
  const safeClientDeliveryPrice = (
    clientDeliveryPrice !== null &&
    clientDeliveryPrice >= 0 &&
    clientDeliveryPrice <= MAX_DELIVERY_FEE
  )
    ? toMoney(clientDeliveryPrice)
    : null;
  const fallbackDeliveryPrice = computeDeliveryPriceByDistance(safeDistanceKm);
  const deliveryPrice = safeClientDeliveryPrice === null
    ? fallbackDeliveryPrice
    : Math.min(MAX_DELIVERY_FEE, safeClientDeliveryPrice);
  const subtotal = toMoney(cartSummary.subtotal);
  const total = subtotal + deliveryPrice;
  const orderNumber = String(100000 + db.orders.length + 1);
  const order = {
    id: randomId('ord'),
    orderNumber,
    customerPhone: phone,
    customerName: profile.name || 'Mehmon',
    customerAddress: String(req.body.addressText || req.body.location || profile.address || '').trim(),
    location: String(req.body.location || '').trim(),
    addressText: String(req.body.addressText || '').trim(),
    landmarkText: String(req.body.landmarkText || '').trim(),
    locationLat: hasValidCustomerCoords ? rawLocationLat : null,
    locationLng: hasValidCustomerCoords ? rawLocationLng : null,
    locationAccuracy: Number(req.body.locationAccuracy || 0),
    distanceKm,
    distanceValid: distanceKm !== null,
    deliveryFallbackApplied: safeDistanceKm === null,
    deliveryPriceCapped: deliveryPrice >= MAX_DELIVERY_FEE,
    paymentMethod: String(req.body.paymentMethod || 'cash'),
    paymentStatus: String(req.body.paymentStatus || 'pending'),
    status: 'created',
    delivery_status: 'new',
    deliveryEta: String(req.body.deliveryTime || db.homeSettings.deliveryTimeText || '30 daqiqa'),
    items: cartSummary.items,
    subtotal,
    deliveryPrice,
    total,
    created_at: nowIso(),
    updated_at: nowIso(),
    courierName: '',
    courierPhone: '',
    courierLocationLat: null,
    courierLocationLng: null
  };
  db.orders.unshift(order);
  db.carts[phone] = {};
  saveDb();
  return res.json({ ok: true, orderNumber, status: order.status, paymentStatus: order.paymentStatus });
});

app.get('/api/v1/orders/:orderNumber/track', (req, res) => {
  const order = db.orders.find((o) => String(o.orderNumber) === String(req.params.orderNumber));
  if (!order) return res.status(404).json({ ok: false, message: 'Buyurtma topilmadi' });
  const now = Date.now();
  const created = new Date(order.created_at || now).getTime();
  const elapsedMin = Math.max(1, Math.round((now - created) / 60000));
  const simulatedEtaMin = Math.max(3, 45 - elapsedMin);
  const etaLabel = simulatedEtaMin > 59
    ? `${Math.ceil(simulatedEtaMin / 60)} soat`
    : `${simulatedEtaMin} daqiqa`;
  const payload = orderPublic({
    ...order,
    etaLiveText: etaLabel,
    trackingUpdatedAt: nowIso()
  });
  return res.json({ ok: true, order: payload });
});

app.get('/api/v1/notifications', (req, res) => {
  const phone = getUserPhone(req);
  const readMap = (db.profiles[phone]?.notificationsRead || {}) || {};
  const notifications = (db.notifications || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map((item) => ({
      ...item,
      read: Boolean(readMap[item.id])
    }));
  const unreadCount = notifications.filter((n) => !n.read).length;
  return res.json({ ok: true, notifications, unreadCount });
});

app.post('/api/v1/notifications/read-all', (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.status(401).json({ ok: false, message: 'x-user-phone yuboring' });
  const profile = db.profiles[phone] || { phone, name: phone };
  if (!profile.notificationsRead || typeof profile.notificationsRead !== 'object') profile.notificationsRead = {};
  (db.notifications || []).forEach((n) => { profile.notificationsRead[n.id] = true; });
  db.profiles[phone] = profile;
  saveDb();
  return res.json({ ok: true });
});

app.post('/api/v1/orders/:orderNumber/feedback', (req, res) => {
  const order = db.orders.find((o) => String(o.orderNumber) === String(req.params.orderNumber));
  if (!order) return res.status(404).json({ ok: false, message: 'Buyurtma topilmadi' });
  order.feedbackRating = Number(req.body.feedbackRating || 0);
  order.feedbackComment = String(req.body.feedbackComment || '').trim();
  order.feedbackAt = nowIso();
  order.updated_at = nowIso();
  saveDb();
  return res.json({ ok: true, order: orderPublic(order) });
});

app.get('/api/v1/customer/orders', (req, res) => {
  const phone = normalizePhone(req.query.phone);
  if (!phone) return res.status(400).json({ ok: false, message: 'phone query kerak' });
  const orders = db.orders.filter((o) => String(o.customerPhone) === phone).map(orderPublic);
  return res.json({ ok: true, orders });
});

// Admin API
app.get('/api/v1/admin/banners', requireAdmin, (req, res) => {
  res.json({ ok: true, banners: db.banners });
});
app.post('/api/v1/admin/banners', requireAdmin, (req, res) => {
  const item = {
    id: randomId('ban'),
    title: String(req.body.title || '').trim(),
    subtitle: String(req.body.subtitle || '').trim(),
    image_url: String(req.body.image_url || '').trim(),
    active: req.body.active !== false
  };
  db.banners.unshift(item);
  saveDb();
  res.json({ ok: true, banner: item });
});
app.put('/api/v1/admin/banners/:id', requireAdmin, (req, res) => {
  const i = db.banners.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Banner topilmadi' });
  db.banners[i] = { ...db.banners[i], ...req.body, id: db.banners[i].id };
  saveDb();
  res.json({ ok: true, banner: db.banners[i] });
});
app.delete('/api/v1/admin/banners/:id', requireAdmin, (req, res) => {
  db.banners = db.banners.filter((x) => x.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.get('/api/v1/admin/promotions', requireAdmin, (req, res) => {
  res.json({ ok: true, promotions: db.promotions });
});
app.post('/api/v1/admin/promotions', requireAdmin, (req, res) => {
  const item = {
    id: randomId('prm'),
    title: String(req.body.title || '').trim(),
    discount_text: String(req.body.discount_text || '').trim(),
    description: String(req.body.description || '').trim(),
    image_url: String(req.body.image_url || '').trim(),
    active: req.body.active !== false
  };
  db.promotions.unshift(item);
  saveDb();
  res.json({ ok: true, promotion: item });
});
app.put('/api/v1/admin/promotions/:id', requireAdmin, (req, res) => {
  const i = db.promotions.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Promotion topilmadi' });
  db.promotions[i] = { ...db.promotions[i], ...req.body, id: db.promotions[i].id };
  saveDb();
  res.json({ ok: true, promotion: db.promotions[i] });
});
app.delete('/api/v1/admin/promotions/:id', requireAdmin, (req, res) => {
  db.promotions = db.promotions.filter((x) => x.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.get('/api/v1/admin/home-settings', requireAdmin, (req, res) => {
  res.json({ ok: true, homeSettings: db.homeSettings });
});
app.put('/api/v1/admin/home-settings', requireAdmin, (req, res) => {
  db.homeSettings = { ...db.homeSettings, ...req.body };
  saveDb();
  res.json({ ok: true, homeSettings: db.homeSettings });
});

app.get('/api/v1/admin/categories', requireAdmin, (req, res) => {
  const categories = db.categories.map((c) => ({
    ...c,
    productCount: db.products.filter((p) => p.categoryId === c.id).length
  }));
  res.json({ ok: true, categories });
});
app.put('/api/v1/admin/categories/:id', requireAdmin, (req, res) => {
  const i = db.categories.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Category topilmadi' });
  db.categories[i] = { ...db.categories[i], ...req.body, id: db.categories[i].id, name: db.categories[i].name };
  saveDb();
  res.json({ ok: true, category: db.categories[i] });
});
app.post('/api/v1/admin/categories/:id/image', requireAdmin, (req, res) => {
  const category = db.categories.find((x) => x.id === req.params.id);
  if (!category) return res.status(404).json({ ok: false, message: 'Category topilmadi' });
  category.image_url = category.image_url || '';
  saveDb();
  return res.json({ ok: true, category, warning: 'Multipart upload hozircha mock rejimda' });
});

app.get('/api/v1/admin/products', requireAdmin, (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const products = db.products
    .map(publicProduct)
    .filter((p) => !q || `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q));
  res.json({ ok: true, products });
});

app.get('/api/v1/admin/notifications', requireAdmin, (req, res) => {
  return res.json({ ok: true, notifications: db.notifications || [] });
});
app.post('/api/v1/admin/notifications', requireAdmin, (req, res) => {
  const notification = {
    id: randomId('ntf'),
    title: String(req.body.title || '').trim(),
    body: String(req.body.body || '').trim(),
    createdAt: nowIso(),
    active: req.body.active !== false
  };
  if (!notification.title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  db.notifications.unshift(notification);
  saveDb();
  return res.json({ ok: true, notification });
});
app.delete('/api/v1/admin/notifications/:id', requireAdmin, (req, res) => {
  db.notifications = (db.notifications || []).filter((n) => n.id !== req.params.id);
  saveDb();
  return res.json({ ok: true });
});

app.get('/api/v1/admin/shorts', requireAdmin, (req, res) => {
  return res.json({ ok: true, shorts: db.shorts || [] });
});
app.post('/api/v1/admin/shorts', requireAdmin, (req, res) => {
  const shortItem = {
    id: randomId('srt'),
    title: String(req.body.title || '').trim(),
    subtitle: String(req.body.subtitle || '').trim(),
    media_url: String(req.body.media_url || '').trim(),
    sortOrder: Number(req.body.sortOrder || (db.shorts?.length || 0) + 1),
    active: req.body.active !== false
  };
  if (!shortItem.title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  db.shorts.unshift(shortItem);
  saveDb();
  return res.json({ ok: true, short: shortItem });
});
app.delete('/api/v1/admin/shorts/:id', requireAdmin, (req, res) => {
  db.shorts = (db.shorts || []).filter((s) => s.id !== req.params.id);
  saveDb();
  return res.json({ ok: true });
});
app.put('/api/v1/admin/products/:id', requireAdmin, (req, res) => {
  const i = db.products.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Product topilmadi' });
  const categoryId = String(req.body.categoryId || db.products[i].categoryId);
  const category = db.categories.find((c) => c.id === categoryId);
  db.products[i] = {
    ...db.products[i],
    ...req.body,
    id: db.products[i].id,
    price: toMoney(req.body.price ?? db.products[i].price),
    stock: Math.max(0, Number(req.body.stock ?? db.products[i].stock)),
    discount_percent: Math.max(0, Math.min(100, Number(req.body.discount_percent ?? (db.products[i].discount_percent ?? 0)))),
    categoryId,
    category: category?.name || db.products[i].category,
    categoryDisplayName: category?.displayName || category?.name || db.products[i].categoryDisplayName
  };
  saveDb();
  res.json({ ok: true, product: publicProduct(db.products[i]) });
});
app.post('/api/v1/admin/products/import', requireAdmin, (req, res) => {
  return res.json({
    ok: true,
    imported: 0,
    skipped: 0,
    invalidRows: 0,
    categoriesDetected: db.categories.length,
    skippedCategoryRows: 0,
    productsAssignedCategory: db.products.length,
    productsWithoutCategoryFallback: 0,
    imageExtracted: 0,
    imageProcessed: 0,
    imageWarnings: 0,
    imageObjectDetected: 0,
    imageDetectionWarnings: [],
    imageUpscaled: 0,
    imageSkippedExisting: 0,
    imageMissing: 0,
    productsWithImageUrl: db.products.filter((p) => p.image_url).length,
    productsWithEmbeddedImages: 0,
    productsWithoutImages: db.products.filter((p) => !p.image_url).length,
    processingTimeMs: 0,
    averageImageMs: 0,
    message: 'Excel import hozircha mock: admin CRUD orqali boshqarish mumkin'
  });
});

app.get('/api/v1/admin/orders', requireAdmin, (req, res) => {
  res.json({ ok: true, orders: db.orders.map(orderPublic) });
});
app.get('/api/v1/admin/customers/biometric', requireAdmin, (req, res) => {
  const customers = Object.values(db.profiles || {})
    .map((profile) => {
      const bio = profile?.biometric || null;
      return {
        phone: profile?.phone || '',
        name: profile?.name || 'Mijoz',
        updatedAt: profile?.updatedAt || null,
        biometricStatus: Boolean(bio?.consentGiven && bio?.imageUrl),
        biometric: bio
          ? {
              consentGiven: Boolean(bio.consentGiven),
              consentAt: bio.consentAt || null,
              capturedAt: bio.capturedAt || null,
              imageUrl: bio.imageUrl || '',
              mimeType: bio.mimeType || '',
              fileSize: Number(bio.fileSize || 0)
            }
          : null
      };
    })
    .sort((a, b) => {
      const at = new Date(a.biometric?.capturedAt || a.updatedAt || 0).getTime();
      const bt = new Date(b.biometric?.capturedAt || b.updatedAt || 0).getTime();
      return bt - at;
    });
  res.json({ ok: true, customers });
});
app.post('/api/v1/admin/orders/:id/cancel', requireAdmin, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  o.status = 'cancelled';
  o.delivery_status = 'cancelled';
  o.updated_at = nowIso();
  saveDb();
  return res.json({ ok: true, order: orderPublic(o) });
});
app.post('/api/v1/admin/orders/:id/assign-courier', requireAdmin, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  o.courierName = String(req.body.courierName || '').trim();
  o.courierPhone = String(req.body.courierPhone || '').trim();
  o.status = 'courier_assigned';
  o.delivery_status = 'courier_assigned';
  o.updated_at = nowIso();
  saveDb();
  return res.json({ ok: true, order: orderPublic(o) });
});
app.put('/api/v1/admin/orders/:id/status', requireAdmin, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  o.status = String(req.body.status || o.status);
  o.delivery_status = o.status;
  if (o.status === 'delivered' && o.paymentStatus === 'pending') o.paymentStatus = 'paid';
  o.updated_at = nowIso();
  saveDb();
  return res.json({ ok: true, order: orderPublic(o) });
});

app.post('/api/v1/admin/store/reload', requireAdmin, (req, res) => {
  db = readDb();
  return res.json({ ok: true });
});
app.get('/api/v1/admin/store/summary', requireAdmin, (req, res) => {
  const summary = {
    categories: db.categories.length,
    products: db.products.length,
    orders: db.orders.length,
    banners: db.banners.length,
    promotions: db.promotions.length,
    storageFile: DB_FILE
  };
  return res.json({ ok: true, summary });
});

app.get('/api/v1/integrations/status', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    integrations: { dalionTrend1C: { enabled: false } },
    stats: { storageMode: 'local' }
  });
});
app.post('/api/v1/admin/dalion/sync', requireAdmin, (req, res) => {
  res.json({ ok: true, success: true, message: 'DALION sync mock ishga tushdi' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'dalion-mobile-app' });
});

app.listen(PORT, () => {
  console.info(`[SERVER] started on port ${PORT}`);
});
