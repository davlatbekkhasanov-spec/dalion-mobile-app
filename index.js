const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const smsService = require('./src/services/sms.service');
const prisma = require('./src/prisma-client');
const marketplaceRepo = require('./src/marketplace-repository');
const r2Service = require('./src/services/r2.service');

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
const MAX_PRODUCT_IMAGE_BYTES = Math.min(
  12 * 1024 * 1024,
  Math.max(MAX_BANNER_IMAGE_BYTES, Number(process.env.MAX_PRODUCT_IMAGE_BYTES || 6 * 1024 * 1024) || 6 * 1024 * 1024)
);
const BIOMETRIC_UPLOADS_DIR = path.join(__dirname, 'uploads', 'biometric');
const ADMIN_AMBIENT_UPLOADS_DIR = path.join(__dirname, 'uploads', 'audio', 'admin-ambient');
const MAX_BIOMETRIC_BYTES = 1.5 * 1024 * 1024;
const MAX_ADMIN_AMBIENT_BYTES = 12 * 1024 * 1024;
const SHORTS_VIDEO_UPLOADS_DIR = path.join(__dirname, 'uploads', 'shorts');
const PRODUCTS_UPLOADS_DIR = path.join(__dirname, 'uploads', 'products');
const CATEGORY_UPLOADS_DIR = path.join(__dirname, 'uploads', 'categories');
const GENERIC_MEDIA_UPLOADS_DIR = path.join(__dirname, 'uploads', 'uploads');
const MAX_SHORTS_VIDEO_BYTES = Math.min(
  200 * 1024 * 1024,
  Math.max(
    512 * 1024,
    Number(process.env.MAX_SHORTS_VIDEO_BYTES || 30 * 1024 * 1024) || 30 * 1024 * 1024
  )
);
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

function isEphemeralUploadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.startsWith('/uploads/')) return true;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return u.pathname.startsWith('/uploads/');
    } catch (_) {
      return false;
    }
  }
  return false;
}

function validateShortMediaDurability(mediaUrl, thumbnailUrl) {
  if (!r2Service.shouldUseR2()) return null;
  const m = String(mediaUrl || '').trim();
  const t = String(thumbnailUrl || '').trim();
  if (!isEphemeralUploadUrl(m) && !isEphemeralUploadUrl(t)) return null;
  return 'R2 yoqilgan paytda /uploads/... URL qabul qilinmaydi. Aks holda deploydan keyin short yo‘qoladi. Videoni/eskizni qayta yuklang (R2 URL bilan).';
}

function localUploadPathFromUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  let relPath = '';
  if (raw.startsWith('/uploads/')) {
    relPath = raw.slice('/uploads/'.length);
  } else if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (!u.pathname.startsWith('/uploads/')) return null;
      relPath = u.pathname.slice('/uploads/'.length);
    } catch (_) {
      return null;
    }
  } else {
    return null;
  }
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  return path.join(__dirname, 'uploads', normalized);
}

function inferContentTypeFromPath(filePath, fallbackPrefix) {
  const ext = String(path.extname(filePath || '') || '').toLowerCase();
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return fallbackPrefix === 'shorts' ? 'video/mp4' : 'image/jpeg';
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
  await marketplaceRepo.writeSmsChallenge(phone, {
    codeHash,
    expiresAt,
    attempts: 0,
    createdAt: nowIso()
  });

  const sendResult = await smsService.sendSmsOtp(phone, code);
  if (!sendResult.ok) {
    await marketplaceRepo.deleteSmsChallenge(phone);
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

async function handleSmsOtpVerify(req, res) {
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

  const ch = await marketplaceRepo.readSmsChallenge(phone);
  if (!ch || Date.now() > ch.expiresAt.getTime()) {
    return res.status(400).json({ ok: false, message: 'Kod eskirgan yoki yuborilmagan' });
  }
  const nextAttempts = Math.min(99, Number(ch.attempts || 0) + 1);
  await marketplaceRepo.touchSmsAttempt(phone, nextAttempts);
  if (nextAttempts > 10) {
    await marketplaceRepo.deleteSmsChallenge(phone);
    return res.status(429).json({ ok: false, message: 'Urinishlar limiti' });
  }
  if (hashSmsOtp(phone, code) !== ch.codeHash) {
    return res.status(400).json({ ok: false, message: 'Kod noto‘g‘ri' });
  }
  await marketplaceRepo.deleteSmsChallenge(phone);

  const existing = await marketplaceRepo.getUserProfile(phone);
  const profileBody = {
    name: existing?.name || phone,
    firstName: existing?.firstName || '',
    lastName: existing?.lastName || '',
    address: existing?.address || '',
    biometric: existing?.biometric ?? undefined,
    notificationsRead: existing?.notificationsRead ?? undefined
  };
  const saved = await marketplaceRepo.upsertUserProfile(phone, profileBody);
  const profile = {
    ...(await marketplaceRepo.profileToApi(saved)),
    phoneVerified: true,
    smsVerifiedAt: nowIso()
  };

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

const ALLOWED_ADMIN_V2_IMAGE_PURPOSES = new Set(['banner', 'shorts', 'generic', 'products']);
const ALLOWED_ADMIN_V2_IMAGE_MIME = new Set(['image/png', 'image/jpeg']);
const ALLOWED_SHORTS_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp'
]);

/** Browsers often send application/octet-stream for phone recordings; trust extension only in that case. */
function normalizeShortsUploadMime(file) {
  const raw = String(file?.mimetype || '').toLowerCase();
  if (ALLOWED_SHORTS_VIDEO_MIME.has(raw)) return raw;
  const loose =
    raw === 'application/octet-stream' ||
    raw === 'binary/octet-stream' ||
    raw === '';
  if (!loose) return '';
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.m4v') return 'video/x-m4v';
  if (ext === '.3gp') return 'video/3gpp';
  if (ext === '.mp4') return 'video/mp4';
  return '';
}

function normalizeAdminV2ImagePurpose(raw) {
  const p = String(raw === undefined || raw === null ? 'banner' : raw)
    .trim()
    .toLowerCase();
  if (ALLOWED_ADMIN_V2_IMAGE_PURPOSES.has(p)) return p;
  return 'banner';
}

function resolveAdminV2ImageStorage(purpose) {
  switch (purpose) {
    case 'shorts':
      return { localDir: SHORTS_VIDEO_UPLOADS_DIR, urlPathSegment: 'shorts', r2Prefix: 'shorts' };
    case 'generic':
      return { localDir: GENERIC_MEDIA_UPLOADS_DIR, urlPathSegment: 'uploads', r2Prefix: 'uploads' };
    case 'products':
      return { localDir: PRODUCTS_UPLOADS_DIR, urlPathSegment: 'products', r2Prefix: 'products' };
    default:
      return { localDir: BANNER_UPLOADS_DIR, urlPathSegment: 'banners', r2Prefix: 'banners' };
  }
}

const shortsVideoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDir(SHORTS_VIDEO_UPLOADS_DIR);
      cb(null, SHORTS_VIDEO_UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const mime = normalizeShortsUploadMime(file) || String(file.mimetype || '').toLowerCase();
      let ext = '.mp4';
      if (mime === 'video/webm') ext = '.webm';
      else if (mime === 'video/quicktime') ext = '.mov';
      else if (mime === 'video/x-m4v' || mime === 'video/3gpp') ext = '.mp4';
      cb(null, `short_${Date.now()}_${randomId('v')}${ext}`);
    }
  }),
  limits: { fileSize: MAX_SHORTS_VIDEO_BYTES },
  fileFilter: (req, file, cb) => {
    if (normalizeShortsUploadMime(file)) return cb(null, true);
    cb(new Error('UNSUPPORTED_VIDEO'));
  }
});

const categoryImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BANNER_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    const m = String(file.mimetype || '').toLowerCase();
    if (ALLOWED_ADMIN_V2_IMAGE_MIME.has(m)) return cb(null, true);
    cb(new Error('UNSUPPORTED_CATEGORY_IMAGE'));
  }
});

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

function normalizeStoredOrder(order) {
  if (!order) return order;
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
}

async function bumpShortsBroadcast(shortItem) {
  if (!shortItem || shortItem.active === false) return;
  const apiShape = {
    id: shortItem.id,
    title: shortItem.title,
    subtitle: shortItem.subtitle || '',
    media_url: shortItem.media_url || '',
    thumbnail_url: shortItem.thumbnail_url || '',
    active: shortItem.active !== false,
    sortOrder: Number(shortItem.sortOrder || 0)
  };
  await marketplaceRepo.bumpShortsBroadcastRepo(apiShape);
}

async function getAdminAmbientTracksOrdered() {
  return marketplaceRepo.listAmbientTracks();
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

async function findProductById(id) {
  return marketplaceRepo.findProductById(id);
}

async function getCartItems(phone) {
  const lines = await marketplaceRepo.getCartLines(phone);
  const items = [];
  for (const line of lines) {
    const product = await marketplaceRepo.findProductById(line.productId);
    if (!product) continue;
    const qty = Math.max(0, Number(line.quantity || 0));
    if (qty <= 0) continue;
    const pp = marketplaceRepo.productToPublic(product);
    const unit = toMoney(pp.price);
    items.push({
      id: pp.id,
      name: pp.name,
      price: unit,
      quantity: qty,
      subtotal: unit * qty,
      image_url: pp.image_url || ''
    });
  }
  return items;
}

async function buildCartSummary(phone) {
  const items = await getCartItems(phone);
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  return { items, totalQty, subtotal };
}

function publicProduct(product) {
  return marketplaceRepo.productToPublic(product);
}

function orderPublic(order) {
  const base = normalizeStoredOrder(order);
  return {
    ...base,
    items: Array.isArray(base.items) ? base.items : []
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
app.get('/api/v1/home', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    const homeSettings = await marketplaceRepo.getHomeSettingsJson();
    const shortsAll = await marketplaceRepo.listShortsApi();
    let activeShorts = shortsAll
      .filter((item) => item && item.active !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    if (r2Service.shouldUseR2()) {
      activeShorts = activeShorts.filter((item) => {
        const mediaUrl = String(item?.media_url || '').trim();
        const thumbUrl = String(item?.thumbnail_url || '').trim();
        return !isEphemeralUploadUrl(mediaUrl) && !isEphemeralUploadUrl(thumbUrl);
      });
    }
    const bannersRaw = await marketplaceRepo.listBannersOrdered();
    const promos = await marketplaceRepo.listPromotionsApi();
    return res.json({
      ok: true,
      home_settings: homeSettings,
      banners: bannersRaw.filter((b) => b.active !== false).map(marketplaceRepo.bannerToApi),
      promotions: promos.filter((p) => p.active !== false),
      shorts: activeShorts,
      shortsRevision: await marketplaceRepo.getShortsRevision(),
      delivery_info: {
        location: homeSettings.locationText || 'Toshkent shahri',
        time: homeSettings.deliveryTimeText || '30 daqiqa',
        price: 18000
      }
    });
  } catch (e) {
    logStructured('error', 'home_api_failed', { message: e?.message });
    return res.status(500).json({ ok: false, message: 'Server xatolik' });
  }
});

app.get('/api/v1/shorts/meta', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  return res.json({ ok: true, shortsRevision: await marketplaceRepo.getShortsRevision() });
});

app.post('/api/v1/shorts/:id/view', async (req, res) => {
  const phone = getUserPhone(req);
  await marketplaceRepo.recordShortViewEvent(req.params.id, phone || null);
  return res.json({ ok: true });
});

app.get('/api/v1/ambient-playlist', async (req, res) => {
  const tracks = await getAdminAmbientTracksOrdered();
  return res.json({
    ok: true,
    tracks,
    source: tracks.length ? 'admin' : 'default'
  });
});

app.get('/api/v1/products', async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 40)));
  try {
    const out = await marketplaceRepo.listProductsPublicPage({ page, limit });
    return res.json({
      ok: true,
      page: out.page,
      limit: out.limit,
      total: out.total,
      hasMore: out.hasMore,
      items: out.items
    });
  } catch (e) {
    logStructured('error', 'products_page_failed', { message: e?.message });
    return res.status(500).json({ ok: false, message: 'Server xatolik' });
  }
});

app.get('/api/v1/products/:id', async (req, res) => {
  try {
    const row = await findProductById(req.params.id);
    if (!row || row.active === false) {
      return res.status(404).json({ ok: false, message: 'Mahsulot topilmadi' });
    }
    return res.json({ ok: true, product: publicProduct(row) });
  } catch (e) {
    logStructured('error', 'product_by_id_failed', { message: e?.message });
    return res.status(500).json({ ok: false, message: 'Server xatolik' });
  }
});

