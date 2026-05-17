'use strict';

function envBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return String(raw).trim().toLowerCase() === 'true' || raw === '1';
}

function envStr(name, defaultValue = '') {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return String(raw).trim();
}

const integrationConfig = {
  tsdEnabled: envBool('TSD_ENABLED', false),
  tsdMode: envStr('TSD_MODE', 'stub').toLowerCase() === 'live' ? 'live' : 'stub',
  tsdWebhookSecret: envStr('TSD_WEBHOOK_SECRET'),
  tsdAutoOnPreparing: envBool('TSD_AUTO_ON_PREPARING', false),
  tsdAutoOnCreate: envBool('TSD_AUTO_ON_CREATE', false),
  onecOrdersEnabled: envBool('ONEC_ORDERS_ENABLED', false),
  onecWebhookSecret: envStr('ONEC_WEBHOOK_SECRET'),
  /** After 1C pick complete: ready_for_courier | preparing */
  onecPickTargetStatus: envStr('ONEC_PICK_TARGET_STATUS', 'ready_for_courier').toLowerCase()
};

function pickTargetStatus() {
  const t = integrationConfig.onecPickTargetStatus;
  return t === 'preparing' ? 'preparing' : 'ready_for_courier';
}

module.exports = { integrationConfig, pickTargetStatus, envBool, envStr };
