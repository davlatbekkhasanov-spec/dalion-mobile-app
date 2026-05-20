const crypto = require('crypto');

const COURIER_PASSWORD_PEPPER =
  process.env.COURIER_PASSWORD_PEPPER || process.env.SMS_OTP_PEPPER || 'dev-courier-pepper-change-me';
const COURIER_PASSWORD_MIN_LEN = Math.max(6, Number(process.env.COURIER_PASSWORD_MIN_LEN || 6) || 6);

function courierSmsChallengePhone(phone) {
  return `courier|${String(phone || '').trim()}`;
}

function normalizeVehiclePlate(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .slice(0, 24);
}

function validateCourierPassword(password) {
  const p = String(password || '');
  if (p.length < COURIER_PASSWORD_MIN_LEN) {
    return { ok: false, message: `Parol kamida ${COURIER_PASSWORD_MIN_LEN} belgi` };
  }
  return { ok: true };
}

function hashCourierPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), `${salt}|${COURIER_PASSWORD_PEPPER}`, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyCourierPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const derived = crypto.scryptSync(String(password), `${parts[1]}|${COURIER_PASSWORD_PEPPER}`, 32).toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(parts[2], 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function courierHasPassword(row) {
  return Boolean(row && row.passwordHash && String(row.passwordHash).startsWith('scrypt:'));
}

module.exports = {
  courierSmsChallengePhone,
  normalizeVehiclePlate,
  validateCourierPassword,
  hashCourierPassword,
  verifyCourierPassword,
  courierHasPassword,
  COURIER_PASSWORD_MIN_LEN
};