app.put('/api/v1/profile', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const firstNameRaw = req.body.firstName !== undefined ? String(req.body.firstName || '').trim() : '';
  const lastNameRaw = req.body.lastName !== undefined ? String(req.body.lastName || '').trim() : '';
  const combinedName = `${firstNameRaw} ${lastNameRaw}`.trim();
  const name = String(req.body.name || combinedName || '').trim();
  if (!phone || !name) {
    return res.status(400).json({ ok: false, message: 'Name va phone majburiy' });
  }
  const now = nowIso();
  const existingRow = await marketplaceRepo.getUserProfile(phone);
  const existingProfile = existingRow ? await marketplaceRepo.profileToApi(existingRow) : {};
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

  const saved = await marketplaceRepo.upsertUserProfile(phone, {
    name,
    firstName,
    lastName,
    address: nextAddress,
    biometric
  });
  return res.json({ ok: true, profile: await marketplaceRepo.profileToApi(saved) });
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

app.get('/api/v1/cart', async (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.json({ ok: true, items: [], totalQty: 0, subtotal: 0 });
  return res.json({ ok: true, ...(await buildCartSummary(phone)) });
});

app.put('/api/v1/cart/items', async (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.status(401).json({ ok: false, message: 'x-user-phone yuboring' });
  const productId = String(req.body.productId || '');
  const quantity = Math.max(0, Math.round(Number(req.body.quantity || 0)));
  const product = await findProductById(productId);
  if (!product) return res.status(404).json({ ok: false, message: 'Mahsulot topilmadi' });
  const qty = quantity === 0
    ? 0
    : Math.min(quantity, Math.max(0, Number(product.stock || 0)));
  await marketplaceRepo.setCartQuantity(phone, productId, qty);
  return res.json({ ok: true, ...(await buildCartSummary(phone)) });
});

app.post('/api/v1/orders', async (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.status(401).json({ ok: false, message: 'Foydalanuvchi tasdiqlanmagan' });
  const cartSummary = await buildCartSummary(phone);
  if (!cartSummary.items.length) return res.status(400).json({ ok: false, message: 'Savat bo‘sh' });
  const profileRow = await marketplaceRepo.getUserProfile(phone);
  const profileApi = profileRow ? await marketplaceRepo.profileToApi(profileRow) : {};
  const profile = { name: profileApi.name || 'Mehmon', address: profileApi.address || '' };
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
  const orderNumber = await marketplaceRepo.nextOrderNumber();
  const homeSettings = await marketplaceRepo.getHomeSettingsJson();
  const courierToken = randomId('crt');
  const deliveryAddr = String(req.body.addressText || req.body.location || profile.address || '').trim();
  const itemCreates = cartSummary.items.map((it) => ({
    productId: String(it.id),
    productName: String(it.name || ''),
    quantity: Math.max(0, Number(it.quantity || 0)),
    price: Math.round(Number(it.price || 0)),
    imageUrl: String(it.image_url || '')
  }));
  const created = await marketplaceRepo.createOrderWithItems(
    {
      orderNumber,
      status: 'created',
      customerName: profile.name || 'Mehmon',
      customerPhone: phone,
      deliveryAddress: deliveryAddr,
      subtotal,
      deliveryPrice,
      total,
      paymentMethod: String(req.body.paymentMethod || 'cash'),
      paymentStatus: String(req.body.paymentStatus || 'pending'),
      deliveryStatus: 'created',
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
      deliveryEta: String(req.body.deliveryTime || homeSettings.deliveryTimeText || '30 daqiqa'),
      courierName: '',
      courierPhone: '',
      courierToken,
      courierTokenUsed: false,
      courierLocationLat: null,
      courierLocationLng: null,
      courierLocationAccuracy: null,
      courierLocationUpdatedAt: null,
      trackingUpdatedAt: new Date()
    },
    itemCreates
  );
  await marketplaceRepo.clearCart(phone);
  return res.json({
    ok: true,
    orderNumber,
    status: created.status,
    paymentStatus: created.paymentStatus
  });
});

app.get('/api/v1/orders/:orderNumber/status', async (req, res) => {
  const order = await marketplaceRepo.loadOrderLegacy({ orderNumber: String(req.params.orderNumber) });
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

app.get('/api/v1/orders/:orderNumber/track', async (req, res) => {
  const order = await marketplaceRepo.loadOrderLegacy({ orderNumber: String(req.params.orderNumber) });
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

app.get('/api/v1/notifications', async (req, res) => {
  const phone = getUserPhone(req);
  const userRow = phone ? await marketplaceRepo.getUserProfile(phone) : null;
  const readRaw =
    userRow?.notificationsRead && typeof userRow.notificationsRead === 'object'
      ? userRow.notificationsRead
      : {};
  const readMap = readRaw;
  const notifications = (await marketplaceRepo.listNotificationsApi())
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map((item) => ({
      ...item,
      read: Boolean(readMap[item.id])
    }));
  const unreadCount = notifications.filter((n) => !n.read).length;
  return res.json({ ok: true, notifications, unreadCount });
});

app.post('/api/v1/notifications/read-all', async (req, res) => {
  const phone = getUserPhone(req);
  if (!phone) return res.status(401).json({ ok: false, message: 'x-user-phone yuboring' });
  const existing = await marketplaceRepo.getUserProfile(phone);
  const baseName = existing?.name || phone;
  const read = { ...(existing?.notificationsRead && typeof existing.notificationsRead === 'object' ? existing.notificationsRead : {}) };
  const all = await marketplaceRepo.listNotificationsApi();
  all.forEach((n) => {
    read[n.id] = true;
  });
  await marketplaceRepo.upsertUserProfile(phone, {
    name: existing?.name || baseName,
    firstName: existing?.firstName ?? undefined,
    lastName: existing?.lastName ?? undefined,
    address: existing?.address ?? undefined,
    biometric: existing?.biometric ?? undefined,
    notificationsRead: read
  });
  return res.json({ ok: true });
});

app.post('/api/v1/orders/:orderNumber/feedback', async (req, res) => {
  const legacy = await marketplaceRepo.loadOrderLegacy({ orderNumber: String(req.params.orderNumber) });
  if (!legacy) return res.status(404).json({ ok: false, message: 'Buyurtma topilmadi' });
  const updated = await marketplaceRepo.patchOrderScalars(legacy.id, {
    feedbackRating: Number(req.body.feedbackRating || 0),
    feedbackComment: String(req.body.feedbackComment || '').trim(),
    feedbackAt: new Date(),
    trackingUpdatedAt: new Date()
  });
  return res.json({ ok: true, order: orderPublic(updated) });
});

app.get('/api/v1/customer/orders', async (req, res) => {
  const phone = normalizePhone(req.query.phone);
  if (!phone) return res.status(400).json({ ok: false, message: 'phone query kerak' });
  const all = await marketplaceRepo.listOrdersLegacySorted();
  const orders = all.filter((o) => String(o.customerPhone) === phone).map(orderPublic);
  return res.json({ ok: true, orders });
});

app.get('/api/v1/orders-display/feed', async (req, res) => {
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
  const allOrders = await marketplaceRepo.listOrdersForFeed();
  const feedOrders = allOrders
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

app.get('/api/v1/admin-v2/settings/theme', requireAdminV2, async (req, res) => {
  return res.json({ ok: true, theme: await marketplaceRepo.getAdminV2ThemeJson() });
});

app.put('/api/v1/admin-v2/settings/theme', requireAdminV2, async (req, res) => {
  const body = req.body || {};
  const prev = await marketplaceRepo.getAdminV2ThemeJson();
  const nextTheme = {
    ...prev,
    primaryColor:
      String(body.primaryColor ?? prev.primaryColor ?? '').trim() || '#4f7dff',
    accentColor:
      String(body.accentColor ?? prev.accentColor ?? '').trim() || '#6a4dff',
    radiusPx: Math.max(
      0,
      Math.min(48, Number(body.radiusPx ?? prev.radiusPx ?? 16) || 16)
    )
  };
  await marketplaceRepo.setAdminV2ThemeJson(nextTheme);
  await marketplaceRepo.mergeHomeSettings({ accentColor: nextTheme.accentColor });
  return res.json({ ok: true, theme: nextTheme });
});

app.get('/api/v1/admin-v2/home-settings', requireAdminV2, async (req, res) => {
  return res.json({ ok: true, homeSettings: await marketplaceRepo.getHomeSettingsJson() });
});

app.put('/api/v1/admin-v2/home-settings', requireAdminV2, async (req, res) => {
  const next = await marketplaceRepo.mergeHomeSettings(req.body || {});
  return res.json({ ok: true, homeSettings: next });
});

app.post('/api/v1/admin-v2/media/image', requireAdminV2, async (req, res) => {
  const purpose = normalizeAdminV2ImagePurpose(req.body?.purpose);
  const maxImageBytes = purpose === 'products' ? MAX_PRODUCT_IMAGE_BYTES : MAX_BANNER_IMAGE_BYTES;
  const parsed = parseImageDataUrl(req.body?.imageDataUrl);
  if (!parsed) {
    return res.status(400).json({ ok: false, message: 'PNG/JPG data URL kiriting' });
  }
  const mimeLower = String(parsed.mimeType || '').toLowerCase();
  if (!ALLOWED_ADMIN_V2_IMAGE_MIME.has(mimeLower)) {
    return res.status(400).json({ ok: false, message: 'Faqat PNG yoki JPG ruxsat etiladi' });
  }
  if (parsed.buffer.length > maxImageBytes) {
    const mb = Math.round(maxImageBytes / (1024 * 1024));
    return res.status(400).json({
      ok: false,
      message:
        purpose === 'products'
          ? `Mahsulot rasmi juda katta (maks ~${mb}MB)`
          : 'Rasm hajmi juda katta (maks ~2MB)'
    });
  }
  const { localDir, urlPathSegment, r2Prefix } = resolveAdminV2ImageStorage(purpose);
  const stem =
    purpose === 'shorts' ? 'short_thumb' : purpose === 'products' ? 'product' : 'cms';
  const fileName = `${stem}_${Date.now()}_${randomId('img')}.${parsed.ext}`;

  if (r2Service.shouldUseR2()) {
    const key = r2Service.buildObjectKey(r2Prefix, fileName);
    try {
      const { url } = await r2Service.uploadToR2(parsed.buffer, key, mimeLower);
      return res.json({ ok: true, url });
    } catch (error) {
      logStructured('error', 'admin_v2_media_image_r2_failed', {
        message: error?.message,
        purpose
      });
      if (purpose === 'shorts') {
        return res.status(503).json({
          ok: false,
          message:
            'R2 ga yuklash amalga oshmadi (kalitlar / tarmoq). Shorts uchun mahalliy disk ishlatilmaydi — Railway deployda fayllar yo‘qolardi. R2 ni tekshirib qayta urinib ko‘ring.'
        });
      }
      logStructured('warn', 'admin_v2_media_image_r2_failed_fallback_local', { message: error?.message });
      ensureDir(localDir);
      const absolutePath = path.join(localDir, fileName);
      try {
        fs.writeFileSync(absolutePath, parsed.buffer);
      } catch (writeErr) {
        logStructured('error', 'admin_v2_banner_image_write_failed', { message: writeErr?.message });
        return res.status(500).json({ ok: false, message: 'Saqlab bo‘lmadi' });
      }
      const url = `/uploads/${urlPathSegment}/${fileName}`;
      return res.json({ ok: true, url });
    }
  }

  ensureDir(localDir);
  const absolutePath = path.join(localDir, fileName);
  try {
    fs.writeFileSync(absolutePath, parsed.buffer);
  } catch (error) {
    logStructured('error', 'admin_v2_banner_image_write_failed', { message: error?.message });
    return res.status(500).json({ ok: false, message: 'Saqlab bo‘lmadi' });
  }
  const url = `/uploads/${urlPathSegment}/${fileName}`;
  return res.json({ ok: true, url });
});

app.post('/api/v1/admin-v2/media/video', requireAdminV2, (req, res) => {
  shortsVideoUpload.single('video')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          ok: false,
          message: `Video juda katta (maks ${Math.round(MAX_SHORTS_VIDEO_BYTES / (1024 * 1024))}MB)`
        });
      }
      return res.status(400).json({
        ok: false,
        message: 'Faqat MP4, WebM yoki MOV video yuklang'
      });
    }
    const f = req.file;
    if (!f) return res.status(400).json({ ok: false, message: 'Video fayl kerak (maydon nomi: video)' });
    const baseName = path.basename(f.filename);
    const mimeLower = normalizeShortsUploadMime(f) || String(f.mimetype || '').toLowerCase();
    if (!ALLOWED_SHORTS_VIDEO_MIME.has(mimeLower)) {
      try {
        fs.unlinkSync(f.path);
      } catch (_) {}
      return res.status(400).json({
        ok: false,
        message: 'Faqat MP4, WebM yoki MOV video yuklang'
      });
    }

    if (r2Service.shouldUseR2()) {
      try {
        const buf = fs.readFileSync(f.path);
        const key = r2Service.buildObjectKey('shorts', baseName);
        const { url } = await r2Service.uploadToR2(buf, key, mimeLower);
        try {
          fs.unlinkSync(f.path);
        } catch (_) {}
        return res.json({ ok: true, url });
      } catch (error) {
        logStructured('error', 'admin_v2_media_video_r2_failed', { message: error?.message });
        try {
          fs.unlinkSync(f.path);
        } catch (_) {}
        return res.status(503).json({
          ok: false,
          message:
            'R2 ga video yuklanmadi (kalitlar / tarmoq). Mahalliy URL berilmaydi — Railway deploydan keyin yo‘qolardi. R2 ni tekshirib qayta yuklang.'
        });
      }
    }

    const url = `/uploads/shorts/${baseName}`;
    return res.json({ ok: true, url });
  });
});

app.get('/api/v1/admin-v2/banners', requireAdminV2, async (req, res) => {
  const rows = await marketplaceRepo.listBannersOrdered();
  return res.json({ ok: true, banners: rows.map(marketplaceRepo.bannerToApi) });
});

app.post('/api/v1/admin-v2/banners', requireAdminV2, async (req, res) => {
  const item = await marketplaceRepo.createBannerApiShape({
    title: String(req.body.title || '').trim(),
    subtitle: String(req.body.subtitle || '').trim(),
    badge: String(req.body.badge || '').trim(),
    link_url: String(req.body.link_url || '').trim(),
    image_url: String(req.body.image_url || '').trim(),
    active: req.body.active !== false
  });
  return res.json({ ok: true, banner: item });
});

app.put('/api/v1/admin-v2/banners/reorder', requireAdminV2, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => String(x)) : [];
  if (!ids.length) return res.status(400).json({ ok: false, message: 'ids massivi kerak' });
  const banners = await marketplaceRepo.reorderBanners(ids);
  return res.json({ ok: true, banners });
});

