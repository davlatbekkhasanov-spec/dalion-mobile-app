const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const store = require('../data/store.js');

const PRODUCTS_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');
const PARSER_SCRIPT = path.join(__dirname, 'xlsx_parser.py');

function importProductsFromXlsxBuffer(buffer) {
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dalion-xlsx-'));
  const xlsxPath = path.join(tmpDir, 'import.xlsx');
  fs.writeFileSync(xlsxPath, buffer);

  const py = spawnSync('python3', [PARSER_SCRIPT, xlsxPath, PRODUCTS_UPLOAD_DIR], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024
  });

  if (py.error) {
    throw new Error(`Python parser error: ${py.error.message}`);
  }

  if (py.status !== 0) {
    throw new Error((py.stdout || py.stderr || 'XLSX parse failed').trim());
  }

  let parsed;
  try {
    parsed = JSON.parse(py.stdout || '{}');
  } catch (error) {
    throw new Error('Python parser JSON javobi noto‘g‘ri');
  }

  if (!parsed.ok) {
    throw new Error(parsed.message || 'XLSX parser failure');
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  store.upsertProducts(items);

  const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
  return {
    imported: items.length,
    skipped: errors.length,
    errors
  };
}

module.exports = {
  importProductsFromXlsxBuffer
};
