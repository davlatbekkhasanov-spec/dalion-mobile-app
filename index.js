const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const smsService = require('./src/services/sms.service');

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
const ADMIN_V2_PASSWORD = process.env.ADMIN_V2_PASSWORD ?? '8080';
const ADMIN_V2_SECRET =
  process.env.ADMIN_V2_SECRET || 'dev-admin-v2-secret-change-in-production';
const ADMIN_V2_JWT_TTL_SEC = Math.min(
  30 * 24 * 3600,
  Math.max(3600, Number(process.env.ADMIN_V2_JWT_TTL_SEC || 86400 * 7) || 86400 * 7)
);
const BANNER_UPLOADS_DIR = path.join(__dirname, 'uploads', 'banners');
const MAX_BANNER_IMAGE_BYTES = 2 * 1024 * 1024;
const BIOMETRIC_UPLOADS_DIR = path.join(__dirname, 'uploads', 'biometric');
const ADMIN_AMBIENT_UPLOADS_DIR = path.join(__dirname, 'uploads', 'audio', 'admin-ambient');
const MAX_BIOMETRIC_BYTES = 1.5 * 1024 * 1024;
const MAX_ADMIN_AMBIENT_BYTES = 12 * 1024 * 1024;
const ADMIN_AMBIENT_MAX_SLOTS = 5;
const ALLOWED_ADMIN_AMBIENT_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac'
]);
const MAX_REASONABLE_DISTANCE_KM = 120;
const MAX_DELIVERY_FEE = 300000;
const SMS_OTP_PEPPER = process.env.SMS_OTP_PEPPER || process.env.OTP_PEPPER || 'dev-sms-pepper-change-me';
const SMS_OTP_DIGITS = Math.min(8, Math.max(4, Number(process.env.SMS_OTP_DIGITS || 6) || 6));
const SMS_OTP_TTL_MS = Math.min(
  30 * 60 * 1000,
  Math.max(60 * 1000, Number(process.env.SMS_OTP_TTL_MS || 600000) || 600000)
);

const smsThrottlePhone = new Map();
const smsThrottleIp = new Map();
const smsVerifyThrottleIp = new Map();
const adminV2LoginHits = new Map();

function logStructured(level, event, details = {}) {
  const payload = {
    level,
    event,
    at: nowIso(),
    ...details
  };
  if (level === 'error') {
    console.error('[BACKEND]', JSON.stringify(payload));
    return;
  }
  console.info('[BACKEND]', JSON.stringify(payload));
}

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

function normalizeSmsPhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  let nine = '';
  if (digits.length >= 12 && digits.startsWith('998')) {
    nine = digits.slice(-9);
  } else if (digits.length === 9) {
    nine = digits;
  } else if (digits.length > 9) {
    nine = digits.slice(-9);
  }
  if (/^[1-9]\d{8}$/.test(nine)) return `+998${nine}`;
  return '';
}

function normalizePhone(phone) {
  const uz = normalizeSmsPhone(phone);
  if (uz) return uz;
  return String(phone || '').trim();
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (fwd) return fwd;
  return req.socket?.remoteAddress || '';
}

function smsThrottleTouch(map, key, minMs) {
  const now = Date.now();
  const last = map.get(key) || 0;
  if (now - last < minMs) {
    return { ok: false, retryAfterMs: minMs - (now - last) };
  }
  map.set(key, now);
  return { ok: true };
}

function generateSmsOtpCode() {
  const n = SMS_OTP_DIGITS;
  const min = 10 ** (n - 1);
  const max = 10 ** n - 1;
  return String(crypto.randomInt(min, max + 1));
}

function hashSmsOtp(phone, code) {
  return crypto.createHash('sha256').update(`${SMS_OTP_PEPPER}|${phone}|${code}`).digest('hex');
}

function smsOtpDevHint(code) {
  const prod = process.env.NODE_ENV === 'production';
  const allowUi = String(process.env.ALLOW_OTP_DEV_UI || '').toLowerCase() === 'true';
  if (prod && !allowUi) return {};
  return { devHint: code };
}

async function handleSmsOtpSend(req, res) {
  if (!db.smsOtpChallenges || typeof db.smsOtpChallenges !== 'object') db.smsOtpChallenges = {};
  const phone = normalizeSmsPhone(req.body.phone);
  if (!phone) {
    return res.status(400).json({ ok: false, message: 'Telefon +998 formatida kiriting' });
  }
  const ip = clientIp(req);
  const tp = smsThrottleTouch(smsThrottlePhone, phone, 45000);
  if (!tp.ok) {
    return res.status(429).json({
      ok: false,
      message: 'Kodni qayta yuborishdan oldin kuting',
      retryAfterMs: tp.retryAfterMs
    });
  }
  const ti = smsThrottleTouch(smsThrottleIp, ip || 'unknown', 12000);
  if (!ti.ok) {
    return res.status(429).json({
      ok: false,
      message: 'So‘rovlar juda tez',
      retryAfterMs: ti.retryAfterMs
    });
  }

  const code = generateSmsOtpCode();
  const codeHash = hashSmsOtp(phone, code);
  const expiresAt = Date.now() + SMS_OTP_TTL_MS;
  db.smsOtpChallenges[phone] = {
    codeHash,
    expiresAt,
    attempts: 0,
    createdAt: nowIso()
  };
  saveDb();

  const sendResult = await smsService.sendSmsOtp(phone, code);
  if (!sendResult.ok) {
    delete db.smsOtpChallenges[phone];
    saveDb();
    logStructured('error', 'sms_otp_send_provider_failed', {
      provider: sendResult.provider || smsService.gatewayMode(),
      ...(sendResult.logContext || {})
    });
    const prod = process.env.NODE_ENV === 'production';
    const payload = {
      ok: false,
      message: sendResult.message || 'SMS yuborilmadi'
    };
    if (prod && sendResult.clientDetail) {
      payload.detail = sendResult.clientDetail;
    }
    return res.status(502).json(payload);
  }

  return res.json({ ok: true, ...smsOtpDevHint(code) });
}

