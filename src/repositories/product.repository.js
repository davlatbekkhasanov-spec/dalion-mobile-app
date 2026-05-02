const db = require('../db/index.js');
const store = require('../data/store.js');

function toDbProduct(item = {}) {
  return {
    id: String(item.id || '').trim(),
    code: String(item.code || '').trim() || null,
    source: String(item.source || 'excel').trim(),
    name: String(item.name || '').trim(),
    category: String(item.category || 'Boshqa').trim(),
    price: Number(item.price || 0),
    oldPrice: item.oldPrice === undefined || item.oldPrice === null ? null : Number(item.oldPrice || 0),
    stock: Number(item.stock || 0),
    imageUrl: item.image_url || null,
    isActive: item.active !== false,
    rawData: item
  };
}

async function upsertProducts(products = []) {
  if (!db.isDbEnabled()) {
    return store.upsertProducts(products);
  }
  const ids = [];
  for (const raw of products) {
    const p = toDbProduct(raw);
    if (!p.id || !p.name) continue;
    await db.query(
      `insert into products (id, code, source, name, category, price, old_price, stock, image_url, is_active, raw_data, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       on conflict (id) do update
       set code = excluded.code,
           source = excluded.source,
           name = excluded.name,
           category = excluded.category,
           price = excluded.price,
           old_price = excluded.old_price,
           stock = excluded.stock,
           image_url = excluded.image_url,
           is_active = excluded.is_active,
           raw_data = excluded.raw_data,
           updated_at = now()`,
      [p.id, p.code, p.source, p.name, p.category, p.price, p.oldPrice, p.stock, p.imageUrl, p.isActive, p.rawData]
    );
    ids.push(p.id);
  }
  return ids;
}

async function listProducts(filters = {}) {
  if (!db.isDbEnabled()) return store.listProducts(filters.search || '', filters);
  const activeOnly = Boolean(filters.activeOnly);
  const params = [];
  const where = [];
  if (activeOnly) where.push('is_active = true');
  if (filters.search) {
    params.push(`%${String(filters.search).toLowerCase()}%`);
    where.push(`(lower(name) like $${params.length} or lower(coalesce(code,'')) like $${params.length})`);
  }
  const sql = `select * from products ${where.length ? `where ${where.join(' and ')}` : ''} order by updated_at desc limit 5000`;
  const out = await db.query(sql, params);
  return out.rows.map((r) => ({
    id: r.id, code: r.code, sku: r.code, source: r.source, name: r.name, category: r.category,
    price: Number(r.price || 0), oldPrice: Number(r.old_price || 0), stock: Number(r.stock || 0),
    image_url: r.image_url || '', image: r.image_url || '', active: r.is_active !== false, updated_at: r.updated_at
  }));
}

async function getProductById(id) {
  if (!db.isDbEnabled()) return store.getProductById(id);
  const out = await db.query('select * from products where id = $1 limit 1', [id]);
  const r = out.rows[0];
  if (!r) return null;
  return {
    id: r.id, code: r.code, sku: r.code, source: r.source, name: r.name, category: r.category,
    price: Number(r.price || 0), oldPrice: Number(r.old_price || 0), stock: Number(r.stock || 0),
    image_url: r.image_url || '', image: r.image_url || '', active: r.is_active !== false, updated_at: r.updated_at
  };
}

async function clearBySource(source) {
  if (!db.isDbEnabled()) {
    const before = store.products.length;
    const keep = store.products.filter((p) => String(p.source || '') !== String(source || ''));
    store.products.splice(0, store.products.length, ...keep);
    return before - keep.length;
  }
  const out = await db.query('delete from products where source = $1', [String(source || '')]);
  return out.rowCount || 0;
}

module.exports = { upsertProducts, listProducts, getProductById, clearBySource };
