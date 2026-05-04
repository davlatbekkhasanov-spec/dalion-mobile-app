const smsService = require('./sms.service.js');

const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map();
const otpRequestStore = new Map();

function normalizePhone(phone = '') {
  return String(phone || '').replace(/\s+/g, '');
}
function isValidUzPhone(phone = '') {
  return /^\+998\d{9}$/.test(String(phone || '').replace(/\s+/g, ''));
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function requestOtp(phone = '') {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { error: 'phone required' };
  if (!isValidUzPhone(normalizedPhone)) return { error: 'invalid_phone' };
  const lastSentAt = Number(otpRequestStore.get(normalizedPhone) || 0);
  if (Date.now() - lastSentAt < 60000) return { error: 'OTP too many requests' };

  const code = generateOtp();
  const now = Date.now();
  otpStore.set(normalizedPhone, {
    code,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0
  });

  const sent = await smsService.sendOtp(normalizedPhone, code);
  if (!sent.ok) return { error: sent.message || 'OTP send failed' };
  otpRequestStore.set(normalizedPhone, Date.now());
  if (String(process.env.TEST_MODE || 'false').toLowerCase() === 'true') {
    console.info('[OTP][TEST_MODE]', { phone: normalizedPhone, code });
  }

  return {
    ok: true,
    provider: smsService.provider,
    devOtp: smsService.provider === 'mock' ? code : undefined
  };
}

function verifyOtp(phone = '', code = '') {
  const normalizedPhone = normalizePhone(phone);
  const normalizedCode = String(code || '').trim();
  if (!normalizedPhone || !normalizedCode) return { error: 'phone and code required' };

  const entry = otpStore.get(normalizedPhone);
  if (!entry) return { error: 'OTP not found or expired' };
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedPhone);
    return { error: 'OTP expired' };
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(normalizedPhone);
    return { error: 'OTP attempts exceeded' };
  }

  if (entry.code !== normalizedCode) return { error: 'OTP code is invalid' };

  otpStore.delete(normalizedPhone);
  return { ok: true };
}

module.exports = {
  requestOtp,
  verifyOtp,
  normalizePhone
};
