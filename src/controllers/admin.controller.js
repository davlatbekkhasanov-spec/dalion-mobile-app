const store = require('../data/store.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { loadKanstikDemoCatalog, SOURCE: KANSTIK_SOURCE, DEMO_CATEGORIES } = require('../services/kanstik-demo.service.js');

function buildDemoProducts() {
  const itemsByCategory = {
    'Kanselyariya': ['Qaychi 17sm', 'Yelim qalam', 'Skotch 24mm', 'Marker qora', 'Shtamp bo‘yoq', 'Qalamdon stol usti', 'Korrektor lenta', 'Chizg‘ich 30sm', 'Stepler №24'],
    'Ofis jihozlari': ['Kalkulyator Canon', 'Laminator A4', 'Shreder mini', 'Flipchart doska', 'Ofis stoli organizer', 'Kreslo g‘ildirakli', 'Sichqoncha gilamcha', 'Stol lampasi LED', 'Vizitka qutisi'],
    'Qog‘oz mahsulotlari': ['A4 ofis qog‘ozi 80g', 'A3 ofis qog‘ozi 80g', 'Sticky notes 76x76', 'Rangli qog‘oz A4', 'Foto qog‘oz 10x15', 'Konvert C4', 'Konvert C5', 'Termo qog‘oz 57mm', 'Kartochka qog‘oz'],
    'Papkalar': ['Arxiv papka keng', 'Fayl papka 60 list', 'Prijim papka A4', 'Burchakli papka', 'Halqali papka 2D', 'Portfolio papka', 'Fayl qopqoqli papka', 'Zip papka A5', 'Bo‘luvchi separator'],
    'Ruchkalar': ['Sharikli ruchka ko‘k', 'Gel ruchka qora', 'Kapillyar ruchka 0.5', 'Avtomatik ruchka', 'Ruchka seti 4 rang', 'Kalligrafik ruchka', 'Ruchka refill ko‘k', 'Flomaster ruchka', 'Roller ruchka'],
    'Daftarlar': ['Daftar 12 varaq', 'Daftar 24 varaq', 'Daftar 48 varaq', 'Daftar 96 varaq', 'Spiral daftar A4', 'Qattiq muqova daftar', 'Katak daftar', 'Chiziqli daftar', 'Planner notebook'],
    'Printer va kartrijlar': ['HP LaserJet printer', 'Canon Inkjet printer', 'Epson MFP', 'HP 85A kartrij', 'Canon 725 kartrij', 'Epson 003 siyoh', 'Printer kabel USB-B', 'Toner universal', 'Drum unit'],
    'Kompyuter aksessuarlari': ['Simsiz sichqoncha', 'USB klaviatura', 'Web-kamera HD', 'Naushnik mikrofonsiz', 'Naushnik mikrofonli', 'Laptop stendi', 'Bluetooth adapter', 'Card reader', 'Kuler pad'],
    'USB va kabellar': ['USB fleshka 32GB', 'USB fleshka 64GB', 'Type-C kabel 1m', 'Lightning kabel 1m', 'HDMI kabel 2m', 'VGA kabel 1.5m', 'LAN kabel Cat6 3m', 'USB hub 4 port', 'OTG adapter'],
    'Tashkiliy buyumlar': ['Qog‘oz qisqichi 33mm', 'Skrepkalar 100 dona', 'Rezinka bog‘lagich', 'Nomerator stiker', 'Kantselyariya lotok', 'Sandiqcha organizer', 'Stol kalendari', 'Pin knopka', 'Magnit doska pin']
  };
  const imageBase = 'https://kanstik.uz/storage/products';
  const out = [];
  let idx = 1;
  for (const cat of DEMO_CATEGORIES) {
    const items = itemsByCategory[cat] || [];
    for (let i = 0; i < items.length + 1; i += 1) {
      const productName = items[i % items.length];
      const base = 12000 + (idx * 1950);
      const old = i % 3 === 0 ? base + 12000 : 0;
      const imageSlug = `${cat}-${productName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const imageUrl = `${imageBase}/${imageSlug}.jpg`;
      out.push({
        id: `demo-${idx}`,
        code: `DEMO-${String(idx).padStart(4, '0')}`,
        sku: `DEMO-${String(idx).padStart(4, '0')}`,
        name: productName,
        category: cat,
        price: base,
        oldPrice: old,
        stock: 5 + (idx % 40),
        image_url: imageUrl,
        image: imageUrl,
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
  return res.json({ ok: true, imported: products.length, categories: DEMO_CATEGORIES.length, source: 'demo' });
};

exports.loadKanstikDemoProducts = async (req, res) => {
  try {
    const { products, summary } = await loadKanstikDemoCatalog();
    if (!products.length) return res.status(422).json({ message: 'Kanstik sahifalaridan mahsulot topilmadi', summary });
    store.upsertProducts(products);
    return res.json({ ok: true, source: KANSTIK_SOURCE, ...summary });
  } catch (e) {
    return res.status(502).json({ ok: false, message: e.message || 'Kanstik demo yuklashda xatolik' });
  }
};
exports.clearDemoProducts = (req, res) => {
  const before = store.products.length;
  const keep = store.products.filter((p) => !['demo', KANSTIK_SOURCE].includes(String(p.source || '')));
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
