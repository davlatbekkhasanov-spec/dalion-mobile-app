'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOrderStatus } = require('../src/order-status');
const tsdService = require('../src/integrations/tsd.service');
const {
  orderTsdSent,
  buildTsdSentMeta,
  isDuplicateTsdWebhook,
  tsdWebhookEventKey,
  mergeIntegrationMeta
} = require('../src/integrations/integration-meta');

test('normalizeOrderStatus: sent_to_tsd and picking -> preparing', () => {
  assert.strictEqual(normalizeOrderStatus('sent_to_tsd'), 'preparing');
  assert.strictEqual(normalizeOrderStatus('picking'), 'preparing');
  assert.strictEqual(normalizeOrderStatus('SENT-TO-TSD'), 'preparing');
});

test('tsd.service sendOrderToTsd stub when enabled', async () => {
  const prev = process.env.TSD_ENABLED;
  const prevMode = process.env.TSD_MODE;
  process.env.TSD_ENABLED = 'true';
  process.env.TSD_MODE = 'stub';
  delete require.cache[require.resolve('../src/integrations/integration.config')];
  delete require.cache[require.resolve('../src/integrations/tsd.service')];
  const tsd = require('../src/integrations/tsd.service');

  const order = { id: 'ord_test', orderNumber: '100501', integrationMeta: null };
  const out = await tsd.sendOrderToTsd(order);
  assert.equal(out.ok, true);
  assert.ok(out.externalId);
  assert.ok(out.integrationMeta?.tsd?.sentAt);

  if (prev === undefined) delete process.env.TSD_ENABLED;
  else process.env.TSD_ENABLED = prev;
  if (prevMode === undefined) delete process.env.TSD_MODE;
  else process.env.TSD_MODE = prevMode;
  delete require.cache[require.resolve('../src/integrations/integration.config')];
  delete require.cache[require.resolve('../src/integrations/tsd.service')];
});

test('tsd.service sendOrderToTsd returns error when disabled', async () => {
  const prev = process.env.TSD_ENABLED;
  process.env.TSD_ENABLED = 'false';
  delete require.cache[require.resolve('../src/integrations/integration.config')];
  delete require.cache[require.resolve('../src/integrations/tsd.service')];
  const tsd = require('../src/integrations/tsd.service');
  const out = await tsd.sendOrderToTsd({ id: 'x', orderNumber: '1' });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'tsd_disabled');
  if (prev === undefined) delete process.env.TSD_ENABLED;
  else process.env.TSD_ENABLED = prev;
  delete require.cache[require.resolve('../src/integrations/integration.config')];
  delete require.cache[require.resolve('../src/integrations/tsd.service')];
});

test('integration meta: orderTsdSent and webhook idempotency', () => {
  const meta = buildTsdSentMeta(null, { externalId: 'ext-1', mode: 'stub' });
  assert.equal(orderTsdSent(meta), true);
  const key = tsdWebhookEventKey({ orderId: 'a', status: 'picking', externalId: 'ext-1' });
  const withWebhook = mergeIntegrationMeta(meta, {
    tsd: { ...meta.tsd, lastWebhookKey: key }
  });
  assert.equal(isDuplicateTsdWebhook(withWebhook, key), true);
  assert.equal(isDuplicateTsdWebhook(withWebhook, 'other'), false);
});

test('tsd webhook maps status via normalizeOrderStatus', () => {
  assert.strictEqual(tsdService.mapTsdWebhookStatus('picked'), 'ready_for_courier');
  assert.strictEqual(tsdService.mapTsdWebhookStatus('sent_to_tsd'), 'preparing');
  const applied = tsdService.applyTsdWebhookToMeta(null, {
    orderId: 'o1',
    status: 'waiting_courier',
    externalId: 'dm-9'
  });
  assert.strictEqual(applied.targetStatus, 'ready_for_courier');
  assert.equal(applied.integrationMeta.tsd.externalId, 'dm-9');
});
