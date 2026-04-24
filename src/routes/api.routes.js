const express = require('express');

const homeController = require('../controllers/home.controller.js');
const productController = require('../controllers/product.controller.js');
const cartController = require('../controllers/cart.controller.js');
const orderController = require('../controllers/order.controller.js');
const integrationController = require('../controllers/integration.controller.js');
const { parseMultipartSingleFile } = require('../middlewares/upload.middleware.js');
const { requireAdminImportToken } = require('../middlewares/admin-token.middleware.js');

const router = express.Router();

router.get('/home', homeController.getHome);
router.get('/products', productController.getProducts);

router.get('/cart', cartController.getCart);
router.put('/cart/items', cartController.setCartItem);
router.delete('/cart', cartController.clearCart);

router.post('/orders', orderController.createOrder);

router.get('/integrations/status', integrationController.getIntegrationStatus);
router.post('/integrations/1c/import', integrationController.importFrom1C);
router.get('/integrations/1c/export', integrationController.exportTo1C);
router.get('/integrations/excel/template', integrationController.getExcelTemplate);
router.get('/integrations/excel/export/products', integrationController.exportProductsExcel);
router.post('/integrations/excel/import/products', integrationController.importProductsExcel);
router.post(
  '/integrations/excel/import/products-xlsx',
  requireAdminImportToken,
  parseMultipartSingleFile('file'),
  integrationController.importProductsXlsx
);

module.exports = router;
