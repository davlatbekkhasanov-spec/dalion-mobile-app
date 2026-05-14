'use strict';

const ORDER_STATUS_ALIASES = {
  new: 'created',
  sent_to_tsd: 'preparing',
  picking: 'preparing',
  picked: 'ready_for_courier',
  waiting_courier: 'ready_for_courier'
};

function normalizeOrderStatus(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
  if (!raw) return 'created';
  return ORDER_STATUS_ALIASES[raw] || raw;
}

module.exports = { ORDER_STATUS_ALIASES, normalizeOrderStatus };
