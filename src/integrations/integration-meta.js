'use strict';

function parseIntegrationMeta(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...raw };
}

function getTsdMeta(meta) {
  const m = parseIntegrationMeta(meta);
  return m.tsd && typeof m.tsd === 'object' ? { ...m.tsd } : {};
}

function orderTsdSent(meta) {
  const tsd = getTsdMeta(meta);
  return Boolean(tsd.sentAt || tsd.externalId);
}

function mergeIntegrationMeta(existing, patch) {
  const base = parseIntegrationMeta(existing);
  const next = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
      next[key] = { ...base[key], ...value };
    } else {
      next[key] = value;
    }
  }
  return next;
}

function tsdWebhookEventKey(payload) {
  const orderId = String(payload?.orderId || '').trim();
  const status = String(payload?.status || '').trim().toLowerCase();
  const externalId = String(payload?.externalId || '').trim();
  return `${orderId}:${status}:${externalId}`;
}

function isDuplicateTsdWebhook(meta, eventKey) {
  if (!eventKey) return false;
  return getTsdMeta(meta).lastWebhookKey === eventKey;
}

function buildTsdSentMeta(existing, { externalId, mode, statusAfter }) {
  const now = new Date().toISOString();
  const tsd = {
    ...getTsdMeta(existing),
    externalId: externalId || getTsdMeta(existing).externalId || null,
    sentAt: now,
    mode: mode || getTsdMeta(existing).mode || 'stub',
    statusAfter: statusAfter || 'preparing'
  };
  return mergeIntegrationMeta(existing, { tsd });
}

module.exports = {
  parseIntegrationMeta,
  getTsdMeta,
  orderTsdSent,
  mergeIntegrationMeta,
  tsdWebhookEventKey,
  isDuplicateTsdWebhook,
  buildTsdSentMeta
};
