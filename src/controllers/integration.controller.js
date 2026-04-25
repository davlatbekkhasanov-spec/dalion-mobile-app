const store = require('../data/store.js');
const dalionService = require('../services/dalion.service.js');
const excelService = require('../services/excel.service.js');
const xlsxImportService = require('../services/dalion-excel-import.service.js');

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

    const overwriteFromQuery = req.query?.overwriteImages;
    const overwriteFromBody = req.body?.overwriteImages;
    const overwriteImages = String(overwriteFromQuery ?? overwriteFromBody ?? 'true').toLowerCase() !== 'false';
    const processImages = String(req.query?.processImages ?? req.body?.processImages ?? 'true').toLowerCase() !== 'false';
    const updateOnlyStockPrice = String(req.query?.updateOnlyStockPrice ?? req.body?.updateOnlyStockPrice ?? 'false').toLowerCase() === 'true';

    const result = await xlsxImportService.importProductsFromXlsxBuffer(req.file.buffer, { overwriteImages, processImages, updateOnlyStockPrice });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'XLSX import failed' });
  }
};

exports.sendOrderToDataMobile = (req, res) => {
  const out = store.sendOrderToTsd(req.params.id);
  if (!out) return res.status(404).json({ ok: false, message: 'Order not found' });
  // TODO: connect real Data Mobile API call here.
  return res.json({ ok: true, message: "Order TSD queue ga qo‘shildi", order: out.order });
};

exports.markDalionOrderPicked = (req, res) => {
  const order = store.markDalionPicked(req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
  return res.json({ ok: true, order });
};
