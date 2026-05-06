const test = require('node:test');
const assert = require('node:assert/strict');

const integrationController = require('../src/controllers/integration.controller.js');
const xlsxImportService = require('../src/services/dalion-excel-import.service.js');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test('importProductsXlsx returns 400 when file is missing', async () => {
  const req = { file: null, query: {}, body: {} };
  const res = createRes();
  await integrationController.importProductsXlsx(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /xlsx file is required/i);
});

test('importProductsXlsx rejects non-xlsx extension', async () => {
  const req = { file: { originalname: 'products.csv', mimetype: 'text/csv', buffer: Buffer.from('x') }, query: {}, body: {} };
  const res = createRes();
  await integrationController.importProductsXlsx(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Only .xlsx files are allowed for product import');
});

test('importProductsXlsx returns clear missing-header error', async () => {
  const original = xlsxImportService.importProductsFromXlsxBuffer;
  xlsxImportService.importProductsFromXlsxBuffer = async () => { throw new Error('Excel header missing: name, price, stock'); };

  const req = { file: { originalname: 'products.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('x') }, query: {}, body: {} };
  const res = createRes();
  await integrationController.importProductsXlsx(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_HEADERS');
  assert.match(res.body.message, /Excel header missing/);
  xlsxImportService.importProductsFromXlsxBuffer = original;
});

test('importProductsXlsx returns summary for valid minimal xlsx import call', async () => {
  const original = xlsxImportService.importProductsFromXlsxBuffer;
  xlsxImportService.importProductsFromXlsxBuffer = async () => ({
    imported: 1,
    skipped: 0,
    invalidRows: 0,
    imageProcessed: 0,
    imageWarnings: 0
  });

  const req = { file: { originalname: 'products.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('x') }, query: {}, body: {} };
  const res = createRes();
  await integrationController.importProductsXlsx(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.imported, 1);
  xlsxImportService.importProductsFromXlsxBuffer = original;
});
