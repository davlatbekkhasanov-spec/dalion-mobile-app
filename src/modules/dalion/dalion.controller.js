const syncService = require('./dalion.sync.service.js');

exports.syncDalion = async (req, res) => {
  console.log('[DALION] sync started');
  const result = await syncService.syncProducts();
  if (result.errors.length) {
    console.warn('[DALION] sync errors', { count: result.errors.length });
    return res.status(200).json({ success: false, result, fallback: 'excel_or_existing_db' });
  }
  console.log('[DALION] sync success', { products: result.products });
  return res.json({ success: true, result });
};
