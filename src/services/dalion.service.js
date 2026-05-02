const store = require('../data/store.js');

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

async function fetchProducts() {
  // TODO: connect DALION Trend products endpoint
  return [];
}

async function fetchStocks() {
  // TODO: connect DALION Trend stocks endpoint
  return [];
}

async function fetchPrices() {
  // TODO: connect DALION Trend prices endpoint
  return [];
}

async function fetchImages() {
  // TODO: connect DALION Trend images endpoint
  return [];
}

async function syncDalionProducts() {
  // TODO: implement DALION merge/upsert strategy
  return { synced: 0, source: 'dalion', status: 'pending_integration' };
}

module.exports = {
  mapFrom1CDalionTrend,
  mapTo1CDalionTrend,
  importFrom1C,
  exportTo1C,
  fetchProducts,
  fetchStocks,
  fetchPrices,
  fetchImages,
  syncDalionProducts
};
