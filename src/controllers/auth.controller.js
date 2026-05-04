const otpService = require('../services/otp.service.js');
const store = require('../data/store.js');
const tokenService = require('../services/auth-token.service.js');

exports.requestOtp = async (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const result = await otpService.requestOtp(phone);
  if (result.error) return res.status(400).json({ ok: false, message: result.error });

  const payload = { ok: true, status: 'otp_sent' };
  if (process.env.ALLOW_DEV_OTP === 'true' && result.provider === 'mock' && result.devOtp) payload.devOtp = result.devOtp;
  return res.json(payload);
};

exports.verifyOtp = (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const code = String(req.body?.code || '').trim();
  const verify = otpService.verifyOtp(phone, code);
  if (verify.error) return res.status(400).json({ ok: false, message: verify.error });

  const normalizedPhone = otpService.normalizePhone(phone);
  const existing = store.getUserByPhone(normalizedPhone);
  const user = existing
    ? store.markPhoneVerified(normalizedPhone)
    : store.upsertUser({ phone: normalizedPhone, name: '', address: '', role: 'user', phoneVerified: true, otpVerifiedAt: new Date().toISOString() });
  const token = tokenService.sign(normalizedPhone, user?.role || 'user');
  return res.json({ ok: true, status: 'verified', token, user });
};
