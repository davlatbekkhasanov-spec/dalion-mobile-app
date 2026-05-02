const store = require('../data/store.js');
const txRepo = require('../repositories/payme-transaction.repository.js');

const ERRORS = { UNAUTHORIZED: -32504, INVALID_AMOUNT: -31001, TX_NOT_FOUND: -31003, ORDER_NOT_FOUND: -31050, TX_EXISTS: -31099, METHOD_NOT_FOUND: -32601, INTERNAL: -32400, CONFIG: -32400 };
const TX_STATE = { CREATED: 1, PERFORMED: 2, CANCELED_BEFORE_PERFORM: -1, CANCELED_AFTER_PERFORM: -2 };
const msg = (en, ru = en, uz = en) => ({ ru, uz, en });
const resOk = (id, result) => ({ jsonrpc: '2.0', result, id: id ?? null });
const resErr = (id, code, message, data) => ({ jsonrpc: '2.0', error: { code, message, data }, id: id ?? null });
const send = (res, body) => res.status(200).json(body);

function getConfig() {
  return {
    merchantId: String(process.env.PAYME_MERCHANT_ID || '').trim(),
    secret: String(process.env.PAYME_SECRET_KEY || '').trim(),
    testMode: String(process.env.PAYME_TEST_MODE || 'false').toLowerCase() === 'true',
    legacyTestKey: String(process.env.PAYME_TEST_KEY || '').trim()
  };
}
function parseAuthorization(header = '') {
  if (!String(header).startsWith('Basic ')) return null;
  try { const [username, password] = Buffer.from(String(header).slice(6), 'base64').toString('utf8').split(':'); return { username, password }; } catch { return null; }
}
function isAuthorized(req) {
  const auth = parseAuthorization(req.headers.authorization || '');
  if (!auth || auth.username !== 'Paycom') return false;
  const cfg = getConfig();
  if (cfg.secret && auth.password === cfg.secret) return true;
  return cfg.testMode && cfg.legacyTestKey && auth.password === cfg.legacyTestKey;
}
function configReady() { const cfg = getConfig(); return Boolean(cfg.secret || (cfg.testMode && cfg.legacyTestKey)); }
function normalizeOrderId(v = '') { return String(v || '').trim().replace(/^"+|"+$/g, ''); }
function findOrder(account = {}) {
  const orderKey = normalizeOrderId(account.order_id || account.orderNumber);
  if (!orderKey) return null;
  const found = store.getOrderById(orderKey) || store.getOrderByNumber(orderKey) || null;
  if (found) return found;
  const cfg = getConfig();
  if (cfg.testMode && /^test(-\d+)?$/i.test(orderKey)) {
    const tiyin = /^test-(\d+)$/i.test(orderKey) ? Number(orderKey.split('-')[1]) * 10000 : 5000;
    return { id: orderKey, orderNumber: orderKey, total: tiyin / 100, paymentStatus: 'pending', status: 'new', sandbox: true };
  }
  return null;
}
function expectedAmountTiyin(order) { return Math.round(Number(order.total || 0) * 100); }
function txResult(tx) { return { create_time: Number(tx.create_time || 0), perform_time: Number(tx.perform_time || 0), cancel_time: Number(tx.cancel_time || 0), transaction: tx.payme_transaction_id, state: Number(tx.state || 0), reason: tx.reason ?? null }; }

