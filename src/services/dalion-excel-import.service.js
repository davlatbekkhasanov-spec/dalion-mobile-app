const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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

function parseNumber(raw) {
  const cleaned = String(raw || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim();
  const n = Number(cleaned || '0');
  return Number.isFinite(n) ? n : NaN;
}

function parseDrawingImages(files) {
  const drawingXml = (files['xl/drawings/drawing1.xml'] || Buffer.from('')).toString('utf8');
  const drawingRelsXml = (files['xl/drawings/_rels/drawing1.xml.rels'] || Buffer.from('')).toString('utf8');
  const drawingRels = parseRelationships(drawingRelsXml);
  const rowImages = new Map();

  const anchors = drawingXml.match(/<(?:\w+:)?twoCellAnchor[\s\S]*?<\/(?:\w+:)?twoCellAnchor>/g) || [];
  for (const anchor of anchors) {
    const fromBlock = (anchor.match(/<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/) || [])[1] || '';
    const row0 = Number((fromBlock.match(/<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/) || [])[1]);
    const col0 = Number((fromBlock.match(/<(?:\w+:)?col>(\d+)<\/(?:\w+:)?col>/) || [])[1]);
    const embed = (anchor.match(/<(?:\w+:)?blip[^>]*r:embed="([^"]+)"/) || [])[1];
    if (!Number.isFinite(row0) || !Number.isFinite(col0) || !embed) continue;

    const target = drawingRels[embed];
    if (!target) continue;
    const mediaPath = `xl/media/${target.split('/').pop()}`;
    const buffer = files[mediaPath];
    if (!buffer) continue;

    // Excel row is 1-based, drawing row is 0-based.
    rowImages.set(row0 + 1, { col: col0, buffer });
  }

  return rowImages;
}

const WHITE_THRESHOLD = 240;
const OUTPUT_CANVAS_SIZE = 800;
const MAX_UPSCALE_FACTOR = 4;
const TARGET_OBJECT_SIDE = 620;

function isNearWhitePixel(r, g, b, a) {
  if (a <= 16) return true;
  return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

async function detectObjectBoundingBox(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (!isNearWhitePixel(r, g, b, a)) {
        if (x < left) left = x;
        if (y < top) top = y;
        if (x > right) right = x;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    imageWidth: width,
    imageHeight: height
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function renderToCenteredCanvas(inputBuffer, sourceWidth, sourceHeight, outputPath, requestedScale = 1) {
  const fitScale = Math.min(OUTPUT_CANVAS_SIZE / sourceWidth, OUTPUT_CANVAS_SIZE / sourceHeight);
  let scale = clamp(requestedScale, 1, MAX_UPSCALE_FACTOR);
  if (sourceWidth * scale > OUTPUT_CANVAS_SIZE || sourceHeight * scale > OUTPUT_CANVAS_SIZE) {
    scale = fitScale;
  }
  if (scale <= 0) scale = fitScale;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const resized = await sharp(inputBuffer)
    .resize(targetWidth, targetHeight, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    })
    .png({ compressionLevel: 9, effort: 10, palette: false })
    .toBuffer();

  const left = Math.floor((OUTPUT_CANVAS_SIZE - targetWidth) / 2);
  const top = Math.floor((OUTPUT_CANVAS_SIZE - targetHeight) / 2);

  await sharp({
    create: {
      width: OUTPUT_CANVAS_SIZE,
      height: OUTPUT_CANVAS_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9, effort: 10, palette: false })
    .toFile(outputPath);

  return { upscaled: scale > 1.01 };
}

async function processAndSaveProductImage({ inputBuffer, outputPath }) {
  const warnings = [];
  try {
    const normalizedBuffer = await sharp(inputBuffer).rotate().png().toBuffer();
    const box = await detectObjectBoundingBox(normalizedBuffer);

    if (!box) {
      warnings.push('object_not_found: using fallback contain');
      const meta = await sharp(normalizedBuffer).metadata();
      const baseWidth = meta.width || OUTPUT_CANVAS_SIZE;
      const baseHeight = meta.height || OUTPUT_CANVAS_SIZE;
      const scale = clamp(TARGET_OBJECT_SIDE / Math.max(baseWidth, baseHeight), 1, MAX_UPSCALE_FACTOR);
      const render = await renderToCenteredCanvas(normalizedBuffer, baseWidth, baseHeight, outputPath, scale);
      if (render.upscaled && Math.max(baseWidth, baseHeight) < 300) {
        warnings.push('low source image resolution, upscaled');
      }
      return { processed: false, warnings, upscaled: render.upscaled };
    }

    const padding = Math.round(Math.max(box.width, box.height) * 0.12);
    const cropLeft = Math.max(0, box.left - padding);
    const cropTop = Math.max(0, box.top - padding);
    const cropRight = Math.min(box.imageWidth, box.left + box.width + padding);
    const cropBottom = Math.min(box.imageHeight, box.top + box.height + padding);
    const cropWidth = Math.max(1, cropRight - cropLeft);
    const cropHeight = Math.max(1, cropBottom - cropTop);
    const objectMaxSide = Math.max(box.width, box.height);
    const scaleFactor = clamp(TARGET_OBJECT_SIDE / Math.max(1, objectMaxSide), 1, MAX_UPSCALE_FACTOR);

    const cropped = await sharp(normalizedBuffer)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight
      })
      .png({ compressionLevel: 9, effort: 10, palette: false })
      .toBuffer();

    const render = await sharp(cropped)
      .sharpen(0.45, 1, 2)
      .png({ compressionLevel: 9, effort: 10, palette: false })
      .toBuffer();

    const canvasResult = await renderToCenteredCanvas(render, cropWidth, cropHeight, outputPath, scaleFactor);
    if (canvasResult.upscaled && objectMaxSide < 300) {
      warnings.push('low source image resolution, upscaled');
    }

    return { processed: true, warnings, upscaled: canvasResult.upscaled };
  } catch (processingError) {
    warnings.push(`processing_failed: ${processingError.message}`);
    try {
      const normalizedFallback = await sharp(inputBuffer).rotate().png().toBuffer();
      const meta = await sharp(normalizedFallback).metadata();
      const baseWidth = meta.width || OUTPUT_CANVAS_SIZE;
      const baseHeight = meta.height || OUTPUT_CANVAS_SIZE;
      const scale = clamp(TARGET_OBJECT_SIDE / Math.max(baseWidth, baseHeight), 1, MAX_UPSCALE_FACTOR);
      const fallbackRender = await renderToCenteredCanvas(
        normalizedFallback,
        baseWidth,
        baseHeight,
        outputPath,
        scale
      );
      if (fallbackRender.upscaled && Math.max(baseWidth, baseHeight) < 300) {
        warnings.push('low source image resolution, upscaled');
      }
      return { processed: false, warnings, upscaled: fallbackRender.upscaled };
    } catch (fallbackError) {
      warnings.push(`fallback_failed: ${fallbackError.message}`);
      fs.writeFileSync(outputPath, inputBuffer);
      return { processed: false, warnings, upscaled: false };
    }
  }
}

async function importProductsFromXlsxBuffer(buffer) {
  const files = unzipBuffer(buffer);
  const sharedStrings = parseSharedStrings((files['xl/sharedStrings.xml'] || Buffer.from('')).toString('utf8'));
  const sheetXmlPath = 'xl/worksheets/sheet1.xml';
  const sheetXml = (files[sheetXmlPath] || Buffer.from('')).toString('utf8');
  if (!sheetXml) throw new Error('sheet1.xml not found in xlsx');

  const rows = parseRows(sheetXml, sharedStrings);
  const headers = rows.get(1) || new Map();
  const headersByName = {};
  for (const [idx, val] of headers.entries()) headersByName[val] = idx;

  const required = ['Код', 'Номенклатура', 'Файл картинки', 'Штук', 'Цена'];
  const missing = required.filter((h) => !headersByName[h]);
  if (missing.length) throw new Error(`Excel header missing: ${missing.join(', ')}`);

  const rowImages = parseDrawingImages(files);
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });

  let currentCategory = 'Boshqa';
  const upsertRows = [];
  const errors = [];
  let skipped = 0;
  let imageExtracted = 0;
  let imageProcessed = 0;
  let imageUpscaled = 0;
  let imageMissing = 0;
  const imageProcessingWarnings = [];

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

    const stock = parseNumber(row.get(headersByName['Штук']) || '0');
    const price = parseNumber(row.get(headersByName['Цена']) || '0');
    if (Number.isNaN(price) || price <= 0) {
      skipped += 1;
      errors.push({ row: rowNo, code: codeRaw, message: 'Цена noto\'g\'ri' });
      continue;
    }

    const safeCode = sanitizeCode(codeRaw);
    let imageUrl = null;
    const rowImage = rowImages.get(rowNo);
    if (rowImage && rowImage.col === 2) {
      try {
        const outputPath = path.join(PRODUCTS_UPLOAD_DIR, `${safeCode}.png`);
        const processingResult = await processAndSaveProductImage({
          inputBuffer: rowImage.buffer,
          outputPath
        });
        if (processingResult.processed) imageProcessed += 1;
        if (processingResult.upscaled) imageUpscaled += 1;
        if (processingResult.warnings.length) {
          const warning = {
            row: rowNo,
            code: codeRaw,
            message: processingResult.warnings.join('; ')
          };
          imageProcessingWarnings.push(warning);
          errors.push({
            row: rowNo,
            code: codeRaw,
            message: `Image processing warning: ${warning.message}`
          });
        }
        imageUrl = `/uploads/products/${safeCode}.png`;
        imageExtracted += 1;
      } catch (e) {
        errors.push({ row: rowNo, code: codeRaw, message: 'Image save warning: ' + e.message });
        imageMissing += 1;
      }
    } else {
      errors.push({ row: rowNo, code: codeRaw, message: 'Image warning: anchor/image not found' });
      imageMissing += 1;
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
    imageExtracted,
    imageProcessed,
    imageUpscaled,
    imageProcessingWarnings,
    imageMissing,
    errors
  };
}

module.exports = {
  importProductsFromXlsxBuffer
};
