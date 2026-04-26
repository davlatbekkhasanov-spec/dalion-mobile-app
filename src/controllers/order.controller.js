const store = require('../data/store.js');

exports.createOrder = (req, res) => {
  const result = store.createOrder(req.body || {});
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  return res.status(201).json(result.data);
};

exports.getProfile = (req, res) => {
  return res.json({ profile: store.getCustomerProfile() });
};

exports.saveProfile = (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!name || !phone) {
    return res.status(400).json({ message: 'name va phone majburiy' });
  }
  const profile = store.saveCustomerProfile(req.body || {});
  return res.json({ profile });
};

exports.getOrderStatus = (req, res) => {
  const order = store.getOrderByNumber(req.params.orderNumber);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json({
    orderNumber: order.orderNumber,
    status: order.status,
    updated_at: order.updated_at,
    created_at: order.created_at
  });
};

exports.getOrdersDisplay = (req, res) => {
  res.json({ orders: store.getOrders() });
};

exports.getOrderTrack = (req, res) => {
  const order = store.getOrderByNumber(req.params.orderNumber);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json({ order });
};

exports.submitOrderFeedback = (req, res) => {
  const order = store.saveOrderFeedback(req.params.orderNumber, {
    rating: req.body?.feedbackRating,
    comment: req.body?.feedbackComment
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json({ ok: true, order, message: 'Rahmat, fikringiz qabul qilindi' });
};
