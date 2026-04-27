const store = require('../data/store.js');

exports.getCourierOrder = (req, res) => {
  const order = store.getOrderByCourierToken(req.params.token);
  if (!order) return res.status(404).json({ message: 'Invalid token' });
  if (order.courierTokenUsed) return res.status(410).json({ message: 'Bu QR kod allaqachon ishlatilgan', order });
  return res.json({ order });
};

exports.acceptCourierOrder = (req, res) => {
  const out = store.courierAccept(req.params.token, req.body || {});
  if (out.error) return res.status(400).json({ message: out.error });
  return res.json({ order: out.order });
};

exports.deliverCourierOrder = (req, res) => {
  const out = store.courierDeliver(req.params.token);
  if (out.error) return res.status(400).json({ message: out.error });
  return res.json({ order: out.order });
};

exports.updateCourierLocation = (req, res) => {
  const out = store.updateCourierLocation(req.params.token, req.body || {});
  if (out.error) return res.status(400).json({ ok: false, message: out.error });
  return res.json({ ok: true, order: out.order });
};
