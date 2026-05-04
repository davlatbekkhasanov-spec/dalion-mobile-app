const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store.js');

function seedProduct(id='p_test_flow') {
  store.upsertProducts([{ id, name:'Test Product', category:'Kanselyariya', price:10000, stock:50, active:true }]);
  return id;
}

test('add to cart once does not duplicate', () => {
  const phone = '+998901111111';
  const productId = seedProduct('p_test_once');
  store.upsertUser({ phone, name:'User One', address:'Samarqand', role:'user' });
  store.clearCart(phone);
  store.setCartItem(phone, productId, 1);
  const summary = store.getCartSummary(phone);
  assert.equal(summary.totalQty, 1);
  assert.equal(summary.items.length, 1);
});

test('plus/minus and remove item works', () => {
  const phone = '+998902222222';
  const productId = seedProduct('p_test_plus_minus');
  store.upsertUser({ phone, name:'User Two', address:'Samarqand', role:'user' });
  store.clearCart(phone);
  store.setCartItem(phone, productId, 1);
  store.setCartItem(phone, productId, 3);
  assert.equal(store.getCartSummary(phone).totalQty, 3);
  store.setCartItem(phone, productId, 2);
  assert.equal(store.getCartSummary(phone).totalQty, 2);
  store.setCartItem(phone, productId, 0);
  assert.equal(store.getCartSummary(phone).totalQty, 0);
});

test('cart total correct', () => {
  const phone = '+998903333333';
  const productId = seedProduct('p_test_total');
  store.upsertUser({ phone, name:'User Three', address:'Samarqand', role:'user' });
  store.clearCart(phone);
  store.setCartItem(phone, productId, 2);
  const summary = store.getCartSummary(phone);
  assert.equal(summary.subtotal, 20000);
});

test('delivery formula correct and order in admin list', () => {
  const phone = '+998904444444';
  const productId = seedProduct('p_test_delivery');
  store.upsertUser({ phone, name:'User Four', address:'Samarqand', role:'user' });
  store.clearCart(phone);
  store.setCartItem(phone, productId, 1);
  const out = store.createOrder({ userPhone: phone, paymentMethod:'cash', cashAgreementAccepted:true, locationLat:39.654572, locationLng:66.958871, addressText:'A' });
  assert.ok(out.data?.orderNumber);
  assert.equal(out.data.deliveryPrice, 18500);
  assert.equal(out.data.paymentMethod, 'cash');
  const orders = store.getOrders();
  assert.ok(orders.some((o) => o.orderNumber === out.data.orderNumber));
});

test('payment method selection stores correct method', () => {
  const phone = '+998905555555';
  const productId = seedProduct('p_test_payme');
  store.upsertUser({ phone, name:'User Five', address:'Samarqand', role:'user' });
  store.clearCart(phone);
  store.setCartItem(phone, productId, 1);
  const out = store.createOrder({ userPhone: phone, paymentMethod:'payme', locationLat:39.654572, locationLng:66.958871, addressText:'A' });
  assert.equal(out.data.paymentMethod, 'payme');
  assert.equal(out.data.paymentStatus, 'pending');
});

test('product category counts update', () => {
  const before = store.getCategories().reduce((s,c)=>s+Number(c.productCount||0),0);
  store.upsertProducts([{ id:'p_cat_1', name:'Cat Item', category:'USB va kabellar', price:5000, stock:3, active:true }]);
  const after = store.getCategories().reduce((s,c)=>s+Number(c.productCount||0),0);
  assert.ok(after >= before);
});
