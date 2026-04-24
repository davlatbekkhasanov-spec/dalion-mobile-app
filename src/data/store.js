const products = [
  { id: 'coca', sku: 'DAL-COCA-1L', name: 'Coca Cola 1L', category: 'Ichimliklar', price: 12000, oldPrice: 13400, stock: 100, image: '' },
  { id: 'pepsi', sku: 'DAL-PEPSI-1L', name: 'Pepsi 1L', category: 'Ichimliklar', price: 12000, oldPrice: 13400, stock: 100, image: '' },
  { id: 'rich', sku: 'DAL-RICH-ORANGE-1L', name: 'Rich Apelsin 1L', category: 'Ichimliklar', price: 18000, oldPrice: 20000, stock: 100, image: '' }
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

function upsertProducts(items = []) {
  const touched = [];

  for (const raw of items) {
    if (!raw || !raw.id) continue;
    const index = products.findIndex((p) => p.id === raw.id);
    const normalized = {
      id: raw.id,
      sku: raw.sku || '',
      name: raw.name || 'Nomsiz mahsulot',
      category: raw.category || 'Boshqa',
      price: Number(raw.price) || 0,
      oldPrice: Number(raw.oldPrice) || Number(raw.price) || 0,
      stock: Number(raw.stock ?? 0),
      image: raw.image || ''
    };

    if (index === -1) {
      products.push(normalized);
      touched.push(normalized.id);
    } else {
      products[index] = { ...products[index], ...normalized };
      touched.push(products[index].id);
    }
  }

  return touched;
}

module.exports = {
  listProducts,
  getProductById,
  getCartSummary,
  setCartItem,
  clearCart,
  createOrder,
  upsertProducts,
  orders
};
