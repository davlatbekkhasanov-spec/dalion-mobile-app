# Mobile App V1 Plan

## Main goal

Fast ordering app, not a marketplace.

## V1 Screens

1. Splash
2. Home
3. Categories
4. Product List
5. Product Detail
6. Cart
7. Checkout
8. Order Success
9. Profile / Order History

## V1 Features

* Product catalog
* Search
* Add to cart
* Delivery price calculation
* Payment type selection
* Order creation
* Payment proof upload
* Order history

## Backend API

* GET /api/v1/home
* GET /api/v1/categories
* GET /api/v1/products
* GET /api/v1/products/:id
* GET /api/v1/search?q=
* POST /api/v1/delivery/calc
* POST /api/v1/cart/validate
* POST /api/v1/orders
* GET /api/v1/orders/:id
* GET /api/v1/me/orders
* POST /api/v1/payments/proof

## Important rules

* DALION categories are NOT shown directly in UI
* UI uses only 8-12 main categories
* Search is very important
* Telegram flow must keep working
* Backend remains Node.js
* Mobile app will be Flutter
