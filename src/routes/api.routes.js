const express = require('express');

const homeController = require('../controllers/home.controller.js');
const productController = require('../controllers/product.controller.js');
const cartController = require('../controllers/cart.controller.js');
const orderController = require('../controllers/order.controller.js');

const router = express.Router();

router.get('/home', homeController.getHome);
router.get('/products', productController.getProducts);

router.get('/cart', cartController.getCart);
router.put('/cart/items', cartController.setCartItem);
router.delete('/cart', cartController.clearCart);

router.post('/orders', orderController.createOrder);

module.exports = router;
