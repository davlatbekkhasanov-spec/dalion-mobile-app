'use strict';

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

function phonesEqual(a, b) {
  const na = normalizeSmsPhone(a);
  const nb = normalizeSmsPhone(b);
  if (na && nb) return na === nb;
  const da = String(a || '').replace(/\D/g, '').slice(-9);
  const db = String(b || '').replace(/\D/g, '').slice(-9);
  return da.length >= 9 && db.length >= 9 && da === db;
}

module.exports = { normalizeSmsPhone, normalizePhone, phonesEqual };
