/**
 * Legacy in-memory fallback used when DB_ENABLED pg pool paths run tests/controllers.
 * Marketplace persistence lives in PostgreSQL via index.js + marketplace-repository.
 */
let products = [];

function listProducts(search = '') {
  const q = String(search || '').trim().toLowerCase();
  let list = [...products];
  if (q) {
    list = list.filter((p) => `${p.name || ''} ${p.code || ''}`.toLowerCase().includes(q));
  }
  return list;
}

function getProductById(id) {
  return products.find((p) => String(p.id) === String(id)) || null;
}

function upsertProducts(rows = []) {
  const touched = [];
  for (const row of rows) {
    const id = String(row.id || '').trim();
    if (!id || !String(row.name || '').trim()) continue;
    const ix = products.findIndex((p) => String(p.id) === id);
    const merged = { ...row, id };
    if (ix >= 0) products[ix] = { ...products[ix], ...merged };
    else products.push(merged);
    touched.push(id);
  }
  return touched;
}

function getOrderById() {
  return null;
}

function getOrderByNumber() {
  return null;
}

function markOrderPaid() {}

function markOrderPaymentCancelled() {}

function getCartSummary() {
  return { totalQty: 0, items: [], subtotal: 0 };
}

function setCartItem() {
  return { error: 'not-found', data: null };
}

function clearCart() {}

function sendOrderToTsd() {
  return { ok: false };
}

function markDalionPicked() {
  return null;
}

module.exports = {
  products,
  listProducts,
  getProductById,
  upsertProducts,
  getOrderById,
  getOrderByNumber,
  markOrderPaid,
  markOrderPaymentCancelled,
  getCartSummary,
  setCartItem,
  clearCart,
  sendOrderToTsd,
  markDalionPicked
};
