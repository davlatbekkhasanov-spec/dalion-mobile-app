const store = require('../data/store.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dalionService = require('../services/dalion.service.js');

const DEMO_DEPRECATED_MESSAGE = 'Demo katalog funksiyasi o‘chirildi. Excel import yoki DALION sinxronizatsiyasidan foydalaning.';

exports.getBanners = (req, res) => {
  res.json({ banners: store.getBanners() });
};

exports.createBanner = (req, res) => {
  const banner = store.createBanner(req.body || {});
  res.status(201).json({ banner });
};

exports.updateBanner = (req, res) => {
  const banner = store.updateBanner(req.params.id, req.body || {});
  if (!banner) return res.status(404).json({ message: 'Banner not found' });
  return res.json({ banner });
};

exports.deleteBanner = (req, res) => {
  const ok = store.deleteBanner(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Banner not found' });
  return res.json({ ok: true });
};

exports.getPromotions = (req, res) => {
  res.json({ promotions: store.getPromotions() });
};

exports.createPromotion = (req, res) => {
  const promotion = store.createPromotion(req.body || {});
  res.status(201).json({ promotion });
};

exports.updatePromotion = (req, res) => {
  const promotion = store.updatePromotion(req.params.id, req.body || {});
  if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
  return res.json({ promotion });
};

exports.deletePromotion = (req, res) => {
  const ok = store.deletePromotion(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Promotion not found' });
  return res.json({ ok: true });
};


exports.getPromoCodes = (req, res) => {
  res.json({ promoCodes: store.getPromoCodes() });
};

exports.upsertPromoCode = (req, res) => {
  const promoCode = store.upsertPromoCode(req.body || {});
  if (!promoCode) return res.status(400).json({ message: 'promo_code required' });
  return res.json({ promoCode });
};

exports.getHomeSettings = (req, res) => {
  res.json({ homeSettings: store.getHomeSettings() });
};

exports.updateHomeSettings = (req, res) => {
  const homeSettings = store.updateHomeSettings(req.body || {});
  res.json({ homeSettings });
};

exports.getCategories = (req, res) => {
  res.json({ categories: store.getCategories() });
};

exports.updateCategory = (req, res) => {
  const category = store.updateCategory(req.params.id, req.body || {});
  if (!category) return res.status(404).json({ message: 'Category not found' });
  return res.json({ category });
};

exports.uploadCategoryImage = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: 'image file is required' });
    const category = store.getCategories().find((c) => c.id === req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const dir = path.join(process.cwd(), 'uploads', 'categories');
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `${category.id}.webp`);
    await sharp(req.file.buffer)
      .rotate()
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 82, effort: 5 })
      .toFile(outPath);

    const image_url = `/uploads/categories/${category.id}.webp`;
    const updated = store.updateCategory(category.id, { image_url });
    return res.json({ category: updated });
  } catch (e) {
    return res.status(400).json({ message: e.message || 'Image upload failed' });
  }
};

exports.getProducts = (req, res) => {
  const { search = '' } = req.query;
  res.json({ products: store.listProducts(search) });
};

exports.updateProduct = (req, res) => {
  const product = store.updateProduct(req.params.id, req.body || {});
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json({ product });
};
exports.loadDemoProducts = (req, res) => {
  return res.status(410).json({ ok: false, deprecated: true, message: DEMO_DEPRECATED_MESSAGE });
};

exports.loadKanstikDemoProducts = async (req, res) => {
  return res.status(410).json({ ok: false, deprecated: true, message: DEMO_DEPRECATED_MESSAGE });
};
exports.clearDemoProducts = (req, res) => {
  const before = store.products.length;
  const keep = store.products.filter((p) => !['demo', 'static_demo', 'kanstik_demo', 'seed'].includes(String(p.source || '')));
  store.products.splice(0, store.products.length, ...keep);
  return res.json({ ok: true, removed: before - keep.length, deprecated: true, message: DEMO_DEPRECATED_MESSAGE });
};

exports.getStoreSummary = (req, res) => {
  res.json({ summary: store.getStoreSummary() });
};

exports.reloadStore = (req, res) => {
  const out = store.reloadStoreFromDisk();
  res.json(out);
};

exports.syncDalionProducts = async (req, res) => {
  const cfg = dalionService.getDalionConfig();
  if (!cfg.enabled) {
    return res.status(400).json({
      success: false,
      code: 'DALION_NOT_CONFIGURED',
      message: 'DALION integratsiyasi hali sozlanmagan'
    });
  }
  try {
    const result = await dalionService.syncProductsFromDalion();
    return res.json({ success: true, result });
  } catch (error) {
    if (error?.code === 'DALION_NOT_CONFIGURED') {
      return res.status(400).json({
        success: false,
        code: 'DALION_NOT_CONFIGURED',
        message: 'DALION integratsiyasi hali sozlanmagan'
      });
    }
    return res.status(500).json({ success: false, code: 'DALION_SYNC_FAILED', message: error?.message || 'DALION sync failed' });
  }
};

