const crypto = require('crypto');

const SECRET = () => String(process.env.JWT_SECRET || process.env.AUTH_TOKEN_SECRET || 'dev-secret-change-me');

function sign(phone = '', role = 'user') {
  const payload = `${phone}|${role}|${Date.now()}`;
  const sig = crypto.createHmac('sha256', SECRET()).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function verify(token = '') {
  try {
    const raw = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const [phone, role, ts, sig] = raw.split('|');
    const expected = crypto.createHmac('sha256', SECRET()).update(`${phone}|${role}|${ts}`).digest('hex');
    if (expected !== sig) return null;
    return { phone, role };
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
