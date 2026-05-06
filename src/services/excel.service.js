const store = require('../data/store.js');

const TEMPLATE_COLUMNS = ['id', 'sku', 'name', 'category', 'price', 'oldPrice', 'stock'];

function toCSV(rows = [], columns = TEMPLATE_COLUMNS) {
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns
      .map((key) => {
        const raw = row[key] ?? '';
        const value = String(raw).replace(/"/g, '""');
        return `"${value}"`;
      })
      .join(',')
  );

  return [header, ...lines].join('\n');
}

function parseCSV(csv = '') {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((x) => x.replace(/^"|"$/g, '').trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((x) => x.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

function exportProductsCSV() {
  return toCSV(store.listProducts(), TEMPLATE_COLUMNS);
}

function templateCSV() {
  return toCSV([], TEMPLATE_COLUMNS);
}

function importProductsCSV(csv = '') {
  const rows = parseCSV(csv).map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    price: Number(r.price || 0),
    oldPrice: Number(r.oldPrice || r.price || 0),
    stock: Number(r.stock || 0)
  }));

  const touched = store.upsertProducts(rows);
  return {
    imported: touched.length,
    touchedIds: touched
  };
}

module.exports = {
  TEMPLATE_COLUMNS,
  exportProductsCSV,
  templateCSV,
  importProductsCSV
};
