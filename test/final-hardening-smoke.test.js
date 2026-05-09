const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
const ADMIN_TOKEN = '12345';
const PHONE = '+998901234567';
const SELFIE_1PX_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7N7S8AAAAASUVORK5CYII=';
const STATUS_FLOW = ['payment_pending', 'payment_confirmed', 'preparing', 'ready_for_courier', 'courier_assigned', 'out_for_delivery', 'delivered'];

function waitForServerReady(baseUrl, timeoutMs = 12000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) return resolve();
      } catch (_) {}
      if (Date.now() - started > timeoutMs) {
        reject(new Error('server did not become ready'));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

async function api(baseUrl, method, endpoint, body, headers = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload };
}

test('final hardening critical flow smoke', { skip: !DATABASE_URL }, async () => {
  const port = 3300 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      DATABASE_URL,
      SMS_GATEWAY_MODE: 'log',
      ALLOW_OTP_DEV_UI: 'true'
    },
    stdio: 'ignore'
  });

  try {
    await waitForServerReady(baseUrl);

    const badProfile = await api(baseUrl, 'PUT', '/api/v1/profile', {
      phone: PHONE,
      name: 'Smoke User',
      biometricConsent: false,
      biometricSelfieDataUrl: SELFIE_1PX_PNG
    });
    assert.equal(badProfile.res.status, 400);

    const profile = await api(baseUrl, 'PUT', '/api/v1/profile', {
      phone: PHONE,
      name: 'Smoke User',
      address: 'Samarqand markaz',
      biometricConsent: true,
      biometricConsentAt: new Date().toISOString(),
      biometricCapturedAt: new Date().toISOString(),
      biometricSelfieDataUrl: SELFIE_1PX_PNG
    });
    assert.equal(profile.res.status, 200);
    assert.equal(profile.payload.ok, true);

    const otpRequest = await api(baseUrl, 'POST', '/api/v1/auth/sms/send', { phone: PHONE });
    assert.equal(otpRequest.payload.ok, true);
    assert.ok(
      otpRequest.payload.devHint && String(otpRequest.payload.devHint).length >= 4,
      'devHint expected in non-production smoke'
    );
    const otpVerify = await api(baseUrl, 'POST', '/api/v1/auth/sms/verify', {
      phone: PHONE,
      code: String(otpRequest.payload.devHint)
    });
    assert.equal(otpVerify.payload.ok, true);

    const products = await api(baseUrl, 'GET', '/api/v1/products');
    assert.equal(products.payload.ok, true);
    assert.ok(Array.isArray(products.payload.items) && products.payload.items.length > 0);
    const productId = products.payload.items[0].id;

    const cart = await api(baseUrl, 'PUT', '/api/v1/cart/items', { productId, quantity: 2 }, { 'x-user-phone': PHONE });
    assert.equal(cart.payload.ok, true);
    assert.equal(cart.payload.totalQty, 2);

    const createdOrder = await api(baseUrl, 'POST', '/api/v1/orders', {
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      addressText: 'Samarqand test manzil'
    }, { 'x-user-phone': PHONE });
    assert.equal(createdOrder.payload.ok, true);
    const orderNumber = createdOrder.payload.orderNumber;
    assert.ok(orderNumber);

    const statusView = await api(baseUrl, 'GET', `/api/v1/orders/${orderNumber}/status`);
    assert.equal(statusView.payload.ok, true);
    assert.equal(statusView.payload.status, 'created');
    assert.equal(typeof statusView.payload.statusLabel, 'string');

    const trackView = await api(baseUrl, 'GET', `/api/v1/orders/${orderNumber}/track`);
    assert.equal(trackView.payload.ok, true);
    assert.equal(trackView.payload.order.deliveryFallbackApplied, true);
    assert.equal(typeof trackView.payload.order.paymentStatusLabel, 'string');

    const adminOrders = await api(baseUrl, 'GET', '/api/v1/admin/orders', null, { 'x-admin-token': ADMIN_TOKEN });
    assert.equal(adminOrders.payload.ok, true);
    const orderId = adminOrders.payload.orders[0].id;
    assert.ok(orderId);

    for (const nextStatus of STATUS_FLOW) {
      if (nextStatus === 'courier_assigned') {
        const assigned = await api(baseUrl, 'POST', `/api/v1/admin/orders/${orderId}/assign-courier`, {
          courierName: 'Smoke Courier',
          courierPhone: '+998900000001'
        }, { 'x-admin-token': ADMIN_TOKEN });
        assert.equal(assigned.payload.ok, true);
      } else {
        const moved = await api(baseUrl, 'PUT', `/api/v1/admin/orders/${orderId}/status`, { status: nextStatus }, { 'x-admin-token': ADMIN_TOKEN });
        assert.equal(moved.payload.ok, true);
      }
    }

    const afterDelivered = await api(baseUrl, 'PUT', `/api/v1/admin/orders/${orderId}/status`, { status: 'preparing' }, { 'x-admin-token': ADMIN_TOKEN });
    assert.equal(afterDelivered.res.status, 409);

    const feed = await api(baseUrl, 'GET', '/api/v1/orders-display/feed');
    assert.equal(feed.payload.ok, true);
    assert.equal(typeof feed.payload.orders[0].statusLabel, 'string');
    assert.equal(typeof feed.payload.orders[0].deliveryStatusLabel, 'string');
  } finally {
    if (child && !child.killed) child.kill('SIGTERM');
  }
});
