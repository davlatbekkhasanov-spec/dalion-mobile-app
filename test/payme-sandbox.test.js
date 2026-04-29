const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PAYME_TEST_KEY = process.env.PAYME_TEST_KEY || 'sandbox-key';
process.env.PAYME_SANDBOX_MODE = 'true';

const payme = require('../src/controllers/payme.controller.js');

function authHeader() {
  return `Basic ${Buffer.from(`Paycom:${process.env.PAYME_TEST_KEY}`).toString('base64')}`;
}

async function callRpc(method, params, id = 1) {
  let payload = null;
  const req = { body: { jsonrpc: '2.0', id, method, params }, headers: { authorization: authHeader() } };
  const res = { status: () => ({ json: (body) => { payload = body; } }) };
  await payme.paymeRpc(req, res);
  return payload;
}

test('CheckPerformTransaction payable test order returns allow true', async () => {
  const body = await callRpc('CheckPerformTransaction', { amount: 5000, account: { order_id: 'test' } });
  assert.equal(body.result.allow, true);
});

test('CheckPerformTransaction missing returns -31050 with order_id', async () => {
  const body = await callRpc('CheckPerformTransaction', { amount: 5000, account: { order_id: 'test-missing' } });
  assert.equal(body.error.code, -31050);
  assert.equal(body.error.data, 'order_id');
});

test('CreateTransaction then Check/Perform/Cancel flow', async () => {
  const id = 'tx-sandbox-1';
  const created = await callRpc('CreateTransaction', { id, time: 777, amount: 5000, account: { order_id: 'test' } });
  assert.equal(created.result.state, 1);
  assert.equal(created.result.create_time, 777);
  const checked = await callRpc('CheckTransaction', { id });
  assert.equal(checked.result.state, 1);
  const performed = await callRpc('PerformTransaction', { id });
  assert.equal(performed.result.state, 2);
  const canceled = await callRpc('CancelTransaction', { id });
  assert.equal(canceled.result.state, -2);
});

test('CheckTransaction missing returns -31003 with id', async () => {
  const body = await callRpc('CheckTransaction', { id: 'missing-tx' });
  assert.equal(body.error.code, -31003);
  assert.equal(body.error.data, 'id');
});
