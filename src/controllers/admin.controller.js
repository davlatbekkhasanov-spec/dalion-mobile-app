const store = require('../data/store.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const DEMO_CATEGORIES = ['Ofis jihozlari', 'Kanselyariya', 'Qog‘oz mahsulotlari', 'Printer va kartrijlar', 'Kompyuterlar', 'Noutbuklar', 'Monitorlar', 'Klaviatura va sichqoncha', 'USB va aksessuarlar', 'Tarmoq qurilmalari', 'Tozalash vositalari', 'Arxiv va papkalar'];

function buildDemoProducts() {
  const imageByCategory = {
    'Ofis jihozlari': 'Office+Supplies',
    Kanselyariya: 'Stationery',
    'Qog‘oz mahsulotlari': 'Paper+Products',
    'Printer va kartrijlar': 'Printer+Cartridge',
    Kompyuterlar: 'Desktop+Computer',
    Noutbuklar: 'Laptop',
    Monitorlar: 'Monitor',
    'Klaviatura va sichqoncha': 'Keyboard+Mouse',
    'USB va aksessuarlar': 'USB+Accessories',
    'Tarmoq qurilmalari': 'Network+Devices',
    'Tozalash vositalari': 'Cleaning+Supplies',
    'Arxiv va papkalar': 'Archive+Folders'
  };
  const names = ['Premium', 'Standart', 'Office', 'Pro', 'Mini', 'Max'];
  const out = [];
  let idx = 1;
  for (const cat of DEMO_CATEGORIES) {
    for (let i = 0; i < 9; i += 1) {
      const base = 35000 + (idx * 2700);
      const old = i % 3 === 0 ? base + 12000 : 0;
      const imageText = imageByCategory[cat] || 'Product+Image';
      const placeholder = `https://dummyimage.com/640x640/f8fafc/334155&text=${imageText}`;
      out.push({
        id: `demo-${idx}`,
        code: `DEMO-${String(idx).padStart(4, '0')}`,
        sku: `DEMO-${String(idx).padStart(4, '0')}`,
        name: `${cat} ${names[i % names.length]} ${i + 1}`,
        category: cat,
        price: base,
        oldPrice: old,
        stock: 5 + (idx % 40),
        image_url: placeholder,
        image: placeholder,
        source: 'demo',
        active: true
      });
      idx += 1;
    }
  }
  return out;
}

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
  const products = buildDemoProducts();
  store.upsertProducts(products);
  return res.json({ ok: true, imported: products.length, categories: DEMO_CATEGORIES.length });
};
exports.clearDemoProducts = (req, res) => {
  const before = store.products.length;
  const keep = store.products.filter((p) => String(p.source || '') !== 'demo');
  store.products.splice(0, store.products.length, ...keep);
  return res.json({ ok: true, removed: before - keep.length });
};

exports.getStoreSummary = (req, res) => {
  res.json({ summary: store.getStoreSummary() });
};

exports.reloadStore = (req, res) => {
  const out = store.reloadStoreFromDisk();
  res.json(out);
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
