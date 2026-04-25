const store = require('../data/store.js');

exports.createOrder = (req, res) => {
  const result = store.createOrder(req.body || {});
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  return res.status(201).json(result.data);
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
