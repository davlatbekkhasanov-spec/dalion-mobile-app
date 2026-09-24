'use strict';

const fs = require('fs');
const sharp = require('sharp');

/** Bump when fingerprint layout changes (invalidates cache). */
const FP_VERSION = 2;
const SIZE = 32;
const HIST_BINS = 16;
const MAX_FETCH_BYTES = 2.5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 4500;
const CACHE_MAX = 800;

/**
 * Fingerprint layout (Float32Array):
 *  [0..2]     mean Lab (L/100, a/128+0.5, b/128+0.5)
 *  [3..5]     center-crop mean Lab
 *  [6..21]    L histogram (16)
 *  [22..37]   edge magnitude histogram (16)
 *  [38]       content aspect (w/h of non-bg bbox), 0..1 mapped from 0.2..5
 *  [39]       fill ratio (non-bg / total)
 *  [40]       edge density
 *  [41]       vertical mass center (0..1)
 *  [42]       horizontal mass center (0..1)
 *  [43..74]   4x4 Lab means (16*2 for a,b only? use L+a+b = 48) — use 4x4 L only = 16
 * Actually keep compact: 4x4 Lab = 48 floats starting at 43 → total 91
 */
const FP_LEN = 3 + 3 + HIST_BINS + HIST_BINS + 5 + 4 * 4 * 3; // 91

/** @type {Map<string, { fp: Float32Array, at: number }>} */
const fingerprintCache = new Map();

function cacheGet(key) {
  const hit = fingerprintCache.get(key);
  if (!hit) return null;
  fingerprintCache.delete(key);
  fingerprintCache.set(key, hit);
  return hit.fp;
}

function cacheSet(key, fp) {
  if (fingerprintCache.has(key)) fingerprintCache.delete(key);
  fingerprintCache.set(key, { fp, at: Date.now() });
  while (fingerprintCache.size > CACHE_MAX) {
    const oldest = fingerprintCache.keys().next().value;
    fingerprintCache.delete(oldest);
  }
}

function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToLab(r, g, b) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  let x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  let z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  x /= 0.95047;
  z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function packLab(L, a, b) {
  return [L / 100, a / 128 + 0.5, b / 128 + 0.5];
}

function isNearBackground(r, g, b) {
  // Studio / white / light gray catalog backgrounds
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn >= 210 && mx - mn <= 28;
}

/**
 * Multi-signal visual fingerprint (shape + color + edges).
 * Not deep ML — much better than flat RGB grid for glass vs frame.
 * @param {Buffer} buffer
 * @returns {Promise<Float32Array>}
 */
