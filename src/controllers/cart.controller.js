const store = require('../data/store.js');

function resolveUserPhone(req) {
  return String(req.header('x-user-phone') || req.query?.phone || req.body?.phone || req.body?.userPhone || '').trim();
}

exports.getCart = (req, res) => {
  const phone = resolveUserPhone(req);
  if (!phone) return res.status(400).json({ message: 'user phone is required' });
  res.json(store.getCartSummary(phone));
};

exports.setCartItem = (req, res) => {
  const { productId, quantity } = req.body || {};
  if (!productId) {
    return res.status(400).json({ message: 'productId is required' });
  }

  const phone = resolveUserPhone(req);
  if (!phone) return res.status(400).json({ message: 'user phone is required' });

  const result = store.setCartItem(phone, productId, quantity);
  if (result.error) {
    return res.status(404).json({ message: result.error });
  }

  return res.json(result.data);
};

exports.clearCart = (req, res) => {
  const phone = resolveUserPhone(req);
  if (!phone) return res.status(400).json({ message: 'user phone is required' });
  store.clearCart(phone);
  return res.json(store.getCartSummary(phone));
};