function handleSmsOtpVerify(req, res) {
  if (!db.smsOtpChallenges || typeof db.smsOtpChallenges !== 'object') db.smsOtpChallenges = {};
  const phone = normalizeSmsPhone(req.body.phone);
  const code = String(req.body.code || '').replace(/\D/g, '').trim();
  if (!phone || !code) {
    return res.status(400).json({ ok: false, message: 'Telefon va kod kiriting' });
  }

  const ip = clientIp(req);
  const tv = smsThrottleTouch(smsVerifyThrottleIp, `${ip}|${phone}`, 600);
  if (!tv.ok) {
    return res.status(429).json({
      ok: false,
      message: 'Urinishlar juda tez',
      retryAfterMs: tv.retryAfterMs
    });
  }

  const ch = db.smsOtpChallenges[phone];
  if (!ch || Date.now() > Number(ch.expiresAt || 0)) {
    return res.status(400).json({ ok: false, message: 'Kod eskirgan yoki yuborilmagan' });
  }
  ch.attempts = Math.min(99, Number(ch.attempts || 0) + 1);
  if (ch.attempts > 10) {
    delete db.smsOtpChallenges[phone];
    saveDb();
    return res.status(429).json({ ok: false, message: 'Urinishlar limiti' });
  }
  if (hashSmsOtp(phone, code) !== ch.codeHash) {
    saveDb();
    return res.status(400).json({ ok: false, message: 'Kod noto‘g‘ri' });
  }
  delete db.smsOtpChallenges[phone];
  const profile = db.profiles[phone] || { phone, name: phone };
  profile.phone = phone;
  profile.phoneVerified = true;
  profile.smsVerifiedAt = nowIso();
  db.profiles[phone] = profile;
  saveDb();

  const verificationToken = randomId('smsv');
  return res.json({
    ok: true,
    phoneVerified: true,
    verificationToken,
    user: profile
  });
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

function parseAudioDataUrl(input) {
  const raw = String(input || '').trim();
  const match = raw.match(/^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mimeType = String(match[1] || '').toLowerCase();
  const cleanBase64 = String(match[2] || '').replace(/\s/g, '');
  if (!cleanBase64) return null;
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (!buffer.length) return null;
  return { mimeType, buffer };
}

function sanitizeFileName(name) {
  return String(name || '')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

function adminAmbientExtFromMime(mimeType) {
  const map = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac'
  };
  return map[String(mimeType || '').toLowerCase()] || '';
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
    smsOtpChallenges: {},
    orders: [],
    notifications: [],
    shorts: [
      { id: 's1', title: 'Yangi aksiya', subtitle: 'Top mahsulotlar bo‘yicha chegirmalar', media_url: '', active: true, sortOrder: 1 },
      { id: 's2', title: 'Tezkor yetkazish', subtitle: 'Buyurtma odatda 1-4 soatda yetib boradi', media_url: '', active: true, sortOrder: 2 }
    ],
    ambientPlaylist: {
      slots: []
    }
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
  } catch (error) {
    logStructured('error', 'db_read_failed', {
      message: error?.message || 'unknown db read error',
      file: DB_FILE
    });
    return defaultDb();
  }
}

let db = readDb();

function ensureDbShape() {
  if (!Array.isArray(db.orders)) db.orders = [];
  if (!db.profiles || typeof db.profiles !== 'object') db.profiles = {};
  if (!db.carts || typeof db.carts !== 'object') db.carts = {};
  if (!db.otp || typeof db.otp !== 'object') db.otp = {};
  if (!db.smsOtpChallenges || typeof db.smsOtpChallenges !== 'object') db.smsOtpChallenges = {};
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.shorts)) db.shorts = [];
  if (!db.adminV2Theme || typeof db.adminV2Theme !== 'object') {
    const accent = String(db.homeSettings?.accentColor || '#6a4dff').trim() || '#6a4dff';
    db.adminV2Theme = {
      primaryColor: accent,
      accentColor: accent,
      radiusPx: 16
    };
  } else {
    db.adminV2Theme.primaryColor = String(db.adminV2Theme.primaryColor || db.homeSettings?.accentColor || '#6a4dff');
    db.adminV2Theme.accentColor = String(db.adminV2Theme.accentColor || db.homeSettings?.accentColor || '#6a4dff');
    db.adminV2Theme.radiusPx = Math.max(0, Math.min(48, Number(db.adminV2Theme.radiusPx ?? 16) || 16));
  }
  if (!db.ambientPlaylist || typeof db.ambientPlaylist !== 'object') db.ambientPlaylist = { slots: [] };
  if (!Array.isArray(db.ambientPlaylist.slots)) db.ambientPlaylist.slots = [];
  db.ambientPlaylist.slots = db.ambientPlaylist.slots
    .map((slot) => {
      const slotNumber = Math.round(Number(slot?.slot || 0));
      if (slotNumber < 1 || slotNumber > ADMIN_AMBIENT_MAX_SLOTS) return null;
      const fileUrl = String(slot?.fileUrl || '').trim();
      if (!fileUrl) return null;
      return {
        slot: slotNumber,
        fileName: String(slot?.fileName || '').trim() || `track-${slotNumber}`,
        fileUrl,
        mimeType: String(slot?.mimeType || '').trim(),
        fileSize: Math.max(0, Math.round(Number(slot?.fileSize || 0))),
        updatedAt: String(slot?.updatedAt || nowIso())
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slot - b.slot);
  db.orders = db.orders.map((order) => {
    const normalizedStatus = normalizeOrderStatus(order.status);
    const hasCourierTerminalStatus = ['delivered', 'cancelled'].includes(normalizedStatus);
    return {
      ...order,
      status: normalizedStatus,
      delivery_status: normalizeOrderStatus(order.delivery_status || normalizedStatus),
      updated_at: order.updated_at || order.created_at || nowIso(),
      courierToken: order.courierToken || randomId('crt'),
      courierTokenUsed: order.courierTokenUsed === undefined ? hasCourierTerminalStatus : Boolean(order.courierTokenUsed),
      courierLocationLat: toFiniteNumber(order.courierLocationLat),
      courierLocationLng: toFiniteNumber(order.courierLocationLng),
      courierLocationAccuracy: toFiniteNumber(order.courierLocationAccuracy),
      courierLocationUpdatedAt: order.courierLocationUpdatedAt || null
    };
  });
}
ensureDbShape();

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function getAdminAmbientTracksOrdered() {
  const slots = Array.isArray(db.ambientPlaylist?.slots) ? db.ambientPlaylist.slots : [];
  return slots
    .filter((slot) => slot && slot.fileUrl && Number(slot.slot) >= 1 && Number(slot.slot) <= ADMIN_AMBIENT_MAX_SLOTS)
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map((slot) => ({
      slot: Number(slot.slot),
      fileName: String(slot.fileName || ''),
      fileUrl: String(slot.fileUrl || ''),
      mimeType: String(slot.mimeType || ''),
      fileSize: Number(slot.fileSize || 0),
      updatedAt: String(slot.updatedAt || '')
    }));
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

function adminV2B64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function adminV2ParseJwtPayload(segment) {
  const pad = 4 - (segment.length % 4 || 4);
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/') + (pad === 4 ? '' : '='.repeat(pad));
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function adminV2SignJwt(payload) {
  const header = adminV2B64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = adminV2B64urlJson(payload);
  const sig = crypto
    .createHmac('sha256', ADMIN_V2_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${sig}`;
}

function adminV2VerifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto
    .createHmac('sha256', ADMIN_V2_SECRET)
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  let sigBuf;
  let expBuf;
  try {
    sigBuf = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    expBuf = Buffer.from(expected.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try {
    payload = adminV2ParseJwtPayload(p);
  } catch {
    return null;
  }
  if (payload.typ !== 'admin-v2') return null;
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

function adminV2PasswordMatches(input) {
  const a = crypto.createHash('sha256').update(String(input), 'utf8').digest();
  const b = crypto.createHash('sha256').update(String(ADMIN_V2_PASSWORD), 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

function touchAdminV2Login(ip) {
  const key = ip || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxReq = 24;
  let rec = adminV2LoginHits.get(key);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + windowMs };
  }
  rec.count += 1;
  adminV2LoginHits.set(key, rec);
  if (rec.count > maxReq) {
    return { ok: false, retryAfterMs: Math.max(0, rec.resetAt - now) };
  }
  return { ok: true, resetAt: rec.resetAt };
}

function requireAdminV2(req, res, next) {
  const raw = String(req.headers.authorization || '').trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : '';
  const payload = adminV2VerifyJwt(token);
  if (!payload) {
    return res.status(401).json({ ok: false, message: 'Admin v2 sessiyasi yaroqsiz' });
  }
  req.adminV2 = payload;
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

function ensureCourierToken(order) {
  if (!order) return '';
  if (!order.courierToken) order.courierToken = randomId('crt');
  return order.courierToken;
}

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled']);
const ORDER_STATUS_ALIASES = {
  new: 'created',
  sent_to_tsd: 'preparing',
  picking: 'preparing',
  picked: 'ready_for_courier',
  waiting_courier: 'ready_for_courier'
};
const ALLOWED_ORDER_TRANSITIONS = {
  created: new Set(['payment_pending', 'payment_confirmed', 'preparing', 'cancelled']),
  payment_pending: new Set(['payment_confirmed', 'preparing', 'cancelled']),
  payment_confirmed: new Set(['preparing', 'cancelled']),
  preparing: new Set(['ready_for_courier', 'cancelled']),
  ready_for_courier: new Set(['courier_assigned', 'out_for_delivery', 'cancelled']),
  courier_assigned: new Set(['out_for_delivery', 'cancelled']),
  out_for_delivery: new Set(['delivered', 'cancelled']),
  delivered: new Set([]),
  cancelled: new Set([])
};
const ORDER_STATUS_LABELS = {
  created: 'Buyurtma qabul qilindi',
  payment_pending: 'To‘lov tekshirilmoqda',
  payment_confirmed: 'To‘lov tasdiqlandi',
  preparing: 'Yig‘ish jarayonida',
  ready_for_courier: 'Kurier biriktirilmoqda',
  courier_assigned: 'Kurier biriktirildi',
  out_for_delivery: 'Yo‘lda',
  delivered: 'Yetkazib berildi',
  cancelled: 'Bekor qilingan'
};
const PAYMENT_STATUS_LABELS = {
  pending: 'To‘lov tekshirilmoqda',
  unpaid: 'To‘lanmagan',
  paid: 'To‘langan'
};

function normalizeOrderStatus(status) {
  const raw = String(status || '').trim();
  if (!raw) return 'created';
  return ORDER_STATUS_ALIASES[raw] || raw;
}

function applyOrderUpdateTimestamp(order, at = nowIso()) {
  order.updated_at = at;
  order.trackingUpdatedAt = at;
}

function canTransitionOrderStatus(currentStatus, requestedStatus) {
  const from = normalizeOrderStatus(currentStatus);
  const to = normalizeOrderStatus(requestedStatus);
  if (from === to) return true;
  if (TERMINAL_ORDER_STATUSES.has(from)) return false;
  const allowed = ALLOWED_ORDER_TRANSITIONS[from];
  return Boolean(allowed && allowed.has(to));
}

function orderStatusLabel(status) {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[normalized] || normalized || '-';
}

function paymentStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return PAYMENT_STATUS_LABELS[normalized] || normalized || '-';
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      logStructured('error', 'http_5xx_response', {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    }
  });
  next();
});

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

app.get(['/admin-v2', '/admin-v2.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-v2.html'));
});

app.get('/admin-v2.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-v2.css'));
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

app.get('/api/v1/ambient-playlist', (req, res) => {
  const tracks = getAdminAmbientTracksOrdered();
  return res.json({
    ok: true,
    tracks,
    source: tracks.length ? 'admin' : 'default'
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
  const firstNameRaw = req.body.firstName !== undefined ? String(req.body.firstName || '').trim() : '';
  const lastNameRaw = req.body.lastName !== undefined ? String(req.body.lastName || '').trim() : '';
  const combinedName = `${firstNameRaw} ${lastNameRaw}`.trim();
  const name = String(req.body.name || combinedName || '').trim();
  if (!phone || !name) {
    return res.status(400).json({ ok: false, message: 'Name va phone majburiy' });
  }
  const now = nowIso();
  const existingProfile = db.profiles[phone] || {};
  const firstName = firstNameRaw || existingProfile.firstName || '';
  const lastName = lastNameRaw || existingProfile.lastName || '';
  const consentChecked = req.body.biometricConsent === true;
  const consentAtRaw = req.body.biometricConsentAt;
  const selfieRaw = req.body.biometricSelfieDataUrl;
  const capturedAtRaw = req.body.biometricCapturedAt;
  const selfiePayload =
    selfieRaw !== undefined && selfieRaw !== null ? String(selfieRaw).trim() : '';
  const wantsSelfieUpload = selfiePayload.length > 0;

  let biometric = existingProfile.biometric || null;
  if (wantsSelfieUpload) {
    if (!consentChecked) {
      return res.status(400).json({ ok: false, message: 'Biometrik selfie uchun rozilik majburiy' });
    }
    const parsedImage = parseImageDataUrl(selfiePayload);
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
  } else if (consentChecked && biometric) {
    biometric = {
      ...biometric,
      consentGiven: true,
      consentAt: String(consentAtRaw || biometric.consentAt || now)
    };
  }

  const nextAddress =
    req.body.address !== undefined
      ? String(req.body.address || '').trim()
      : String(existingProfile.address || '').trim();

  db.profiles[phone] = {
    ...existingProfile,
    phone,
    name,
    firstName,
    lastName,
    address: nextAddress,
    updatedAt: now,
    biometric
  };
  saveDb();
  return res.json({ ok: true, profile: db.profiles[phone] });
});

app.post('/api/v1/auth/sms/send', (req, res) => {
  handleSmsOtpSend(req, res).catch((error) => {
    logStructured('error', 'sms_send_unhandled', {
      message: error?.message,
      name: error?.name
    });
    res.status(500).json({ ok: false, message: 'Server xatolik' });
  });
});

app.post('/api/v1/auth/sms/verify', handleSmsOtpVerify);

app.post('/api/v1/auth/request-otp', (req, res) => {
  handleSmsOtpSend(req, res).catch((error) => {
    logStructured('error', 'sms_send_unhandled', {
      message: error?.message,
      name: error?.name
    });
    res.status(500).json({ ok: false, message: 'Server xatolik' });
  });
});

app.post('/api/v1/auth/verify-otp', handleSmsOtpVerify);

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
  const createdAt = nowIso();
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
    delivery_status: 'created',
    deliveryEta: String(req.body.deliveryTime || db.homeSettings.deliveryTimeText || '30 daqiqa'),
    items: cartSummary.items,
    subtotal,
    deliveryPrice,
    total,
    created_at: createdAt,
    updated_at: createdAt,
    courierName: '',
    courierPhone: '',
    courierToken: randomId('crt'),
    courierTokenUsed: false,
    courierLocationLat: null,
    courierLocationLng: null,
    courierLocationAccuracy: null,
    courierLocationUpdatedAt: null
  };
  db.orders.unshift(order);
  db.carts[phone] = {};
  saveDb();
  return res.json({ ok: true, orderNumber, status: order.status, paymentStatus: order.paymentStatus });
});

app.get('/api/v1/orders/:orderNumber/status', (req, res) => {
  const order = db.orders.find((o) => String(o.orderNumber) === String(req.params.orderNumber));
  if (!order) return res.status(404).json({ ok: false, message: 'Buyurtma topilmadi' });
  const normalizedStatus = normalizeOrderStatus(order.status);
  return res.json({
    ok: true,
    orderNumber: order.orderNumber,
    status: normalizedStatus,
    statusLabel: orderStatusLabel(normalizedStatus),
    paymentStatus: order.paymentStatus || 'pending',
    paymentStatusLabel: paymentStatusLabel(order.paymentStatus || 'pending'),
    updatedAt: order.updated_at || order.created_at || nowIso()
  });
});

app.get('/api/v1/orders/:orderNumber/track', (req, res) => {
  const order = db.orders.find((o) => String(o.orderNumber) === String(req.params.orderNumber));
  if (!order) return res.status(404).json({ ok: false, message: 'Buyurtma topilmadi' });
  const normalizedStatus = normalizeOrderStatus(order.status);
  const now = Date.now();
  const created = new Date(order.created_at || now).getTime();
  const elapsedMin = Math.max(1, Math.round((now - created) / 60000));
  const statusEtaMinMap = {
    created: 60,
    payment_pending: 55,
    payment_confirmed: 50,
    preparing: 35,
    ready_for_courier: 20,
    courier_assigned: 15,
    out_for_delivery: 12
  };
  const etaBase = statusEtaMinMap[normalizedStatus] || 45;
  const simulatedEtaMin = TERMINAL_ORDER_STATUSES.has(normalizedStatus)
    ? 0
    : Math.max(3, etaBase - Math.floor(elapsedMin / 2));
  const etaLabel = simulatedEtaMin > 59
    ? `${Math.ceil(simulatedEtaMin / 60)} soat`
    : (simulatedEtaMin <= 0 ? (normalizedStatus === 'cancelled' ? 'Bekor qilingan' : 'Yetkazildi') : `${simulatedEtaMin} daqiqa`);
  const latestUpdateAt = order.updated_at || order.created_at || nowIso();
  const payload = orderPublic({
    ...order,
    status: normalizedStatus,
    statusLabel: orderStatusLabel(normalizedStatus),
    paymentStatusLabel: paymentStatusLabel(order.paymentStatus || 'pending'),
    delivery_status: normalizeOrderStatus(order.delivery_status || normalizedStatus),
    deliveryStatusLabel: orderStatusLabel(order.delivery_status || normalizedStatus),
    etaLiveText: etaLabel,
    trackingUpdatedAt: latestUpdateAt
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

app.get('/api/v1/orders-display/feed', (req, res) => {
  const activeStatuses = new Set([
    'created',
    'payment_pending',
    'payment_confirmed',
    'preparing',
    'ready_for_courier',
    'courier_assigned',
    'out_for_delivery',
    'delivered',
    'cancelled'
  ]);
  const feedOrders = db.orders
    .map((order) => ({
      ...order,
      status: normalizeOrderStatus(order.status),
      statusLabel: orderStatusLabel(order.status),
      paymentStatusLabel: paymentStatusLabel(order.paymentStatus || 'pending'),
      delivery_status: normalizeOrderStatus(order.delivery_status || order.status),
      deliveryStatusLabel: orderStatusLabel(order.delivery_status || order.status)
    }))
    .filter((order) => activeStatuses.has(String(order.status || '').trim()))
    .sort((a, b) => {
      const bt = new Date(b.updated_at || b.created_at || 0).getTime();
      const at = new Date(a.updated_at || a.created_at || 0).getTime();
      return bt - at;
    })
    .slice(0, 300)
    .map(orderPublic);
  return res.json({
    ok: true,
    total: feedOrders.length,
    updatedAt: nowIso(),
    orders: feedOrders
  });
});

// Admin v2 API (GlobusMarket visual CMS — Bearer JWT from POST .../login)
app.post('/api/v1/admin-v2/login', (req, res) => {
  const ip = clientIp(req);
  const hit = touchAdminV2Login(ip);
  if (!hit.ok) {
    logStructured('info', 'admin_v2_login_rate_limited', { ip: ip || null });
    return res.status(429).json({
      ok: false,
      message: 'Juda ko‘p urinishlar, birozdan keyin qayta urinib ko‘ring',
      retryAfterMs: hit.retryAfterMs
    });
  }
  const password = req.body?.password;
  if (password === undefined || password === null || typeof password !== 'string') {
    logStructured('info', 'admin_v2_login_bad_request', { ip: ip || null });
    return res.status(400).json({ ok: false, message: 'Parol kiriting' });
  }
  if (!adminV2PasswordMatches(password)) {
    logStructured('info', 'admin_v2_login_failed', { ip: ip || null });
    return res.status(401).json({ ok: false, message: 'Parol noto‘g‘ri' });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const token = adminV2SignJwt({
    typ: 'admin-v2',
    iat: nowSec,
    exp: nowSec + ADMIN_V2_JWT_TTL_SEC
  });
  return res.json({ ok: true, token });
});

app.get('/api/v1/admin-v2/settings/theme', requireAdminV2, (req, res) => {
  return res.json({ ok: true, theme: db.adminV2Theme });
});

app.put('/api/v1/admin-v2/settings/theme', requireAdminV2, (req, res) => {
  const body = req.body || {};
  db.adminV2Theme = {
    ...db.adminV2Theme,
    primaryColor:
      String(body.primaryColor ?? db.adminV2Theme.primaryColor ?? '').trim() || '#4f7dff',
    accentColor:
      String(body.accentColor ?? db.adminV2Theme.accentColor ?? '').trim() || '#6a4dff',
    radiusPx: Math.max(
      0,
      Math.min(48, Number(body.radiusPx ?? db.adminV2Theme.radiusPx ?? 16) || 16)
    )
  };
  db.homeSettings = {
    ...db.homeSettings,
    accentColor: db.adminV2Theme.accentColor
  };
  saveDb();
  return res.json({ ok: true, theme: db.adminV2Theme });
});

app.get('/api/v1/admin-v2/home-settings', requireAdminV2, (req, res) => {
  return res.json({ ok: true, homeSettings: db.homeSettings });
});

app.put('/api/v1/admin-v2/home-settings', requireAdminV2, (req, res) => {
  db.homeSettings = { ...db.homeSettings, ...req.body };
  saveDb();
  return res.json({ ok: true, homeSettings: db.homeSettings });
});

app.post('/api/v1/admin-v2/media/image', requireAdminV2, (req, res) => {
  const parsed = parseImageDataUrl(req.body?.imageDataUrl);
  if (!parsed) {
    return res.status(400).json({ ok: false, message: 'PNG/JPG data URL kiriting' });
  }
  if (parsed.buffer.length > MAX_BANNER_IMAGE_BYTES) {
    return res.status(400).json({ ok: false, message: 'Rasm hajmi juda katta (maks ~2MB)' });
  }
  ensureDir(BANNER_UPLOADS_DIR);
  const fileName = `cms_${Date.now()}_${randomId('img')}.${parsed.ext}`;
  const absolutePath = path.join(BANNER_UPLOADS_DIR, fileName);
  try {
    fs.writeFileSync(absolutePath, parsed.buffer);
  } catch (error) {
    logStructured('error', 'admin_v2_banner_image_write_failed', { message: error?.message });
    return res.status(500).json({ ok: false, message: 'Saqlab bo‘lmadi' });
  }
  const url = `/uploads/banners/${fileName}`;
  return res.json({ ok: true, url });
});

app.get('/api/v1/admin-v2/banners', requireAdminV2, (req, res) => {
  return res.json({ ok: true, banners: db.banners });
});

app.post('/api/v1/admin-v2/banners', requireAdminV2, (req, res) => {
  const item = {
    id: randomId('ban'),
    title: String(req.body.title || '').trim(),
    subtitle: String(req.body.subtitle || '').trim(),
    badge: String(req.body.badge || '').trim(),
    link_url: String(req.body.link_url || '').trim(),
    image_url: String(req.body.image_url || '').trim(),
    active: req.body.active !== false
  };
  db.banners.unshift(item);
  saveDb();
  return res.json({ ok: true, banner: item });
});

app.put('/api/v1/admin-v2/banners/reorder', requireAdminV2, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => String(x)) : [];
  if (!ids.length) return res.status(400).json({ ok: false, message: 'ids massivi kerak' });
  const byId = new Map(db.banners.map((b) => [String(b.id), b]));
  const next = [];
  ids.forEach((id) => {
    const b = byId.get(id);
    if (b) next.push(b);
  });
  db.banners.forEach((b) => {
    if (!next.includes(b)) next.push(b);
  });
  db.banners = next;
  saveDb();
  return res.json({ ok: true, banners: db.banners });
});

app.put('/api/v1/admin-v2/banners/:id', requireAdminV2, (req, res) => {
  const i = db.banners.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Banner topilmadi' });
  db.banners[i] = { ...db.banners[i], ...req.body, id: db.banners[i].id };
  saveDb();
  return res.json({ ok: true, banner: db.banners[i] });
});

app.delete('/api/v1/admin-v2/banners/:id', requireAdminV2, (req, res) => {
  db.banners = db.banners.filter((x) => x.id !== req.params.id);
  saveDb();
  return res.json({ ok: true });
});

app.get('/api/v1/admin-v2/shorts', requireAdminV2, (req, res) => {
  return res.json({ ok: true, shorts: db.shorts || [] });
});

app.post('/api/v1/admin-v2/shorts', requireAdminV2, (req, res) => {
  const shortItem = {
    id: randomId('srt'),
    title: String(req.body.title || '').trim(),
    subtitle: String(req.body.subtitle || '').trim(),
    media_url: String(req.body.media_url || '').trim(),
    thumbnail_url: String(req.body.thumbnail_url || '').trim(),
    sortOrder: Number(req.body.sortOrder || (db.shorts?.length || 0) + 1),
    active: req.body.active !== false
  };
  if (!shortItem.title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  db.shorts.unshift(shortItem);
  saveDb();
  return res.json({ ok: true, short: shortItem });
});

app.put('/api/v1/admin-v2/shorts/reorder', requireAdminV2, (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  if (!order.length) return res.status(400).json({ ok: false, message: 'order massivi kerak' });
  order.forEach((row) => {
    const id = String(row?.id || '');
    const sortOrder = Number(row?.sortOrder);
    const s = (db.shorts || []).find((x) => x.id === id);
    if (s && Number.isFinite(sortOrder)) s.sortOrder = sortOrder;
  });
  saveDb();
  return res.json({ ok: true, shorts: db.shorts || [] });
});

app.put('/api/v1/admin-v2/shorts/:id', requireAdminV2, (req, res) => {
  const i = (db.shorts || []).findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Short topilmadi' });
  const cur = db.shorts[i];
  db.shorts[i] = {
    ...cur,
    ...req.body,
    id: cur.id,
    title: String(req.body.title ?? cur.title ?? '').trim(),
    subtitle: String(req.body.subtitle ?? cur.subtitle ?? '').trim(),
    media_url: String(req.body.media_url ?? cur.media_url ?? '').trim(),
    thumbnail_url: String(req.body.thumbnail_url ?? cur.thumbnail_url ?? '').trim(),
    sortOrder: Number(req.body.sortOrder ?? cur.sortOrder ?? 0),
    active: req.body.active !== undefined ? req.body.active !== false : cur.active !== false
  };
  saveDb();
  return res.json({ ok: true, short: db.shorts[i] });
});

app.delete('/api/v1/admin-v2/shorts/:id', requireAdminV2, (req, res) => {
  db.shorts = (db.shorts || []).filter((s) => s.id !== req.params.id);
  saveDb();
  return res.json({ ok: true });
});

app.get('/api/v1/admin-v2/products', requireAdminV2, (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const products = db.products
    .map(publicProduct)
    .filter((p) => !q || `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q))
    .slice(0, 80);
  return res.json({ ok: true, products, note: 'products-lite: faqat ko‘rish / qidiruv' });
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
    badge: String(req.body.badge || '').trim(),
    link_url: String(req.body.link_url || '').trim(),
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
    thumbnail_url: String(req.body.thumbnail_url || '').trim(),
    sortOrder: Number(req.body.sortOrder || (db.shorts?.length || 0) + 1),
    active: req.body.active !== false
  };
  if (!shortItem.title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  db.shorts.unshift(shortItem);
  saveDb();
  return res.json({ ok: true, short: shortItem });
});
app.put('/api/v1/admin/shorts/:id', requireAdmin, (req, res) => {
  const i = (db.shorts || []).findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: 'Short topilmadi' });
  const cur = db.shorts[i];
  db.shorts[i] = {
    ...cur,
    ...req.body,
    id: cur.id,
    title: String(req.body.title ?? cur.title ?? '').trim(),
    subtitle: String(req.body.subtitle ?? cur.subtitle ?? '').trim(),
    media_url: String(req.body.media_url ?? cur.media_url ?? '').trim(),
    thumbnail_url: String(req.body.thumbnail_url ?? cur.thumbnail_url ?? '').trim(),
    sortOrder: Number(req.body.sortOrder ?? cur.sortOrder ?? 0),
    active: req.body.active !== undefined ? req.body.active !== false : cur.active !== false
  };
  saveDb();
  return res.json({ ok: true, short: db.shorts[i] });
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

app.get('/api/v1/admin/ambient-playlist', requireAdmin, (req, res) => {
  return res.json({
    ok: true,
    maxSlots: ADMIN_AMBIENT_MAX_SLOTS,
    tracks: getAdminAmbientTracksOrdered()
  });
});

app.post('/api/v1/admin/ambient-playlist/slots/:slot', requireAdmin, express.json({ limit: '30mb' }), (req, res) => {
  const slot = Math.round(Number(req.params.slot || 0));
  if (slot < 1 || slot > ADMIN_AMBIENT_MAX_SLOTS) {
    return res.status(400).json({ ok: false, message: 'Slot 1..5 oralig‘ida bo‘lishi kerak' });
  }
  const parsed = parseAudioDataUrl(req.body?.fileDataUrl);
  if (!parsed) {
    return res.status(400).json({ ok: false, message: 'Audio fayl formati noto‘g‘ri (data URL kerak)' });
  }
  if (!ALLOWED_ADMIN_AMBIENT_MIME_TYPES.has(parsed.mimeType)) {
    return res.status(400).json({ ok: false, message: 'Faqat MP3/WAV/OGG/M4A/AAC audio ruxsat etiladi' });
  }
  if (parsed.buffer.length > MAX_ADMIN_AMBIENT_BYTES) {
    return res.status(400).json({ ok: false, message: 'Audio hajmi juda katta (maksimum 12MB)' });
  }
  const ext = adminAmbientExtFromMime(parsed.mimeType);
  if (!ext) {
    return res.status(400).json({ ok: false, message: 'Audio MIME turi qo‘llab-quvvatlanmaydi' });
  }

  ensureDir(ADMIN_AMBIENT_UPLOADS_DIR);
  const originalName = sanitizeFileName(req.body?.fileName || '');
  const baseName = originalName ? originalName.replace(/\.[a-z0-9]+$/i, '') : `slot-${slot}`;
  const fileName = `slot-${slot}-${Date.now()}-${baseName}${ext}`.slice(0, 150);
  const absolutePath = path.join(ADMIN_AMBIENT_UPLOADS_DIR, fileName);

  try {
    fs.writeFileSync(absolutePath, parsed.buffer);
  } catch (error) {
    logStructured('error', 'admin_ambient_write_failed', { message: error?.message || 'failed writing ambient track', slot });
    return res.status(500).json({ ok: false, message: 'Audio faylni saqlab bo‘lmadi' });
  }

  const slots = Array.isArray(db.ambientPlaylist?.slots) ? db.ambientPlaylist.slots : [];
  const existingIx = slots.findIndex((item) => Number(item?.slot) === slot);
  const previousTrack = existingIx >= 0 ? slots[existingIx] : null;
  const nextTrack = {
    slot,
    fileName: originalName || fileName,
    fileUrl: `/uploads/audio/admin-ambient/${fileName}`,
    mimeType: parsed.mimeType,
    fileSize: parsed.buffer.length,
    updatedAt: nowIso()
  };
  if (existingIx >= 0) slots[existingIx] = nextTrack;
  else slots.push(nextTrack);
  db.ambientPlaylist = { slots: slots.sort((a, b) => Number(a.slot) - Number(b.slot)) };
  saveDb();

  if (previousTrack?.fileUrl) {
    const previousName = path.basename(String(previousTrack.fileUrl || ''));
    const previousPath = path.join(ADMIN_AMBIENT_UPLOADS_DIR, previousName);
    if (previousPath !== absolutePath && fs.existsSync(previousPath)) {
      try { fs.unlinkSync(previousPath); } catch {}
    }
  }

  return res.json({
    ok: true,
    track: nextTrack,
    tracks: getAdminAmbientTracksOrdered()
  });
});

app.delete('/api/v1/admin/ambient-playlist/slots/:slot', requireAdmin, (req, res) => {
  const slot = Math.round(Number(req.params.slot || 0));
  if (slot < 1 || slot > ADMIN_AMBIENT_MAX_SLOTS) {
    return res.status(400).json({ ok: false, message: 'Slot 1..5 oralig‘ida bo‘lishi kerak' });
  }
  const slots = Array.isArray(db.ambientPlaylist?.slots) ? db.ambientPlaylist.slots : [];
  const existingIx = slots.findIndex((item) => Number(item?.slot) === slot);
  if (existingIx < 0) {
    return res.json({ ok: true, removed: false, tracks: getAdminAmbientTracksOrdered() });
  }
  const existing = slots[existingIx];
  slots.splice(existingIx, 1);
  db.ambientPlaylist = { slots: slots.sort((a, b) => Number(a.slot) - Number(b.slot)) };
  saveDb();
  if (existing?.fileUrl) {
    const filePath = path.join(ADMIN_AMBIENT_UPLOADS_DIR, path.basename(String(existing.fileUrl)));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
  return res.json({ ok: true, removed: true, tracks: getAdminAmbientTracksOrdered() });
});

app.get('/api/v1/admin/orders', requireAdmin, (req, res) => {
  const orders = db.orders
    .map((order) => ({
      ...order,
      status: normalizeOrderStatus(order.status),
      statusLabel: orderStatusLabel(order.status),
      paymentStatusLabel: paymentStatusLabel(order.paymentStatus || 'pending'),
      delivery_status: normalizeOrderStatus(order.delivery_status || order.status),
      deliveryStatusLabel: orderStatusLabel(order.delivery_status || order.status)
    }))
    .sort((a, b) => {
      const bt = new Date(b.updated_at || b.created_at || 0).getTime();
      const at = new Date(a.updated_at || a.created_at || 0).getTime();
      return bt - at;
    })
    .map(orderPublic);
  res.json({ ok: true, orders });
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
  const currentStatus = normalizeOrderStatus(o.status);
  if (TERMINAL_ORDER_STATUSES.has(currentStatus)) {
    return res.status(409).json({ ok: false, message: `Buyurtma allaqachon yakunlangan (${currentStatus})`, code: 'ORDER_TERMINAL' });
  }
  o.status = 'cancelled';
  o.delivery_status = 'cancelled';
  applyOrderUpdateTimestamp(o);
  saveDb();
  return res.json({ ok: true, order: orderPublic(o) });
});
app.post('/api/v1/admin/orders/:id/assign-courier', requireAdmin, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  const currentStatus = normalizeOrderStatus(o.status);
  if (!canTransitionOrderStatus(currentStatus, 'courier_assigned')) {
    return res.status(409).json({
      ok: false,
      message: `Status o'zgarishi mumkin emas: ${currentStatus} -> courier_assigned`,
      code: 'INVALID_ORDER_TRANSITION'
    });
  }
  o.courierName = String(req.body.courierName || '').trim();
  o.courierPhone = String(req.body.courierPhone || '').trim();
  o.status = 'courier_assigned';
  o.delivery_status = 'courier_assigned';
  applyOrderUpdateTimestamp(o);
  saveDb();
  return res.json({ ok: true, order: orderPublic(o) });
});
app.put('/api/v1/admin/orders/:id/status', requireAdmin, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  const requestedStatusRaw = String(req.body.status || o.status);
  const requestedStatus = normalizeOrderStatus(requestedStatusRaw);
  const currentStatus = normalizeOrderStatus(o.status);
  if (!canTransitionOrderStatus(currentStatus, requestedStatus)) {
    return res.status(409).json({
      ok: false,
      message: `Status o'zgarishi mumkin emas: ${currentStatus} -> ${requestedStatus}`,
      code: 'INVALID_ORDER_TRANSITION'
    });
  }
  o.status = requestedStatus;
  o.delivery_status = o.status;
  if (o.status === 'delivered' && ['pending', 'unpaid'].includes(String(o.paymentStatus || ''))) o.paymentStatus = 'paid';
  if (o.status === 'delivered' || o.status === 'cancelled') o.courierTokenUsed = true;
  ensureCourierToken(o);
  applyOrderUpdateTimestamp(o);
  saveDb();
  return res.json({ ok: true, order: orderPublic(o) });
});

