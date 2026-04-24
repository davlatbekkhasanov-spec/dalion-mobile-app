const express = require('express');

const homeController = require('../controllers/home.controller.js');
const productController = require('../controllers/product.controller.js');
const cartController = require('../controllers/cart.controller.js');
const orderController = require('../controllers/order.controller.js');
const integrationController = require('../controllers/integration.controller.js');
const adminController = require('../controllers/admin.controller.js');
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

router.get('/admin/banners', requireAdminImportToken, adminController.getBanners);
router.post('/admin/banners', requireAdminImportToken, adminController.createBanner);
router.put('/admin/banners/:id', requireAdminImportToken, adminController.updateBanner);
router.delete('/admin/banners/:id', requireAdminImportToken, adminController.deleteBanner);

router.get('/admin/promotions', requireAdminImportToken, adminController.getPromotions);
router.post('/admin/promotions', requireAdminImportToken, adminController.createPromotion);
router.put('/admin/promotions/:id', requireAdminImportToken, adminController.updatePromotion);
router.delete('/admin/promotions/:id', requireAdminImportToken, adminController.deletePromotion);

router.get('/admin/home-settings', requireAdminImportToken, adminController.getHomeSettings);
router.put('/admin/home-settings', requireAdminImportToken, adminController.updateHomeSettings);

router.get('/admin/categories', requireAdminImportToken, adminController.getCategories);
router.put('/admin/categories/:id', requireAdminImportToken, adminController.updateCategory);

router.get('/admin/products', requireAdminImportToken, adminController.getProducts);
router.put('/admin/products/:id', requireAdminImportToken, adminController.updateProduct);

module.exports = router;
