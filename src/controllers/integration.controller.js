const store = require('../data/store.js');
const dalionService = require('../services/dalion.service.js');
const excelService = require('../services/excel.service.js');

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
