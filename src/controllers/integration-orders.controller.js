'use strict';

const marketplaceRepo = require('../marketplace-repository');
const { integrationConfig } = require('../integrations/integration.config');
const tsdService = require('../integrations/tsd.service');
const onecService = require('../integrations/onec.service');
const {
  orderTsdSent,
  isDuplicateTsdWebhook,
  tsdWebhookEventKey
} = require('../integrations/integration-meta');
const { normalizeOrderStatus } = require('../order-status');

function verifyWebhookSecret(req, expectedSecret) {
  if (!expectedSecret) return false;
  const header =
    String(req.headers['x-integration-secret'] || req.headers['x-webhook-secret'] || '').trim();
  if (!header) return false;
  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expectedSecret, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return require('crypto').timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolveOrderRef(payload) {
  const id = String(payload?.orderId || payload?.id || '').trim();
  const orderNumber = String(payload?.orderNumber || '').trim();
  if (id) return { id };
  if (orderNumber) return { orderNumber };
  return null;
}

async function loadOrderFromPayload(payload) {
  const ref = resolveOrderRef(payload);
  if (!ref) return null;
  if (ref.id) return marketplaceRepo.loadOrderLegacyById(ref.id);
  return marketplaceRepo.loadOrderLegacy({ orderNumber: ref.orderNumber });
}

/** Shared admin + legacy datamobile route handler */
async function sendOrderToTsdAdmin(req, res) {
  const order = await marketplaceRepo.loadOrderLegacyById(req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: 'Order topilmadi' });

  if (orderTsdSent(order.integrationMeta)) {
    return res.status(409).json({
      ok: false,
      code: 'TSD_ALREADY_SENT',
      message: 'Buyurtma allaqachon TSD ga yuborilgan'
    });
  }

  const result = await tsdService.sendOrderToTsd(order);
  if (!result.ok) {
    const code = result.error || 'TSD_SEND_FAILED';
    const status = code === 'tsd_disabled' ? 503 : 502;
    return res.status(status).json({ ok: false, code, message: result.error || 'TSD yuborish muvaffaqiyatsiz' });
  }

  const nextStatus = 'preparing';
  const current = normalizeOrderStatus(order.status);
  const statusUpdate =
    current === 'preparing' || current === nextStatus
      ? {}
      : { status: nextStatus, deliveryStatus: nextStatus };

  const next = await marketplaceRepo.patchOrderScalars(order.id, {
    integrationMeta: result.integrationMeta,
    ...statusUpdate,
    updatedAt: new Date()
  });

  return res.json({
    ok: true,
    message: 'Buyurtma TSD navbatiga qo‘shildi',
    externalId: result.externalId,
    order: next
  });
}

async function tsdWebhook(req, res) {
  if (!integrationConfig.tsdEnabled) {
    return res.status(503).json({ ok: false, message: 'TSD integration o‘chirilgan' });
  }
  if (!verifyWebhookSecret(req, integrationConfig.tsdWebhookSecret)) {
    return res.status(401).json({ ok: false, message: 'Webhook secret noto‘g‘ri' });
  }

  const order = await loadOrderFromPayload(req.body);
  if (!order) return res.status(404).json({ ok: false, message: 'Order topilmadi' });

  const eventKey = tsdWebhookEventKey(req.body);
  if (isDuplicateTsdWebhook(order.integrationMeta, eventKey)) {
    return res.json({ ok: true, duplicate: true, order });
  }

  const { integrationMeta, targetStatus } = tsdService.applyTsdWebhookToMeta(order.integrationMeta, req.body);
  const current = normalizeOrderStatus(order.status);
  const mapped = normalizeOrderStatus(targetStatus);
  const patch = { integrationMeta, updatedAt: new Date() };
  if (mapped && mapped !== current && !['delivered', 'cancelled'].includes(current)) {
    patch.status = mapped;
    patch.deliveryStatus = mapped;
  }

  const next = await marketplaceRepo.patchOrderScalars(order.id, patch);
  return res.json({ ok: true, order: next });
}

async function applyOnecPick(order, body) {
  const pick = onecService.handlePickComplete({ ...body, orderId: order.id }, order.integrationMeta);
  if (!pick.ok) return { ok: false, status: 400, message: pick.error || 'Noto‘g‘ri so‘rov' };

  const current = normalizeOrderStatus(order.status);
  const target = normalizeOrderStatus(pick.targetStatus);
  const patch = { integrationMeta: pick.integrationMeta, updatedAt: new Date() };
  if (target && target !== current && !['delivered', 'cancelled'].includes(current)) {
    patch.status = target;
    patch.deliveryStatus = target;
  }
  const next = await marketplaceRepo.patchOrderScalars(order.id, patch);
  return { ok: true, order: next };
}

async function onecOrderPicked(req, res) {
  if (!integrationConfig.onecOrdersEnabled) {
    return res.status(503).json({ ok: false, message: '1C order integration o‘chirilgan' });
  }
  if (!verifyWebhookSecret(req, integrationConfig.onecWebhookSecret)) {
    return res.status(401).json({ ok: false, message: 'Webhook secret noto‘g‘ri' });
  }

  const order = await loadOrderFromPayload(req.body);
  if (!order) return res.status(404).json({ ok: false, message: 'Order topilmadi' });

  const out = await applyOnecPick(order, req.body);
  if (!out.ok) return res.status(out.status || 400).json({ ok: false, message: out.message });
  return res.json({ ok: true, order: out.order });
}

/** Admin manual pick (legacy Dalion route) — does not require ONEC_ORDERS_ENABLED. */
async function onecOrderPickedAdmin(req, res) {
  const order = await loadOrderFromPayload(req.body);
  if (!order) return res.status(404).json({ ok: false, message: 'Order topilmadi' });
  const out = await applyOnecPick(order, req.body);
  if (!out.ok) return res.status(out.status || 400).json({ ok: false, message: out.message });
  return res.json({ ok: true, order: out.order });
}

module.exports = {
  sendOrderToTsdAdmin,
  tsdWebhook,
  onecOrderPicked,
  onecOrderPickedAdmin,
  verifyWebhookSecret
};
