const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PAYME_TEST_KEY = 'testkey';
process.env.PAYME_SECRET_KEY = 'secretkey';

const { paymeRpc } = require('../src/controllers/payme.controller.js');

function buildReq(authorization) {
  return {
    headers: authorization ? { authorization } : {},
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'CheckPerformTransaction',
      params: { account: { order_id: 'missing-order' }, amount: 1000 }
    }
  };
}

function buildRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

async function callRpc(authorization) {
  const req = buildReq(authorization);
  const res = buildRes();
  await paymeRpc(req, res);
  return res;
}

test('auth passes with PAYME_TEST_KEY', async () => {
  const auth = `Basic ${Buffer.from('Paycom:testkey').toString('base64')}`;
  const res = await callRpc(auth);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.result, { allow: true });
});

test('auth passes with PAYME_SECRET_KEY', async () => {
  const auth = `Basic ${Buffer.from('Paycom:secretkey').toString('base64')}`;
  const res = await callRpc(auth);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.result, { allow: true });
});

test('missing auth returns JSON-RPC unauthorized', async () => {
  const res = await callRpc();

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.error?.code, -32504);
  assert.deepEqual(res.payload.error?.message, {
    ru: 'Не авторизован',
    uz: 'Avtorizatsiyadan o‘tilmagan',
    en: 'Unauthorized'
  });
});
