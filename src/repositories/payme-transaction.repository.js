const db = require('../db/index.js');

const mem = new Map();

async function getById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  if (!db.isDbEnabled()) return mem.get(key) || null;
  const out = await db.query('select * from payme_transactions where payme_transaction_id = $1 limit 1', [key]);
  return out.rows[0] || null;
}

async function getActiveByOrderId(orderId, ignoreTxId = '') {
  const oid = String(orderId || '').trim();
  if (!oid) return null;
  if (!db.isDbEnabled()) {
    for (const tx of mem.values()) {
      if (tx.order_id === oid && tx.payme_transaction_id !== ignoreTxId && Number(tx.state) === 1) return tx;
    }
    return null;
  }
  const out = await db.query(
    'select * from payme_transactions where order_id = $1 and state = 1 and payme_transaction_id <> $2 order by created_at desc limit 1',
    [oid, String(ignoreTxId || '')]
  );
  return out.rows[0] || null;
}

async function upsert(tx) {
  const key = String(tx.payme_transaction_id || '').trim();
  if (!db.isDbEnabled()) {
    mem.set(key, { ...tx, payme_transaction_id: key });
    return mem.get(key);
  }
  await db.query(
    `insert into payme_transactions
    (payme_transaction_id, order_id, amount, state, reason, create_time, perform_time, cancel_time, created_at, updated_at, raw_data)
    values ($1,$2,$3,$4,$5,$6,$7,$8, now(), now(), $9)
    on conflict (payme_transaction_id) do update
    set order_id=excluded.order_id, amount=excluded.amount, state=excluded.state, reason=excluded.reason,
        create_time=excluded.create_time, perform_time=excluded.perform_time, cancel_time=excluded.cancel_time,
        updated_at=now(), raw_data=excluded.raw_data`,
    [key, tx.order_id, tx.amount, tx.state, tx.reason ?? null, tx.create_time || 0, tx.perform_time || 0, tx.cancel_time || 0, tx]
  );
  return getById(key);
}

async function listByPeriod(from, to) {
  const fromMs = Number(from || 0);
  const toMs = Number(to || Date.now());
  if (!db.isDbEnabled()) {
    return [...mem.values()].filter((tx) => Number(tx.create_time || 0) >= fromMs && Number(tx.create_time || 0) <= toMs);
  }
  const out = await db.query(
    'select * from payme_transactions where create_time >= $1 and create_time <= $2 order by create_time asc',
    [fromMs, toMs]
  );
  return out.rows;
}

module.exports = { getById, getActiveByOrderId, upsert, listByPeriod };
