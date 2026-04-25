const products = [
  { id: 'coca', code: 'DAL-COCA-1L', sku: 'DAL-COCA-1L', name: 'Coca Cola 1L', categoryId: 'cat_ichimliklar', category: 'Ichimliklar', price: 12000, oldPrice: 13400, stock: 100, image: '', image_url: '', source: 'seed', updated_at: new Date().toISOString(), active: true },
  { id: 'pepsi', code: 'DAL-PEPSI-1L', sku: 'DAL-PEPSI-1L', name: 'Pepsi 1L', categoryId: 'cat_ichimliklar', category: 'Ichimliklar', price: 12000, oldPrice: 13400, stock: 100, image: '', image_url: '', source: 'seed', updated_at: new Date().toISOString(), active: true },
  { id: 'rich', code: 'DAL-RICH-ORANGE-1L', sku: 'DAL-RICH-ORANGE-1L', name: 'Rich Apelsin 1L', categoryId: 'cat_ichimliklar', category: 'Ichimliklar', price: 18000, oldPrice: 20000, stock: 100, image: '', image_url: '', source: 'seed', updated_at: new Date().toISOString(), active: true }
];

const categories = [
  { id: 'cat_ichimliklar', name: 'Ichimliklar', active: true },
  { id: 'cat_shirinliklar', name: 'Shirinliklar', active: true },
  { id: 'cat_sut', name: 'Sut mahsulotlari', active: true },
  { id: 'cat_boshqa', name: 'Boshqa', active: true }
];

const banners = [
  { id: 'banner_1', title: 'Tez yetkazib berish', subtitle: '30 daqiqa ichida buyurtma bering', image_url: '', active: true }
];

const promotions = [
  { id: 'promo_1', title: 'Hafta aksiyasi', description: 'Eng yaxshi narxlar', discount_text: '-20%', active: true }
];

let homeSettings = {
  heroTitle: 'GlobusMarket',
  heroSubtitle: 'Qulay va tez xarid tajribasi',
  deliveryText: '30 daqiqada yetkazib berish',
  backgroundImageUrl: '',
  accentColor: '#25f48f'
};

const cart = new Map();
const orders = [];

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function ensureCategory(categoryName = 'Boshqa') {
  const normalized = String(categoryName || 'Boshqa').trim() || 'Boshqa';
  let found = categories.find((c) => c.name.toLowerCase() === normalized.toLowerCase());
  if (!found) {
    found = { id: makeId('cat'), name: normalized, active: true };
    categories.push(found);
  }
  return found;
}

function listProducts(search = '', { activeOnly = false, category = '' } = {}) {
  const q = String(search || '').trim().toLowerCase();
  const categoryQuery = String(category || '').trim().toLowerCase();
  return products
    .filter((p) => (activeOnly ? p.active !== false : true))
    .filter((p) => (categoryQuery ? String(p.category || '').toLowerCase() === categoryQuery : true))
    .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
}

function getProductById(id) {
  return products.find((p) => p.id === id) || null;
}

function getCategories({ activeOnly = false } = {}) {
  return categories.filter((c) => (activeOnly ? c.active !== false : true));
}

function getBanners({ activeOnly = false } = {}) {
  return banners.filter((b) => (activeOnly ? b.active !== false : true));
}

function createBanner(payload = {}) {
  const banner = {
    id: makeId('banner'),
    title: payload.title || 'Yangi banner',
    subtitle: payload.subtitle || '',
    image_url: payload.image_url || '',
    active: payload.active !== false
  };
  banners.push(banner);
  return banner;
}

function updateBanner(id, payload = {}) {
  const i = banners.findIndex((x) => x.id === id);
  if (i === -1) return null;
  banners[i] = { ...banners[i], ...payload };
  return banners[i];
}

function deleteBanner(id) {
  const i = banners.findIndex((x) => x.id === id);
  if (i === -1) return false;
  banners.splice(i, 1);
  return true;
}

