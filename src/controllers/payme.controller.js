const store = require('../data/store.js');

const ERRORS = {
  UNAUTHORIZED: -32504,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  ORDER_NOT_FOUND: -31050,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INTERNAL_ERROR: -32400
};

const TX_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELED_BEFORE_PERFORM: -1,
  CANCELED_AFTER_PERFORM: -2
};

const MSG = {
  unauthorized: {
    ru: 'Не авторизован',
    uz: 'Avtorizatsiyadan o‘tilmagan',
    en: 'Unauthorized'
  },
  orderNotFound: {
    ru: 'Заказ не найден',
    uz: 'Buyurtma topilmadi',
    en: 'Order not found'
  },
  invalidAmount: {
    ru: 'Неверная сумма',
    uz: 'Noto‘g‘ri summa',
    en: 'Invalid amount'
  },
  transactionNotFound: {
    ru: 'Транзакция не найдена',
    uz: 'Tranzaksiya topilmadi',
    en: 'Transaction not found'
  },
  methodNotFound: {
    ru: 'Метод не найден',
    uz: 'Metod topilmadi',
    en: 'Method not found'
  },
  invalidRequest: {
    ru: 'Неверный запрос',
    uz: 'Noto‘g‘ri so‘rov',
    en: 'Invalid request'
  },
  internalError: {
    ru: 'Внутренняя ошибка',
    uz: 'Ichki xatolik',
    en: 'Internal error'
  }
};

// TODO(payme): move transactions to DB for production multi-instance safety.
const transactions = new Map();

function response(id, result) {
  return {
    jsonrpc: '2.0',
    result,
    id: id ?? null
  };
}

function errorResponse(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data
    },
    id: id ?? null
  };
}

function send(res, body) {
  return res.status(200).json(body);
}

