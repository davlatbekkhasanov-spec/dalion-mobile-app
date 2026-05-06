const smsService = require('./sms.service.js');

const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map();

function normalizePhone(phone = '') {
  return String(phone || '').replace(/\s+/g, '');
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function requestOtp(phone = '') {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { error: 'phone required' };

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
