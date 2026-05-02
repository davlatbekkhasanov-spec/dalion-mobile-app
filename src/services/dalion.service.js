const store = require('../data/store.js');
const DALION_NOT_CONFIGURED_ERROR = 'DALION integration is not configured';

function getDalionConfig() {
  return {
    enabled: String(process.env.DALION_ENABLED || 'false').toLowerCase() === 'true',
    apiUrl: String(process.env.DALION_API_URL || '').trim(),
    username: String(process.env.DALION_USERNAME || '').trim(),
    password: String(process.env.DALION_PASSWORD || '').trim()
  };
}

function assertDalionConfigured() {
  const cfg = getDalionConfig();
  if (!cfg.enabled || !cfg.apiUrl || !cfg.username || !cfg.password) {
    const err = new Error(DALION_NOT_CONFIGURED_ERROR);
    err.code = 'DALION_NOT_CONFIGURED';
    throw err;
  }
  return cfg;
}

function mapFrom1CDalionTrend(item = {}) {
  return {
    id: String(item.id || item.guid || item.code || '').trim(),
    code: String(item.code || item.article || item.id || ''),
    sku: String(item.sku || item.article || item.code || ''),
    name: String(item.name || item.title || 'Nomsiz mahsulot'),
    category: String(item.category || item.group || 'Boshqa'),
    price: Number(item.price || item.salePrice || 0),
    oldPrice: Number(item.oldPrice || item.basePrice || item.price || 0),
    stock: Number(item.stock || item.balance || 0),
    image: String(item.image || ''),
    image_url: String(item.image_url || item.image || ''),
    source: 'dalion',
    updated_at: new Date().toISOString(),
    active: item.active !== false
  };
}

function mapTo1CDalionTrend(item = {}) {
  return {
    id: item.id,
    code: item.sku || item.id,
    article: item.sku || '',
    name: item.name,
    group: item.category,
    price: item.price,
    basePrice: item.oldPrice,
    balance: item.stock || 0
  };
}

function importFrom1C(items = []) {
  const mapped = items.map(mapFrom1CDalionTrend).filter((x) => x.id);
  const touched = store.upsertProducts(mapped);
  return {
    imported: touched.length,
    touchedIds: touched
  };
}

function exportTo1C() {
  const products = store.listProducts();
  return products.map(mapTo1CDalionTrend);
}

async function fetchProducts() { assertDalionConfigured(); throw new Error(DALION_NOT_CONFIGURED_ERROR); }
async function fetchCategories() { assertDalionConfigured(); throw new Error(DALION_NOT_CONFIGURED_ERROR); }
async function fetchStocks() { assertDalionConfigured(); throw new Error(DALION_NOT_CONFIGURED_ERROR); }
async function fetchPrices() { assertDalionConfigured(); throw new Error(DALION_NOT_CONFIGURED_ERROR); }
async function fetchImages() { assertDalionConfigured(); throw new Error(DALION_NOT_CONFIGURED_ERROR); }

async function syncProductsFromDalion() {
  assertDalionConfigured();
  throw new Error(DALION_NOT_CONFIGURED_ERROR);
}

module.exports = {
  mapFrom1CDalionTrend,
  mapTo1CDalionTrend,
  importFrom1C,
  exportTo1C,
  getDalionConfig,
  fetchProducts,
  fetchCategories,
  fetchStocks,
  fetchPrices,
  fetchImages,
  syncProductsFromDalion,
  DALION_NOT_CONFIGURED_ERROR
};
