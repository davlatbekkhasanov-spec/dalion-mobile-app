'use strict';

/** Ops tablo / orders-display — faqat to'langan yoki naqd buyurtmalar ko'rinadi. */
function shouldShowOnOpsBoards(order) {
  const normalizedStatus = String(order?.status || '').trim().toLowerCase();
  if (normalizedStatus === 'payment_pending') return false;
  const method = String(order?.paymentMethod || '').trim().toLowerCase();
  const payment = String(order?.paymentStatus || '').trim().toLowerCase();
  if (method === 'payme' && payment !== 'paid') return false;
  return true;
}

module.exports = { shouldShowOnOpsBoards };
