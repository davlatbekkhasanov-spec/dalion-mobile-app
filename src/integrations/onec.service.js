'use strict';

const { integrationConfig, pickTargetStatus } = require('./integration.config');
const { mergeIntegrationMeta, parseIntegrationMeta } = require('./integration-meta');

/**
 * @param {object} order
 * @returns {Promise<{ ok: boolean, onecDocumentId?: string, error?: string, integrationMeta?: object }>}
 */
async function exportOrderTo1C(order) {
  if (!order?.id) return { ok: false, error: 'order_required' };
  if (!integrationConfig.onecOrdersEnabled) {
    return { ok: false, error: 'onec_orders_disabled' };
  }

  const docId = `1c-stub-${String(order.orderNumber || order.id).replace(/\W/g, '')}`;
  const integrationMeta = mergeIntegrationMeta(order.integrationMeta, {
    onec: {
      documentId: docId,
      exportedAt: new Date().toISOString(),
      mode: 'stub'
    }
  });

  console.log('[1C] exportOrderTo1C stub', { orderId: order.id, onecDocumentId: docId });
  return { ok: true, onecDocumentId: docId, integrationMeta };
}

/**
 * @param {object} payload — { orderId, orderNumber?, onecDocumentId?, pickedAt? }
 * @param {object} [existingMeta]
 * @returns {{ ok: boolean, targetStatus: string, integrationMeta: object, error?: string }}
 */
function handlePickComplete(payload, existingMeta) {
  const orderId = String(payload?.orderId || payload?.id || '').trim();
  if (!orderId) return { ok: false, error: 'order_id_required', targetStatus: pickTargetStatus() };

  const targetStatus = pickTargetStatus();
  const meta = mergeIntegrationMeta(existingMeta, {
    onec: {
      ...(parseIntegrationMeta(existingMeta).onec || {}),
      documentId: payload?.onecDocumentId || parseIntegrationMeta(existingMeta).onec?.documentId || null,
      pickedAt: payload?.pickedAt || new Date().toISOString(),
      pickWebhookAt: new Date().toISOString()
    }
  });

  return { ok: true, targetStatus, integrationMeta: meta, orderId };
}

module.exports = { exportOrderTo1C, handlePickComplete, pickTargetStatus };