async function fingerprintFromBuffer(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(SIZE, SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const fp = new Float32Array(FP_LEN);

  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let nAll = 0;
  let cL = 0;
  let cA = 0;
  let cBch = 0;
  let nCenter = 0;
  const lHist = new Float32Array(HIST_BINS);
  const eHist = new Float32Array(HIST_BINS);
  let edgeSum = 0;
  let edgeN = 0;
  let mass = 0;
  let massX = 0;
  let massY = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let fill = 0;

  const labGrid = Array.from({ length: w * h }, () => ({ L: 0, a: 0, b: 0 }));

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lab = rgbToLab(r, g, b);
      labGrid[y * w + x] = lab;
      sumL += lab.L;
      sumA += lab.a;
      sumB += lab.b;
      nAll += 1;
      const bin = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((lab.L / 100) * HIST_BINS)));
      lHist[bin] += 1;

      const inCenter = x >= w * 0.25 && x < w * 0.75 && y >= h * 0.25 && y < h * 0.75;
      if (inCenter) {
        cL += lab.L;
        cA += lab.a;
        cBch += lab.b;
        nCenter += 1;
      }

      if (!isNearBackground(r, g, b)) {
        fill += 1;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        mass += lum;
        massX += x * lum;
        massY += y * lum;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Sobel-ish edge magnitude on L channel
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const gx =
        -labGrid[(y - 1) * w + (x - 1)].L -
        2 * labGrid[y * w + (x - 1)].L -
        labGrid[(y + 1) * w + (x - 1)].L +
        labGrid[(y - 1) * w + (x + 1)].L +
        2 * labGrid[y * w + (x + 1)].L +
        labGrid[(y + 1) * w + (x + 1)].L;
      const gy =
        -labGrid[(y - 1) * w + (x - 1)].L -
        2 * labGrid[(y - 1) * w + x].L -
        labGrid[(y - 1) * w + (x + 1)].L +
        labGrid[(y + 1) * w + (x - 1)].L +
        2 * labGrid[(y + 1) * w + x].L +
        labGrid[(y + 1) * w + (x + 1)].L;
      const mag = Math.min(100, Math.sqrt(gx * gx + gy * gy) / 8);
      edgeSum += mag;
      edgeN += 1;
      const ebin = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((mag / 100) * HIST_BINS)));
      eHist[ebin] += 1;
    }
  }

  const mean = packLab(sumL / nAll, sumA / nAll, sumB / nAll);
  const center = nCenter
    ? packLab(cL / nCenter, cA / nCenter, cBch / nCenter)
    : mean;

  let o = 0;
  fp[o++] = mean[0];
  fp[o++] = mean[1];
  fp[o++] = mean[2];
  fp[o++] = center[0];
  fp[o++] = center[1];
  fp[o++] = center[2];

  for (let i = 0; i < HIST_BINS; i += 1) fp[o++] = lHist[i] / nAll;
  for (let i = 0; i < HIST_BINS; i += 1) fp[o++] = eHist[i] / Math.max(1, edgeN);

  const hasBox = maxX >= minX && maxY >= minY;
  const boxW = hasBox ? maxX - minX + 1 : w;
  const boxH = hasBox ? maxY - minY + 1 : h;
  const aspect = boxW / Math.max(1, boxH);
  // map aspect 0.25..4 → 0..1
  const aspectN = Math.min(1, Math.max(0, (Math.log(aspect) - Math.log(0.25)) / (Math.log(4) - Math.log(0.25))));
  fp[o++] = aspectN;
  fp[o++] = fill / Math.max(1, nAll);
  fp[o++] = edgeSum / Math.max(1, edgeN) / 100;
  fp[o++] = mass > 0 ? massX / mass / Math.max(1, w - 1) : 0.5;
  fp[o++] = mass > 0 ? massY / mass / Math.max(1, h - 1) : 0.5;

  // 4×4 Lab cell means
  const cell = SIZE / 4;
  for (let cy = 0; cy < 4; cy += 1) {
    for (let cx = 0; cx < 4; cx += 1) {
      let sL = 0;
      let sA = 0;
      let sB = 0;
      let n = 0;
      for (let y = cy * cell; y < (cy + 1) * cell; y += 1) {
        for (let x = cx * cell; x < (cx + 1) * cell; x += 1) {
          const lab = labGrid[y * w + x];
          sL += lab.L;
          sA += lab.a;
          sB += lab.b;
          n += 1;
        }
      }
      const packed = packLab(sL / n, sA / n, sB / n);
      fp[o++] = packed[0];
      fp[o++] = packed[1];
      fp[o++] = packed[2];
    }
  }

  return fp;
}

/** Weighted distance — shape/edges matter more than flat color. */
function fingerprintDistance(a, b) {
  if (!a || !b || a.length !== FP_LEN || b.length !== FP_LEN) return 1;

  const wMean = 0.12;
  const wCenter = 0.18;
  const wLHist = 0.1;
  const wEHist = 0.16;
  const wAspect = 0.18;
  const wFill = 0.08;
  const wEdge = 0.08;
  const wMass = 0.04;
  const wGrid = 0.06;

  let o = 0;
  const d3 = (i0, weight) => {
    let s = 0;
    for (let k = 0; k < 3; k += 1) {
      const d = a[i0 + k] - b[i0 + k];
      s += d * d;
    }
    return weight * Math.sqrt(s / 3);
  };
  const dHist = (i0, weight) => {
    let s = 0;
    for (let k = 0; k < HIST_BINS; k += 1) {
      const d = a[i0 + k] - b[i0 + k];
      s += d * d;
    }
    return weight * Math.sqrt(s / HIST_BINS);
  };

  let dist = 0;
  dist += d3(o, wMean);
  o += 3;
  dist += d3(o, wCenter);
  o += 3;
  dist += dHist(o, wLHist);
  o += HIST_BINS;
  dist += dHist(o, wEHist);
  o += HIST_BINS;

  dist += wAspect * Math.abs(a[o] - b[o]);
  o += 1;
  dist += wFill * Math.abs(a[o] - b[o]);
  o += 1;
  dist += wEdge * Math.abs(a[o] - b[o]);
  o += 1;
  dist += wMass * Math.abs(a[o] - b[o]);
  o += 1;
  dist += wMass * Math.abs(a[o] - b[o]);
  o += 1;

  let grid = 0;
  for (let k = 0; k < 48; k += 1) {
    const d = a[o + k] - b[o + k];
    grid += d * d;
  }
  dist += wGrid * Math.sqrt(grid / 48);

  return dist;
}

