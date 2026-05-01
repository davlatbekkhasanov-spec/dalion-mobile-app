const test = require('node:test');
const assert = require('node:assert/strict');
const { __test } = require('../src/services/dalion-excel-import.service.js');

test('category header markers are detected', () => {
  assert.equal(__test.isCategoryHeaderName('■ Адресные папки'), true);
  assert.equal(__test.isCategoryHeaderName('◼ Бумага'), true);
  assert.equal(__test.isCategoryHeaderName('▪ Ручки'), true);
  assert.equal(__test.isCategoryHeaderName('● Клей'), true);
  assert.equal(__test.isCategoryHeaderName('Адресат IMZOGA'), false);
});

test('category header names are cleaned', () => {
  assert.equal(__test.cleanCategoryHeaderName('■ Адресные папки'), 'Адресные папки');
  assert.equal(__test.cleanCategoryHeaderName('◼  Бумага A4'), 'Бумага A4');
});

test('unknown categories safely map to Boshqa', () => {
  assert.equal(__test.normalizeImportedCategory('Неизвестная группа'), 'Boshqa');
  assert.equal(__test.normalizeImportedCategory(''), 'Boshqa');
});

test('known categories map into curated set', () => {
  assert.equal(__test.normalizeImportedCategory('Газированный напиток'), 'Ichimliklar');
  assert.equal(__test.normalizeImportedCategory('Шампунь'), 'Gigiyena');
});

test('products inherit/switch category headers and fallback to Boshqa', () => {
  let current = 'Boshqa';
  let out = __test.resolveRowCategory({ nameRaw: '■ Адресные папки', currentCategory: current });
  assert.equal(out.isCategoryHeader, true);
  current = out.nextCategory;
  assert.equal(current, 'Адресные папки');

  out = __test.resolveRowCategory({ nameRaw: 'Адресат IMZOGA', currentCategory: current });
  assert.equal(out.assignedCategory, 'Boshqa');

  out = __test.resolveRowCategory({ nameRaw: '● Напитки', currentCategory: current });
  current = out.nextCategory;
  out = __test.resolveRowCategory({ nameRaw: 'Cola 1L', currentCategory: current });
  assert.equal(out.assignedCategory, 'Ichimliklar');

  out = __test.resolveRowCategory({ nameRaw: 'No Category Product', currentCategory: '', explicitCategory: '' });
  assert.equal(out.assignedCategory, 'Boshqa');
});
