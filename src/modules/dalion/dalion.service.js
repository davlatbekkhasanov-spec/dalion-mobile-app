function getDalionEnv() {
  return {
    apiUrl: String(process.env.DALION_API_URL || '').trim(),
    username: String(process.env.DALION_USERNAME || '').trim(),
    password: String(process.env.DALION_PASSWORD || '').trim()
  };
}

function isConfigured() {
  const cfg = getDalionEnv();
  return Boolean(cfg.apiUrl && cfg.username && cfg.password);
}

async function fetchDalionProducts() {
  if (!isConfigured()) throw new Error('DALION_NOT_CONFIGURED');
  // TODO: implement real DALION request with secure HTTP client and retries.
  return [];
}

module.exports = { getDalionEnv, isConfigured, fetchDalionProducts };
