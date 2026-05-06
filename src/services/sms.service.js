const provider = String(process.env.SMS_PROVIDER || 'mock').trim().toLowerCase() || 'mock';

async function sendOtp(phone = '', code = '') {
  const normalizedPhone = String(phone || '').trim();
  const normalizedCode = String(code || '').trim();
  if (!normalizedPhone || !normalizedCode) {
    return { ok: false, provider, message: 'phone and code required' };
  }

  if (provider === 'mock') {
    return {
      ok: true,
      provider,
      devOtp: normalizedCode,
      message: 'Mock SMS mode: OTP is not sent to real provider'
    };
  }

  // Future provider integration point (Eskiz/Playmobile/etc.)
  // Keep non-blocking for now until provider adapter is implemented.
  return {
    ok: true,
    provider,
    message: 'SMS provider is configured but adapter is not connected yet'
  };
}

module.exports = {
  provider,
  sendOtp
};
