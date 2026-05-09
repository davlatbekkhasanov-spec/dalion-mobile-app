/**
 * Mock fetch scenarios for DevSMS parsing and auth modes (no network).
 */
const assert = require('node:assert/strict');
const test = require('node:test');

function loadSmsFresh() {
  delete require.cache[require.resolve('../src/services/sms.service.js')];
  return require('../src/services/sms.service.js');
}

test('sendViaDevsms: string success + api_key in body when DEVSMS_AUTH_MODE=body', async () => {
  const prev = {
    SMS_GATEWAY_MODE: process.env.SMS_GATEWAY_MODE,
    DEVSMS_API_KEY: process.env.DEVSMS_API_KEY,
    DEVSMS_AUTH_MODE: process.env.DEVSMS_AUTH_MODE,
    SMS_API_URL: process.env.SMS_API_URL
  };
  process.env.SMS_GATEWAY_MODE = 'devsms';
  process.env.DEVSMS_API_KEY = 'test-key-123';
  process.env.DEVSMS_AUTH_MODE = 'body';
  delete process.env.SMS_API_URL;

  let captured;
  global.fetch = async (_url, opts) => {
    captured = opts;
    const bodyStr = JSON.stringify({ success: 'true', message: 'ok' });
    return {
      ok: true,
      status: 200,
      text: async () => bodyStr
    };
  };

  try {
    const sms = loadSmsFresh();
    const result = await sms.sendSmsOtp('+998901234567', '123456');
    assert.equal(result.ok, true);
    assert.equal(result.provider, 'devsms');
    const body = JSON.parse(captured.body);
    assert.equal(body.api_key, 'test-key-123');
    assert.equal(captured.headers.Authorization, undefined);
    assert.equal(body.phone, '998901234567');
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete global.fetch;
    delete require.cache[require.resolve('../src/services/sms.service.js')];
  }
});

test('sendViaDevsms: success:false yields clientDetail + logContext', async () => {
  const prev = {
    SMS_GATEWAY_MODE: process.env.SMS_GATEWAY_MODE,
    DEVSMS_API_KEY: process.env.DEVSMS_API_KEY,
    DEVSMS_AUTH_MODE: process.env.DEVSMS_AUTH_MODE
  };
  process.env.SMS_GATEWAY_MODE = 'devsms';
  process.env.DEVSMS_API_KEY = 'test-key-123';
  process.env.DEVSMS_AUTH_MODE = 'bearer';

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        success: false,
        error: 'Insufficient balance'
      })
  });

  try {
    const sms = loadSmsFresh();
    const result = await sms.sendSmsOtp('+998901234567', '123456');
    assert.equal(result.ok, false);
    assert.equal(result.provider, 'devsms');
    assert.ok(result.clientDetail);
    assert.ok(result.logContext && typeof result.logContext.httpStatus === 'number');
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete global.fetch;
    delete require.cache[require.resolve('../src/services/sms.service.js')];
  }
});

test('gatewayMode infers devsms when SMS_GATEWAY_MODE unset + DEVSMS key + default URL', async () => {
  const prev = {
    SMS_GATEWAY_MODE: process.env.SMS_GATEWAY_MODE,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    DEVSMS_API_KEY: process.env.DEVSMS_API_KEY,
    SMS_API_URL: process.env.SMS_API_URL,
    DEVSMS_API_URL: process.env.DEVSMS_API_URL
  };
  delete process.env.SMS_GATEWAY_MODE;
  delete process.env.SMS_PROVIDER;
  process.env.DEVSMS_API_KEY = 'k';
  delete process.env.SMS_API_URL;
  delete process.env.DEVSMS_API_URL;

  try {
    const sms = loadSmsFresh();
    assert.equal(sms.gatewayMode(), 'devsms');
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete require.cache[require.resolve('../src/services/sms.service.js')];
  }
});