app.get('/api/v1/admin/orders/:id/qr', requireAdmin, async (req, res) => {
  const order = db.orders.find((x) => x.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  ensureCourierToken(order);
  const courierUrl = `${req.protocol}://${req.get('host')}/courier/${encodeURIComponent(order.courierToken)}`;
  try {
    const qrDataUrl = await require('qrcode').toDataURL(courierUrl, { width: 280, margin: 1 });
    saveDb();
    return res.json({ ok: true, courierUrl, qrDataUrl });
  } catch {
    return res.status(500).json({ ok: false, message: 'QR yaratilmadi' });
  }
});

app.get('/api/v1/courier/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = db.orders.find((o) => String(o.courierToken || '') === token);
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  if (order.courierTokenUsed && !['out_for_delivery', 'courier_assigned'].includes(normalizeOrderStatus(order.status))) {
    return res.status(410).json({ ok: false, message: 'Bu QR kod yaroqsiz yoki ishlatilgan' });
  }
  return res.json({ ok: true, order: orderPublic(order) });
});

app.post('/api/v1/courier/:token/accept', (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = db.orders.find((o) => String(o.courierToken || '') === token);
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  const currentStatus = normalizeOrderStatus(order.status);
  if (!canTransitionOrderStatus(currentStatus, 'out_for_delivery')) {
    return res.status(409).json({ ok: false, message: `Bu statusda qabul qilib bo'lmaydi: ${currentStatus}` });
  }
  order.courierName = String(req.body.courierName || order.courierName || '').trim();
  order.courierPhone = String(req.body.courierPhone || order.courierPhone || '').trim();
  order.status = 'out_for_delivery';
  order.delivery_status = 'out_for_delivery';
  order.courierTokenUsed = false;
  applyOrderUpdateTimestamp(order);
  saveDb();
  return res.json({ ok: true, order: orderPublic(order) });
});

