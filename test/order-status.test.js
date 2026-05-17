'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeOrderStatus } = require('../src/order-status');

test('normalizeOrderStatus: empty -> created', () => {
  assert.strictEqual(normalizeOrderStatus(''), 'created');
  assert.strictEqual(normalizeOrderStatus('   '), 'created');
});

test('normalizeOrderStatus: hyphens and spaces fold to snake_case', () => {
  assert.strictEqual(normalizeOrderStatus('Ready-For-Courier'), 'ready_for_courier');
  assert.strictEqual(normalizeOrderStatus('ready for courier'), 'ready_for_courier');
  assert.strictEqual(normalizeOrderStatus('  OUT   FOR   DELIVERY  '), 'out_for_delivery');
  assert.strictEqual(normalizeOrderStatus('Courier-Assigned'), 'courier_assigned');
});

test('normalizeOrderStatus: aliases after folding', () => {
  assert.strictEqual(normalizeOrderStatus('picked'), 'ready_for_courier');
  assert.strictEqual(normalizeOrderStatus('Picked'), 'ready_for_courier');
  assert.strictEqual(normalizeOrderStatus('waiting courier'), 'ready_for_courier');
  assert.strictEqual(normalizeOrderStatus('waiting-courier'), 'ready_for_courier');
});

test('normalizeOrderStatus: known snake_case unchanged', () => {
  assert.strictEqual(normalizeOrderStatus('preparing'), 'preparing');
  assert.strictEqual(normalizeOrderStatus('payment_confirmed'), 'payment_confirmed');
});

test('normalizeOrderStatus: sent_to_tsd alias', () => {
  assert.strictEqual(normalizeOrderStatus('sent_to_tsd'), 'preparing');
  assert.strictEqual(normalizeOrderStatus('SENT_TO_TSD'), 'preparing');
});