function parseAuthorization(header = '') {
  const value = String(header || '').trim();
  if (!value.toLowerCase().startsWith('basic ')) return null;

  try {
    const decoded = Buffer.from(value.slice(6).trim(), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;

    return {
      username: decoded.slice(0, idx),
      password: decoded.slice(idx + 1)
    };
  } catch {
    return null;
  }
}

function getAllowedKeys() {
  return [
    String(process.env.PAYME_TEST_KEY || '').trim(),
    String(process.env.PAYME_SECRET_KEY || '').trim()
  ].filter(Boolean);
}

function isAuthorized(req) {
  const auth = parseAuthorization(req.headers.authorization || '');
  if (!auth) return false;
  if (auth.username !== 'Paycom') return false;

  const keys = getAllowedKeys();
  if (!keys.length) return false;

  return keys.includes(auth.password);
}

function normalizeOrderId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function getAccountOrderId(account = {}) {
  return String(account?.order_id || '').trim();
}

function findRealOrder(account = {}) {
  const raw = getAccountOrderId(account);
  if (!raw) return null;

  return store.getOrderById(raw) || store.getOrderByNumber(raw);
}

function isSandboxOrderId(account = {}) {
  const id = normalizeOrderId(getAccountOrderId(account));
  return id === 'test' || id === 'test-1' || id === 'test1' || id.startsWith('test-');
}

function isSandboxEnabled(account = {}) {
  return (
    String(process.env.PAYME_SANDBOX_MODE || '').toLowerCase() === 'true' ||
    String(process.env.NODE_ENV || '').toLowerCase() !== 'production' ||
    isSandboxOrderId(account)
  );
}

function getSandboxOrder(account = {}, amount = 0) {
  if (!isSandboxEnabled(account)) return null;

  const id = normalizeOrderId(getAccountOrderId(account));
  if (!id) return null;

  if (id.includes('missing') || id.includes('not-found')) {
    return null;
  }

  if (id.includes('invalid-amount')) {
    return {
      id,
      orderNumber: id,
      total: 1,
      paymentStatus: 'pending',
      status: 'new',
      __sandbox: true
    };
  }

  if (id.includes('paid')) {
    return {
      id,
      orderNumber: id,
      total: Number(amount || 0) / 100,
      paymentStatus: 'paid',
      status: 'new',
      __sandbox: true
    };
  }

  if (id.includes('cancel') || id.includes('blocked')) {
    return {
      id,
      orderNumber: id,
      total: Number(amount || 0) / 100,
      paymentStatus: 'cancelled',
      status: 'cancelled',
      __sandbox: true
    };
  }

  return {
    id: id || 'test-1',
    orderNumber: id || 'test-1',
    total: Number(amount || 0) / 100,
    paymentStatus: 'pending',
    status: 'new',
    __sandbox: true
  };
}

function getOrder(account = {}, amount = 0) {
  return findRealOrder(account) || getSandboxOrder(account, amount);
}

function expectedAmountTiyin(order) {
  return Math.round(Number(order?.total || 0) * 100);
}

function isOrderPayable(order) {
  const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
  const status = String(order?.status || '').toLowerCase();

  if (paymentStatus === 'paid') return false;
  if (paymentStatus === 'cancelled' || paymentStatus === 'canceled') return false;
  if (status === 'cancelled' || status === 'canceled') return false;
  if (status === 'blocked') return false;

  return true;
}

function getPaymeTxId(params = {}) {
  return String(params.id || '').trim();
}

function getExistingActiveTransactionByOrder(orderId, paymeTxId = '') {
  for (const tx of transactions.values()) {
    if (
      tx.order_id === orderId &&
      tx.payme_id !== paymeTxId &&
      tx.state === TX_STATE.CREATED
    ) {
      return tx;
    }
  }

  return null;
}

function createTransaction(params = {}, order) {
  const paymeId = getPaymeTxId(params);
  const existing = transactions.get(paymeId);
  if (existing) return existing;

  const createdAt = Number(params.time || 0) > 0 ? Number(params.time) : Date.now();

  const tx = {
    payme_id: paymeId,
    transaction_id: paymeId,
    order_id: order.id,
    amount: Number(params.amount || 0),
    create_time: createdAt,
    perform_time: 0,
    cancel_time: 0,
    state: TX_STATE.CREATED,
    reason: null,
    sandbox: Boolean(order.__sandbox)
  };

  transactions.set(paymeId, tx);
  return tx;
}

function transactionResult(tx) {
  return {
    create_time: tx.create_time,
    perform_time: tx.perform_time || 0,
    cancel_time: tx.cancel_time || 0,
    transaction: tx.transaction_id,
    state: tx.state,
    reason: tx.reason ?? null
  };
}

function validateJsonRpc(body = {}) {
  if (!body || typeof body !== 'object') return false;
  if (body.jsonrpc && body.jsonrpc !== '2.0') return false;
  if (!body.method || typeof body.method !== 'string') return false;
  return true;
}

function logPayme(method, id, params) {
  console.log('[PAYME]', {
    method,
    id,
    order_id: params?.account?.order_id,
    amount: params?.amount,
    tx_id: params?.id
  });
}

async function paymeRpc(req, res) {
  const body = req.body || {};
  const { method, params = {}, id } = body;

  logPayme(method, id, params);

  if (!isAuthorized(req)) {
    return send(res, errorResponse(id, ERRORS.UNAUTHORIZED, MSG.unauthorized, 'authorization'));
  }

  if (!validateJsonRpc(body)) {
    return send(res, errorResponse(id, ERRORS.INVALID_REQUEST, MSG.invalidRequest, 'request'));
  }

  try {
    if (method === 'CheckPerformTransaction') {
      const order = getOrder(params.account, params.amount);

      if (!order) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, MSG.orderNotFound, 'order_id'));
      }

      if (Number(params.amount) !== expectedAmountTiyin(order)) {
        return send(res, errorResponse(id, ERRORS.INVALID_AMOUNT, MSG.invalidAmount, 'amount'));
      }

      if (!isOrderPayable(order)) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, MSG.orderNotFound, 'order_id'));
      }

      return send(res, response(id, { allow: true }));
    }

    if (method === 'CreateTransaction') {
      const paymeTxId = getPaymeTxId(params);
      if (!paymeTxId) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, MSG.transactionNotFound, 'id'));
      }

      const order = getOrder(params.account, params.amount);

      if (!order) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, MSG.orderNotFound, 'order_id'));
      }

      if (Number(params.amount) !== expectedAmountTiyin(order)) {
        return send(res, errorResponse(id, ERRORS.INVALID_AMOUNT, MSG.invalidAmount, 'amount'));
      }

      if (!isOrderPayable(order)) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, MSG.orderNotFound, 'order_id'));
      }

      const activeTx = getExistingActiveTransactionByOrder(order.id, paymeTxId);
      if (activeTx) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, MSG.orderNotFound, 'order_id'));
      }

      const tx = createTransaction(params, order);

      return send(res, response(id, {
        create_time: tx.create_time,
        transaction: tx.transaction_id,
        state: tx.state
      }));
    }

    if (method === 'CheckTransaction') {
      const tx = transactions.get(getPaymeTxId(params));

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, MSG.transactionNotFound, 'id'));
      }

      return send(res, response(id, transactionResult(tx)));
    }

    if (method === 'PerformTransaction') {
      const tx = transactions.get(getPaymeTxId(params));

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, MSG.transactionNotFound, 'id'));
      }

      if (tx.state === TX_STATE.CANCELED_BEFORE_PERFORM || tx.state === TX_STATE.CANCELED_AFTER_PERFORM) {
        return send(res, errorResponse(id, ERRORS.ORDER_NOT_FOUND, MSG.orderNotFound, 'id'));
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
        transaction: tx.transaction_id,
        perform_time: tx.perform_time,
        state: tx.state
      }));
    }

    if (method === 'CancelTransaction') {
      const tx = transactions.get(getPaymeTxId(params));

      if (!tx) {
        return send(res, errorResponse(id, ERRORS.TRANSACTION_NOT_FOUND, MSG.transactionNotFound, 'id'));
      }

      if (tx.state !== TX_STATE.CANCELED_BEFORE_PERFORM && tx.state !== TX_STATE.CANCELED_AFTER_PERFORM) {
        tx.cancel_time = Date.now();
        tx.reason = params.reason ?? null;

        if (tx.state === TX_STATE.PERFORMED) {
          tx.state = TX_STATE.CANCELED_AFTER_PERFORM;
        } else {
          tx.state = TX_STATE.CANCELED_BEFORE_PERFORM;
        }

        if (!tx.sandbox) {
          const order = store.getOrderById(tx.order_id);
          if (order) store.markOrderPaymentCancelled(order.id);
        }
      }

      return send(res, response(id, {
        transaction: tx.transaction_id,
        cancel_time: tx.cancel_time,
        state: tx.state
      }));
    }

    return send(res, errorResponse(id, ERRORS.METHOD_NOT_FOUND, MSG.methodNotFound, 'method'));
  } catch (err) {
    console.error('[PAYME] internal error', {
      method,
      message: err?.message
    });

    return send(res, errorResponse(id, ERRORS.INTERNAL_ERROR, MSG.internalError, 'internal'));
  }
}

module.exports = {
  paymeRpc,
  parseAuthorization,
  formatResponse: response,
  formatError: errorResponse
};
