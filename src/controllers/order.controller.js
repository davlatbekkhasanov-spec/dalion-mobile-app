const store = require('../data/store.js');
const fs = require('fs');
const path = require('path');

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

exports.getCustomerOrders = (req, res) => {
  const phone = String(req.query?.phone || '').trim();
  if (!phone) return res.status(400).json({ message: 'phone query required' });
  return res.json({ orders: store.getCustomerOrders(phone) });
};

exports.uploadPaymentProof = async (req, res) => {
  const orderNumber = String(req.body?.orderNumber || req.query?.orderNumber || '').trim();
  if (!orderNumber) return res.status(400).json({ message: 'orderNumber required' });
  if (!req.file?.buffer) return res.status(400).json({ message: 'proof file required' });
  const order = store.getOrderByNumber(orderNumber);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const proofsDir = path.join(process.cwd(), 'uploads', 'payment-proofs');
  fs.mkdirSync(proofsDir, { recursive: true });
  const isPdf = String(req.file.mimetype || '').includes('pdf');
  const ext = isPdf ? '.pdf' : path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
  const fileName = `${orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
  const fullPath = path.join(proofsDir, fileName);
  fs.writeFileSync(fullPath, req.file.buffer);
  const paymentProofUrl = `/uploads/payment-proofs/${fileName}`;
  const updated = store.attachPaymentProof(orderNumber, { paymentProofUrl });
  return res.json({ ok: true, order: updated, paymentProofUrl });
};

exports.submitOrderFeedback = (req, res) => {
  const order = store.saveOrderFeedback(req.params.orderNumber, {
    rating: req.body?.feedbackRating,
    comment: req.body?.feedbackComment
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json({ ok: true, order, message: 'Rahmat, fikringiz qabul qilindi' });
};
