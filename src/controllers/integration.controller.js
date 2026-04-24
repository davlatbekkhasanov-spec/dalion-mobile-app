const store = require('../data/store.js');
const dalionService = require('../services/dalion.service.js');
const excelService = require('../services/excel.service.js');
const xlsxImportService = require('../services/xlsx-import.service.js');

exports.getIntegrationStatus = (req, res) => {
  res.json({
    ok: true,
    integrations: {
      dalionTrend1C: {
        enabled: true,
        mode: 'manual-api',
        notes: 'Ready for payload mapping and sync endpoints.'
      },
      excel: {
        enabled: true,
        format: 'csv',
        notes: 'Template/export/import endpoints are available.'
      }
    },
    stats: {
      products: store.listProducts().length,
      cartItems: store.getCartSummary().totalQty
    }
  });
};

exports.importFrom1C = (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const result = dalionService.importFrom1C(items);
  res.json({ ok: true, ...result });
};

exports.exportTo1C = (req, res) => {
  const items = dalionService.exportTo1C();
  res.json({ ok: true, items });
};

exports.getExcelTemplate = (req, res) => {
  const csv = excelService.templateCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dalion-products-template.csv"');
  res.send(csv);
};

exports.exportProductsExcel = (req, res) => {
  const csv = excelService.exportProductsCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dalion-products-export.csv"');
  res.send(csv);
};

exports.importProductsExcel = (req, res) => {
  const csv = String(req.body?.csv || '');
  const result = excelService.importProductsCSV(csv);
  res.json({ ok: true, ...result });
};

exports.importProductsXlsx = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, message: 'xlsx file is required (multipart/form-data, field: file)' });
    }

    const result = await xlsxImportService.importProductsFromXlsxBuffer(req.file.buffer);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'XLSX import failed' });
  }
};
