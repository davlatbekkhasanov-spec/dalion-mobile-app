'use strict';

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

function rankProductsByLabels(products, labels, query, { limit = 24, minScore = 3 } = {}) {
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
      matchReason: 'openai-text'
    })),
    bestScore: best
  };
}

/**
 * OpenAI Vision only — local CLIP / color matching caused false hits (glass→frame).
 * Without OPENAI_API_KEY returns empty + mode ai-required.
 */
async function searchProductsByPhoto({
  queryBuffer,
  productsForText,
  mimeType = 'image/jpeg'
}) {
  const openaiConfigured = photoSearchAi.isPhotoAiConfigured();
  if (!openaiConfigured) {
    return {
      mode: 'ai-required',
      confidence: 'none',
      labels: [],
      query: '',
      object: '',
      items: [],
      compared: 0,
      aiConfigured: false,
      provider: 'none',
      message: 'OPENAI_API_KEY required'
    };
  }

  let ai = null;
  let aiError = null;
  let aiDetail = null;
  try {
    ai = await photoSearchAi.labelProductPhoto(queryBuffer, mimeType);
  } catch (e) {
    aiError = e?.message || 'openai_failed';
    aiDetail = e?.detail || null;
  }

  if (!ai || ai.confidence < 0.4 || !ai.labels?.length) {
    return {
      mode: aiError ? 'ai-error' : 'ai-empty',
      confidence: 'none',
      labels: ai?.labels || [],
      query: ai?.query || '',
      object: ai?.object || '',
      items: [],
      compared: (productsForText || []).length,
      aiConfigured: true,
      provider: 'openai',
      aiError: aiError || ai?.emptyReason || undefined,
      aiDetail: aiDetail || undefined,
      message: aiError
        ? 'OpenAI xatolik qaytardi (kalit/billing/limit)'
        : 'AI mahsulotni aniqlay olmadi'
    };
  }

  const labels = photoSearchAi.expandLabels(ai.labels.concat(ai.object || '', ai.query || ''));
  const ranked = rankProductsByLabels(productsForText, labels, ai.query || ai.object, {
    limit: 24,
    minScore: 3
  });

  if (!ranked.items.length) {
    return {
      mode: 'ai-no-catalog-hit',
      confidence: 'none',
      labels,
      query: ai.query || ai.object || '',
      object: ai.object || '',
      items: [],
      compared: (productsForText || []).length,
      aiConfigured: true,
      provider: 'openai'
    };
  }

  const confidence =
    ai.confidence >= 0.75 && ranked.bestScore >= 6
      ? 'high'
      : ai.confidence >= 0.55
        ? 'medium'
        : 'low';

  return {
    mode: 'ai',
    confidence,
    labels,
    query: ai.query || ai.object || '',
    object: ai.object || '',
    items: ranked.items,
    compared: (productsForText || []).length,
    aiConfigured: true,
    provider: 'openai'
  };
}

module.exports = {
  normalizeText,
  scoreProductByLabels,
  rankProductsByLabels,
  searchProductsByPhoto
};
