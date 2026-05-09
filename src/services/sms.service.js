const DEVSMS_DEFAULT_URL = 'https://devsms.uz/api/send_sms.php';

const gatewayMode = () => {
  const raw = String(process.env.SMS_GATEWAY_MODE || process.env.SMS_PROVIDER || 'log').trim().toLowerCase();
  if (raw === 'mock') return 'log';
  const normalized = ['log', 'twilio', 'eskiz', 'generic', 'devsms'].includes(raw) ? raw : 'log';
  if (normalized === 'devsms') {
    const key = String(process.env.DEVSMS_API_KEY || process.env.SMS_API_KEY || '').trim();
    if (!key) return 'log';
  }
  return normalized;
};

function shouldLogOtpPlaintext() {
  return String(process.env.SMS_LOG_OTP_CODE || '').toLowerCase() === 'true';
}

function logSms(phone, code, extra = {}) {
  console.info('[SMS_GATEWAY_MODE=log]', {
    to: phone,
    ...extra,
    otp: shouldLogOtpPlaintext() ? code : '[REDACTED]'
  });
}

async function sendViaTwilio(phone, code) {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = String(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM || '').trim();
  if (!sid || !token || !from) {
    return { ok: false, message: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER kerak' };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: String(process.env.SMS_TWILIO_BODY_TEMPLATE || 'GlobusMarket tasdiqlash kodi: {{code}}').replace(/\{\{code\}\}/g, code)
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, message: `Twilio xato: ${res.status}`, detail: text.slice(0, 200) };
  }
  return { ok: true };
}

async function sendViaGeneric(phone, code) {
  const url = String(process.env.SMS_API_URL || '').trim();
  const key = String(process.env.SMS_API_KEY || '').trim();
  const sender = String(process.env.SMS_SENDER || '').trim();
  if (!url) {
    return { ok: false, message: 'SMS_API_URL majburiy (generic rejim)' };
  }
  const message = String(process.env.SMS_MESSAGE_TEMPLATE || 'Tasdiqlash kodi: {{code}}').replace(/\{\{code\}\}/g, code);
  const payloadRaw = String(process.env.SMS_REQUEST_BODY_TEMPLATE || '').trim();
  let bodyObj;
  if (payloadRaw) {
    try {
      bodyObj = JSON.parse(
        payloadRaw
          .replace(/\{\{phone\}\}/g, phone)
          .replace(/\{\{code\}\}/g, code)
          .replace(/\{\{sender\}\}/g, sender)
          .replace(/\{\{message\}\}/g, message)
      );
    } catch (_) {
      return { ok: false, message: 'SMS_REQUEST_BODY_TEMPLATE JSON emas' };
    }
  } else {
    bodyObj = { phone, code, sender, message };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (key) {
    const headerName = String(process.env.SMS_API_KEY_HEADER || 'Authorization').trim();
    const prefix = String(process.env.SMS_API_KEY_PREFIX || 'Bearer ').trim();
    headers[headerName] = prefix ? `${prefix}${key}` : key;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyObj) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, message: `SMS API xato: ${res.status}`, detail: text.slice(0, 200) };
  }
  return { ok: true };
}

async function sendViaEskiz(phone, code) {
  if (!String(process.env.SMS_API_URL || '').trim()) {
    return {
      ok: false,
      message: 'Eskiz rejimi hozircha SMS_API_URL orqali generic HTTP yuborishni ishlatadi (provayder REST ni sozlang)'
    };
  }
  return sendViaGeneric(phone, code);
}

function devsmsPhoneDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('998') && d.length >= 12) return d.slice(0, 12);
  const nine = d.length >= 9 ? d.slice(-9) : '';
  if (/^[1-9]\d{8}$/.test(nine)) return `998${nine}`;
  return '';
}

async function sendViaDevsms(phone, code) {
  const apiKey = String(process.env.DEVSMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  const url = String(process.env.DEVSMS_API_URL || DEVSMS_DEFAULT_URL).trim();
  const from = String(process.env.DEVSMS_SENDER_FROM || process.env.SMS_SENDER || '4546').trim();
  const callbackUrl = String(process.env.DEVSMS_CALLBACK_URL || '').trim();
  if (!apiKey) {
    return { ok: false, message: 'DEVSMS_API_KEY yoki SMS_API_KEY kerak' };
  }
  const phoneDigits = devsmsPhoneDigits(phone);
  if (!phoneDigits) {
    return { ok: false, message: 'Telefon raqami noto‘g‘ri (DevSMS)' };
  }
  const message = String(
    process.env.DEVSMS_OTP_MESSAGE_TEMPLATE ||
      process.env.SMS_MESSAGE_TEMPLATE ||
      'GlobusMarket: tasdiqlash kodi {{code}}. Uni boshqalarga bermang.'
  ).replace(/\{\{code\}\}/g, code);
  const body = {
    phone: phoneDigits,
    message,
    from: from || '4546'
  };
  if (callbackUrl) body.callback_url = callbackUrl;
  const smsType = String(process.env.DEVSMS_SMS_TYPE || '').trim();
  if (smsType) body.type = smsType;

  // DevSMS (devsms.uz/api/docs.php): Bearer token in Authorization on every request.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success !== true) {
    const msg = data.message || data.error || `DevSMS xato: ${res.status}`;
    return {
      ok: false,
      message: typeof msg === 'string' ? msg.slice(0, 220) : 'SMS yuborilmadi',
      detail: JSON.stringify(data).slice(0, 240)
    };
  }
  return { ok: true };
}

async function sendSmsOtp(phone, code) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedCode = String(code || '').trim();
  if (!normalizedPhone || !normalizedCode) {
    return { ok: false, message: 'phone va code kerak' };
  }
  const mode = gatewayMode();
  try {
    if (mode === 'log') {
      logSms(normalizedPhone, normalizedCode);
      return { ok: true, provider: 'log' };
    }
    if (mode === 'twilio') return { ...(await sendViaTwilio(normalizedPhone, normalizedCode)), provider: mode };
    if (mode === 'eskiz') return { ...(await sendViaEskiz(normalizedPhone, normalizedCode)), provider: mode };
    if (mode === 'generic') return { ...(await sendViaGeneric(normalizedPhone, normalizedCode)), provider: mode };
    if (mode === 'devsms') return { ...(await sendViaDevsms(normalizedPhone, normalizedCode)), provider: mode };
    logSms(normalizedPhone, normalizedCode);
    return { ok: true, provider: 'log' };
  } catch (error) {
    return { ok: false, message: error?.message || String(error), provider: mode };
  }
}

module.exports = {
  gatewayMode,
  sendSmsOtp
};