exports.getOrders = (req, res) => {
  res.json({ orders: store.getOrders() });
};

exports.getOrderById = (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json({ order });
};

exports.updateOrderStatus = (req, res) => {
  const status = String(req.body?.status || '').trim();
  const order = store.updateOrderStatus(req.params.id, status);
  if (!order) return res.status(400).json({ message: 'Order not found or invalid status' });
  return res.json({ order });
};

exports.cancelOrder = (req, res) => {
  const order = store.cancelOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json({ order });
};

exports.assignCourier = (req, res) => {
  const courierName = String(req.body?.courierName || '').trim();
  const courierPhone = String(req.body?.courierPhone || '').trim();
  if (!courierName || !courierPhone) return res.status(400).json({ message: 'courierName va courierPhone majburiy' });
  const order = store.adminAssignCourier(req.params.id, { courierName, courierPhone });
  if (!order) return res.status(400).json({ message: 'Order not found or cannot assign courier' });
  return res.json({ order });
};

exports.getAnalyticsOverview = (req, res) => {
  const orders = store.getOrders();
  const qualifying = orders.filter((o) => o.status === 'delivered' || o.status === 'paid' || o.paymentStatus === 'paid');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const revenue = qualifying.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalOrders = orders.length;
  res.json({
    total_orders: totalOrders,
    total_revenue: revenue,
    total_delivered_orders: qualifying.filter((o) => o.status === 'delivered').length,
    total_cancelled_orders: cancelled.length,
    avg_order_value: qualifying.length ? Math.round(revenue / qualifying.length) : 0
  });
};

exports.getAnalyticsTopProducts = (req, res) => {
  const soldMap = new Map();
  store.getOrders()
    .filter((o) => o.status !== 'cancelled' && (o.status === 'delivered' || o.status === 'paid' || o.paymentStatus === 'paid'))
    .forEach((o) => {
      (o.items || []).forEach((it) => {
        const id = it.id || it.code || it.name;
        const prev = soldMap.get(id) || { product_id: id, name: it.name || id, qty_sold: 0 };
        prev.qty_sold += Number(it.quantity || 0);
        soldMap.set(id, prev);
      });
    });
  const top = [...soldMap.values()].sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 10);
  res.json({ items: top });
};

exports.getAnalyticsTopCategories = (req, res) => {
  const catMap = new Map();
  store.getOrders()
    .filter((o) => o.status !== 'cancelled' && (o.status === 'delivered' || o.status === 'paid' || o.paymentStatus === 'paid'))
    .forEach((o) => {
      (o.items || []).forEach((it) => {
        const p = store.getProductById(it.id) || {};
        const cat = p.category || 'Boshqa';
        const prev = catMap.get(cat) || { category: cat, revenue: 0 };
        prev.revenue += Number(it.subtotal || (Number(it.price || 0) * Number(it.quantity || 0)));
        catMap.set(cat, prev);
      });
    });
  res.json({ items: [...catMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10) });
};

exports.getAnalyticsDaily = (req, res) => {
  const days = Number(req.query?.days || 7);
  const from = Date.now() - (Math.max(1, Math.min(30, days)) * 24 * 60 * 60 * 1000);
  const bucket = new Map();
  store.getOrders()
    .filter((o) => new Date(o.created_at || 0).getTime() >= from)
    .filter((o) => o.status !== 'cancelled' && (o.status === 'delivered' || o.status === 'paid' || o.paymentStatus === 'paid'))
    .forEach((o) => {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      const prev = bucket.get(key) || { date: key, orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += Number(o.total || 0);
      bucket.set(key, prev);
    });
  res.json({ items: [...bucket.values()].sort((a, b) => a.date.localeCompare(b.date)) });
};

exports.getOrderPicklist = (req, res) => {
  const picklist = store.getOrderPicklist(req.params.id);
  if (!picklist) return res.status(404).json({ message: 'Order not found' });
  return res.json(picklist);
};

exports.sendOrderToTsd = (req, res) => {
  const out = store.sendOrderToTsd(req.params.id);
  if (!out) return res.status(404).json({ message: 'Order not found' });
  return res.json(out);
};

exports.getOrderQr = async (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  let QRCode;
  try {
    // optional dependency: installed in normal deploy/runtime
    QRCode = require('qrcode');
  } catch (e) {
    return res.status(500).json({ message: 'QR generator dependency not installed' });
  }
  const publicBase = process.env.PUBLIC_BASE_URL || 'https://dalion-mobile-app-production.up.railway.app';
  const courierUrl = `${publicBase}/courier/${order.courierToken}`;
  const qrDataUrl = await QRCode.toDataURL(courierUrl, { margin: 1, width: 220 });
  return res.json({ qrUrl: courierUrl, courierUrl, token: order.courierToken, qrDataUrl });
};
