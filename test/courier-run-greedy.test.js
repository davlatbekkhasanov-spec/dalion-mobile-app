'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { greedyOrderIdsFromStore } = require('../src/marketplace-repository');

test('greedyOrderIdsFromStore: nearer stop first from default store', () => {
  const ids = greedyOrderIdsFromStore(
    [
      { id: 'far', lat: 41.0, lng: 69.0 },
      { id: 'near', lat: 39.66, lng: 66.97 }
    ],
    39.654722,
    66.958972
  );
  assert.deepEqual(ids, ['near', 'far']);
});

test('greedyOrderIdsFromStore: empty input', () => {
  assert.deepEqual(greedyOrderIdsFromStore([], 39.654722, 66.958972), []);
});