app.put('/api/v1/admin-v2/banners/:id', requireAdminV2, async (req, res) => {
  const updated = await marketplaceRepo.updateBanner(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, message: 'Banner topilmadi' });
  return res.json({ ok: true, banner: updated });
});

app.delete('/api/v1/admin-v2/banners/:id', requireAdminV2, async (req, res) => {
  await marketplaceRepo.deleteBanner(req.params.id);
  return res.json({ ok: true });
});

app.get('/api/v1/admin-v2/shorts', requireAdminV2, async (req, res) => {
  return res.json({ ok: true, shorts: await marketplaceRepo.listShortsApi() });
});

app.post('/api/v1/admin-v2/shorts', requireAdminV2, async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  const mediaUrlIn = String(req.body.media_url || '').trim();
  if (!mediaUrlIn) {
    return res.status(400).json({
      ok: false,
      message: 'Video majburiy — avval MP4/WebM/MOV faylni yuklang yoki media URL kiriting'
    });
  }
  const durabilityError = validateShortMediaDurability(
    req.body.media_url,
    req.body.thumbnail_url
  );
  if (durabilityError) return res.status(400).json({ ok: false, message: durabilityError });
  const count = (await marketplaceRepo.listShortsApi()).length;
  const shortItem = await marketplaceRepo.createShortApi({
    title,
    subtitle: String(req.body.subtitle ?? req.body.caption ?? '').trim(),
    media_url: String(req.body.media_url || '').trim(),
    thumbnail_url: String(req.body.thumbnail_url || '').trim(),
    sortOrder: Number(req.body.sortOrder || count + 1),
    active: req.body.active !== false
  });
  await bumpShortsBroadcast(shortItem);
  return res.json({ ok: true, short: shortItem });
});

