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
  // Native-ready endpoint: mobile app background tracker can post same payload here in future.
  const out = store.updateCourierLocation(req.params.token, req.body || {});
  if (out.error) return res.status(400).json({ ok: false, message: out.error });
  return res.json({ ok: true, order: out.order });
};

exports.applyCourier = (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!name || !phone) return res.status(400).json({ ok: false, message: 'Ism va telefon majburiy' });
  const app = store.createCourierApplication(req.body || {});
  return res.json({ ok: true, application: app, message: 'Arizangiz yuborildi' });
};

exports.listCourierApplications = (req, res) => {
  return res.json({ ok: true, applications: store.listCourierApplications() });
};

exports.decideCourierApplication = (req, res) => {
  const app = store.decideCourierApplication(req.params.id, req.body?.decision);
  if (!app) return res.status(404).json({ ok: false, message: 'Ariza topilmadi' });
  return res.json({ ok: true, application: app });
};
