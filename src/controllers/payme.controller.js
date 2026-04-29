const store = require('../data/store.js');

const ERRORS = {
  UNAUTHORIZED: -32504,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  ORDER_NOT_FOUND: -31050,
  METHOD_NOT_FOUND: -32601,
  INTERNAL_ERROR: -32400
};

const TX_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELED_BEFORE_PERFORM: -1,
  CANCELED_AFTER_PERFORM: -2
};

const transactions = new Map();

function response(id, result) {
  return { jsonrpc: '2.0', result, id: id ?? null };
}

function errorResponse(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    error: { code, message, data },
    id: id ?? null
  };
}

function send(res, body) {
  return res.status(200).json(body);
}

// ================= AUTH =================
function parseAuthorization(header = '') {
  if (!header.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const [username, password] = decoded.split(':');
  return { username, password };
}

function isAuthorized(req) {
  const auth = parseAuthorization(req.headers.authorization || '');
  if (!auth) return false;
  if (auth.username !== 'Paycom') return false;

  return (
    auth.password === process.env.PAYME_TEST_KEY ||
    auth.password === process.env.PAYME_SECRET_KEY
  );
}

// ================= HELPERS =================
function getOrder(account = {}, amount = 0) {
  const id = String(account.order_id || '');

  // sandbox
  if (!id) return null;

  return (
    store.getOrderById(id) ||
    store.getOrderByNumber(id) || {
      id,
      total: amount / 100,
      paymentStatus: 'pending',
      status: 'new'
    }
  );
}

function expectedAmount(order) {
  return Math.round(order.total * 100);
}

// ================= MAIN =================
async function paymeRpc(req, res) {
  const { method, params = {}, id } = req.body || {};

  if (!isAuthorized(req)) {
    return send(res, errorResponse(id, ERRORS.UNAUTHORIZED, 'Unauthorized', 'authorization'));
  }

  try {
    // ================= CHECK =================
    if (method === 'CheckPerformTransaction') {
      const order = getOrder(params.account, params.amount);

      if (!order) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Order not found', 'order_id'));
      }

      if (Number(params.amount) !== expectedAmount(order)) {
        return send(res, errorResponse(id, ERRORS.INVALID_AMOUNT, 'Invalid amount', 'amount'));
      }

      return send(res, response(id, { allow: true }));
    }

    // ================= CREATE =================
    if (method === 'CreateTransaction') {
      const order = getOrder(params.account, params.amount);

      if (!order) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Order not found', 'order_id'));
      }

      if (Number(params.amount) !== expectedAmount(order)) {
        return send(res, errorResponse(id, ERRORS.INVALID_AMOUNT, 'Invalid amount', 'amount'));
      }

      const tx = {
        id: params.id,
        order_id: order.id,
        amount: params.amount,
        state: TX_STATE.CREATED,
        create_time: params.time || Date.now()
      };

      transactions.set(params.id, tx);

      return send(res, response(id, {
        create_time: tx.create_time,
        transaction: tx.id,
        state: tx.state
      }));
    }

    // ================= CHECK TX =================
    if (method === 'CheckTransaction') {
      const tx = transactions.get(params.id);

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      return send(res, response(id, {
        create_time: tx.create_time,
        perform_time: tx.perform_time || 0,
        cancel_time: tx.cancel_time || 0,
        transaction: tx.id,
        state: tx.state
      }));
    }

    // ================= PERFORM =================
    if (method === 'PerformTransaction') {
      const tx = transactions.get(params.id);

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      tx.state = TX_STATE.PERFORMED;
      tx.perform_time = Date.now();

      const order = store.getOrderById(tx.order_id);
      if (order) store.markOrderPaid(order.id);

      return send(res, response(id, {
        transaction: tx.id,
        perform_time: tx.perform_time,
        state: tx.state
      }));
    }

    // ================= CANCEL =================
    if (method === 'CancelTransaction') {
      const tx = transactions.get(params.id);

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      tx.state = TX_STATE.CANCELED_BEFORE_PERFORM;
      tx.cancel_time = Date.now();

      const order = store.getOrderById(tx.order_id);
      if (order) store.markOrderPaymentCancelled(order.id);

      return send(res, response(id, {
        transaction: tx.id,
        cancel_time: tx.cancel_time,
        state: tx.state
      }));
    }

    return send(res, errorResponse(id, ERRORS.METHOD_NOT_FOUND, 'Method not found', 'method'));

  } catch (e) {
    console.error(e);
    return send(res, errorResponse(id, ERRORS.INTERNAL_ERROR, 'Internal error', 'internal'));
  }
}

module.exports = { paymeRpc };
