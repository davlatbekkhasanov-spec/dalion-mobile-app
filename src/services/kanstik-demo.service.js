const crypto = require('crypto');

const SOURCE = 'kanstik_demo';
const BASE_URL = 'https://kanstik.uz';
const CATALOG_URL = `${BASE_URL}/uz/catalog`;
const DEMO_CATEGORIES = [
  'Kanselyariya',
  'Ofis jihozlari',
  'Qog‘oz mahsulotlari',
  'Papkalar',
  'Ruchkalar',
  'Daftarlar',
  'Printer va kartrijlar',
  'Kompyuter aksessuarlari',
  'USB va kabellar',
  'Tashkiliy buyumlar',
  'Bo‘yoqlar va ijod',
  'Boshqa'
];

function normalizeText(v = '') { return String(v || '').replace(/\s+/g, ' ').trim(); }
function slugify(v = '') { return normalizeText(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, ''); }
function toAbs(url = '') { return /^https?:\/\//i.test(url) ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`; }

async function fetchPage(url, timeoutMs = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal, headers: { 'user-agent': 'dalion-demo-loader/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

function extractProductBlocks(html = '') {
  const blocks = [];
  const rx = /<a[^>]+href=["']([^"']*\/products\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = rx.exec(html))) {
    const body = m[2] || '';
    const image = body.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
    const alt = body.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] || '';
    const priceText = body.match(/(\d[\d\s.,]{2,})\s*(so['ʻ’`]?m|sum|сум)/i)?.[1] || '';
    blocks.push({ href: toAbs(m[1]), image_url: toAbs(image), name: normalizeText(alt), priceText });
  }
  return blocks;
}

function parsePrice(v = '') { const n = Number(String(v).replace(/[^\d]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; }

function mapCategory(name = '', url = '') {
  const raw = `${name} ${url}`.toLowerCase();
  if (/(ruchka|ручк|gel pen)/.test(raw)) return 'Ruchkalar';
  if (/(daftar|тетрад|bloknot)/.test(raw)) return 'Daftarlar';
  if (/(papka|folder|файл)/.test(raw)) return 'Papkalar';
  if (/(printer|kartrij|картридж|toner)/.test(raw)) return 'Printer va kartrijlar';
  if (/(usb|type-c|hdmi|kabel|cable|otg)/.test(raw)) return 'USB va kabellar';
  if (/(klaviatura|sichqon|mouse|adapter|web-camera|naushnik|laptop)/.test(raw)) return 'Kompyuter aksessuarlari';
  if (/(qog'oz|qog‘oz|бумаг|konvert|sticker|sticky)/.test(raw)) return 'Qog‘oz mahsulotlari';
  if (/(kraska|bo'yoq|bo‘yoq|akril|гуашь|кисть|canvas)/.test(raw)) return 'Bo‘yoqlar va ijod';
  if (/(kalkulyator|laminator|shreder|stol|organizer|ofis)/.test(raw)) return 'Ofis jihozlari';
  if (/(qisqich|skrepka|lotok|organizer|pin|magnit)/.test(raw)) return 'Tashkiliy buyumlar';
  if (/(kantsely|канц|qalam|marker|stepler|yelim)/.test(raw)) return 'Kanselyariya';
  return 'Boshqa';
}

async function loadKanstikDemoCatalog({ maxPages = 8, maxProducts = 180 } = {}) {
  const errors = [];
  let html;
  try { html = await fetchPage(CATALOG_URL); } catch (e) { throw new Error(`Kanstik catalog fetch failed: ${e.message}`); }

  const searchLinks = [...new Set(Array.from(html.matchAll(/href=["']([^"']*\/uz\/search\?[^"']+)["']/gi)).map((x) => toAbs(x[1])))].slice(0, maxPages);
  if (!searchLinks.length) throw new Error('Kanstik page parsed but no searchable categories found.');

  const collected = [];
  for (const link of searchLinks) {
    for (let page = 1; page <= maxPages; page += 1) {
      if (collected.length >= maxProducts) break;
      const url = link.includes('page=') ? link : `${link}${link.includes('?') ? '&' : '?'}page=${page}`;
      try {
        const h = await fetchPage(url, 10000);
        const blocks = extractProductBlocks(h);
        if (!blocks.length) break;
        for (const b of blocks) {
          if (!b.name || !b.image_url || !b.href) continue;
          collected.push({ ...b, category: mapCategory(b.name, b.href), price: parsePrice(b.priceText) });
          if (collected.length >= maxProducts) break;
        }
      } catch (e) { errors.push(`${url}: ${e.message}`); break; }
    }
  }

  const uniq = new Map();
  for (const p of collected) {
    if (uniq.has(p.href)) continue;
    const hash = crypto.createHash('md5').update(p.href).digest('hex').slice(0, 10);
    const slug = slugify(p.name).slice(0, 40) || hash;
    const code = `kanstik_${slug}_${hash}`;
    uniq.set(p.href, {
      id: code,
      code,
      sku: code,
      name: p.name,
      category: p.category,
      price: p.price || 10000,
      stock: 20 + (parseInt(hash.slice(0, 2), 16) % 81),
      image_url: p.image_url,
      image: p.image_url,
      source: SOURCE,
      product_url: p.href,
      active: true
    });
  }

  const products = Array.from(uniq.values()).slice(0, maxProducts);
  const categoryCounts = products.reduce((a, p) => { a[p.category] = (a[p.category] || 0) + 1; return a; }, {});
  return { products, summary: { loaded: products.length, skipped: collected.length - products.length, categories: categoryCounts, imagesLoaded: products.filter((p) => p.image_url).length, errors, source: SOURCE, demoCategories: DEMO_CATEGORIES } };
}

module.exports = { loadKanstikDemoCatalog, SOURCE, DEMO_CATEGORIES };
