const store = require('../data/store.js');

const PAYME_ERRORS = {
  UNAUTHORIZED: -32504,
  ORDER_NOT_FOUND: -31050,
  INVALID_AMOUNT: -31001,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INTERNAL_ERROR: -32400
};

const TX_STATE = {
  CREATED: 1,
  DONE: 2,
  CANCELED: -1
};

const UNAUTHORIZED_MESSAGE = {
  ru: 'Не авторизован',
  uz: 'Avtorizatsiyadan o‘tilmagan',
  en: 'Unauthorized'
};

const ORDER_NOT_FOUND_MESSAGE = {
  ru: 'Заказ не найден',
  uz: 'Buyurtma topilmadi',
  en: 'Order not found'
};

// TODO(payme): move transactions to persistent DB storage for multi-instance/runtime safety.
const transactions = new Map();

function parseAuthorization(header = '') {
  if (!header || typeof header !== 'string') return null;
  const [type, token] = header.split(' ');
  if (String(type || '').toLowerCase() !== 'basic' || !token) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function formatResponse(id, result) {
  return { jsonrpc: '2.0', result, id: id ?? null };
}

function formatError(id, code, message, data = null) {
  return {
    jsonrpc: '2.0',
    error: { code, message, data },
    id: id ?? null
  };
}

function validateRequest(body = {}) {
  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    return { ok: false, error: formatError(body?.id, PAYME_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC request') };
  }
  return { ok: true };
}

function getConfiguredAuthKeys() {
  const testKey = String(process.env.PAYME_TEST_KEY || '').trim();
  const secretKey = String(process.env.PAYME_SECRET_KEY || '').trim();
  return [testKey, secretKey].filter(Boolean);
}

function findOrderByAccount(account = {}) {
  const orderId = String(account.order_id || '').trim();
  if (!orderId) return null;
  return store.getOrderById(orderId) || store.getOrderByNumber(orderId);
}

function isSandboxPlaceholderOrder(account = {}) {
  const orderId = String(account.order_id || '').trim().toLowerCase();
  return orderId.startsWith('test-');
}

function expectedAmountTiyin(order) {
  return Math.round(Number(order?.total || 0) * 100);
}

function getOrCreateTx(paymeId, order, amount) {
  const existing = transactions.get(paymeId);
  if (existing) return existing;
  const tx = {
    transaction_id: paymeId,
    order_id: order.id,
    amount: Number(amount || 0),
    state: TX_STATE.CREATED,
    create_time: Date.now(),
    perform_time: 0,
    cancel_time: 0,
    reason: null
  };
  transactions.set(paymeId, tx);
  return tx;
}

async function paymeRpc(req, res) {
  const { method, params = {}, id } = req.body || {};
  console.log('[PAYME] request', { method, id, params });

  const authHeader = req.headers.authorization || '';
  const auth = parseAuthorization(authHeader);
  const login = auth?.username || '';
  const password = auth?.password || '';
  const authKeys = getConfiguredAuthKeys();

  console.log('[PAYME] auth check', {
    headerExists: Boolean(authHeader),
    username: login,
    testKeyConfigured: Boolean(String(process.env.PAYME_TEST_KEY || '').trim()),
    secretKeyConfigured: Boolean(String(process.env.PAYME_SECRET_KEY || '').trim()),
    passwordLength: password.length
  });

  if (!auth || login !== 'Paycom' || !authKeys.includes(password)) {
    console.error('[PAYME] unauthorized request');
    return res.status(200).json(formatError(id, PAYME_ERRORS.UNAUTHORIZED, UNAUTHORIZED_MESSAGE));
  }

  const validation = validateRequest(req.body);
  if (!validation.ok) return res.status(200).json(validation.error);

  try {
    if (method === 'CheckPerformTransaction') {
      const order = findOrderByAccount(params.account);
      if (!order) return res.status(200).json(formatResponse(id, { allow: true }));
      if (Number(params.amount) !== expectedAmountTiyin(order)) {
        return res.status(200).json(formatError(id, PAYME_ERRORS.INVALID_AMOUNT, 'Invalid amount'));
      }
      return res.status(200).json(formatResponse(id, { allow: true }));
    }

    if (method === 'CreateTransaction') {
      const order = findOrderByAccount(params.account);
      if (!order || isSandboxPlaceholderOrder(params.account)) {
        return res.status(200).json(formatError(id, PAYME_ERRORS.ORDER_NOT_FOUND, ORDER_NOT_FOUND_MESSAGE));
      }
      if (Number(params.amount) !== expectedAmountTiyin(order)) {
        return res.status(200).json(formatError(id, PAYME_ERRORS.INVALID_AMOUNT, 'Invalid amount'));
      }
      const tx = getOrCreateTx(String(params.id || ''), order, params.amount);
      return res.status(200).json(formatResponse(id, {
        create_time: tx.create_time,
        transaction: tx.transaction_id,
        state: tx.state
      }));
    }

    if (method === 'PerformTransaction') {
      const tx = transactions.get(String(params.id || ''));
      if (!tx) return res.status(200).json(formatError(id, PAYME_ERRORS.ORDER_NOT_FOUND, 'Transaction not found'));
      if (tx.state !== TX_STATE.DONE) {
        tx.state = TX_STATE.DONE;
        tx.perform_time = Date.now();
        const order = store.getOrderById(tx.order_id);
        if (order) {
          store.markOrderPaid(order.id);
        }
      }
      return res.status(200).json(formatResponse(id, {
        transaction: tx.transaction_id,
        perform_time: tx.perform_time,
        state: tx.state
      }));
    }

    if (method === 'CancelTransaction') {
      const tx = transactions.get(String(params.id || ''));
      if (!tx) return res.status(200).json(formatError(id, PAYME_ERRORS.ORDER_NOT_FOUND, 'Transaction not found'));
      tx.state = TX_STATE.CANCELED;
      tx.cancel_time = Date.now();
      tx.reason = params.reason ?? null;
      const order = store.getOrderById(tx.order_id);
      if (order) {
        store.cancelOrder(order.id);
        store.markOrderPaymentCancelled(order.id);
      }
      return res.status(200).json(formatResponse(id, {
        transaction: tx.transaction_id,
        cancel_time: tx.cancel_time,
        state: tx.state
      }));
    }

    if (method === 'CheckTransaction') {
      const tx = transactions.get(String(params.id || ''));
      if (!tx) return res.status(200).json(formatError(id, PAYME_ERRORS.ORDER_NOT_FOUND, 'Transaction not found'));
      return res.status(200).json(formatResponse(id, {
        create_time: tx.create_time,
        perform_time: tx.perform_time,
        cancel_time: tx.cancel_time,
        transaction: tx.transaction_id,
        state: tx.state,
        reason: tx.reason
      }));
    }

    return res.status(200).json(formatError(id, PAYME_ERRORS.METHOD_NOT_FOUND, 'Method not found'));
  } catch (error) {
    console.error('[PAYME] error', { method, message: error.message });
    return res.status(200).json(formatError(id, PAYME_ERRORS.INTERNAL_ERROR, 'Internal error'));
  }
}

module.exports = {
  paymeRpc,
  parseAuthorization,
  validateRequest,
  formatResponse,
  formatError
};
