'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const GRID = 8;
const SIG_LEN = GRID * GRID * 3;
const MAX_FETCH_BYTES = 2.5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 4500;
const CACHE_MAX = 800;

/** @type {Map<string, { sig: Float32Array, at: number }>} */
const signatureCache = new Map();

function cacheGet(key) {
  const hit = signatureCache.get(key);
  if (!hit) return null;
  signatureCache.delete(key);
  signatureCache.set(key, hit);
  return hit.sig;
}

function cacheSet(key, sig) {
  if (signatureCache.has(key)) signatureCache.delete(key);
  signatureCache.set(key, { sig, at: Date.now() });
  while (signatureCache.size > CACHE_MAX) {
    const oldest = signatureCache.keys().next().value;
    signatureCache.delete(oldest);
  }
}

/**
 * Downsample to GRID×GRID RGB means (perceptual-ish color fingerprint).
 * @param {Buffer} buffer
 * @returns {Promise<Float32Array>}
 */
async function signatureFromBuffer(buffer) {
  const { data } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(GRID, GRID, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sig = new Float32Array(SIG_LEN);
  for (let i = 0; i < SIG_LEN; i += 1) sig[i] = data[i] / 255;
  return sig;
}

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < SIG_LEN; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / SIG_LEN);
}

/**
 * @param {string} imageUrl
 * @param {(url: string) => string|null} resolveLocalPath
 * @returns {Promise<Float32Array|null>}
 */
async function signatureFromProductUrl(imageUrl, resolveLocalPath) {
  const url = String(imageUrl || '').trim();
  if (!url) return null;
  const cached = cacheGet(url);
  if (cached) return cached;

  let buf = null;
  const local = typeof resolveLocalPath === 'function' ? resolveLocalPath(url) : null;
  if (local && fs.existsSync(local)) {
    buf = fs.readFileSync(local);
  } else if (/^https?:\/\//i.test(url)) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { Accept: 'image/*' }
      });
      if (!res.ok) return null;
      const len = Number(res.headers.get('content-length') || 0);
      if (len > MAX_FETCH_BYTES) return null;
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_FETCH_BYTES) return null;
      buf = Buffer.from(ab);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  } else {
    return null;
  }

  if (!buf || !buf.length) return null;
  try {
    const sig = await signatureFromBuffer(buf);
    cacheSet(url, sig);
    return sig;
  } catch {
    return null;
  }
}

/**
 * Rank catalog products by visual similarity to the query image.
 * @param {object} opts
 * @param {Buffer} opts.queryBuffer
 * @param {Array<{id:string,name:string,image_url?:string,imageUrl?:string}>} opts.products
 * @param {(url: string) => string|null} opts.resolveLocalPath
 * @param {number} [opts.limit=24]
 * @param {number} [opts.maxCompare=320]
 * @param {number} [opts.maxDistance=0.42]
 */
async function rankProductsByImage({
  queryBuffer,
  products,
  resolveLocalPath,
  limit = 24,
  maxCompare = 320,
  maxDistance = 0.42
}) {
  if (!queryBuffer || !Buffer.isBuffer(queryBuffer) || !queryBuffer.length) {
    return { items: [], compared: 0 };
  }
  const querySig = await signatureFromBuffer(queryBuffer);
  const pool = (Array.isArray(products) ? products : [])
    .filter((p) => p && (p.image_url || p.imageUrl))
    .slice(0, Math.max(1, maxCompare));

  const scored = [];
  // Concurrency-limited to avoid hammering disk/R2
  const CONCURRENCY = 8;
  let idx = 0;
  async function worker() {
    while (idx < pool.length) {
      const i = idx;
      idx += 1;
      const p = pool[i];
      const url = String(p.image_url || p.imageUrl || '');
      const sig = await signatureFromProductUrl(url, resolveLocalPath);
      if (!sig) continue;
      const dist = distance(querySig, sig);
      if (dist <= maxDistance) {
        scored.push({ product: p, distance: dist, score: Math.max(0, 1 - dist) });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  scored.sort((a, b) => a.distance - b.distance);
  return {
    items: scored.slice(0, limit).map((s) => ({
      ...s.product,
      matchScore: Math.round(s.score * 1000) / 1000
    })),
    compared: pool.length
  };
}

module.exports = {
  signatureFromBuffer,
  distance,
  rankProductsByImage,
  GRID,
  SIG_LEN
};