app.post('/api/v1/admin-v2/shorts/repair-storage', requireAdminV2, async (req, res) => {
  if (!r2Service.shouldUseR2()) {
    return res.status(400).json({
      ok: false,
      message: 'R2 sozlanmagan. Repair faqat R2 yoqilganda ishlaydi.'
    });
  }
  const shorts = await marketplaceRepo.listShortsApi();
  const report = {
    scanned: shorts.length,
    updated: 0,
    skipped: 0,
    missing_files: 0,
    failed: 0,
    details: []
  };

  for (const s of shorts) {
    const fields = [
      { key: 'media_url', value: String(s.media_url || '').trim(), prefix: 'shorts' },
      { key: 'thumbnail_url', value: String(s.thumbnail_url || '').trim(), prefix: 'shorts' }
    ];
    const patch = {};

    for (const field of fields) {
      if (!isEphemeralUploadUrl(field.value)) continue;
      const localPath = localUploadPathFromUrl(field.value);
      if (!localPath || !fs.existsSync(localPath)) {
        report.missing_files += 1;
        report.details.push({
          short_id: s.id,
          field: field.key,
          status: 'missing_local_file',
          from: field.value
        });
        continue;
      }
      try {
        const buf = fs.readFileSync(localPath);
        const key = r2Service.buildObjectKey(field.prefix, path.basename(localPath));
        const contentType = inferContentTypeFromPath(localPath, field.prefix);
        const out = await r2Service.uploadToR2(buf, key, contentType);
        patch[field.key] = out.url;
      } catch (e) {
        report.failed += 1;
        report.details.push({
          short_id: s.id,
          field: field.key,
          status: 'upload_failed',
          from: field.value,
          message: e?.message || 'upload failed'
        });
      }
    }

    const hasPatch = Object.keys(patch).length > 0;
    if (!hasPatch) {
      report.skipped += 1;
      continue;
    }

    try {
      await marketplaceRepo.updateShortApi(s.id, patch);
      report.updated += 1;
      report.details.push({
        short_id: s.id,
        status: 'updated',
        fields: Object.keys(patch)
      });
    } catch (e) {
      report.failed += 1;
      report.details.push({
        short_id: s.id,
        status: 'update_failed',
        fields: Object.keys(patch),
        message: e?.message || 'update failed'
      });
    }
  }

  if (report.updated > 0) await marketplaceRepo.bumpShortsRevision();
  return res.json({ ok: true, report });
});

app.put('/api/v1/admin-v2/shorts/reorder', requireAdminV2, async (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  if (!order.length) return res.status(400).json({ ok: false, message: 'order massivi kerak' });
  const shorts = await marketplaceRepo.reorderShorts(order);
  await marketplaceRepo.bumpShortsRevision();
  return res.json({ ok: true, shorts });
});

app.put('/api/v1/admin-v2/shorts/:id', requireAdminV2, async (req, res) => {
  const curList = await marketplaceRepo.listShortsApi();
  const cur = curList.find((x) => x.id === req.params.id);
  if (!cur) return res.status(404).json({ ok: false, message: 'Short topilmadi' });
  const nextMedia = req.body.media_url !== undefined ? req.body.media_url : cur.media_url;
  const nextThumb = req.body.thumbnail_url !== undefined ? req.body.thumbnail_url : cur.thumbnail_url;
  const durabilityError = validateShortMediaDurability(nextMedia, nextThumb);
  if (durabilityError) return res.status(400).json({ ok: false, message: durabilityError });
  const wasActive = cur.active !== false;
  const updated = await marketplaceRepo.updateShortApi(req.params.id, req.body || {});
  const nowActive = updated.active !== false;
  if (!wasActive && nowActive) await bumpShortsBroadcast(updated);
  else await marketplaceRepo.bumpShortsRevision();
  return res.json({ ok: true, short: updated });
});

app.delete('/api/v1/admin-v2/shorts/:id', requireAdminV2, async (req, res) => {
  await marketplaceRepo.deleteShort(req.params.id);
  await marketplaceRepo.bumpShortsRevision();
  return res.json({ ok: true });
});

app.get('/api/v1/admin-v2/shorts/:id/viewers', requireAdminV2, async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
  const viewers = await marketplaceRepo.listShortViewLogs(req.params.id, limit);
  return res.json({ ok: true, viewers });
});

app.get('/api/v1/admin-v2/customers', requireAdminV2, async (req, res) => {
  const customers = await marketplaceRepo.listCustomersAdmin();
  return res.json({ ok: true, customers });
});

app.get('/api/v1/admin-v2/products', requireAdminV2, async (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const products = (await marketplaceRepo.listAdminProducts(q)).slice(0, 80);
  return res.json({ ok: true, products, note: 'products-lite: faqat ko‘rish / qidiruv' });
});

app.put('/api/v1/admin-v2/products/:id', requireAdminV2, async (req, res) => {
  const updated = await marketplaceRepo.updateProduct(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, message: 'Mahsulot topilmadi' });
  return res.json({ ok: true, product: updated });
});

// Admin API
app.get('/api/v1/admin/banners', requireAdmin, async (req, res) => {
  const rows = await marketplaceRepo.listBannersOrdered();
  res.json({ ok: true, banners: rows.map(marketplaceRepo.bannerToApi) });
});
app.post('/api/v1/admin/banners', requireAdmin, async (req, res) => {
  const item = await marketplaceRepo.createBannerApiShape({
    title: String(req.body.title || '').trim(),
    subtitle: String(req.body.subtitle || '').trim(),
    badge: String(req.body.badge || '').trim(),
    link_url: String(req.body.link_url || '').trim(),
    image_url: String(req.body.image_url || '').trim(),
    active: req.body.active !== false
  });
  res.json({ ok: true, banner: item });
});
app.put('/api/v1/admin/banners/:id', requireAdmin, async (req, res) => {
  const updated = await marketplaceRepo.updateBanner(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, message: 'Banner topilmadi' });
  res.json({ ok: true, banner: updated });
});
app.delete('/api/v1/admin/banners/:id', requireAdmin, async (req, res) => {
  await marketplaceRepo.deleteBanner(req.params.id);
  res.json({ ok: true });
});

