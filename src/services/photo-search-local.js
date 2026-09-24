'use strict';

/**
 * Local CLIP zero-shot labels — no API key.
 * Distinguishes glass vs frame by meaning, then catalog text search uses the labels.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const sharp = require('sharp');

let classifierPromise = null;

const SEED_LABELS = [
  'drinking glass',
  'cup',
  'mug',
  'picture frame',
  'photo frame',
  'chair',
  'table',
  'smartphone',
  'bag',
  'wristwatch',
  'lamp',
  'plate',
  'teapot',
  'cooking pot',
  'shoes',
  'toy',
  'television',
  'refrigerator',
  'stakan',
  'bakal',
  'рамка',
  'кружка',
  'стул',
  'телефон',
  'сумка'
];

function getCacheDir() {
  const dir = path.join(os.tmpdir(), 'gm-transformers-cache');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
  return dir;
}

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      process.env.TRANSFORMERS_CACHE = getCacheDir();
      process.env.HF_HOME = getCacheDir();
      const { pipeline, env } = require('@xenova/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      return pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    })().catch((e) => {
      classifierPromise = null;
      throw e;
    });
  }
  return classifierPromise;
}

function labelsFromCatalog(products, limit = 24) {
  const counts = new Map();
  for (const p of products || []) {
    const cat = String(p.categoryDisplayName || p.category || '').trim();
    if (cat.length >= 2 && cat.length <= 40) counts.set(cat, (counts.get(cat) || 0) + 3);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/**
 * @param {Buffer} buffer
 * @param {object[]} [products]
 */
async function labelProductPhotoLocal(buffer, products = []) {
  if (!buffer || !buffer.length) return null;

  const tmp = path.join(
    os.tmpdir(),
    `gm-photo-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`
  );

  try {
    await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize(384, 384, { fit: 'inside', withoutEnlargement: false })
      .jpeg({ quality: 88 })
      .toFile(tmp);

    const classifier = await getClassifier();
    const candidates = [...new Set([...SEED_LABELS, ...labelsFromCatalog(products)])].slice(0, 40);
    const results = await classifier(tmp, candidates);
    const ranked = (Array.isArray(results) ? results : [])
      .map((r) => ({
        label: String(r.label || '').trim(),
        score: Number(r.score) || 0
      }))
      .filter((r) => r.label)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) return null;
    const best = ranked[0];
    const second = ranked[1]?.score || 0;
    // Need a meaningful top class (real photos usually >> 0.2)
    if (best.score < 0.15) return null;
    if (best.score < 0.28 && best.score - second < 0.05) return null;

    const top = ranked.filter((r) => r.score >= Math.max(0.08, best.score * 0.25)).slice(0, 8);

    return {
      object: best.label,
      labels: top.map((t) => t.label),
      query: best.label,
      confidence: Math.max(0.45, Math.min(0.97, best.score)),
      source: 'local-clip'
    };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

/** Warm model in background after boot (optional). */
function warmupLocalClip() {
  setTimeout(() => {
    getClassifier().catch(() => {});
  }, 2500);
}

module.exports = {
  labelProductPhotoLocal,
  labelsFromCatalog,
  warmupLocalClip,
  SEED_LABELS
};
