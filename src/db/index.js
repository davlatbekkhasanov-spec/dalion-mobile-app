let pgPool = null;

function isDbEnabled() {
  const enabled = String(process.env.DB_ENABLED || 'false').toLowerCase() === 'true';
  const hasUrl = Boolean(String(process.env.DATABASE_URL || '').trim());
  return enabled && hasUrl;
}

function getPool() {
  if (!isDbEnabled()) return null;
  if (pgPool) return pgPool;
  // Lazy require so app can run without pg/DB in fallback mode.
  // eslint-disable-next-line global-require
  const { Pool } = require('pg');
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pgPool;
}

async function query(sql, params = []) {
  const pool = getPool();
  if (!pool) {
    const err = new Error('Database is disabled');
    err.code = 'DB_DISABLED';
    throw err;
  }
  return pool.query(sql, params);
}

async function close() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

module.exports = {
  isDbEnabled,
  query,
  close
};