async function paymeRpc(req, res) {
  const { method, params = {}, id } = req.body || {};
  if (!isAuthorized(req)) return send(res, resErr(id, ERRORS.UNAUTHORIZED, msg('Unauthorized', 'Не авторизован', 'Avtorizatsiyadan o‘tilmagan'), 'authorization'));
  if (!configReady()) return send(res, resErr(id, ERRORS.CONFIG, msg('Payment config error', 'Ошибка конфигурации оплаты', 'To‘lov konfiguratsiyasi xatosi'), 'payme_config'));
  try {
    if (method === 'CheckPerformTransaction') {
      const order = findOrder(params.account || {});
      if (!order) return send(res, resErr(id, ERRORS.ORDER_NOT_FOUND, msg('Order not found', 'Заказ не найден', 'Buyurtma topilmadi'), 'order_id'));
      if (Number(params.amount) !== expectedAmountTiyin(order)) return send(res, resErr(id, ERRORS.INVALID_AMOUNT, msg('Incorrect amount', 'Неверная сумма', 'Noto‘g‘ri summa'), 'amount'));
      return send(res, resOk(id, { allow: true }));
    }
    if (method === 'CreateTransaction') {
      const txId = String(params.id || '').trim();
      const order = findOrder(params.account || {});
      if (!order) return send(res, resErr(id, ERRORS.ORDER_NOT_FOUND, msg('Order not found', 'Заказ не найден', 'Buyurtma topilmadi'), 'order_id'));
      if (Number(params.amount) !== expectedAmountTiyin(order)) return send(res, resErr(id, ERRORS.INVALID_AMOUNT, msg('Incorrect amount', 'Неверная сумма', 'Noto‘g‘ri summa'), 'amount'));
      const existing = await txRepo.getById(txId);
      if (existing) return send(res, resOk(id, { create_time: Number(existing.create_time || 0), transaction: existing.payme_transaction_id, state: Number(existing.state || 0) }));
      const active = await txRepo.getActiveByOrderId(order.id, txId);
      if (active) return send(res, resErr(id, ERRORS.TX_EXISTS, msg('Transaction already exists', 'Транзакция уже существует', 'Tranzaksiya allaqachon mavjud'), 'order_id'));
      const tx = await txRepo.upsert({ payme_transaction_id: txId, order_id: order.id, amount: Number(params.amount || 0), state: TX_STATE.CREATED, reason: null, create_time: Number(params.time || 0) || Date.now(), perform_time: 0, cancel_time: 0, sandbox: Boolean(order.sandbox) });
      return send(res, resOk(id, { create_time: Number(tx.create_time || 0), transaction: tx.payme_transaction_id, state: Number(tx.state || 0) }));
    }
    if (method === 'PerformTransaction') {
      const tx = await txRepo.getById(params.id);
      if (!tx) return send(res, resErr(id, ERRORS.TX_NOT_FOUND, msg('Transaction not found', 'Транзакция не найдена', 'Tranzaksiya topilmadi'), 'id'));
      if (Number(tx.state) < 0) return send(res, resErr(id, ERRORS.ORDER_NOT_FOUND, msg('Transaction cancelled', 'Транзакция отменена', 'Tranzaksiya bekor qilingan'), 'id'));
      if (Number(tx.state) !== TX_STATE.PERFORMED) {
        tx.state = TX_STATE.PERFORMED; tx.perform_time = Date.now(); await txRepo.upsert(tx);
        if (!tx.sandbox) store.markOrderPaid(tx.order_id);
      }
      return send(res, resOk(id, { transaction: tx.payme_transaction_id, perform_time: Number(tx.perform_time || 0), state: Number(tx.state || 0) }));
    }
    if (method === 'CancelTransaction') {
      const tx = await txRepo.getById(params.id);
      if (!tx) return send(res, resErr(id, ERRORS.TX_NOT_FOUND, msg('Transaction not found', 'Транзакция не найдена', 'Tranzaksiya topilmadi'), 'id'));
      if (![TX_STATE.CANCELED_BEFORE_PERFORM, TX_STATE.CANCELED_AFTER_PERFORM].includes(Number(tx.state))) {
        tx.reason = params.reason ?? null; tx.cancel_time = Date.now();
        tx.state = Number(tx.state) === TX_STATE.PERFORMED ? TX_STATE.CANCELED_AFTER_PERFORM : TX_STATE.CANCELED_BEFORE_PERFORM;
        await txRepo.upsert(tx);
        if (!tx.sandbox) store.markOrderPaymentCancelled(tx.order_id);
      }
      return send(res, resOk(id, { transaction: tx.payme_transaction_id, cancel_time: Number(tx.cancel_time || 0), state: Number(tx.state || 0) }));
    }
    if (method === 'CheckTransaction') {
      const tx = await txRepo.getById(params.id);
      if (!tx) return send(res, resErr(id, ERRORS.TX_NOT_FOUND, msg('Transaction not found', 'Транзакция не найдена', 'Tranzaksiya topilmadi'), 'id'));
      return send(res, resOk(id, txResult(tx)));
    }
    if (method === 'GetStatement') {
      const txs = await txRepo.listByPeriod(params.from, params.to);
      return send(res, resOk(id, { transactions: txs.map((tx) => ({ id: tx.payme_transaction_id, time: Number(tx.create_time || 0), amount: Number(tx.amount || 0), account: { order_id: tx.order_id }, ...txResult(tx) })) }));
    }
    return send(res, resErr(id, ERRORS.METHOD_NOT_FOUND, msg('Method not found', 'Метод не найден', 'Metod topilmadi'), 'method'));
  } catch (e) {
    return send(res, resErr(id, ERRORS.INTERNAL, msg('Internal error', 'Внутренняя ошибка', 'Ichki xatolik'), 'internal'));
  }
}

module.exports = { paymeRpc, parseAuthorization };
