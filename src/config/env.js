const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  });
}

loadDotEnv();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  dalionApiUrl: process.env.DALION_API_URL || '',
  dalionUsername: process.env.DALION_USERNAME || '',
  dalionPassword: process.env.DALION_PASSWORD || '',
  enableDemoLoaders: String(process.env.ENABLE_DEMO_LOADERS || 'false').toLowerCase() === 'true'
};

module.exports = { env };
