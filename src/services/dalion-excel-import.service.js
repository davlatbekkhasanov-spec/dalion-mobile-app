const fs = require('fs');
const path = require('path');
const { unzipBuffer } = require('./xlsx-zip-reader.js');
const store = require('../data/store.js');

const PRODUCTS_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

function sanitizeCode(code = '') {
  return String(code || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function xmlUnescape(s = '') {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function getTagValue(xml, tag) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`));
  return m ? xmlUnescape(m[1]) : '';
}

function parseSharedStrings(xml = '') {
  const list = [];
  const matches = xml.match(/<(?:\w+:)?si[\s\S]*?<\/(?:\w+:)?si>/g) || [];
  for (const si of matches) {
    const texts = [];
    const tMatches = si.match(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g) || [];
    for (const t of tMatches) {
      const v = t.replace(/<[^>]+>/g, '');
      texts.push(xmlUnescape(v));
    }
    list.push(texts.join(''));
  }
  return list;
}

function colToIndex(ref = '') {
  const letters = (ref.match(/[A-Z]+/) || [''])[0];
  let out = 0;
  for (const ch of letters) out = out * 26 + (ch.charCodeAt(0) - 64);
  return out;
}

function parseRows(sheetXml, sharedStrings) {
  const rows = new Map();
  const rowMatches = sheetXml.match(/<(?:\w+:)?row[^>]*r="\d+"[^>]*>[\s\S]*?<\/(?:\w+:)?row>/g) || [];

  for (const rowXml of rowMatches) {
    const rowNo = Number((rowXml.match(/r="(\d+)"/) || [])[1] || 0);
    const cells = new Map();

    const cellMatches = rowXml.match(/<(?:\w+:)?c[^>]*>[\s\S]*?<\/(?:\w+:)?c>/g) || [];
    for (const c of cellMatches) {
      const ref = (c.match(/r="([A-Z]+\d+)"/) || [])[1] || '';
      const type = (c.match(/t="([^"]+)"/) || [])[1] || '';
      const col = colToIndex(ref);
      let value = '';

      if (type === 's') {
        const idx = Number(getTagValue(c, 'v'));
        value = sharedStrings[idx] || '';
      } else if (type === 'inlineStr' || c.includes('<is>')) {
        value = getTagValue(c, 't');
      } else {
        value = getTagValue(c, 'v');
      }
      cells.set(col, String(value || '').trim());
    }

    rows.set(rowNo, cells);
  }

  return rows;
}

function parseRelationships(xml = '') {
  const map = {};
  const rels = xml.match(/<Relationship[^>]*>/g) || [];
  for (const rel of rels) {
    const id = (rel.match(/Id="([^"]+)"/) || [])[1];
    const target = (rel.match(/Target="([^"]+)"/) || [])[1];
    if (id && target) map[id] = target;
  }
  return map;
}

function resolvePath(base, relative) {
  const parts = base.split('/').slice(0, -1);
  for (const seg of relative.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function parseRowImages(files, sheetXmlPath) {
  const sheetXml = files[sheetXmlPath]?.toString('utf8') || '';
  const drawingRid = (sheetXml.match(/<(?:\w+:)?drawing[^>]*r:id="([^"]+)"/) || [])[1];
  if (!drawingRid) return new Map();

  const sheetRelsPath = `${sheetXmlPath.replace('/sheet1.xml', '')}/_rels/sheet1.xml.rels`;
  const sheetRels = parseRelationships(files[sheetRelsPath]?.toString('utf8') || '');
  const drawingTarget = sheetRels[drawingRid];
  if (!drawingTarget) return new Map();

  const drawingXmlPath = resolvePath(sheetXmlPath, drawingTarget);
  const drawingRelsPath = `${drawingXmlPath.replace(/\/[^/]+$/, '')}/_rels/${drawingXmlPath.split('/').pop()}.rels`;
  const drawingXml = files[drawingXmlPath]?.toString('utf8') || '';
  const drawingRels = parseRelationships(files[drawingRelsPath]?.toString('utf8') || '');

  const rowImages = new Map();
  const anchors = drawingXml.match(/<(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)>/g) || [];

  for (const a of anchors) {
    const row = Number((a.match(/<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/) || [])[1]);
    const embed = (a.match(/r:embed="([^"]+)"/) || [])[1];
    if (!Number.isFinite(row) || !embed) continue;

    const mediaTarget = drawingRels[embed];
    if (!mediaTarget) continue;
    const mediaPath = resolvePath(drawingXmlPath, mediaTarget);
    const buffer = files[mediaPath];
    if (!buffer) continue;

    rowImages.set(row + 1, buffer);
  }

  return rowImages;
}

function importProductsFromXlsxBuffer(buffer) {
  const files = unzipBuffer(buffer);
  const sharedStrings = parseSharedStrings((files['xl/sharedStrings.xml'] || Buffer.from('')).toString('utf8'));
  const sheetXmlPath = 'xl/worksheets/sheet1.xml';
  const sheetXml = (files[sheetXmlPath] || Buffer.from('')).toString('utf8');
  if (!sheetXml) throw new Error('sheet1.xml not found in xlsx');

  const rows = parseRows(sheetXml, sharedStrings);
  const headers = rows.get(1) || new Map();
  const headersByName = {};
  for (const [idx, val] of headers.entries()) headersByName[val] = idx;

  const required = ['Код', 'Номенклатура', 'Штук', 'Цена'];
  const missing = required.filter((h) => !headersByName[h]);
  if (missing.length) throw new Error(`Excel header missing: ${missing.join(', ')}`);

  const rowImages = parseRowImages(files, sheetXmlPath);
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });

  let currentCategory = 'Boshqa';
  const upsertRows = [];
  const errors = [];
  let skipped = 0;

  const sortedRows = [...rows.keys()].filter((n) => n >= 2).sort((a, b) => a - b);

  for (const rowNo of sortedRows) {
    const row = rows.get(rowNo) || new Map();
    const codeRaw = (row.get(headersByName['Код']) || '').trim();
    const nameRaw = (row.get(headersByName['Номенклатура']) || '').trim();

    if (!codeRaw && !nameRaw) continue;

    if (nameRaw.startsWith('◼')) {
      currentCategory = nameRaw.replace(/^◼\s*/, '').trim() || currentCategory;
      continue;
    }

    if (!codeRaw || !nameRaw) {
      skipped += 1;
      errors.push({ row: rowNo, message: 'Код yoki Номенклатура bo\'sh' });
      continue;
    }

    const stock = Number((row.get(headersByName['Штук']) || '0').replace(',', '.'));
    const price = Number((row.get(headersByName['Цена']) || '0').replace(',', '.'));
    if (Number.isNaN(price) || price <= 0) {
      skipped += 1;
      errors.push({ row: rowNo, code: codeRaw, message: 'Цена noto\'g\'ri' });
      continue;
    }

    const safeCode = sanitizeCode(codeRaw);
    let imageUrl = null;
    if (rowImages.has(rowNo)) {
      try {
        fs.writeFileSync(path.join(PRODUCTS_UPLOAD_DIR, `${safeCode}.png`), rowImages.get(rowNo));
        imageUrl = `/uploads/products/${safeCode}.png`;
      } catch (e) {
        errors.push({ row: rowNo, code: codeRaw, message: 'Image save warning: ' + e.message });
      }
    } else {
      errors.push({ row: rowNo, code: codeRaw, message: 'Image warning: anchor/image not found' });
    }

    upsertRows.push({
      id: safeCode,
      code: codeRaw,
      sku: codeRaw,
      name: nameRaw,
      category: currentCategory,
      stock: Number.isNaN(stock) ? 0 : stock,
      price,
      oldPrice: price,
      image_url: imageUrl,
      image: imageUrl,
      source: 'excel',
      updated_at: new Date().toISOString(),
      active: true
    });
  }

  store.upsertProducts(upsertRows);

  return {
    imported: upsertRows.length,
    skipped,
    errors
  };
}

module.exports = {
  importProductsFromXlsxBuffer
};
