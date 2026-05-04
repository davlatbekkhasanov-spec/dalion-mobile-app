const store = require('../../data/store.js');
const { fetchDalionProducts, isConfigured } = require('./dalion.service.js');
const { mapDalionProduct } = require('./dalion.mapper.js');

async function syncProducts() {
  const startedAt = new Date().toISOString();
  const errors = [];
  let products = 0;
  try {
    if (!isConfigured()) throw new Error('DALION_NOT_CONFIGURED');
    const raw = await fetchDalionProducts();
    const mapped = (Array.isArray(raw) ? raw : []).map(mapDalionProduct).filter((x) => x.id && x.name);
    const touched = store.upsertProducts(mapped);
    products = touched.length;
  } catch (e) {
    errors.push(String(e.message || 'DALION sync failed'));
  }
  return { startedAt, finishedAt: new Date().toISOString(), products, stock: products, prices: products, errors };
}

async function syncStock() { return syncProducts(); }
async function syncPrices() { return syncProducts(); }

module.exports = { syncProducts, syncStock, syncPrices };
