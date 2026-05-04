const store = require('../data/store.js');
const fs = require('fs');
const path = require('path');

function resolveUserPhone(req) {
  return String(req.header('x-user-phone') || req.query?.phone || req.body?.phone || req.body?.userPhone || '').trim();
}
function isValidPhone(phone = '') {
  const normalized = String(phone).replace(/[^\d+]/g, '');
  return /^\+?\d{9,15}$/.test(normalized);
}
function isValidName(name = '') {
  const n = String(name || '').trim();
  return n.length >= 2 && n.length <= 80;
}
function isValidAddress(address = '') {
  const a = String(address || '').trim();
  return !a || (a.length >= 5 && a.length <= 220);
}

exports.createOrder = (req, res) => {
  const userPhone = resolveUserPhone(req);
  const name = String(req.body?.customerName || req.body?.name || '').trim();
  const address = String(req.body?.customerAddress || req.body?.addressText || req.body?.location || '').trim();
  if (userPhone && !isValidPhone(userPhone)) return res.status(400).json({ message: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  if (name && !isValidName(name)) return res.status(400).json({ message: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  if (!isValidAddress(address)) return res.status(400).json({ message: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  const result = store.createOrder({ ...(req.body || {}), userPhone });
  if (result.error) {
    return res.status(400).json({ message: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  }
  const order = result.data || {};
  return res.status(201).json({
    ...order,
    order_number: order.order_number || order.orderNumber,
    payment_method: order.payment_method || order.paymentMethod,
    payment_status: order.payment_status || order.paymentStatus
  });
};

exports.getProfile = (req, res) => {
  const phone = resolveUserPhone(req);
  if (!phone) return res.status(400).json({ message: 'phone required' });
  const profile = store.getUserByPhone(phone);
  if (!profile) return res.json({ profile: null });
  return res.json({ profile });
};

exports.saveProfile = (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = resolveUserPhone(req);
  const address = String(req.body?.address || '').trim();
  if (!isValidName(name) || !isValidPhone(phone) || !isValidAddress(address)) {
    return res.status(400).json({ message: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  }
  const profile = store.upsertUser({ ...(req.body || {}), phone });
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
  return res.json({
    order: {
      ...order,
      courier_status_label: String(order.status) === 'out_for_delivery' ? 'Kuryer yo‘lda' : ''
    }
  });
};

exports.getCustomerOrders = (req, res) => {
  const phone = resolveUserPhone(req);
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
