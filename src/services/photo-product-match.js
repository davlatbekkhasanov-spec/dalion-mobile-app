'use strict';

const visualProductSearch = require('./visual-product-search');
const photoSearchAi = require('./photo-search-ai');

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ʻʼ'`´‘’]/g, "'")
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-яўқғҳіїґөүәң'\s-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s) {
  return new Set(
    normalizeText(s)
      .split(' ')
      .filter((t) => t.length >= 2)
  );
}

/**
 * Score a catalog product against AI labels / query.
 * Higher = better name/category match.
 */
function scoreProductByLabels(product, labels, query) {
  const name = normalizeText(product?.name);
  const cat = normalizeText(product?.categoryDisplayName || product?.category || '');
  if (!name) return 0;

  const nameTokens = tokenSet(name);
  let score = 0;
  const terms = [...(labels || [])];
  if (query) terms.push(query);

  for (const raw of terms) {
    const L = normalizeText(raw);
    if (!L || L.length < 2) continue;

    if (name === L) score += 8;
    else if (name.includes(L)) score += 5;
    else if (L.length >= 4 && L.includes(name) && name.length >= 4) score += 3;

    for (const tok of nameTokens) {
      if (tok.length < 3) continue;
      if (tok === L) score += 4;
      else if (L.includes(tok) || tok.includes(L)) score += 2;
    }

    if (cat && (cat.includes(L) || L.includes(cat))) score += 1.5;
  }

  return score;
}

function rankProductsByLabels(products, labels, query, { limit = 24, minScore = 4 } = {}) {
  const scored = (Array.isArray(products) ? products : [])
    .map((p) => {
      const textScore = scoreProductByLabels(p, labels, query);
      return { product: p, textScore };
    })
    .filter((s) => s.textScore >= minScore)
    .sort((a, b) => b.textScore - a.textScore);

  const top = scored.slice(0, limit);
  const best = top[0]?.textScore || 0;
  return {
    items: top.map((s) => ({
      ...s.product,
      matchScore: Math.round(Math.min(1, s.textScore / Math.max(8, best)) * 1000) / 1000,
      matchPercent: Math.round(Math.min(100, (s.textScore / Math.max(8, best)) * 100)),
      matchReason: 'ai-text'
    })),
    bestScore: best
  };
}

/**
 * AI-first photo search; strict visual only as weak fallback.
 */
async function searchProductsByPhoto({
  queryBuffer,
  productsForText,
  productsForVisual,
  resolveLocalPath,
  mimeType = 'image/jpeg'
}) {
  const aiConfigured = photoSearchAi.isPhotoAiConfigured();
  let ai = null;
  let aiError = null;

  if (aiConfigured) {
    try {
      ai = await photoSearchAi.labelProductPhoto(queryBuffer, mimeType);
    } catch (e) {
      aiError = e?.message || 'ai_failed';
    }
  }

  if (ai && ai.confidence >= 0.4 && ai.labels?.length) {
    const ranked = rankProductsByLabels(productsForText, ai.labels, ai.query, {
      limit: 24,
      minScore: 4
    });
    if (ranked.items.length) {
      const confidence =
        ai.confidence >= 0.75 && ranked.bestScore >= 6
          ? 'high'
          : ai.confidence >= 0.55
            ? 'medium'
            : 'low';
      return {
        mode: 'ai',
        confidence,
        labels: ai.labels,
        query: ai.query,
        object: ai.object,
        items: ranked.items,
        compared: (productsForText || []).length,
        aiConfigured: true
      };
    }
  }

  // Visual fallback — strict, prefer empty over wrong (glass→frame)
  const visual = await visualProductSearch.rankProductsByImage({
    queryBuffer,
    products: productsForVisual,
    resolveLocalPath,
    limit: 8,
    maxCompare: 320,
    maxDistance: 0.16,
    minScore: 0.72,
    minLead: 0.05
  });

  return {
    mode: aiConfigured ? (ai ? 'ai-empty-visual' : 'ai-error-visual') : 'visual',
    confidence: visual.items.length ? visual.confidence : 'none',
    labels: ai?.labels || [],
    query: ai?.query || '',
    object: ai?.object || '',
    items: visual.items,
    compared: visual.compared,
    aiConfigured,
    aiError: aiError || undefined
  };
}

module.exports = {
  normalizeText,
  scoreProductByLabels,
  rankProductsByLabels,
  searchProductsByPhoto
};
