const store = require('../data/store.js');

exports.getCart = (req, res) => {
  res.json(store.getCartSummary());
};

exports.setCartItem = (req, res) => {
  const { productId, quantity } = req.body || {};
  if (!productId) {
    return res.status(400).json({ message: 'productId is required' });
  }

  const result = store.setCartItem(productId, quantity);
  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result.data);
};

exports.clearCart = (req, res) => {
  store.clearCart();
  return res.json(store.getCartSummary());
};
