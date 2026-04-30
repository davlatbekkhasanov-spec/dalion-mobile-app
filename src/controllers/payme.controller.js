const store = require('../data/store.js');

const ERRORS = {
  UNAUTHORIZED: -32504,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  ORDER_NOT_FOUND: -31050,
  TRANSACTION_EXISTS: -31099,
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
  return { jsonrpc: '2.0', error: { code, message, data }, id: id ?? null };
}

function send(res, body) {
  return res.status(200).json(body);
}

function parseAuthorization(header = '') {
  if (!String(header).startsWith('Basic ')) return null;

  try {
    const decoded = Buffer.from(String(header).slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

function isAuthorized(req) {
  const auth = parseAuthorization(req.headers.authorization || '');
  if (!auth) return false;
  if (auth.username !== 'Paycom') return false;

  const testKey = String(process.env.PAYME_TEST_KEY || '').trim();
  const secretKey = String(process.env.PAYME_SECRET_KEY || '').trim();

  return [testKey, secretKey].filter(Boolean).includes(auth.password);
}

function normalizeOrderId(value = '') {
  return String(value || '').trim().replace(/^"+|"+$/g, '');
}

function sandboxExpectedAmount(orderId, fallbackAmount) {
  const id = String(orderId || '').toLowerCase();
  const match = id.match(/^test-(\d+)$/);

  if (match) {
    return Number(match[1]) * 10000;
  }

  return Number(fallbackAmount || 0);
}

function getOrder(account = {}, amount = 0) {
  const orderId = normalizeOrderId(account.order_id);
  if (!orderId) return null;

  const realOrder = store.getOrderById(orderId) || store.getOrderByNumber(orderId);
  if (realOrder) return realOrder;

  if (!orderId.toLowerCase().startsWith('test-')) {
    return null;
  }

  const expectedTiyin = sandboxExpectedAmount(orderId, amount);

  return {
    id: orderId,
    orderNumber: orderId,
    total: Number(expectedTiyin || 0) / 100,
    paymentStatus: 'pending',
    status: 'new',
    sandbox: true
  };
}

function expectedAmount(order) {
  return Math.round(Number(order.total || 0) * 100);
}

function isOrderPayable(order) {
  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  const status = String(order.status || '').toLowerCase();

  if (paymentStatus === 'paid') return false;
  if (paymentStatus === 'cancelled' || paymentStatus === 'canceled') return false;
  if (status === 'cancelled' || status === 'canceled') return false;
  if (status === 'blocked') return false;

  return true;
}

function findActiveTransactionByOrder(orderId, currentTxId = '') {
  for (const tx of transactions.values()) {
    if (
      tx.order_id === orderId &&
      tx.id !== currentTxId &&
      tx.state === TX_STATE.CREATED
    ) {
      return tx;
    }
  }

  return null;
}

function transactionResult(tx) {
  return {
    create_time: tx.create_time,
    perform_time: tx.perform_time || 0,
    cancel_time: tx.cancel_time || 0,
    transaction: tx.id,
    state: tx.state,
    reason: tx.reason ?? null
  };
}

function getStatementResult(from = 0, to = Date.now()) {
  const fromMs = Number(from || 0);
  const toMs = Number(to || Date.now());

  const filtered = Array.from(transactions.values())
    .filter((tx) => {
      const created = Number(tx.create_time || 0);
      return created >= fromMs && created <= toMs;
    })
    .map((tx) => ({
      id: tx.id,
      time: tx.create_time,
      amount: tx.amount,
      account: {
        order_id: tx.order_id
      },
      create_time: tx.create_time,
      perform_time: tx.perform_time || 0,
      cancel_time: tx.cancel_time || 0,
      transaction: tx.id,
      state: tx.state,
      reason: tx.reason ?? null
    }));

  return { transactions: filtered };
}

async function paymeRpc(req, res) {
  const { method, params = {}, id } = req.body || {};

  if (!isAuthorized(req)) {
    return send(res, errorResponse(id, ERRORS.UNAUTHORIZED, 'Unauthorized', 'authorization'));
  }

  try {
    if (method === 'CheckPerformTransaction') {
      const order = getOrder(params.account, params.amount);

      if (!order) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Order not found', 'order_id'));
      }

      if (Number(params.amount) !== expectedAmount(order)) {
        return send(res, errorResponse(id, ERRORS.INVALID_AMOUNT, 'Incorrect amount', 'amount'));
      }

      if (!isOrderPayable(order)) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Order not found', 'order_id'));
      }

      return send(res, response(id, { allow: true }));
    }

    if (method === 'CreateTransaction') {
      const order = getOrder(params.account, params.amount);
      const txId = String(params.id || '').trim();

      if (!txId) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      if (!order) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Order not found', 'order_id'));
      }

      if (Number(params.amount) !== expectedAmount(order)) {
        return send(res, errorResponse(id, ERRORS.INVALID_AMOUNT, 'Incorrect amount', 'amount'));
      }

      if (!isOrderPayable(order)) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Order not found', 'order_id'));
      }

      const existingSameTx = transactions.get(txId);
      if (existingSameTx) {
        return send(res, response(id, {
          create_time: existingSameTx.create_time,
          transaction: existingSameTx.id,
          state: existingSameTx.state
        }));
      }

      const activeTx = findActiveTransactionByOrder(order.id, txId);
      if (activeTx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_EXISTS, 'Transaction already exists', 'order_id'));
      }

      const tx = {
        id: txId,
        order_id: order.id,
        amount: Number(params.amount || 0),
        state: TX_STATE.CREATED,
        create_time: Number(params.time || 0) || Date.now(),
        perform_time: 0,
        cancel_time: 0,
        reason: null,
        sandbox: Boolean(order.sandbox)
      };

      transactions.set(tx.id, tx);

      return send(res, response(id, {
        create_time: tx.create_time,
        transaction: tx.id,
        state: tx.state
      }));
    }

    if (method === 'CheckTransaction') {
      const tx = transactions.get(String(params.id || '').trim());

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      return send(res, response(id, transactionResult(tx)));
    }

    if (method === 'PerformTransaction') {
      const tx = transactions.get(String(params.id || '').trim());

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      if (tx.state < 0) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, 'Transaction cancelled', 'id'));
      }

      if (tx.state !== TX_STATE.PERFORMED) {
        tx.state = TX_STATE.PERFORMED;
        tx.perform_time = Date.now();

        if (!tx.sandbox) {
          const order = store.getOrderById(tx.order_id);
          if (order) store.markOrderPaid(order.id);
        }
      }

      return send(res, response(id, {
        transaction: tx.id,
        perform_time: tx.perform_time,
        state: tx.state
      }));
    }

    if (method === 'CancelTransaction') {
      const tx = transactions.get(String(params.id || '').trim());

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, 'Transaction not found', 'id'));
      }

      if (tx.state !== TX_STATE.CANCELED_BEFORE_PERFORM && tx.state !== TX_STATE.CANCELED_AFTER_PERFORM) {
        tx.cancel_time = Date.now();
        tx.reason = params.reason ?? null;
        tx.state = tx.state === TX_STATE.PERFORMED
          ? TX_STATE.CANCELED_AFTER_PERFORM
          : TX_STATE.CANCELED_BEFORE_PERFORM;

        if (!tx.sandbox) {
          const order = store.getOrderById(tx.order_id);
          if (order) store.markOrderPaymentCancelled(order.id);
        }
      }

      return send(res, response(id, {
        transaction: tx.id,
        cancel_time: tx.cancel_time,
        state: tx.state
      }));
    }

    if (method === 'GetStatement') {
      return send(res, response(id, getStatementResult(params.from, params.to)));
    }

    return send(res, errorResponse(id, ERRORS.METHOD_NOT_FOUND, 'Method not found', 'method'));
  } catch (error) {
    console.error('[PAYME ERROR]', error);
    return send(res, errorResponse(id, ERRORS.INTERNAL_ERROR, 'Internal error', 'internal'));
  }
}

module.exports = {
  paymeRpc,
  parseAuthorization
};