app.post('/api/v1/courier/:token/location', (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = db.orders.find((o) => String(o.courierToken || '') === token);
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  if (normalizeOrderStatus(order.status) !== 'out_for_delivery') {
    return res.status(409).json({ ok: false, message: 'Lokatsiya faqat yo‘lda statusida qabul qilinadi' });
  }
  const lat = toFiniteNumber(req.body.lat);
  const lng = toFiniteNumber(req.body.lng);
  if (!isValidLatLng(lat, lng)) return res.status(400).json({ ok: false, message: 'Lokatsiya noto‘g‘ri' });
  order.courierLocationLat = lat;
  order.courierLocationLng = lng;
  order.courierLocationAccuracy = toFiniteNumber(req.body.accuracy);
  order.courierLocationUpdatedAt = nowIso();
  applyOrderUpdateTimestamp(order);
  saveDb();
  return res.json({ ok: true, order: orderPublic(order) });
});

app.post('/api/v1/courier/:token/deliver', (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = db.orders.find((o) => String(o.courierToken || '') === token);
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  const currentStatus = normalizeOrderStatus(order.status);
  if (!canTransitionOrderStatus(currentStatus, 'delivered')) {
    return res.status(409).json({ ok: false, message: `Buyurtma bu holatda yopilmaydi: ${currentStatus}` });
  }
  order.status = 'delivered';
  order.delivery_status = 'delivered';
  if (['pending', 'unpaid'].includes(String(order.paymentStatus || ''))) order.paymentStatus = 'paid';
  order.courierTokenUsed = true;
  applyOrderUpdateTimestamp(order);
  saveDb();
  return res.json({ ok: true, order: orderPublic(order) });
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
