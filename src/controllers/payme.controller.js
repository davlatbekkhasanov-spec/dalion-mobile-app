const store = require('../data/store.js');

const PAYME_METHODS = new Set([
  'CheckPerformTransaction',
  'CreateTransaction',
  'PerformTransaction',
  'CancelTransaction',
  'CheckTransaction'
]);

const paymeTransactions = new Map();

const PAYME_ERROR = Object.freeze({
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  ORDER_NOT_FOUND: -31050,
  AMOUNT_INVALID: -31001,
  TRANSACTION_NOT_FOUND: -31003
});

function nowMs() {
  return Date.now();
}

function responseResult(id, result) {
  return { jsonrpc: '2.0', result, id: id ?? null };
}

function responseError(id, code, messages, data = null) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message: {
        ru: messages.ru,
        uz: messages.uz,
        en: messages.en
      },
      data
    },
    id: id ?? null
  };
}

function getOrderByAccount(account = {}) {
  const orderId = String(account.order_id || '').trim();
  if (!orderId) return { error: 'order_id required' };
  const order = store.getOrderByNumber(orderId) || store.getOrderById(orderId);
  if (!order) return { error: 'order not found', orderId };
  return { order, orderId };
}

function isAmountValid(order, amount) {
  if (!Number.isFinite(Number(amount))) return false;
  if (!Number.isFinite(Number(order?.total))) return true;
  return Number(order.total) === Number(amount);
}

exports.paymeHealth = (req, res) => {
  res.json({ ok: true, message: 'Payme endpoint expects POST JSON-RPC' });
};

exports.paymeRpc = (req, res) => {
  const body = req.body || {};
  const { id, method, params = {} } = body;
  console.info('[Payme] RPC request', { id, method });

  if (!method || typeof method !== 'string') {
    return res.json(responseError(id, PAYME_ERROR.INVALID_REQUEST, {
      ru: 'Неверный JSON-RPC запрос',
      uz: 'Noto‘g‘ri JSON-RPC so‘rovi',
      en: 'Invalid JSON-RPC request'
    }));
  }

  if (!PAYME_METHODS.has(method)) {
    return res.json(responseError(id, PAYME_ERROR.METHOD_NOT_FOUND, {
      ru: 'Метод не найден',
      uz: 'Metod topilmadi',
      en: 'Method not found'
    }, method));
  }

  const txId = String(params.id || '').trim();

  if (method === 'CheckPerformTransaction') {
    const { order, error, orderId } = getOrderByAccount(params.account || {});
    if (error) {
      return res.json(responseError(id, PAYME_ERROR.ORDER_NOT_FOUND, {
        ru: 'Заказ не найден',
        uz: 'Buyurtma topilmadi',
        en: 'Order not found'
      }, orderId || 'order_id'));
    }
    if (!isAmountValid(order, params.amount)) {
      return res.json(responseError(id, PAYME_ERROR.AMOUNT_INVALID, {
        ru: 'Неверная сумма',
        uz: 'Noto‘g‘ri summa',
        en: 'Invalid amount'
      }, 'amount'));
    }
    return res.json(responseResult(id, { allow: true }));
  }

  if (method === 'CreateTransaction') {
    const { order, error, orderId } = getOrderByAccount(params.account || {});
    if (error) {
      return res.json(responseError(id, PAYME_ERROR.ORDER_NOT_FOUND, {
        ru: 'Заказ не найден',
        uz: 'Buyurtma topilmadi',
        en: 'Order not found'
      }, orderId || 'order_id'));
    }
    if (!isAmountValid(order, params.amount)) {
      return res.json(responseError(id, PAYME_ERROR.AMOUNT_INVALID, {
        ru: 'Неверная сумма',
        uz: 'Noto‘g‘ri summa',
        en: 'Invalid amount'
      }, 'amount'));
    }
    const existing = paymeTransactions.get(txId);
    if (existing) {
      return res.json(responseResult(id, {
        create_time: existing.create_time,
        transaction: existing.transaction,
        state: existing.state
      }));
    }
    const transaction = {
      transaction: txId,
      orderId,
      amount: Number(params.amount),
      create_time: nowMs(),
      perform_time: 0,
      cancel_time: 0,
      state: 1,
      reason: null
    };
    paymeTransactions.set(txId, transaction);
    return res.json(responseResult(id, {
      create_time: transaction.create_time,
      transaction: transaction.transaction,
      state: transaction.state
    }));
  }

  if (method === 'PerformTransaction') {
    const tx = paymeTransactions.get(txId);
    if (!tx) {
      return res.json(responseError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND, {
        ru: 'Транзакция не найдена',
        uz: 'Tranzaksiya topilmadi',
        en: 'Transaction not found'
      }, txId));
    }
    if (tx.state < 0) {
      return res.json(responseError(id, PAYME_ERROR.INVALID_PARAMS, {
        ru: 'Отмененную транзакцию нельзя выполнить',
        uz: 'Bekor qilingan tranzaksiyani bajarib bo‘lmaydi',
        en: 'Cancelled transaction cannot be performed'
      }, txId));
    }
    tx.state = 2;
    tx.perform_time = tx.perform_time || nowMs();
    store.markOrderPaymentPaid?.(tx.orderId);
    return res.json(responseResult(id, {
      transaction: tx.transaction,
      perform_time: tx.perform_time,
      state: tx.state
    }));
  }

  if (method === 'CancelTransaction') {
    const tx = paymeTransactions.get(txId);
    if (!tx) {
      return res.json(responseError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND, {
        ru: 'Транзакция не найдена',
        uz: 'Tranzaksiya topilmadi',
        en: 'Transaction not found'
      }, txId));
    }
    tx.reason = params.reason ?? null;
    tx.cancel_time = tx.cancel_time || nowMs();
    tx.state = tx.perform_time ? -2 : -1;
    return res.json(responseResult(id, {
      transaction: tx.transaction,
      cancel_time: tx.cancel_time,
      state: tx.state
    }));
  }

  const tx = paymeTransactions.get(txId);
  if (!tx) {
    return res.json(responseError(id, PAYME_ERROR.TRANSACTION_NOT_FOUND, {
      ru: 'Транзакция не найдена',
      uz: 'Tranzaksiya topilmadi',
      en: 'Transaction not found'
    }, txId));
  }
  return res.json(responseResult(id, {
    create_time: tx.create_time,
    perform_time: tx.perform_time,
    cancel_time: tx.cancel_time,
    transaction: tx.transaction,
    state: tx.state,
    reason: tx.reason
  }));
};
