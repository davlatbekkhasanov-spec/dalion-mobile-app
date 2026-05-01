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
const DETECTION_BG_THRESHOLD = 235;
const OUTPUT_CANVAS_SIZE = 800;
const MAX_UPSCALE_FACTOR = 8;
const TARGET_OBJECT_SIDE = 720;

function isNearWhitePixel(r, g, b, a) {
  if (a <= 16) return true;
  return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

function isLightBackgroundPixel(r, g, b, a) {
  if (a <= 16) return true;
  return r >= DETECTION_BG_THRESHOLD && g >= DETECTION_BG_THRESHOLD && b >= DETECTION_BG_THRESHOLD;
}

function isDarkPixel(r, g, b, a) {
  if (a <= 16) return false;
  return r <= 40 && g <= 40 && b <= 40;
}

function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function floodFillFromEdges(width, height, passableAt) {
  const visited = new Uint8Array(width * height);
  const queueX = [];
  const queueY = [];

  function pushIfPassable(x, y) {
    if (!inBounds(x, y, width, height)) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    if (!passableAt(x, y, idx)) return;
    visited[idx] = 1;
    queueX.push(x);
    queueY.push(y);
  }

  for (let x = 0; x < width; x += 1) {
    pushIfPassable(x, 0);
    pushIfPassable(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfPassable(0, y);
    pushIfPassable(width - 1, y);
  }

  for (let i = 0; i < queueX.length; i += 1) {
    const x = queueX[i];
    const y = queueY[i];
    pushIfPassable(x + 1, y);
    pushIfPassable(x - 1, y);
    pushIfPassable(x, y + 1);
    pushIfPassable(x, y - 1);
  }

  return visited;
}

async function detectObjectBoundingBox(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const backgroundMask = floodFillFromEdges(width, height, (x, y) => {
    const idx = (y * width + x) * channels;
    return isLightBackgroundPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
  });

  // Ignore dark edge-connected border lines (1-4px-ish artifacts).
  const darkEdgeMask = floodFillFromEdges(width, height, (x, y) => {
    const idx = (y * width + x) * channels;
    return isDarkPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
  });

  const objectCandidate = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = y * width + x;
      const idx = px * channels;
      const a = data[idx + 3];
      if (a <= 16) continue;
      if (backgroundMask[px]) continue;
      if (darkEdgeMask[px]) continue;
      if (isNearWhitePixel(data[idx], data[idx + 1], data[idx + 2], a)) continue;
      objectCandidate[px] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const components = [];
  const minArea = Math.max(20, Math.round((width * height) * 0.00015));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!objectCandidate[start] || visited[start]) continue;

      const queue = [start];
      visited[start] = 1;
      let qIndex = 0;
      let area = 0;
      let left = width;
      let top = height;
      let right = -1;
      let bottom = -1;
      let sumX = 0;
      let sumY = 0;

      while (qIndex < queue.length) {
        const current = queue[qIndex++];
        const cx = current % width;
        const cy = Math.floor(current / width);
        area += 1;
        sumX += cx;
        sumY += cy;
        if (cx < left) left = cx;
        if (cy < top) top = cy;
        if (cx > right) right = cx;
        if (cy > bottom) bottom = cy;

        const neighborCoords = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];
        for (const [nx, ny] of neighborCoords) {
          if (!inBounds(nx, ny, width, height)) continue;
          const n = ny * width + nx;
          if (!objectCandidate[n] || visited[n]) continue;
          visited[n] = 1;
          queue.push(n);
        }
      }

      if (area < minArea) continue;
      components.push({
        area,
        left,
        top,
        right,
        bottom,
        centerX: sumX / area,
        centerY: sumY / area
      });
    }
  }

  if (!components.length) return null;
  components.sort((a, b) => b.area - a.area);
  const largest = components[0];
  const imageCenterX = width / 2;
  const imageCenterY = height / 2;

  const selected = components.filter((c, idx) => {
    if (idx === 0) return true;
    const dist = Math.hypot(c.centerX - imageCenterX, c.centerY - imageCenterY);
    const areaRatio = c.area / largest.area;
    return areaRatio >= 0.15 || (areaRatio >= 0.04 && dist < Math.max(width, height) * 0.22);
  });

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (const c of selected) {
    if (c.left < left) left = c.left;
    if (c.top < top) top = c.top;
    if (c.right > right) right = c.right;
    if (c.bottom > bottom) bottom = c.bottom;
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

  const baseCanvas = sharp({
    create: {
      width: OUTPUT_CANVAS_SIZE,
      height: OUTPUT_CANVAS_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).composite([{ input: resized, left, top }]);

  try {
    await baseCanvas.clone().webp({ quality: 82, effort: 5 }).toFile(outputPath.replace(/\.png$/i, '.webp'));
    return { upscaled: scale > 1.01, ext: 'webp' };
  } catch (webpError) {
    await baseCanvas
      .png({ compressionLevel: 9, effort: 8, palette: false })
      .toFile(outputPath.replace(/\.png$/i, '.png'));
    return { upscaled: scale > 1.01, ext: 'png', webpError: webpError.message };
  }
}

async function processAndSaveProductImage({ inputBuffer, outputPath }) {
  const warnings = [];
  try {
    const normalizedBuffer = await sharp(inputBuffer).rotate().png().toBuffer();
    const box = await detectObjectBoundingBox(normalizedBuffer);

    if (!box) {
      warnings.push('object detection failed, fallback used');
      const meta = await sharp(normalizedBuffer).metadata();
      const baseWidth = meta.width || OUTPUT_CANVAS_SIZE;
      const baseHeight = meta.height || OUTPUT_CANVAS_SIZE;
      const scale = clamp(TARGET_OBJECT_SIDE / Math.max(baseWidth, baseHeight), 1, MAX_UPSCALE_FACTOR);
      const render = await renderToCenteredCanvas(normalizedBuffer, baseWidth, baseHeight, outputPath, scale);
      if (render.upscaled && Math.max(baseWidth, baseHeight) < 360) {
        warnings.push('low resolution image aggressively upscaled');
      }
      if (render.webpError) warnings.push(`webp_fallback_png: ${render.webpError}`);
      return { processed: false, warnings, upscaled: render.upscaled, ext: render.ext };
    }

    const padding = Math.round(Math.max(box.width, box.height) * 0.05);
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
    if (canvasResult.upscaled && objectMaxSide < 360) {
      warnings.push('low resolution image aggressively upscaled');
    }
    if (canvasResult.webpError) warnings.push(`webp_fallback_png: ${canvasResult.webpError}`);

    return { processed: true, warnings, upscaled: canvasResult.upscaled, ext: canvasResult.ext };
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
      if (fallbackRender.upscaled && Math.max(baseWidth, baseHeight) < 360) {
        warnings.push('low resolution image aggressively upscaled');
      }
      if (fallbackRender.webpError) warnings.push(`webp_fallback_png: ${fallbackRender.webpError}`);
      return { processed: false, warnings, upscaled: fallbackRender.upscaled, ext: fallbackRender.ext };
    } catch (fallbackError) {
      warnings.push(`fallback_failed: ${fallbackError.message}`);
      fs.writeFileSync(outputPath, inputBuffer);
      return { processed: false, warnings, upscaled: false, ext: 'png' };
    }
  }
}

async function mapLimit(items, limit, handler) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await handler(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function importProductsFromXlsxBuffer(buffer, { overwriteImages = true, processImages = true, updateOnlyStockPrice = false } = {}) {
  const files = unzipBuffer(buffer);
  const sharedStrings = parseSharedStrings((files['xl/sharedStrings.xml'] || Buffer.from('')).toString('utf8'));
  const sheetXmlPath = 'xl/worksheets/sheet1.xml';
  const sheetXml = (files[sheetXmlPath] || Buffer.from('')).toString('utf8');
  if (!sheetXml) throw new Error('sheet1.xml not found in xlsx');

  const rows = parseRows(sheetXml, sharedStrings);
  const headers = rows.get(1) || new Map();
  const headersByName = {};
  for (const [idx, val] of headers.entries()) headersByName[val] = idx;

  const findHeader = (...variants) => variants.find((h) => headersByName[h]);
  const codeHeader = findHeader('Код', 'code', 'Code', 'ID', 'id', 'sku', 'SKU');
  const nameHeader = findHeader('Номенклатура', 'name', 'Name', 'Название');
  const stockHeader = findHeader('Штук', 'stock', 'Stock', 'quantity', 'Quantity');
  const priceHeader = findHeader('Цена', 'price', 'Price');
  const oldPriceHeader = findHeader('old_price', 'oldPrice', 'Old Price', 'Старая цена');
  const categoryHeader = findHeader('category', 'Category', 'Категория');
  const imageUrlHeader = findHeader('image_url', 'imageUrl', 'Image URL', 'Картинка', 'Ссылка картинки');

  const requiredMissing = [];
  if (!nameHeader) requiredMissing.push('name');
  if (!priceHeader) requiredMissing.push('price');
  if (!stockHeader) requiredMissing.push('stock');
  if (requiredMissing.length) throw new Error(`Excel header missing: ${requiredMissing.join(', ')}`);

  const rowImages = parseDrawingImages(files);
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });

  let currentCategory = 'Boshqa';
  const upsertRows = [];
  const errors = [];
  let skipped = 0;
  let imageExtracted = 0;
  let imageProcessed = 0;
  let imageObjectDetected = 0;
  let imageUpscaled = 0;
  let imageSkippedExisting = 0;
  let imageMissing = 0;
  const imageProcessingWarnings = [];
  const imageDetectionWarnings = [];
  const startedAt = Date.now();
  const imageTimings = [];

  const sortedRows = [...rows.keys()].filter((n) => n >= 2).sort((a, b) => a - b);

  const parsedRows = [];
  for (const rowNo of sortedRows) {
    const row = rows.get(rowNo) || new Map();
    const codeRaw = String(codeHeader ? (row.get(headersByName[codeHeader]) || '') : '').trim();
    const nameRaw = String(row.get(headersByName[nameHeader]) || '').trim();

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

    const stock = parseNumber(row.get(headersByName[stockHeader]) || '0');
    const price = parseNumber(row.get(headersByName[priceHeader]) || '0');
    const oldPrice = oldPriceHeader ? parseNumber(row.get(headersByName[oldPriceHeader]) || '') : NaN;
    const categoryFromRow = categoryHeader ? String(row.get(headersByName[categoryHeader]) || '').trim() : '';
    const imageUrlRaw = imageUrlHeader ? String(row.get(headersByName[imageUrlHeader]) || '').trim() : '';
    if (Number.isNaN(price) || price < 0) {
      skipped += 1;
      errors.push({ row: rowNo, code: codeRaw, message: 'price noto\'g\'ri' });
      continue;
    }
    if (Number.isNaN(stock) || stock < 0) {
      skipped += 1;
      errors.push({ row: rowNo, code: codeRaw, message: 'stock noto\'g\'ri' });
      continue;
    }

    parsedRows.push({
      rowNo,
      codeRaw,
      nameRaw,
      safeCode: sanitizeCode(codeRaw || nameRaw.toLowerCase().replace(/\s+/g, '-')),
      currentCategory: categoryFromRow || currentCategory,
      stock,
      price,
      oldPrice: Number.isFinite(oldPrice) && oldPrice >= 0 ? oldPrice : price,
      imageUrlRaw,
      rowImage: rowImages.get(rowNo)
    });
  }

  await mapLimit(parsedRows, 4, async (item) => {
    const existing = store.getProductById(item.safeCode);
    let imageUrl = null;
    if (processImages && item.rowImage && item.rowImage.col === 2) {
      try {
        const baseOutputPath = path.join(PRODUCTS_UPLOAD_DIR, `${item.safeCode}.png`);
        const webpPath = baseOutputPath.replace(/\.png$/i, '.webp');
        const pngPath = baseOutputPath.replace(/\.png$/i, '.png');
        if (!overwriteImages && (fs.existsSync(webpPath) || fs.existsSync(pngPath))) {
          imageSkippedExisting += 1;
          imageUrl = fs.existsSync(webpPath)
            ? `/uploads/products/${item.safeCode}.webp`
            : `/uploads/products/${item.safeCode}.png`;
        } else {
          const startMs = Date.now();
          const processingResult = await processAndSaveProductImage({
            inputBuffer: item.rowImage.buffer,
            outputPath: baseOutputPath
          });
          imageTimings.push(Date.now() - startMs);
          if (processingResult.processed) {
            imageProcessed += 1;
            imageObjectDetected += 1;
          }
          if (processingResult.upscaled) imageUpscaled += 1;
          if (processingResult.warnings.length) {
            const warning = {
              row: item.rowNo,
              code: item.codeRaw,
              message: processingResult.warnings.join('; ')
            };
            imageProcessingWarnings.push(warning);
            if (warning.message.includes('object detection failed')) {
              imageDetectionWarnings.push(warning);
            }
            errors.push({
              row: item.rowNo,
              code: item.codeRaw,
              message: `Image processing warning: ${warning.message}`
            });
          }
          imageUrl = `/uploads/products/${item.safeCode}.${processingResult.ext === 'png' ? 'png' : 'webp'}`;
        }
        imageExtracted += 1;
      } catch (e) {
        errors.push({ row: item.rowNo, code: item.codeRaw, message: 'Image save warning: ' + e.message });
        imageMissing += 1;
      }
    } else if (processImages) {
      errors.push({ row: item.rowNo, code: item.codeRaw, message: 'Image warning: anchor/image not found' });
      imageMissing += 1;
    }

    if (item.imageUrlRaw) {
      imageUrl = item.imageUrlRaw;
    } else if (!processImages && existing?.image_url) {
      imageUrl = existing.image_url;
    }

    upsertRows.push({
      id: item.safeCode,
      code: item.codeRaw,
      sku: item.codeRaw,
      name: updateOnlyStockPrice && existing ? existing.name : item.nameRaw,
      category: updateOnlyStockPrice && existing ? existing.category : item.currentCategory,
      stock: item.stock,
      price: item.price,
      oldPrice: item.oldPrice,
      image_url: updateOnlyStockPrice && existing ? existing.image_url : imageUrl,
      image: updateOnlyStockPrice && existing ? existing.image : imageUrl,
      source: 'excel',
      updated_at: new Date().toISOString(),
      active: existing ? existing.active !== false : true,
      orderCount: existing?.orderCount || 0
    });
  });

  store.upsertProducts(upsertRows);
  const processingTimeMs = Date.now() - startedAt;
  const averageImageMs = imageTimings.length ? Math.round(imageTimings.reduce((a, b) => a + b, 0) / imageTimings.length) : 0;

  return {
    imported: upsertRows.length,
    skipped,
    invalidRows: skipped,
    imageExtracted,
    imageProcessed,
    imageObjectDetected,
    imageDetectionWarnings,
    imageUpscaled,
    imageSkippedExisting,
    processingTimeMs,
    averageImageMs,
    imageProcessingWarnings,
    imageWarnings: imageProcessingWarnings.length + imageMissing,
    imageMissing,
    errors
  };
}

module.exports = {
  importProductsFromXlsxBuffer
};
