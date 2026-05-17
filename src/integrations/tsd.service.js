'use strict';

const { integrationConfig } = require('./integration.config');
const { buildTsdSentMeta, getTsdMeta } = require('./integration-meta');
const { normalizeOrderStatus } = require('../order-status');

function stubExternalId(order) {
  const num = String(order?.orderNumber || order?.id || 'order').replace(/\W/g, '');
  return `tsd-stub-${num}-${Date.now()}`;
}

/**
 * @param {object} order legacy order row
 * @returns {Promise<{ ok: boolean, externalId?: string, error?: string, integrationMeta?: object }>}
 */
async function sendOrderToTsd(order) {
  if (!order?.id) {
    return { ok: false, error: 'order_required' };
  }
  if (!integrationConfig.tsdEnabled) {
    return { ok: false, error: 'tsd_disabled' };
  }

  const mode = integrationConfig.tsdMode;
  if (mode === 'live') {
    // Placeholder for Data Mobile HTTP client — credentials via TSD_API_URL, TSD_API_KEY
    console.warn('[TSD] live mode not implemented; falling back to stub behavior');
  }

  const externalId = stubExternalId(order);
  const integrationMeta = buildTsdSentMeta(order.integrationMeta, {
    externalId,
    mode: mode === 'live' ? 'live-pending' : 'stub',
    statusAfter: 'preparing'
  });

  console.log('[TSD] sendOrderToTsd', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    mode,
    externalId
  });

  return { ok: true, externalId, integrationMeta };
}

/** Map Data Mobile webhook status to internal workflow status. */
function mapTsdWebhookStatus(rawStatus) {
  return normalizeOrderStatus(rawStatus);
}

function applyTsdWebhookToMeta(existingMeta, payload) {
  const mapped = mapTsdWebhookStatus(payload?.status);
  const eventKey = `${String(payload?.orderId || '').trim()}:${String(payload?.status || '').trim()}:${String(payload?.externalId || '').trim()}`;
  const tsd = {
    ...getTsdMeta(existingMeta),
    externalId: payload?.externalId || getTsdMeta(existingMeta).externalId || null,
    lastWebhookKey: eventKey,
    lastWebhookAt: new Date().toISOString(),
    lastWebhookStatus: String(payload?.status || '').trim()
  };
  const base = existingMeta && typeof existingMeta === 'object' ? existingMeta : {};
  return {
    integrationMeta: { ...base, tsd },
    targetStatus: mapped
  };
}

module.exports = { sendOrderToTsd, mapTsdWebhookStatus, applyTsdWebhookToMeta };