function scoreFromDistance(dist) {
  // Map ~0..0.35 useful range → 1..0
  return Math.max(0, Math.min(1, 1 - dist / 0.35));
}

/**
 * @param {string} imageUrl
 * @param {(url: string) => string|null} resolveLocalPath
 */
async function fingerprintFromProductUrl(imageUrl, resolveLocalPath) {
  const url = String(imageUrl || '').trim();
  if (!url) return null;
  const cacheKey = `${FP_VERSION}:${url}`;
  const cached = cacheGet(cacheKey);
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
    const fp = await fingerprintFromBuffer(buf);
    cacheSet(cacheKey, fp);
    return fp;
  } catch {
    return null;
  }
}

/**
 * Rank products with a strict confidence gate so weak matches (glass→frame) are dropped.
 */
async function rankProductsByImage({
  queryBuffer,
  products,
  resolveLocalPath,
  limit = 12,
  maxCompare = 320,
  /** Absolute distance ceiling (lower = stricter). */
  maxDistance = 0.22,
  /** Minimum score 0..1 after mapping. */
  minScore = 0.55,
  /** Best must beat 2nd by this margin, or be alone. */
  minLead = 0.04
} = {}) {
  if (!queryBuffer || !Buffer.isBuffer(queryBuffer) || !queryBuffer.length) {
    return { items: [], compared: 0, confidence: 'none' };
  }
  const queryFp = await fingerprintFromBuffer(queryBuffer);
  const pool = (Array.isArray(products) ? products : [])
    .filter((p) => p && (p.image_url || p.imageUrl))
    .slice(0, Math.max(1, maxCompare));

  const scored = [];
  const CONCURRENCY = 8;
  let idx = 0;
  async function worker() {
    while (idx < pool.length) {
      const i = idx;
      idx += 1;
      const p = pool[i];
      const url = String(p.image_url || p.imageUrl || '');
      const fp = await fingerprintFromProductUrl(url, resolveLocalPath);
      if (!fp) continue;
      const dist = fingerprintDistance(queryFp, fp);
      const score = scoreFromDistance(dist);
      scored.push({ product: p, distance: dist, score });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  scored.sort((a, b) => a.distance - b.distance);

  const strong = scored.filter((s) => s.distance <= maxDistance && s.score >= minScore);
  if (!strong.length) {
    return { items: [], compared: pool.length, confidence: 'none' };
  }

  // Require clear winner vs runner-up when many weak-ish hits
  if (strong.length >= 2 && strong[0].score - strong[1].score < minLead && strong[0].score < 0.78) {
    // Keep only near-ties of the top cluster within lead*1.5 of best
    const best = strong[0].score;
    const cluster = strong.filter((s) => best - s.score <= Math.max(minLead, 0.06));
    if (cluster.length > 6 && best < 0.7) {
      return { items: [], compared: pool.length, confidence: 'none' };
    }
  }

  const top = strong.slice(0, limit);
  const bestScore = top[0]?.score || 0;
  const confidence = bestScore >= 0.78 ? 'high' : bestScore >= 0.62 ? 'medium' : 'low';

  return {
    items: top.map((s) => ({
      ...s.product,
      matchScore: Math.round(s.score * 1000) / 1000,
      matchPercent: Math.round(s.score * 100)
    })),
    compared: pool.length,
    confidence
  };
}

// Back-compat aliases used by older tests
async function signatureFromBuffer(buffer) {
  return fingerprintFromBuffer(buffer);
}
function distance(a, b) {
  return fingerprintDistance(a, b);
}

module.exports = {
  fingerprintFromBuffer,
  fingerprintDistance,
  rankProductsByImage,
  signatureFromBuffer,
  distance,
  FP_LEN,
  FP_VERSION,
  // legacy
  GRID: 8,
  SIG_LEN: FP_LEN
};