function getPromotions({ activeOnly = false } = {}) {
  return promotions.filter((p) => (activeOnly ? p.active !== false : true));
}

function createPromotion(payload = {}) {
  const promo = {
    id: makeId('promo'),
    title: payload.title || 'Yangi promo',
    description: payload.description || '',
    discount_text: payload.discount_text || '',
    active: payload.active !== false
  };
  promotions.push(promo);
  return promo;
}

function updatePromotion(id, payload = {}) {
  const i = promotions.findIndex((x) => x.id === id);
  if (i === -1) return null;
  promotions[i] = { ...promotions[i], ...payload };
  return promotions[i];
}

function deletePromotion(id) {
  const i = promotions.findIndex((x) => x.id === id);
  if (i === -1) return false;
  promotions.splice(i, 1);
  return true;
}

function getHomeSettings() {
  return homeSettings;
}

function updateHomeSettings(payload = {}) {
  homeSettings = { ...homeSettings, ...payload };
  return homeSettings;
}

function updateCategory(id, payload = {}) {
  const i = categories.findIndex((x) => x.id === id);
  if (i === -1) return null;
  categories[i] = { ...categories[i], ...payload };
  return categories[i];
}

function updateProduct(id, payload = {}) {
  const i = products.findIndex((x) => x.id === id);
  if (i === -1) return null;

  let categoryPatch = {};
  if (payload.categoryId) {
    const cat = categories.find((c) => c.id === payload.categoryId);
    if (cat) categoryPatch = { categoryId: cat.id, category: cat.name };
  } else if (payload.category) {
    const cat = ensureCategory(payload.category);
    categoryPatch = { categoryId: cat.id, category: cat.name };
  }

  products[i] = {
    ...products[i],
    ...payload,
    ...categoryPatch,
    price: payload.price !== undefined ? Number(payload.price) || 0 : products[i].price,
    stock: payload.stock !== undefined ? Number(payload.stock) || 0 : products[i].stock,
    oldPrice: payload.oldPrice !== undefined ? Number(payload.oldPrice) || 0 : products[i].oldPrice
  };
  return products[i];
}

function getCartItems() {
  return products
    .map((p) => ({ product: p, quantity: cart.get(p.id) || 0 }))
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      id: item.product.id,
      name: item.product.name,
      category: item.product.category,
      image_url: item.product.image_url || item.product.image || '',
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
    const i = products.findIndex((p) => p.id === raw.id);
    const categoryRef = ensureCategory(raw.category || 'Boshqa');

    const normalized = {
      id: raw.id,
      code: raw.code || raw.sku || raw.id,
      sku: raw.sku || raw.id,
      name: raw.name || 'Nomsiz mahsulot',
      categoryId: raw.categoryId || categoryRef.id,
      category: raw.category || categoryRef.name,
      price: Number(raw.price) || 0,
      oldPrice: Number(raw.oldPrice) || Number(raw.price) || 0,
      stock: Number(raw.stock ?? 0),
      image: raw.image || raw.image_url || '',
      image_url: raw.image_url || raw.image || '',
      source: raw.source || 'excel',
      updated_at: raw.updated_at || new Date().toISOString(),
      active: raw.active !== false
    };

    if (i === -1) {
      products.push(normalized);
      touched.push(normalized.id);
    } else {
      products[i] = { ...products[i], ...normalized };
      touched.push(products[i].id);
    }
  }

  return touched;
}

module.exports = {
  // state sections
  products,
  categories,
  banners,
  promotions,
  // public getters
  listProducts,
  getProductById,
  getCategories,
  getBanners,
  getPromotions,
  getHomeSettings,
  // admin operations
  createBanner,
  updateBanner,
  deleteBanner,
  createPromotion,
  updatePromotion,
  deletePromotion,
  updateHomeSettings,
  updateCategory,
  updateProduct,
  // cart/order/import
  getCartSummary,
  setCartItem,
  clearCart,
  createOrder,
  upsertProducts,
  orders
};
