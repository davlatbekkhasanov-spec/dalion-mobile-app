const prisma = require('../prisma-client');

const mem = new Map();

function usePrisma() {
  return Boolean(String(process.env.DATABASE_URL || '').trim());
}

function toLegacy(row) {
  if (!row) return null;
  return {
    payme_transaction_id: row.paymeTransactionId,
    order_id: row.orderId,
    amount: row.amount,
    state: row.state,
    reason: row.reason,
    create_time: Number(row.createTime),
    perform_time: Number(row.performTime),
    cancel_time: Number(row.cancelTime),
    sandbox: row.sandbox
  };
}

async function getById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  if (!usePrisma()) return mem.get(key) || null;
  const row = await prisma.paymeTransaction.findUnique({ where: { paymeTransactionId: key } });
  return toLegacy(row);
}

async function getActiveByOrderId(orderId, ignoreTxId = '') {
  const oid = String(orderId || '').trim();
  if (!oid) return null;
  const ign = String(ignoreTxId || '');
  if (!usePrisma()) {
    for (const tx of mem.values()) {
      if (tx.order_id === oid && tx.payme_transaction_id !== ign && Number(tx.state) === 1) return tx;
    }
    return null;
  }
  const row = await prisma.paymeTransaction.findFirst({
    where: {
      orderId: oid,
      state: 1,
      ...(ign ? { paymeTransactionId: { not: ign } } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
  return toLegacy(row);
}

async function upsert(tx) {
  const key = String(tx.payme_transaction_id || '').trim();
  if (!key) throw new Error('missing payme_transaction_id');
  const legacy = {
    payme_transaction_id: key,
    order_id: String(tx.order_id || ''),
    amount: Math.round(Number(tx.amount || 0)),
    state: Number(tx.state ?? 1),
    reason: tx.reason != null ? Number(tx.reason) : null,
    create_time: Number(tx.create_time || 0),
    perform_time: Number(tx.perform_time || 0),
    cancel_time: Number(tx.cancel_time || 0),
    sandbox: Boolean(tx.sandbox)
  };
  if (!usePrisma()) {
    mem.set(key, legacy);
    return legacy;
  }
  const payload = {
    paymeTransactionId: key,
    orderId: legacy.order_id,
    amount: legacy.amount,
    state: legacy.state,
    reason: legacy.reason,
    createTime: BigInt(legacy.create_time || 0),
    performTime: BigInt(legacy.perform_time || 0),
    cancelTime: BigInt(legacy.cancel_time || 0),
    sandbox: legacy.sandbox,
    rawData: {
      payme_transaction_id: key,
      order_id: legacy.order_id,
      amount: legacy.amount,
      state: legacy.state
    }
  };
  const row = await prisma.paymeTransaction.upsert({
    where: { paymeTransactionId: key },
    create: payload,
    update: {
      orderId: payload.orderId,
      amount: payload.amount,
      state: payload.state,
      reason: payload.reason,
      createTime: payload.createTime,
      performTime: payload.performTime,
      cancelTime: payload.cancelTime,
      sandbox: payload.sandbox,
      rawData: payload.rawData
    }
  });
  return toLegacy(row);
}

async function listByPeriod(from, to) {
  const fromMs = Math.max(0, Number(from || 0));
  const toMs = Math.max(0, Number(to || Date.now()));
  if (!usePrisma()) {
    return [...mem.values()].filter(
      (tx) => Number(tx.create_time || 0) >= fromMs && Number(tx.create_time || 0) <= toMs
    );
  }
  const fromB = BigInt(fromMs);
  const toB = BigInt(toMs);
  const rows = await prisma.paymeTransaction.findMany({
    where: {
      createTime: { gte: fromB, lte: toB }
    },
    orderBy: { createTime: 'asc' }
  });
  return rows.map(toLegacy);
}

module.exports = { getById, getActiveByOrderId, upsert, listByPeriod };
