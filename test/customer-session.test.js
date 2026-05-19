'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  issueCustomerToken,
  verifyCustomerJwt,
  resolveCustomerAuth
} = require('../src/customer-session');

test('issueCustomerToken and verify round-trip', () => {
  const token = issueCustomerToken('+998901234567');
  assert.ok(token.includes('.'));
  const payload = verifyCustomerJwt(token);
  assert.ok(payload);
  assert.strictEqual(payload.typ, 'customer');
  assert.strictEqual(payload.sub, '+998901234567');
});

test('resolveCustomerAuth: Bearer wins over x-user-phone', () => {
  const token = issueCustomerToken('+998901111111');
  const req = {
    headers: {
      authorization: `Bearer ${token}`,
      'x-user-phone': '+998902222222'
    }
  };
  const r = resolveCustomerAuth(req, (p) => String(p || '').trim());
  assert.strictEqual(r.phone, '+998901111111');
  assert.strictEqual(r.jwtInvalid, false);
});

test('resolveCustomerAuth: invalid Bearer does not fall back to header', () => {
  const req = {
    headers: {
      authorization: 'Bearer invalid.token.here',
      'x-user-phone': '+998902222222'
    }
  };
  const r = resolveCustomerAuth(req, (p) => String(p || '').trim());
  assert.strictEqual(r.phone, null);
  assert.strictEqual(r.jwtInvalid, true);
});

test('resolveCustomerAuth: legacy x-user-phone', () => {
  const req = { headers: { 'x-user-phone': '+998903333333' } };
  const r = resolveCustomerAuth(req, (p) => String(p || '').trim());
  assert.strictEqual(r.phone, '+998903333333');
  assert.strictEqual(r.jwtInvalid, false);
});
