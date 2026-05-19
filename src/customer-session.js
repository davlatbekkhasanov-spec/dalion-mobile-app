'use strict';

const crypto = require('crypto');

const CUSTOMER_JWT_TTL_SEC = Math.min(
  90 * 24 * 3600,
  Math.max(3600, Number(process.env.CUSTOMER_JWT_TTL_SEC || 86400 * 30) || 86400 * 30)
);

function sessionSecret() {
  return String(
    process.env.CUSTOMER_SESSION_SECRET ||
      process.env.CUSTOMER_JWT_SECRET ||
      process.env.SMS_OTP_PEPPER ||
      'dev-customer-session-change-me'
  ).trim();
}

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseJwtPayload(segment) {
  const pad = 4 - (segment.length % 4 || 4);
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/') + (pad === 4 ? '' : '='.repeat(pad));
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function signCustomerJwt(payload) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const sig = crypto
    .createHmac('sha256', sessionSecret())
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${sig}`;
}

function verifyCustomerJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto
    .createHmac('sha256', sessionSecret())
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
    payload = parseJwtPayload(p);
  } catch {
    return null;
  }
  if (payload.typ !== 'customer') return null;
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

function issueCustomerToken(phone) {
  const sub = String(phone || '').trim();
  if (!sub) return '';
  const nowSec = Math.floor(Date.now() / 1000);
  return signCustomerJwt({
    typ: 'customer',
    sub,
    phone: sub,
    iat: nowSec,
    exp: nowSec + CUSTOMER_JWT_TTL_SEC
  });
}

/**
 * @param {import('express').Request} req
 * @param {(raw: string) => string} normalizePhone
 * @returns {{ phone: string|null, jwtInvalid: boolean }}
 */
function resolveCustomerAuth(req, normalizePhone) {
  const raw = String(req.headers.authorization || '').trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const payload = verifyCustomerJwt(m[1].trim());
    if (!payload) return { phone: null, jwtInvalid: true };
    const phone = normalizePhone(payload.sub || payload.phone);
    if (!phone) return { phone: null, jwtInvalid: true };
    return { phone, jwtInvalid: false };
  }
  const legacy = normalizePhone(req.headers['x-user-phone']);
  return { phone: legacy || null, jwtInvalid: false };
}

module.exports = {
  CUSTOMER_JWT_TTL_SEC,
  issueCustomerToken,
  verifyCustomerJwt,
  resolveCustomerAuth
};
