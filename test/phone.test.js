'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizePhone, phonesEqual } = require('../src/phone');

test('phonesEqual: +998 and 9-digit local', () => {
  assert.strictEqual(phonesEqual('+998972234336', '972234336'), true);
  assert.strictEqual(phonesEqual('998972234336', '+998 97 223 43 36'), true);
});

test('phonesEqual: different numbers', () => {
  assert.strictEqual(phonesEqual('+998901234567', '+998972234336'), false);
});

test('normalizePhone: uz mobile', () => {
  assert.strictEqual(normalizePhone('972234336'), '+998972234336');
});
