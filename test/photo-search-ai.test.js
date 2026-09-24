'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  expandLabels,
  isPhotoAiConfigured
} = require('../src/services/photo-search-ai');
const {
  scoreProductByLabels,
  rankProductsByLabels,
  normalizeText
} = require('../src/services/photo-product-match');

describe('photo-search-ai labels', () => {
  it('expands glass synonyms including bakal/stakan', () => {
    const labels = expandLabels(['drinking glass', 'stakan']);
    assert.ok(labels.includes('stakan'));
    assert.ok(labels.includes('bakal') || labels.includes('стакан'));
  });

  it('reports AI config from env', () => {
    assert.equal(typeof isPhotoAiConfigured(), 'boolean');
  });
});

describe('photo-product-match text ranking', () => {
  it('prefers stakan product over ramka for glass labels', () => {
    const products = [
      { id: '1', name: 'Ramka 30x40', category: 'Dekor', image_url: '/a.jpg' },
      { id: '2', name: 'Shisha stakan 300ml', category: 'Idish', image_url: '/b.jpg' },
      { id: '3', name: 'Yog‘och stol', category: 'Mebel', image_url: '/c.jpg' }
    ];
    const labels = expandLabels(['stakan', 'glass', 'bakal']);
    const ranked = rankProductsByLabels(products, labels, 'stakan', { minScore: 3 });
    assert.ok(ranked.items.length >= 1);
    assert.equal(ranked.items[0].id, '2');
    assert.ok(scoreProductByLabels(products[1], labels, 'stakan') > scoreProductByLabels(products[0], labels, 'stakan'));
  });

  it('normalizes apostrophes', () => {
    assert.equal(normalizeText("o‘xshash"), "o'xshash");
  });
});
