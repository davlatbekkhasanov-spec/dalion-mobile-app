function safeText(v, fallback = '') { return String(v ?? fallback).trim(); }
function safeNum(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

function mapDalionProduct(raw = {}) {
  return {
    id: safeText(raw.id || raw.guid || raw.code),
    name: safeText(raw.name || raw.title || 'Nomsiz mahsulot'),
    code: safeText(raw.code || raw.article || raw.id),
    category: safeText(raw.category || raw.group || 'Boshqa'),
    price: Math.max(0, safeNum(raw.price || raw.salePrice, 0)),
    stock: Math.max(0, safeNum(raw.stock || raw.balance, 0)),
    image_url: safeText(raw.image_url || raw.image || ''),
    active: raw.active !== false,
    source: 'dalion',
    updated_at: new Date().toISOString()
  };
}

module.exports = { mapDalionProduct };
