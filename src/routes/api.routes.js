const express = require('express');

const homeController = require('../controllers/home.controller.js');
const productController = require('../controllers/product.controller.js');
const authController = require('../controllers/auth.controller.js');
const cartController = require('../controllers/cart.controller.js');
const orderController = require('../controllers/order.controller.js');
const courierController = require('../controllers/courier.controller.js');
const integrationController = require('../controllers/integration.controller.js');
const wholesaleController = require('../controllers/wholesale.controller.js');
const adminController = require('../controllers/admin.controller.js');
const { parseMultipartSingleFile } = require('../middlewares/upload.middleware.js');
const { requireAdminImportToken } = require('../middlewares/admin-token.middleware.js');
const { env } = require('../config/env.js');

const router = express.Router();
// TODO(PHASE-2): Split this monolithic router into module-local routers under src/modules/* while preserving current public API paths.
const XLSX_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

router.get('/home', homeController.getHome);
router.get('/products', productController.getProducts);
router.post('/auth/request-otp', authController.requestOtp);
router.post('/auth/verify-otp', authController.verifyOtp);
router.post('/wholesale/apply', wholesaleController.apply);
router.post('/wholesale/login', wholesaleController.login);
router.post('/courier/apply', courierController.applyCourier);

router.get('/cart', cartController.getCart);
router.put('/cart/items', cartController.setCartItem);
router.delete('/cart', cartController.clearCart);

router.post('/orders', orderController.createOrder);
router.get('/customer/orders', orderController.getCustomerOrders);
router.post('/promos/validate', orderController.validatePromo);
router.post('/orders/payment-proof', parseMultipartSingleFile('file'), orderController.uploadPaymentProof);
router.get('/profile', orderController.getProfile);
router.put('/profile', orderController.saveProfile);
router.get('/orders/:orderNumber/status', orderController.getOrderStatus);
router.get('/orders/:orderNumber/track', orderController.getOrderTrack);
router.post('/orders/:orderNumber/feedback', orderController.submitOrderFeedback);
router.get('/orders/display', orderController.getOrdersDisplay);
router.get('/courier/:token', courierController.getCourierOrder);
router.post('/courier/:token/accept', courierController.acceptCourierOrder);
router.post('/courier/:token/deliver', courierController.deliverCourierOrder);
router.post('/courier/:token/location', courierController.updateCourierLocation);

router.get('/integrations/status', integrationController.getIntegrationStatus);
router.post('/integrations/1c/import', integrationController.importFrom1C);
router.get('/integrations/1c/export', integrationController.exportTo1C);
router.get('/integrations/excel/template', integrationController.getExcelTemplate);
router.get('/integrations/excel/export/products', integrationController.exportProductsExcel);
router.post('/integrations/excel/import/products', integrationController.importProductsExcel);
router.post('/integrations/datamobile/orders/:id/send', requireAdminImportToken, integrationController.sendOrderToDataMobile);
router.post('/integrations/dalion/orders/:id/picked', integrationController.markDalionOrderPicked);
router.post(
  '/integrations/excel/import/products-xlsx',
  requireAdminImportToken,
  parseMultipartSingleFile('file', { maxBytes: XLSX_IMPORT_MAX_BYTES }),
  integrationController.importProductsXlsx
);
router.post(
  '/admin/products/import',
  requireAdminImportToken,
  parseMultipartSingleFile('file', { maxBytes: XLSX_IMPORT_MAX_BYTES }),
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
router.get('/admin/promo-codes', requireAdminImportToken, adminController.getPromoCodes);
router.post('/admin/promo-codes', requireAdminImportToken, adminController.upsertPromoCode);

router.get('/admin/home-settings', requireAdminImportToken, adminController.getHomeSettings);
router.put('/admin/home-settings', requireAdminImportToken, adminController.updateHomeSettings);

router.get('/admin/categories', requireAdminImportToken, adminController.getCategories);
router.put('/admin/categories/:id', requireAdminImportToken, adminController.updateCategory);
router.post('/admin/categories/:id/image', requireAdminImportToken, parseMultipartSingleFile('file'), adminController.uploadCategoryImage);

router.get('/admin/products', requireAdminImportToken, adminController.getProducts);
router.put('/admin/products/:id', requireAdminImportToken, adminController.updateProduct);

// TODO(PHASE-3): Remove demo loader routes fully after DALION/Excel production migration sign-off.
if (env.enableDemoLoaders) {
  router.post('/admin/products/load-demo', requireAdminImportToken, adminController.loadDemoProducts);
  router.post('/admin/products/load-kanstik-demo', requireAdminImportToken, adminController.loadKanstikDemoProducts);
  router.post('/admin/products/clear-demo', requireAdminImportToken, adminController.clearDemoProducts);
}
router.get('/admin/store/summary', requireAdminImportToken, adminController.getStoreSummary);
router.post('/admin/store/reload', requireAdminImportToken, adminController.reloadStore);
router.post('/admin/dalion/sync', requireAdminImportToken, adminController.syncDalionProducts);
router.get('/admin/courier/applications', requireAdminImportToken, courierController.listCourierApplications);
router.post('/admin/courier/applications/:id/decision', requireAdminImportToken, courierController.decideCourierApplication);
router.get('/admin/wholesale/applications', requireAdminImportToken, wholesaleController.listAdmin);
router.post('/admin/wholesale/applications/:id/decision', requireAdminImportToken, wholesaleController.decide);
router.get('/admin/orders', requireAdminImportToken, adminController.getOrders);
router.get('/admin/orders/:id', requireAdminImportToken, adminController.getOrderById);
router.put('/admin/orders/:id/status', requireAdminImportToken, adminController.updateOrderStatus);
router.post('/admin/orders/:id/cancel', requireAdminImportToken, adminController.cancelOrder);
router.post('/admin/orders/:id/assign-courier', requireAdminImportToken, adminController.assignCourier);
router.get('/admin/orders/:id/picklist', requireAdminImportToken, adminController.getOrderPicklist);
router.post('/admin/orders/:id/send-to-tsd', requireAdminImportToken, adminController.sendOrderToTsd);
router.get('/admin/orders/:id/qr', requireAdminImportToken, adminController.getOrderQr);

module.exports = router;