app.get('/api/v1/admin/promotions', requireAdmin, async (req, res) => {
  res.json({ ok: true, promotions: await marketplaceRepo.listPromotionsApi() });
});
app.post('/api/v1/admin/promotions', requireAdmin, async (req, res) => {
  const item = await marketplaceRepo.createPromotionApi({
    title: String(req.body.title || '').trim(),
    discount_text: String(req.body.discount_text || '').trim(),
    description: String(req.body.description || '').trim(),
    image_url: String(req.body.image_url || '').trim(),
    active: req.body.active !== false
  });
  res.json({ ok: true, promotion: item });
});
app.put('/api/v1/admin/promotions/:id', requireAdmin, async (req, res) => {
  const updated = await marketplaceRepo.updatePromotion(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, message: 'Promotion topilmadi' });
  res.json({ ok: true, promotion: updated });
});
app.delete('/api/v1/admin/promotions/:id', requireAdmin, async (req, res) => {
  await marketplaceRepo.deletePromotion(req.params.id);
  res.json({ ok: true });
});

app.get('/api/v1/admin/home-settings', requireAdmin, async (req, res) => {
  res.json({ ok: true, homeSettings: await marketplaceRepo.getHomeSettingsJson() });
});
app.put('/api/v1/admin/home-settings', requireAdmin, async (req, res) => {
  const next = await marketplaceRepo.mergeHomeSettings(req.body || {});
  res.json({ ok: true, homeSettings: next });
});

app.get('/api/v1/admin/categories', requireAdmin, async (req, res) => {
  res.json({ ok: true, categories: await marketplaceRepo.listCategoriesForAdmin() });
});
app.put('/api/v1/admin/categories/:id', requireAdmin, async (req, res) => {
  const updated = await marketplaceRepo.updateCategory(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, message: 'Category topilmadi' });
  const withCount = (await marketplaceRepo.listCategoriesForAdmin()).find((c) => c.id === updated.id);
  res.json({ ok: true, category: withCount || updated });
});
app.post('/api/v1/admin/categories/:id/image', requireAdmin, (req, res) => {
  categoryImageUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        message: 'Faqat PNG/JPG, maks ~2MB'
      });
    }
    const id = req.params.id;
    const buf = req.file?.buffer;
    const mimeLower = String(req.file?.mimetype || '').toLowerCase();
    if (!buf?.length || !ALLOWED_ADMIN_V2_IMAGE_MIME.has(mimeLower)) {
      return res.status(400).json({ ok: false, message: 'PNG yoki JPG fayl yuklang' });
    }
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, message: 'Category topilmadi' });

    const ext = mimeLower === 'image/png' ? 'png' : 'jpg';
    const fileName = `cat_${sanitizeFileName(id)}_${Date.now()}.${ext}`;

    let publicUrl;
    if (r2Service.shouldUseR2()) {
      try {
        const key = r2Service.buildObjectKey('categories', fileName);
        publicUrl = (await r2Service.uploadToR2(buf, key, mimeLower)).url;
      } catch (error) {
        logStructured('warn', 'admin_category_image_r2_failed_fallback_local', { message: error?.message });
        ensureDir(CATEGORY_UPLOADS_DIR);
        const diskPath = path.join(CATEGORY_UPLOADS_DIR, fileName);
        try {
          fs.writeFileSync(diskPath, buf);
        } catch (writeErr) {
          logStructured('error', 'admin_category_image_write_failed', { message: writeErr?.message });
          return res.status(500).json({ ok: false, message: 'Rasm saqlab bo‘lmadi' });
        }
        publicUrl = `/uploads/categories/${fileName}`;
      }
    } else {
      ensureDir(CATEGORY_UPLOADS_DIR);
      const diskPath = path.join(CATEGORY_UPLOADS_DIR, fileName);
      try {
        fs.writeFileSync(diskPath, buf);
      } catch (writeErr) {
        logStructured('error', 'admin_category_image_write_failed', { message: writeErr?.message });
        return res.status(500).json({ ok: false, message: 'Rasm saqlab bo‘lmadi' });
      }
      publicUrl = `/uploads/categories/${fileName}`;
    }

    const updated = await marketplaceRepo.updateCategory(id, { imageUrl: publicUrl });
    if (!updated) return res.status(404).json({ ok: false, message: 'Category topilmadi' });
    const withCount = (await marketplaceRepo.listCategoriesForAdmin()).find((c) => c.id === updated.id);
    return res.json({ ok: true, category: withCount || updated });
  });
});

app.get('/api/v1/admin/products', requireAdmin, async (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  const products = await marketplaceRepo.listAdminProducts(q);
  res.json({ ok: true, products });
});

app.get('/api/v1/admin/notifications', requireAdmin, async (req, res) => {
  return res.json({ ok: true, notifications: await marketplaceRepo.listNotificationsApi() });
});
app.post('/api/v1/admin/notifications', requireAdmin, async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  const notification = await marketplaceRepo.createNotificationApi({
    title,
    body: String(req.body.body || '').trim(),
    active: req.body.active !== false
  });
  return res.json({ ok: true, notification });
});
app.delete('/api/v1/admin/notifications/:id', requireAdmin, async (req, res) => {
  await marketplaceRepo.deleteNotification(req.params.id);
  return res.json({ ok: true });
});

