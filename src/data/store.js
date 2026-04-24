const products = [
  { id: 'coca', name: 'Coca Cola 1L', category: 'Ichimliklar', price: 12000, oldPrice: 13400, image: '' },
  { id: 'pepsi', name: 'Pepsi 1L', category: 'Ichimliklar', price: 12000, oldPrice: 13400, image: '' },
  { id: 'rich', name: 'Rich Apelsin 1L', category: 'Ichimliklar', price: 18000, oldPrice: 20000, image: '' }
];

const cart = new Map();
const orders = [];

function listProducts(search = '') {
  const q = search.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => p.name.toLowerCase().includes(q));
}

function getProductById(id) {
  return products.find((p) => p.id === id) || null;
}

function getCartItems() {
  return products
    .map((p) => ({ product: p, quantity: cart.get(p.id) || 0 }))
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      id: item.product.id,
      name: item.product.name,
      category: item.product.category,
      price: item.product.price,
      oldPrice: item.product.oldPrice,
      quantity: item.quantity,
      subtotal: item.quantity * item.product.price
    }));
}

function getCartSummary() {
  const items = getCartItems();
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { items, totalQty, subtotal };
}

function setCartItem(productId, quantity) {
  const product = getProductById(productId);
  if (!product) return { error: 'Product not found' };
  const qty = Math.max(0, Number(quantity) || 0);
  if (qty === 0) cart.delete(productId);
  else cart.set(productId, qty);
  return { data: getCartSummary() };
}

function clearCart() {
  cart.clear();
}

function createOrder({ paymentMethod = 'Naqd', location = 'Yunusobod, Toshkent', deliveryTime = '30 daqiqa', deliveryPrice = 12000 } = {}) {
  const summary = getCartSummary();
  if (summary.totalQty === 0) return { error: 'Cart is empty' };

  const order = {
    id: `ord_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'accepted',
    paymentMethod,
    location,
    deliveryTime,
    deliveryPrice,
    items: summary.items,
    subtotal: summary.subtotal,
    total: summary.subtotal + deliveryPrice
  };

  orders.push(order);
  clearCart();

  return { data: order };
}

module.exports = {
  listProducts,
  getProductById,
  getCartSummary,
  setCartItem,
  clearCart,
  createOrder,
  orders
};