app.get('/api/v1/admin/shorts', requireAdmin, async (req, res) => {
  return res.json({ ok: true, shorts: await marketplaceRepo.listShortsApi() });
});
app.post('/api/v1/admin/shorts', requireAdmin, async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ ok: false, message: 'Sarlavha majburiy' });
  const durabilityError = validateShortMediaDurability(
    req.body.media_url,
    req.body.thumbnail_url
  );
  if (durabilityError) return res.status(400).json({ ok: false, message: durabilityError });
  const count = (await marketplaceRepo.listShortsApi()).length;
  const shortItem = await marketplaceRepo.createShortApi({
    title,
    subtitle: String(req.body.subtitle || '').trim(),
    media_url: String(req.body.media_url || '').trim(),
    thumbnail_url: String(req.body.thumbnail_url || '').trim(),
    sortOrder: Number(req.body.sortOrder || count + 1),
    active: req.body.active !== false
  });
  await bumpShortsBroadcast(shortItem);
  return res.json({ ok: true, short: shortItem });
});
app.put('/api/v1/admin/shorts/:id', requireAdmin, async (req, res) => {
  const curList = await marketplaceRepo.listShortsApi();
  const cur = curList.find((x) => x.id === req.params.id);
  if (!cur) return res.status(404).json({ ok: false, message: 'Short topilmadi' });
  const nextMedia = req.body.media_url !== undefined ? req.body.media_url : cur.media_url;
  const nextThumb = req.body.thumbnail_url !== undefined ? req.body.thumbnail_url : cur.thumbnail_url;
  const durabilityError = validateShortMediaDurability(nextMedia, nextThumb);
  if (durabilityError) return res.status(400).json({ ok: false, message: durabilityError });
  const wasActive = cur.active !== false;
  const updated = await marketplaceRepo.updateShortApi(req.params.id, req.body || {});
  const nowActive = updated.active !== false;
  if (!wasActive && nowActive) await bumpShortsBroadcast(updated);
  else await marketplaceRepo.bumpShortsRevision();
  return res.json({ ok: true, short: updated });
});
app.delete('/api/v1/admin/shorts/:id', requireAdmin, async (req, res) => {
  await marketplaceRepo.deleteShort(req.params.id);
  await marketplaceRepo.bumpShortsRevision();
  return res.json({ ok: true });
});
app.put('/api/v1/admin/products/:id', requireAdmin, async (req, res) => {
  const updated = await marketplaceRepo.updateProduct(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ ok: false, message: 'Product topilmadi' });
  res.json({ ok: true, product: updated });
});
app.post('/api/v1/admin/products/import', requireAdmin, async (req, res) => {
  const summary = await marketplaceRepo.storeSummary();
  const products = await marketplaceRepo.listProductsPublic();
  return res.json({
    ok: true,
    imported: 0,
    skipped: 0,
    invalidRows: 0,
    categoriesDetected: summary.categories,
    skippedCategoryRows: 0,
    productsAssignedCategory: summary.products,
    productsWithoutCategoryFallback: 0,
    imageExtracted: 0,
    imageProcessed: 0,
    imageWarnings: 0,
    imageObjectDetected: 0,
    imageDetectionWarnings: [],
    imageUpscaled: 0,
    imageSkippedExisting: 0,
    imageMissing: 0,
    productsWithImageUrl: products.filter((p) => p.image_url).length,
    productsWithEmbeddedImages: 0,
    productsWithoutImages: products.filter((p) => !p.image_url).length,
    processingTimeMs: 0,
    averageImageMs: 0,
    message: 'Excel import hozircha mock: admin CRUD orqali boshqarish mumkin'
  });
});

app.get('/api/v1/admin/ambient-playlist', requireAdmin, async (req, res) => {
  return res.json({
    ok: true,
    maxSlots: ADMIN_AMBIENT_MAX_SLOTS,
    tracks: await getAdminAmbientTracksOrdered()
  });
});

app.post('/api/v1/admin/ambient-playlist/slots/:slot', requireAdmin, express.json({ limit: '30mb' }), async (req, res) => {
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

  const previousTrack = await prisma.ambientTrack.findUnique({ where: { slot } });
  const nextTrack = {
    slot,
    fileName: originalName || fileName,
    fileUrl: `/uploads/audio/admin-ambient/${fileName}`,
    mimeType: parsed.mimeType,
    fileSize: parsed.buffer.length,
    updatedAt: nowIso()
  };
  await marketplaceRepo.upsertAmbientTrack(slot, nextTrack);

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
    tracks: await getAdminAmbientTracksOrdered()
  });
});

app.delete('/api/v1/admin/ambient-playlist/slots/:slot', requireAdmin, async (req, res) => {
  const slot = Math.round(Number(req.params.slot || 0));
  if (slot < 1 || slot > ADMIN_AMBIENT_MAX_SLOTS) {
    return res.status(400).json({ ok: false, message: 'Slot 1..5 oralig‘ida bo‘lishi kerak' });
  }
  const existing = await prisma.ambientTrack.findUnique({ where: { slot } });
  if (!existing) {
    return res.json({ ok: true, removed: false, tracks: await getAdminAmbientTracksOrdered() });
  }
  await marketplaceRepo.deleteAmbientSlot(slot);
  if (existing?.fileUrl) {
    const filePath = path.join(ADMIN_AMBIENT_UPLOADS_DIR, path.basename(String(existing.fileUrl)));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
  return res.json({ ok: true, removed: true, tracks: await getAdminAmbientTracksOrdered() });
});

app.get('/api/v1/admin/orders', requireAdmin, async (req, res) => {
  const ordersRaw = await marketplaceRepo.listOrdersLegacySorted();
  const orders = ordersRaw
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
app.get('/api/v1/admin/customers/biometric', requireAdmin, async (req, res) => {
  const customers = (await marketplaceRepo.listUsersForBiometricAdmin()).sort((a, b) => {
    const at = new Date(a.biometric?.capturedAt || a.updatedAt || 0).getTime();
    const bt = new Date(b.biometric?.capturedAt || b.updatedAt || 0).getTime();
    return bt - at;
  });
  res.json({ ok: true, customers });
});
app.post('/api/v1/admin/orders/:id/cancel', requireAdmin, async (req, res) => {
  const o = await marketplaceRepo.loadOrderLegacyById(req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  const currentStatus = normalizeOrderStatus(o.status);
  if (TERMINAL_ORDER_STATUSES.has(currentStatus)) {
    return res.status(409).json({ ok: false, message: `Buyurtma allaqachon yakunlangan (${currentStatus})`, code: 'ORDER_TERMINAL' });
  }
  applyOrderUpdateTimestamp(o);
  const next = await marketplaceRepo.patchOrderScalars(o.id, {
    status: 'cancelled',
    deliveryStatus: 'cancelled',
    trackingUpdatedAt: new Date(o.trackingUpdatedAt || o.updated_at),
    updatedAt: new Date(o.updated_at)
  });
  return res.json({ ok: true, order: orderPublic(next) });
});
app.post('/api/v1/admin/orders/:id/assign-courier', requireAdmin, async (req, res) => {
  const o = await marketplaceRepo.loadOrderLegacyById(req.params.id);
  if (!o) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  const currentStatus = normalizeOrderStatus(o.status);
  if (!canTransitionOrderStatus(currentStatus, 'courier_assigned')) {
    return res.status(409).json({
      ok: false,
      message: `Status o'zgarishi mumkin emas: ${currentStatus} -> courier_assigned`,
      code: 'INVALID_ORDER_TRANSITION'
    });
  }
  applyOrderUpdateTimestamp(o);
  const next = await marketplaceRepo.patchOrderScalars(o.id, {
    courierName: String(req.body.courierName || '').trim(),
    courierPhone: String(req.body.courierPhone || '').trim(),
    status: 'courier_assigned',
    deliveryStatus: 'courier_assigned',
    trackingUpdatedAt: new Date(o.trackingUpdatedAt || o.updated_at),
    updatedAt: new Date(o.updated_at)
  });
  return res.json({ ok: true, order: orderPublic(next) });
});
app.put('/api/v1/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const o = await marketplaceRepo.loadOrderLegacyById(req.params.id);
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
  let paymentStatus = o.paymentStatus;
  if (o.status === 'delivered' && ['pending', 'unpaid'].includes(String(paymentStatus || ''))) paymentStatus = 'paid';
  let courierTokenUsed = o.courierTokenUsed;
  if (o.status === 'delivered' || o.status === 'cancelled') courierTokenUsed = true;
  ensureCourierToken(o);
  applyOrderUpdateTimestamp(o);
  const next = await marketplaceRepo.patchOrderScalars(o.id, {
    status: requestedStatus,
    deliveryStatus: requestedStatus,
    paymentStatus,
    courierTokenUsed,
    courierToken: o.courierToken,
    trackingUpdatedAt: new Date(o.trackingUpdatedAt || o.updated_at),
    updatedAt: new Date(o.updated_at)
  });
  return res.json({ ok: true, order: orderPublic(next) });
});

app.get('/api/v1/admin/orders/:id/qr', requireAdmin, async (req, res) => {
  const order = await marketplaceRepo.loadOrderLegacyById(req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  ensureCourierToken(order);
  await marketplaceRepo.patchOrderScalars(order.id, { courierToken: order.courierToken });
  const courierUrl = `${req.protocol}://${req.get('host')}/courier/${encodeURIComponent(order.courierToken)}`;
  try {
    const qrDataUrl = await require('qrcode').toDataURL(courierUrl, { width: 280, margin: 1 });
    return res.json({ ok: true, courierUrl, qrDataUrl });
  } catch {
    return res.status(500).json({ ok: false, message: 'QR yaratilmadi' });
  }
});

app.get('/api/v1/courier/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = await marketplaceRepo.loadOrderLegacy({ courierToken: token });
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  if (order.courierTokenUsed && !['out_for_delivery', 'courier_assigned'].includes(normalizeOrderStatus(order.status))) {
    return res.status(410).json({ ok: false, message: 'Bu QR kod yaroqsiz yoki ishlatilgan' });
  }
  return res.json({ ok: true, order: orderPublic(order) });
});

app.post('/api/v1/courier/:token/accept', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = await marketplaceRepo.loadOrderLegacy({ courierToken: token });
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  const currentStatus = normalizeOrderStatus(order.status);
  if (!canTransitionOrderStatus(currentStatus, 'out_for_delivery')) {
    return res.status(409).json({ ok: false, message: `Bu statusda qabul qilib bo'lmaydi: ${currentStatus}` });
  }
  applyOrderUpdateTimestamp(order);
  const next = await marketplaceRepo.patchOrderScalars(order.id, {
    courierName: String(req.body.courierName || order.courierName || '').trim(),
    courierPhone: String(req.body.courierPhone || order.courierPhone || '').trim(),
    status: 'out_for_delivery',
    deliveryStatus: 'out_for_delivery',
    courierTokenUsed: false,
    trackingUpdatedAt: new Date(order.trackingUpdatedAt || order.updated_at),
    updatedAt: new Date(order.updated_at)
  });
  return res.json({ ok: true, order: orderPublic(next) });
});

app.post('/api/v1/courier/:token/location', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = await marketplaceRepo.loadOrderLegacy({ courierToken: token });
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  if (normalizeOrderStatus(order.status) !== 'out_for_delivery') {
    return res.status(409).json({ ok: false, message: 'Lokatsiya faqat yo‘lda statusida qabul qilinadi' });
  }
  const lat = toFiniteNumber(req.body.lat);
  const lng = toFiniteNumber(req.body.lng);
  if (!isValidLatLng(lat, lng)) return res.status(400).json({ ok: false, message: 'Lokatsiya noto‘g‘ri' });
  const at = nowIso();
  order.courierLocationLat = lat;
  order.courierLocationLng = lng;
  order.courierLocationAccuracy = toFiniteNumber(req.body.accuracy);
  order.courierLocationUpdatedAt = at;
  applyOrderUpdateTimestamp(order);
  const next = await marketplaceRepo.patchOrderScalars(order.id, {
    courierLocationLat: lat,
    courierLocationLng: lng,
    courierLocationAccuracy: toFiniteNumber(req.body.accuracy),
    courierLocationUpdatedAt: new Date(at),
    trackingUpdatedAt: new Date(order.trackingUpdatedAt || order.updated_at),
    updatedAt: new Date(order.updated_at)
  });
  return res.json({ ok: true, order: orderPublic(next) });
});

app.post('/api/v1/courier/:token/deliver', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const order = await marketplaceRepo.loadOrderLegacy({ courierToken: token });
  if (!order) return res.status(404).json({ ok: false, message: 'Kuryer token topilmadi' });
  const currentStatus = normalizeOrderStatus(order.status);
  if (!canTransitionOrderStatus(currentStatus, 'delivered')) {
    return res.status(409).json({ ok: false, message: `Buyurtma bu holatda yopilmaydi: ${currentStatus}` });
  }
  let paymentStatus = order.paymentStatus;
  if (['pending', 'unpaid'].includes(String(paymentStatus || ''))) paymentStatus = 'paid';
  applyOrderUpdateTimestamp(order);
  const next = await marketplaceRepo.patchOrderScalars(order.id, {
    status: 'delivered',
    deliveryStatus: 'delivered',
    paymentStatus,
    courierTokenUsed: true,
    trackingUpdatedAt: new Date(order.trackingUpdatedAt || order.updated_at),
    updatedAt: new Date(order.updated_at)
  });
  return res.json({ ok: true, order: orderPublic(next) });
});

app.post('/api/v1/admin/store/reload', requireAdmin, async (req, res) => {
  await prisma.$disconnect();
  await prisma.$connect();
  console.log('PostgreSQL connected');
  await marketplaceRepo.ensureAppState();
  return res.json({ ok: true });
});
app.get('/api/v1/admin/store/summary', requireAdmin, async (req, res) => {
  const s = await marketplaceRepo.storeSummary();
  const summary = {
    categories: s.categories,
    products: s.products,
    orders: s.orders,
    banners: s.banners,
    promotions: s.promotions,
    storageMode: s.storageMode
  };
  return res.json({ ok: true, summary });
});

app.get('/api/v1/integrations/status', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    integrations: { dalionTrend1C: { enabled: false } },
    stats: { storageMode: 'postgresql' }
  });
});
app.post('/api/v1/admin/dalion/sync', requireAdmin, (req, res) => {
  res.json({ ok: true, success: true, message: 'DALION sync mock ishga tushdi' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'dalion-mobile-app' });
});

async function main() {
  await prisma.$connect();
  console.log('PostgreSQL connected');
  await marketplaceRepo.ensureAppState();
  if (r2Service.shouldUseR2()) {
    const diag = r2Service.diagnoseR2PublicUrl();
    console.info('[R2] configured — CDN uploads:', diag.ok ? 'PUBLIC_URL OK' : diag.message);
  } else {
    console.info('[R2] not configured — using local disk under /uploads');
  }
  app.listen(PORT, () => {
    console.info(`[SERVER] started on port ${PORT}`);
  });
}

main().catch((error) => {
  console.error('[SERVER] failed to start', error?.message || error);
  process.exit(1);
});
